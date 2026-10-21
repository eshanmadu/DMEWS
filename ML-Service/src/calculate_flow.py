"""Condition the working DEM and calculate D8 contributing-cell counts.

macOS: ML-Service/.venv/bin/python ML-Service/src/calculate_flow.py
Windows PowerShell:
    & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\calculate_flow.py
No snapping or catchment extraction is performed.
"""

from pathlib import Path
import gc
import sys
import time

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm
import numpy as np
import rasterio
from rasterio.plot import plotting_extent
from rasterio.warp import transform
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
from scipy.ndimage import binary_erosion


def main():
    started = time.perf_counter()
    root = Path(__file__).resolve().parents[1]
    source = root / "data/processed/dem_kalu_utm44n_30m.tif"
    direction_path = root / "data/processed/flow_direction_d8.tif"
    accumulation_path = root / "data/processed/flow_accumulation_d8.tif"
    preview = root / "outputs/flow_accumulation_map.png"
    for path in (direction_path, accumulation_path, preview):
        if path.exists():
            raise FileExistsError(f"Preserving existing output: {path}")

    with rasterio.open(source) as dataset:
        if dataset.crs.to_epsg() != 32644 or dataset.res != (30, 30):
            raise ValueError("Expected EPSG:32644 and 30 m pixels.")
        profile = dataset.profile.copy()
        elevations = dataset.read(1).astype("float64")
        valid = (dataset.read_masks(1) != 0) & np.isfinite(elevations)
        affine, crs = dataset.transform, dataset.crs
        xs, ys = transform("EPSG:4326", crs, [80.394167], [6.678333])
        gauge = (xs[0], ys[0])
        gauge_row, gauge_col = dataset.index(*gauge)
        if not (0 <= gauge_row < dataset.height and 0 <= gauge_col < dataset.width
                and valid[gauge_row, gauge_col]):
            raise ValueError("Ratnapura gauge is not inside valid coverage.")

    nodata = np.float64(-9999)
    elevations[~valid] = nodata
    view = ViewFinder(affine=affine, shape=elevations.shape, crs=crs, nodata=nodata)
    terrain = Raster(elevations, viewfinder=view)
    del elevations
    grid = Grid(viewfinder=view)

    # Pysheds 0.5 priority-flood uses the first/last valid cells along rows and
    # columns as open boundary seeds. Invalid border cells are never terrain.
    print("Filling pits...", flush=True)
    filled = grid.fill_pits(terrain)
    del terrain
    gc.collect()
    print("Filling depressions...", flush=True)
    filled = grid.fill_depressions(filled)

    # resolve_flats does not consistently exclude NoData in all its operations.
    # A high barrier stops the -9999 border acting as a low outlet during flat
    # resolution. Restore explicit NoData before D8, which skips those cells.
    filled[~valid] = filled[valid].max() + 100
    print("Resolving flats...", flush=True)
    conditioned = grid.resolve_flats(filled)
    del filled
    conditioned[~valid] = nodata
    if not np.isfinite(conditioned[valid]).all():
        raise ValueError("Conditioned terrain contains invalid elevations.")
    gc.collect()

    dirmap = (64, 128, 1, 2, 4, 8, 16, 32)  # N NE E SE S SW W NW
    print("Calculating D8 directions...", flush=True)
    direction = grid.flowdir(conditioned, routing="d8", dirmap=dirmap, nodata_out=0)
    del conditioned
    gc.collect()
    assert np.all(direction[~valid] == 0)
    assert np.isin(direction[valid], list(dirmap) + [-1, -2]).all()

    # Confirm no routed valid cell points into an invalid neighbour.
    for code, (dr, dc) in zip(dirmap, [(-1, 0), (-1, 1), (0, 1), (1, 1),
                                      (1, 0), (1, -1), (0, -1), (-1, -1)]):
        rows, cols = np.nonzero((direction == code) & valid)
        rr, cc = rows + dr, cols + dc
        assert ((rr >= 0) & (rr < valid.shape[0]) & (cc >= 0) & (cc < valid.shape[1])).all()
        assert valid[rr, cc].all(), "A flow direction points into NoData"
    del rows, cols, rr, cc
    edge = valid & ~binary_erosion(valid, structure=np.ones((3, 3)), border_value=0)
    terminals = valid & (direction < 0)
    print(f"Terminal cells: edge={np.count_nonzero(terminals & edge):,}; "
          f"interior={np.count_nonzero(terminals & ~edge):,}", flush=True)
    print("Direction codes: -1=unresolved flat; -2=no lower valid neighbour; 0=NoData")

    profile.update(dtype="int16", nodata=0, compress="deflate", predictor=1)
    with rasterio.open(direction_path, "w", **profile) as output:
        output.write(np.asarray(direction).astype("int16"), 1)
        output.update_tags(D8_mapping="N64 NE128 E1 SE2 S4 SW8 W16 NW32",
                           terminal_codes="-1 flat; -2 pit/boundary terminal",
                           boundary_policy="NoData neighbours excluded; no padding")

    # Accumulation includes each valid cell itself; terminal valid cells still
    # contribute one. Pysheds may replace terminal codes internally with zero.
    print("Calculating D8 accumulation...", flush=True)
    accumulation = grid.accumulation(direction, routing="d8", dirmap=dirmap)
    del direction, terminals, edge
    gc.collect()
    values = accumulation[valid]
    assert np.isfinite(values).all() and (values >= 1).all()
    assert (accumulation[~valid] == 0).all()
    maximum = float(values.max())
    area = maximum * abs(affine.a * affine.e - affine.b * affine.d) / 1e6
    del values
    print(f"Maximum accumulation: {maximum:,.0f} cells; approximate area={area:.3f} km²")
    print(f"Unsnapped gauge-cell accumulation: {accumulation[gauge_row, gauge_col]:,.0f} cells")
    print("Counts represent contributing terrain, NOT observed river discharge.")
    profile.update(dtype="float64", nodata=0, predictor=3)
    with rasterio.open(accumulation_path, "w", **profile) as output:
        output.write(np.asarray(accumulation), 1)
        output.set_band_unit(1, "cells")
        output.update_tags(meaning="Contributing terrain cells including self; not discharge",
                           boundary_limitation="Only terrain inside valid DEM footprint contributes")

    for path in (direction_path, accumulation_path):
        with rasterio.open(path) as output:
            assert output.crs == crs and output.transform == affine
            assert output.shape == valid.shape and output.nodata == 0
            for _, window in output.block_windows(1):
                block = output.read(1, window=window, masked=True)
                assert np.isfinite(block.compressed()).all()
                if path == accumulation_path:
                    assert (block.compressed() >= 1).all()
            print(f"Verified {path.name}: {output.crs}, {output.shape}, {output.res}, {output.dtypes}")

    fig, ax = plt.subplots(figsize=(10, 9))
    cmap = plt.get_cmap("Blues").copy()
    cmap.set_bad("lightgray")
    # Display a reduced view only; processing above used every original cell.
    shown = np.ma.array(np.asarray(accumulation)[::3, ::3], mask=~valid[::3, ::3])
    with rasterio.open(source) as dataset:
        extent = plotting_extent(dataset)
    image = ax.imshow(shown, extent=extent, origin="upper", cmap=cmap,
                      norm=LogNorm(vmin=1, vmax=maximum), interpolation="nearest")
    ax.scatter(*gauge, color="red", edgecolors="black", s=50)
    ax.annotate("Ratnapura gauge (not snapped)", gauge, xytext=(8, 8),
                textcoords="offset points", bbox=dict(facecolor="white", alpha=0.85))
    ax.set_title("D8 flow accumulation — full projected DEM")
    ax.set_xlabel("Easting (m)")
    ax.set_ylabel("Northing (m)")
    ax.ticklabel_format(style="plain", useOffset=False)
    fig.colorbar(image, ax=ax, shrink=0.8, label="Contributing terrain cells (log scale)")
    fig.text(0.5, 0.025, "Gray = NoData. Finite DEM boundary limits upstream counts. Not river discharge.",
             ha="center", fontsize=8)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    preview.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(preview, dpi=180)
    plt.close(fig)
    print(f"Runtime: {time.perf_counter() - started:.1f} seconds")
    try:
        import resource  # Available on macOS/Linux; optional on Windows.
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        peak_bytes = peak if sys.platform == "darwin" else peak * 1024
        print(f"Process peak resident memory: {peak_bytes / 1024**3:.3f} GiB")
    except ImportError:
        print("Peak memory measurement unavailable on this platform.")


if __name__ == "__main__":
    main()
