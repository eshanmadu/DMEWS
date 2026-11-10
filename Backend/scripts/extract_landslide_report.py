import json
import re
import sys
from pathlib import Path


DISTRICTS = [
    "Ampara",
    "Anuradhapura",
    "Badulla",
    "Batticaloa",
    "Colombo",
    "Galle",
    "Gampaha",
    "Hambantota",
    "Jaffna",
    "Kalutara",
    "Kandy",
    "Kegalle",
    "Kilinochchi",
    "Kurunegala",
    "Mannar",
    "Matale",
    "Matara",
    "Monaragala",
    "Mullaitivu",
    "Nuwara Eliya",
    "Polonnaruwa",
    "Puttalam",
    "Ratnapura",
    "Trincomalee",
    "Vavuniya",
]


def extract_with_pymupdf(path):
    try:
        import pymupdf
    except ImportError:
        import fitz as pymupdf

    document = pymupdf.open(path)
    text = "\n".join(page.get_text() for page in document)
    if len(text.strip()) < 120:
        raise ValueError("PyMuPDF returned too little text")
    blocks = [page.get_text("blocks") for page in document]
    return text, "pymupdf", blocks


def extract_with_pdfplumber(path):
    import pdfplumber

    with pdfplumber.open(path) as document:
        text = "\n".join(page.extract_text() or "" for page in document)
    if len(text.strip()) < 120:
        raise ValueError("pdfplumber returned too little text")
    return text, "pdfplumber", None


def extract_with_ocr(path):
    try:
        import pymupdf
    except ImportError:
        import fitz as pymupdf
    import pytesseract
    from PIL import Image

    document = pymupdf.open(path)
    pages = []
    for page in document:
        pixels = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
        image = Image.frombytes("RGB", [pixels.width, pixels.height], pixels.samples)
        pages.append(pytesseract.image_to_string(image))
    text = "\n".join(pages)
    if len(text.strip()) < 120:
        raise ValueError("OCR returned too little text")
    return text, "ocr", None


def extract_text(path):
    errors = []
    for extractor in (extract_with_pymupdf, extract_with_pdfplumber, extract_with_ocr):
        try:
            return extractor(path)
        except Exception as error:  # noqa: BLE001 - each extractor is an intentional fallback
            errors.append(f"{extractor.__name__}: {error}")
    raise RuntimeError("; ".join(errors))


def clean_area_text(value):
    value = re.sub(r"Divisional Secretariat.*", "", value, flags=re.IGNORECASE | re.DOTALL)
    return re.sub(r"\s+", " ", value).strip(" ,;\n")


def area_names(value):
    return [
        clean_area_text(part)
        for part in re.split(r"\s+\band\b\s+|,\s*", value)
        if clean_area_text(part)
    ]


def parse_report(text, blocks=None):
    if blocks:
        warnings = parse_table_blocks(blocks)
    else:
        warnings = []
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    district_indices = [
        (index, district)
        for index, line in enumerate(lines)
        for district in DISTRICTS
        if line.casefold() == district.casefold()
    ]
    if not warnings:
        for position, (start, district) in enumerate(district_indices):
            end = district_indices[position + 1][0] if position + 1 < len(district_indices) else len(lines)
            section = lines[start + 1 : end]
            divisions = [
                line for line in section
                if line and not re.search(
                    r"divisional secretariat|surrounding areas|note:|special note:|previous message",
                    line,
                    re.IGNORECASE,
                )
            ]
            if divisions:
                warnings.append({"district": district, "level": 1, "divisions": area_names(" ".join(divisions))})

    message_id = re.search(r"Message ID:\s*([A-Z0-9-]+)", text, re.IGNORECASE)
    validity = re.search(
        r"Validity Period:\s*(.+?)(?:\n\n|\nLocations for Potential Risk)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    return {
        "messageId": message_id.group(1) if message_id else None,
        "validity": re.sub(r"\s+", " ", validity.group(1)).strip() if validity else None,
        "warnings": warnings,
    }


def parse_table_blocks(pages):
    warnings = []
    for blocks in pages:
        district_blocks = [
            block for block in blocks
            if block[0] < 100 and block[4].strip().casefold() in {district.casefold() for district in DISTRICTS}
        ]
        if not district_blocks:
            continue
        district_blocks.sort(key=lambda block: block[1])
        by_district = {block[4].strip().casefold(): {1: [], 2: [], 3: []} for block in district_blocks}
        for block in blocks:
            x0, y0, _x1, y1, value = block[:5]
            level = 1 if 90 <= x0 < 230 else 2 if 230 <= x0 < 340 else 3 if 340 <= x0 < 490 else 0
            if not level or not value.strip():
                continue
            district_block = min(district_blocks, key=lambda item: abs(item[1] - ((y0 + y1) / 2)))
            area = clean_area_text(value)
            if area:
                by_district[district_block[4].strip().casefold()][level].append(area)

        for district_block in district_blocks:
            district = district_block[4].strip()
            district = next(item for item in DISTRICTS if item.casefold() == district.casefold())
            by_level = by_district[district.casefold()]
            for level, areas in by_level.items():
                if areas:
                    warnings.append(
                        {
                            "district": district,
                            "level": level,
                            "divisions": area_names(" ".join(areas)),
                        }
                    )
    return warnings


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: extract_landslide_report.py <pdf>")
    sys.stdout.reconfigure(encoding="utf-8")
    text, method, blocks = extract_text(Path(sys.argv[1]))
    result = parse_report(text, blocks)
    result["extractionMethod"] = method
    result["textPreview"] = text[:2000]
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
