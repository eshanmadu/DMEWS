"""DMEWS face matching service (InsightFace / ArcFace).

This service returns ranked potential matches only. It never makes an identity
claim. The InsightFace dependency is deliberately required at runtime so an
unconfigured deployment reports unavailable instead of returning fabricated
matches.

Pipeline: RetinaFace-family detection (SCRFD) -> 5-point alignment -> ArcFace
512-dimensional L2-normalised embedding -> cosine similarity.

Endpoints
- GET  /health   service and model status
- POST /embed    one image -> every detected face with embedding and quality

The Node backend stores the embeddings and compares them (Backend/src/services/matching.js).
"""

from __future__ import annotations

import base64
import io
import os
from threading import Lock
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

try:
    from insightface.app import FaceAnalysis
except ImportError:  # pragma: no cover - exercised by deployment configuration
    FaceAnalysis = None


MODEL_NAME = os.getenv("INSIGHTFACE_MODEL", "buffalo_l")
MODEL_ROOT = os.path.expanduser(os.getenv("INSIGHTFACE_ROOT", "~/.insightface"))
DETECTION_SIZE = int(os.getenv("FACE_DETECTION_SIZE", "640"))
EMBEDDING_DIM = 512
MIN_DETECTION_SCORE = float(os.getenv("FACE_MIN_DETECTION_SCORE", "0.50"))
MIN_FACE_PIXELS = int(os.getenv("FACE_MIN_FACE_PIXELS", "60"))
MAX_IMAGE_DIMENSION = 1600

app = FastAPI(title="DMEWS Face Recognition Service", version="2.0.0")

_engine: Any = None
_engine_error = ""
_engine_lock = Lock()
# ONNX Runtime sessions are shared; serialise inference to keep memory bounded.
_inference_lock = Lock()


class EmbedRequest(BaseModel):
    imageBase64: str = Field(min_length=1)
    imageMimeType: str = "image/jpeg"


# --------------------------------------------------------------------------
# Model and image handling
# --------------------------------------------------------------------------

def get_engine() -> Any:
    """Load the InsightFace model pack once. Returns None when unavailable."""
    global _engine, _engine_error
    if FaceAnalysis is None:
        _engine_error = "InsightFace is not installed on the analysis service."
        return None
    with _engine_lock:
        if _engine is None and not _engine_error:
            try:
                engine = FaceAnalysis(
                    name=MODEL_NAME,
                    root=MODEL_ROOT,
                    providers=["CPUExecutionProvider"],
                    allowed_modules=["detection", "landmark_3d_68", "genderage", "recognition"],
                )
                engine.prepare(ctx_id=-1, det_size=(DETECTION_SIZE, DETECTION_SIZE))
                _engine = engine
            except Exception as error:  # model download or ONNX load failure
                _engine_error = f"Face model failed to load: {error}"
        return _engine


@app.on_event("startup")
def warm_up() -> None:
    get_engine()


def decode_image(value: str) -> bytes:
    if "," in value and value.strip().lower().startswith("data:"):
        value = value.split(",", 1)[1]
    try:
        return base64.b64decode(value, validate=True)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid image data.")


def load_normalized_image(raw: bytes) -> np.ndarray:
    """EXIF-upright RGB array, longest side capped at MAX_IMAGE_DIMENSION."""
    with Image.open(io.BytesIO(raw)) as image:
        normalized = ImageOps.exif_transpose(image).convert("RGB")
        if max(normalized.size) > MAX_IMAGE_DIMENSION:
            scale = MAX_IMAGE_DIMENSION / max(normalized.size)
            normalized = normalized.resize(
                (max(1, round(normalized.width * scale)), max(1, round(normalized.height * scale))),
                Image.Resampling.LANCZOS,
            )
        return np.asarray(normalized)


def sharpness(gray: np.ndarray) -> float:
    """Variance of a 4-neighbour Laplacian; low values indicate blur."""
    if gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0
    g = gray.astype(np.float32)
    lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(lap.var())


def describe_face(face: Any, rgb: np.ndarray) -> dict[str, Any]:
    x1, y1, x2, y2 = (float(v) for v in face.bbox)
    width, height = max(0.0, x2 - x1), max(0.0, y2 - y1)
    h, w = rgb.shape[:2]
    crop = rgb[max(0, int(y1)):min(h, int(y2)), max(0, int(x1)):min(w, int(x2))]
    gray = crop.mean(axis=2) if crop.size else np.zeros((1, 1))
    blur_score = sharpness(gray)
    brightness = float(gray.mean()) if crop.size else 0.0

    pose = getattr(face, "pose", None)
    pitch, yaw, roll = (float(v) for v in pose) if pose is not None else (None, None, None)

    warnings = []
    if float(face.det_score) < MIN_DETECTION_SCORE:
        warnings.append("low_detection_confidence")
    if min(width, height) < MIN_FACE_PIXELS:
        warnings.append("small_face")
    if blur_score < 40:
        warnings.append("blurry")
    if brightness < 50:
        warnings.append("too_dark")
    elif brightness > 215:
        warnings.append("overexposed")
    if yaw is not None and abs(yaw) > 45:
        warnings.append("turned_away")
    if pitch is not None and abs(pitch) > 35:
        warnings.append("tilted")

    sex = getattr(face, "sex", None)
    age = getattr(face, "age", None)
    return {
        "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
        "detectionScore": round(float(face.det_score), 4),
        "quality": {
            "faceWidthPx": round(width, 1),
            "faceHeightPx": round(height, 1),
            "sharpness": round(blur_score, 1),
            "brightness": round(brightness, 1),
            "yaw": None if yaw is None else round(yaw, 1),
            "pitch": None if pitch is None else round(pitch, 1),
            "roll": None if roll is None else round(roll, 1),
            "warnings": warnings,
            "usable": "low_detection_confidence" not in warnings and "small_face" not in warnings,
        },
        "estimatedAge": None if age is None else int(age),
        "estimatedSex": {"M": "male", "F": "female"}.get(str(sex), None) if sex is not None else None,
    }


def analyse_image(rgb: np.ndarray) -> list[tuple[np.ndarray, dict[str, Any]]]:
    """Detect faces; return (embedding, description) sorted largest face first."""
    engine = get_engine()
    if engine is None:
        return []
    bgr = np.ascontiguousarray(rgb[:, :, ::-1])
    with _inference_lock:
        faces = engine.get(bgr)
    results = []
    for face in faces:
        embedding = getattr(face, "normed_embedding", None)
        if embedding is None:
            continue
        results.append((np.asarray(embedding, dtype=np.float32), describe_face(face, rgb)))
    results.sort(
        key=lambda item: (item[1]["bbox"][2] - item[1]["bbox"][0]) * (item[1]["bbox"][3] - item[1]["bbox"][1]),
        reverse=True,
    )
    return results


def dominant_face(faces: list[tuple[np.ndarray, dict[str, Any]]]) -> tuple[np.ndarray | None, str]:
    """Pick the reference face: the only face, or one clearly larger than the rest."""
    if not faces:
        return None, "no_face"
    if len(faces) == 1:
        return faces[0][0], "ok"

    def area(item: tuple[np.ndarray, dict[str, Any]]) -> float:
        x1, y1, x2, y2 = item[1]["bbox"]
        return (x2 - x1) * (y2 - y1)

    if area(faces[0]) >= 2.5 * area(faces[1]):
        return faces[0][0], "ok"
    return None, "multiple_faces"


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@app.get("/health")
def health() -> dict[str, Any]:
    engine = get_engine()
    return {
        "ok": True,
        "faceRecognitionConfigured": engine is not None,
        "engine": "insightface",
        "model": MODEL_NAME,
        "embeddingDim": EMBEDDING_DIM,
        "error": _engine_error or None,
    }


@app.post("/embed")
def embed(request: EmbedRequest) -> dict[str, Any]:
    if get_engine() is None:
        return {"status": "unavailable", "faces": [], "message": _engine_error}
    try:
        rgb = load_normalized_image(decode_image(request.imageBase64))
    except (OSError, ValueError):
        raise HTTPException(status_code=400, detail="The image could not be decoded.")
    faces = analyse_image(rgb)
    _, reference_status = dominant_face(faces)
    return {
        "status": "completed",
        "model": MODEL_NAME,
        "embeddingDim": EMBEDDING_DIM,
        "imageDimensions": {"width": int(rgb.shape[1]), "height": int(rgb.shape[0])},
        "faceCount": len(faces),
        "primaryFaceIndex": 0 if reference_status == "ok" else None,
        "referenceStatus": reference_status,
        "faces": [
            {**info, "index": index, "embedding": [round(float(v), 6) for v in embedding]}
            for index, (embedding, info) in enumerate(faces)
        ],
    }
