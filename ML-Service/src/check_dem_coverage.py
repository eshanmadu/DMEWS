"""Compare connected HydroBASINS polygons with the existing DEM footprint.

Run: ML-Service/.venv/bin/python ML-Service/src/check_dem_coverage.py
This checks an existing reference network; it does not delineate a DEM watershed.
"""

from collections import defaultdict
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path as PlotPath
from matplotlib.patches import PathPatch, Patch, Rectangle
import numpy as np
import rasterio
from rasterio.crs import CRS
import shapefile


ROOT = Path(__file__).resolve().parents[1]
RATNAPURA = (80.394167, 6.678333)  # longitude, latitude
ELLAGAWA = (80.210000, 6.731944)


def contains_point(shape, point):
    """Use pyshp's ring grouping, then exclude holes from each polygon."""
    geometry = shape.__geo_interface__
    polygons = ([geometry["coordinates"]] if geometry["type"] == "Polygon"
                else geometry["coordinates"])
    return any(
        PlotPath(polygon[0]).contains_point(point)
        and not any(PlotPath(hole).contains_point(point) for hole in polygon[1:])
        for polygon in polygons
    )


def polygon_patch(shape, color, label=None):
    """A compound path preserves shapefile exterior/hole winding when filled.

    Shapefile exteriors are clockwise and holes counterclockwise. Keeping their
    opposite directions makes the nonzero fill rule leave holes unfilled.
    Parts are rings, not automatically independent polygons.
    """
    ends = list(shape.parts[1:]) + [len(shape.points)]
    vertices, codes = [], []
    for start, end in zip(shape.parts, ends):
        ring = list(shape.points[start:end])
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        vertices.extend(ring)
        codes.extend([PlotPath.MOVETO] + [PlotPath.LINETO] * (len(ring) - 2)
                     + [PlotPath.CLOSEPOLY])
    return PathPatch(PlotPath(vertices, codes), facecolor=color, edgecolor="0.3",
                     linewidth=0.6, alpha=0.65, label=label)


def main():
    shp = ROOT / "data/raw/hydrobasins/hybas_as_lev12_v1c.shp"
    dem_path = ROOT / "data/raw/dem/Copernicus_DSM_COG_10_N06_00_E080_00_DEM.tif"
    output = ROOT / "outputs/dem_coverage_check.png"
    reference_crs = CRS.from_wkt(shp.with_suffix(".prj").read_text())
    with rasterio.open(dem_path) as dem:
        if (reference_crs.to_epsg() != 4326 or dem.crs is None
                or dem.crs.to_epsg() != 4326):
            raise ValueError("Expected both datasets in EPSG:4326.")
        bounds = dem.bounds

    # Definitions verified against HydroBASINS Technical Documentation v1.c,
    # section 3.2: HYBAS_ID = unique polygon ID; NEXT_DOWN = next downstream
    # polygon ID (0 means no connection); SUB_AREA and UP_AREA are in km².
    # https://data.hydrosheds.org/file/technical-documentation/HydroBASINS_TechDoc_v1c.pdf
    with shapefile.Reader(str(shp)) as reader:
        records, upstream = {}, defaultdict(list)
        for record in reader.iterRecords():
            row = record.as_dict()
            basin_id = int(row["HYBAS_ID"])
            if basin_id in records:
                raise ValueError("Duplicate HYBAS_ID")
            records[basin_id] = (record.oid, row)
            # Exclude virtual links from endorheic sinks.
            if int(row["NEXT_DOWN"]) and int(row["ENDO"]) != 2:
                upstream[int(row["NEXT_DOWN"])].append(basin_id)

        x, y = RATNAPURA
        candidates = list(reader.iterShapes(bbox=(x - 1e-8, y - 1e-8,
                                                 x + 1e-8, y + 1e-8)))
        matches = [s for s in candidates if contains_point(s, RATNAPURA)]
        if len(matches) != 1:
            raise ValueError("Gauge does not have one unambiguous containing polygon.")
        target = int(reader.record(matches[0].oid)["HYBAS_ID"])

        # Reverse NEXT_DOWN links across the full Asia table, not a local box.
        selected, pending = set(), [target]
        while pending:
            current = pending.pop()
            if current in selected:
                raise ValueError("Cycle or duplicate upstream path in reference network.")
            selected.add(current)
            pending.extend(upstream[current])
        rows = [records[i][1] for i in selected]
        shapes = {i: reader.shape(records[i][0]) for i in selected}

    total = sum(float(row["SUB_AREA"]) for row in rows)
    containing = records[target][1]
    coordinates = np.concatenate([np.asarray(s.points) for s in shapes.values()])
    xmin, ymin = coordinates.min(axis=0)
    xmax, ymax = coordinates.max(axis=0)
    crossings = {
        "west": xmin < bounds.left, "east": xmax > bounds.right,
        "south": ymin < bounds.bottom, "north": ymax > bounds.top,
    }
    print(f"pyshp {shapefile.__version__}; reference CRS: {reference_crs}")
    print(f"Containing polygon: {target}; NEXT_DOWN: {containing['NEXT_DOWN']}")
    print(f"Selected {len(selected)} connected polygons, including containing polygon")
    print(f"IDs: {sorted(selected)}")
    print(f"SUB_AREA sum: {total:.1f} km²; target UP_AREA: {containing['UP_AREA']:.1f} km²")
    print(f"Containing polygon alone: {containing['SUB_AREA']:.1f} km²")
    print(f"Other connected polygons: {total - containing['SUB_AREA']:.1f} km²")
    print(f"Difference from 603 km²: {total - 603:+.1f} km² ({(total / 603 - 1) * 100:+.1f}%)")
    print(f"Reference bounds (west,south,east,north): {xmin}, {ymin}, {xmax}, {ymax}")
    print(f"Crosses DEM edges: {crossings}")
    print("Gauge-containing polygon is not an exact gauge catchment. Its upstream")
    print("tributaries can join below the gauge; excluding that polygon is not a")
    print("guaranteed lower bound. Coarse geometry and channel matching remain uncertain.")

    fig, ax = plt.subplots(figsize=(10, 9))
    for basin_id, shape in shapes.items():
        ax.add_patch(polygon_patch(shape, "orange" if basin_id == target else "skyblue"))
    ax.add_patch(Rectangle((bounds.left, bounds.bottom), bounds.right - bounds.left,
                           bounds.top - bounds.bottom, fill=False, edgecolor="crimson",
                           linestyle="--", linewidth=2))
    for name, point in [("Ratnapura gauge", RATNAPURA), ("Ellagawa gauge", ELLAGAWA)]:
        ax.scatter(*point, color="black", s=35, zorder=5)
        ax.annotate(name, point, xytext=(8, -16), textcoords="offset points",
                    bbox=dict(facecolor="white", alpha=0.9, edgecolor="none"))
    ax.set_xlim(min(bounds.left, xmin, ELLAGAWA[0]) - 0.04,
                max(bounds.right, xmax) + 0.04)
    ax.set_ylim(min(bounds.bottom, ymin) - 0.04, max(bounds.top, ymax) + 0.04)
    ax.set_aspect(1 / np.cos(np.deg2rad(RATNAPURA[1])))
    ax.set_xlabel("Longitude (°E)")
    ax.set_ylabel("Latitude (°N)")
    ax.set_title("Ratnapura: HydroBASINS reference and DEM coverage")
    ax.grid(alpha=0.2)
    ax.legend(handles=[Patch(facecolor="skyblue", label="Connected upstream polygons"),
                       Patch(facecolor="orange", label="Gauge-containing polygon (approximate)"),
                       Patch(facecolor="none", edgecolor="crimson", linestyle="--",
                             label="Existing DEM footprint")], loc="lower right")
    fig.text(0.5, 0.035,
             f"Reference polygon-outlet area: {total:.1f} km²; published gauge area: 603 km².\n"
             "HydroBASINS v1.c, 15-arc-second source. Not a DEM-delineated gauge catchment.\n"
             "Source: HydroSHEDS; Lehner & Grill (2013). Coverage is a reference check only.",
             ha="center", fontsize=9)
    fig.tight_layout(rect=(0, 0.10, 1, 1))
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, dpi=180)
    plt.close(fig)
    print(f"Saved: {output}")


if __name__ == "__main__":
    main()
