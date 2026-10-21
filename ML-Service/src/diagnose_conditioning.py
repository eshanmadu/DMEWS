"""Inspect full-DEM conditioning at major terminals; write no raster outputs.

macOS: ML-Service/.venv/bin/python ML-Service/src/diagnose_conditioning.py
Windows PowerShell:
    & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\diagnose_conditioning.py
"""

from pathlib import Path
import argparse
from collections import defaultdict
import gc
import sys
import time

import numpy as np
import rasterio
from rasterio.warp import transform
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
from scipy.ndimage import binary_erosion, binary_dilation, distance_transform_edt, label as label_components
import shapefile
from rasterio.features import rasterize
from rasterio.warp import transform_geom


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--eps", type=float, default=1e-5,
                        help="Flat-resolution increment; default reproduces original workflow")
    eps = parser.parse_args().eps
    if not np.isfinite(eps) or eps <= 0:
        raise ValueError("eps must be finite and positive")
    started = time.perf_counter()
    print(f"Diagnostic eps={eps:g}; float64 conditioning; full DEM context", flush=True)
    root = Path(__file__).resolve().parents[1]
    points = [("A: inside reference", 80.427488495, 6.697871898),
              ("B: downstream terminal", 80.349851704, 6.704288066),
              ("C: shared downstream flat", 80.013709777, 6.631279111)]
    with rasterio.open(root / "data/processed/dem_kalu_utm44n_30m.tif") as source:
        elevations = source.read(1).astype("float64")
        valid = (source.read_masks(1) != 0) & np.isfinite(elevations)
        affine, crs = source.transform, source.crs
        cells = []
        for name, longitude, latitude in points:
            x, y = transform("EPSG:4326", crs, [longitude], [latitude])
            row, column = source.index(x[0], y[0])
            assert valid[row, column]
            cells.append((name, row, column))
    nodata = np.float64(-9999)
    elevations[~valid] = nodata
    view = ViewFinder(affine=affine, shape=elevations.shape, crs=crs, nodata=nodata)
    terrain = Raster(elevations, viewfinder=view)
    del elevations
    grid = Grid(viewfinder=view)
    snapshots = {}

    def inspect(stage, array):
        # Copy only 5 x 5 windows; retain no full intermediate terrain arrays.
        windows = []
        print(f"\nSTAGE: {stage}", flush=True)
        print("Nonfinite valid cells:", np.count_nonzero(~np.isfinite(array[valid])))
        for name, row, column in cells:
            window = np.asarray(array[row-2:row+3, column-2:column+3]).copy()
            windows.append(window)
            neighbours = window[1:4, 1:4].copy()
            neighbours[1, 1] = np.inf
            delta = float(window[2, 2] - neighbours.min())
            print(f"{name}: row={row}, col={column}; centre={window[2,2]:.12f}; "
                  f"centre minus lowest neighbour={delta:.12g}")
            print(np.array2string(window, precision=12, suppress_small=False))
        snapshots[stage] = windows
        # Examine the full connected equal-elevation region containing C. This
        # is a terrain-component diagnostic, not watershed delineation.
        _, row, column = cells[2]
        value = float(array[row, column])
        labels, _ = label_components(valid & (np.asarray(array) == value), np.ones((3, 3)))
        component = labels == labels[row, column]
        del labels
        border = binary_dilation(component, np.ones((3, 3))) & ~component
        boundary_values = np.asarray(array)[border & valid]
        rr, cc = np.nonzero(component)
        touches_raster = bool(component[0,:].any() or component[-1,:].any()
                              or component[:,0].any() or component[:,-1].any())
        print(f"SHARED FLAT {stage}: exact-elevation component cells={len(rr)}, "
              f"area_km2={len(rr)*abs(affine.a*affine.e)/1e6:.6f}, "
              f"row_range={rr.min()}..{rr.max()}, col_range={cc.min()}..{cc.max()}, "
              f"touches_raster_edge={touches_raster}, "
              f"adjacent_invalid_cells={np.count_nonzero(border & ~valid)}, "
              f"lower_valid_boundary_cells={np.count_nonzero(boundary_values < value)}")
        if boundary_values.size:
            print(f"SHARED FLAT valid boundary elevations: min={boundary_values.min():.12f}, "
                  f"max={boundary_values.max():.12f}; centre={value:.12f}")
        if stage == "flat-resolved":
            # Gradient construction is independent of eps in pysheds 0.5.
            # Reconstruct ONLY this small window for comparison, not a second
            # conditioning run. This is an inferred surface, not a saved one.
            before = snapshots["depression-filled"][2]
            after = snapshots["flat-resolved"][2]
            inferred_default = before + (after - before) * (1e-5 / eps)
            print("SHARED FLAT inferred eps=1e-5 window (linear gradient scaling):\n",
                  np.array2string(inferred_default, precision=12))
            print("SHARED FLAT float64 spacing:", np.spacing(np.float64(value)))

    inspect("original", terrain)
    filled = grid.fill_pits(terrain)
    del terrain
    gc.collect()
    inspect("pit-filled", filled)
    filled = grid.fill_depressions(filled)
    inspect("depression-filled", filled)
    # Match calculate_flow.py exactly, including temporary NoData barrier.
    filled[~valid] = filled[valid].max() + 100
    conditioned = grid.resolve_flats(filled, eps=eps)
    del filled
    conditioned[~valid] = nodata
    gc.collect()
    inspect("flat-resolved", conditioned)

    dirmap = (64, 128, 1, 2, 4, 8, 16, 32)
    print("\nComputing directions only (no accumulation)...", flush=True)
    direction = grid.flowdir(conditioned, routing="d8", dirmap=dirmap, nodata_out=0)
    del conditioned
    gc.collect()
    # Verify real routing without the synthetic test's padding workaround.
    assert (direction[~valid] == 0).all()
    assert np.isin(direction[valid], list(dirmap) + [-1, -2]).all()
    offsets = [(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]
    for code, (dr, dc) in zip(dirmap, offsets):
        rows, cols = np.nonzero(valid & (direction == code))
        rr, cc = rows + dr, cols + dc
        assert ((rr >= 0) & (rr < valid.shape[0]) &
                (cc >= 0) & (cc < valid.shape[1])).all()
        assert valid[rr, cc].all(), "Route enters NoData"
    del rows, cols, rr, cc
    interior = binary_erosion(valid, np.ones((3, 3)), border_value=0)

    # Reverse NEXT_DOWN across all records; use actual polygon geometries,
    # including their holes, rather than their combined bounding rectangle.
    reference = root / "data/raw/hydrobasins/hybas_as_lev12_v1c.shp"
    with shapefile.Reader(str(reference)) as reader:
        records, upstream = {}, defaultdict(list)
        for record in reader.iterRecords():
            row = record.as_dict()
            basin_id = int(row["HYBAS_ID"])
            records[basin_id] = record.oid
            if row["NEXT_DOWN"] and row["ENDO"] != 2:
                upstream[int(row["NEXT_DOWN"])].append(basin_id)
        selected, pending = set(), [4121158930]
        while pending:
            basin_id = pending.pop()
            if basin_id not in selected:
                selected.add(basin_id)
                pending.extend(upstream[basin_id])
        assert len(selected) == 6, "Unexpected reference polygon count"
        reference_crs = rasterio.crs.CRS.from_wkt(reference.with_suffix(".prj").read_text())
        geometries = [transform_geom(reference_crs, crs,
                      reader.shape(records[i]).__geo_interface__) for i in selected]
        # Include the downstream basin links for a coarse topology comparison.
        next_down = {int(r["HYBAS_ID"]): int(r["NEXT_DOWN"])
                     for r in reader.iterRecords()}
    reference_mask = rasterize([(g, 1) for g in geometries], out_shape=valid.shape,
                               transform=affine, dtype="uint8") > 0
    with rasterio.open(root / "data/processed/flow_direction_d8.tif") as previous:
        old_direction = previous.read(1)
        assert previous.crs == crs and previous.transform == affine
    for name, mask in [("full interior", interior),
                       ("reference interior", interior & reference_mask)]:
        for code, label in [(-2, "pits"), (-1, "flats")]:
            old_mask = mask & (old_direction == code)
            new_mask = mask & (direction == code)
            print(f"COUNT {name} {label}: old={old_mask.sum()}, new={new_mask.sum()}, "
                  f"newly classified={np.count_nonzero(new_mask & ~old_mask)}", flush=True)
    print("PASS: valid D8 codes; no routes into NoData or outside raster", flush=True)

    # Trace only the candidate array. The saved original is used above solely
    # for count comparisons, never to decide candidate path directions.
    footprint_edge = valid & ~interior
    code_offsets = dict(zip(dirmap, offsets))
    paths = []
    for name, start_row, start_column in cells:
        path, seen = [], set()
        row, column = start_row, start_column
        length = 0.0
        while True:
            cell = (int(row), int(column))
            if cell in seen:
                reason = "LOOP"
                break
            seen.add(cell)
            path.append(cell)
            if not valid[cell]:
                reason = "INVALID: entered NoData"
                break
            code = int(direction[cell])
            if code not in code_offsets:
                kind = {-1: "unresolved flat", -2: "pit"}.get(code, "INVALID code")
                reason = f"{kind}; " + ("valid footprint edge" if footprint_edge[cell]
                                         else "INTERIOR terminal")
                break
            dr, dc = code_offsets[code]
            rr, cc = row + dr, column + dc
            if not (0 <= rr < valid.shape[0] and 0 <= cc < valid.shape[1]):
                reason = "INVALID: routed outside array"
                break
            length += np.hypot(dc * abs(affine.a), dr * abs(affine.e))
            row, column = rr, cc
        paths.append(path)
        x, y = rasterio.transform.xy(affine, *path[-1])
        longitude, latitude = transform(crs, "EPSG:4326", [x], [y])
        print(f"PATH {name}: steps={len(path)-1}, length_km={length/1000:.6f}, "
              f"final_latlon={latitude[0]:.9f},{longitude[0]:.9f}, reason={reason}", flush=True)
    shared = set(paths[0]) & set(paths[1])
    print(f"PATH intersection: {len(shared)} shared cells")
    if shared:
        first_shared = next(cell for cell in paths[0] if cell in shared)
        x, y = rasterio.transform.xy(affine, *first_shared)
        longitude, latitude = transform(crs, "EPSG:4326", [x], [y])
        print(f"First shared cell along A: {first_shared}; "
              f"latlon={latitude[0]:.9f},{longitude[0]:.9f}")

    path_mask = np.zeros(valid.shape, dtype=bool)
    for path in paths:
        rr, cc = np.asarray(path).T
        path_mask[rr, cc] = True
    distances = distance_transform_edt(~path_mask, sampling=(abs(affine.e), abs(affine.a)))
    for code, kind in [(-2, "pits"), (-1, "flats")]:
        terminals = interior & (direction == code)
        print(f"PATH proximity {kind}: total={terminals.sum()}, "
              f"on_path={np.count_nonzero(terminals & path_mask)}, "
              f"within300m={np.count_nonzero(terminals & (distances<=300))}, "
              f"within1000m={np.count_nonzero(terminals & (distances<=1000))}, "
              f"minimum_distance_m={distances[terminals].min() if terminals.any() else 'none'}")
        rr, cc = np.nonzero(terminals)
        nearest = np.argsort(distances[terminals])[:5]
        for k in nearest:
            row, column = int(rr[k]), int(cc[k])
            x, y = rasterio.transform.xy(affine, row, column)
            longitude, latitude = transform(crs, "EPSG:4326", [x], [y])
            print(f"NEAR {kind}: latlon={latitude[0]:.9f},{longitude[0]:.9f}, "
                  f"distance_m={distances[row,column]:.1f}, "
                  f"inside_reference={bool(reference_mask[row,column])}")
    # Component counts describe distribution, not whether a flat is harmless.
    flat_components, ncomponents = label_components(interior & (direction == -1), np.ones((3,3)))
    print(f"Interior flat clusters={ncomponents}; "
          f"largest_cluster_cells={np.bincount(flat_components.ravel())[1:].max() if ncomponents else 0}")
    del distances, path_mask, flat_components

    # Sample reference polygon membership along paths using the same projected
    # geometries (holes respected). Only a few small path point lists are used.
    # Coarse polygon transitions do not establish exact river alignment.
    # Rasterize compact ordinal labels, not 10-digit IDs (which exceed int32).
    ordered_ids = list(selected)
    reference_labels = rasterize([(g, k+1) for k, g in enumerate(geometries)],
                                 out_shape=valid.shape, transform=affine, dtype="uint8")
    for (name, _, _), path in zip(cells, paths):
        sequence = []
        outside = 0
        for row, column in path:
            ordinal = int(reference_labels[row, column])
            basin = ordered_ids[ordinal-1] if ordinal else None
            if basin is None:
                outside += 1
            if not sequence or sequence[-1] != basin:
                sequence.append(basin)
        print(f"REFERENCE {name}: polygon sequence={sequence}; "
              f"path cells outside six polygons={outside}/{len(path)}")
        print("Reference next-down links for visited polygons:",
              {i: next_down[i] for i in sequence if i is not None})
    del old_direction, interior, reference_mask, records, upstream
    with rasterio.open(root / "data/processed/flow_direction_d8.tif") as old:
        for index, (name, row, column) in enumerate(cells):
            from rasterio.windows import Window
            previous = old.read(1, window=Window(column-2, row-2, 5, 5))
            current = np.asarray(direction[row-2:row+3, column-2:column+3])
            resolved = snapshots["flat-resolved"][index]
            filled_window = snapshots["depression-filled"][index]
            print(f"\n{name}: old/new centre code={previous[2,2]}/{current[2,2]}; "
                  f"5x5 equal={np.array_equal(previous, current)}")
            print("D8 codes:\n", current)
            print("Flat-resolution elevation increments:\n",
                  np.array2string(resolved-filled_window, precision=12))
            # Independently calculate the eight local slopes for comparison.
            offsets = [(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]
            slopes = []
            for dr, dc in offsets:
                distance = np.hypot(dr*abs(affine.e), dc*abs(affine.a))
                slopes.append((resolved[2,2]-resolved[2+dr,2+dc])/distance)
            best = int(np.argmax(slopes))
            expected = dirmap[best] if slopes[best] > 0 else (-1 if slopes[best] == 0 else -2)
            print("Slopes N,NE,E,SE,S,SW,W,NW:", slopes)
            print("Independent expected code:", expected,
                  "matches pysheds:", expected == current[2,2])
    print(f"\nRuntime: {time.perf_counter()-started:.1f} seconds")
    try:
        import resource
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f"Peak resident memory: {peak/(1024**3 if sys.platform=='darwin' else 1024**2):.3f} GiB")
    except ImportError:
        print("Peak memory measurement unavailable on this platform.")
    print("No raster outputs, accumulation, snapping or catchment extraction performed.")


if __name__ == "__main__":
    main()
