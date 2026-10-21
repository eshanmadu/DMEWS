"""Copy two aligned geographic DEM tiles into a new mosaic, without resampling.

macOS: ML-Service/.venv/bin/python ML-Service/src/mosaic_dem.py
Windows PowerShell:
    & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\mosaic_dem.py
"""

from pathlib import Path
import sys
import time

import numpy as np
import rasterio
from rasterio.windows import Window, from_bounds
from scipy.ndimage import label, binary_dilation
import shapefile


def main():
    started = time.perf_counter()
    root = Path(__file__).resolve().parents[1]
    raw = root / "data/raw/dem"
    paths = [raw / f"Copernicus_DSM_COG_10_N06_00_E{east:03d}_00_DEM.tif"
             for east in (79, 80)]
    destination = root / "data/processed/dem_kalu_mosaic_wgs84.tif"
    if destination.exists():
        raise FileExistsError(f"Preserving existing output: {destination}")

    with rasterio.open(paths[0]) as west, rasterio.open(paths[1]) as east:
        assert west.crs.to_epsg() == east.crs.to_epsg() == 4326
        assert west.count == east.count == 1
        assert west.dtypes == east.dtypes == ("float32",)
        assert west.nodata is None and east.nodata is None
        assert west.height == east.height and west.res == east.res
        assert west.transform.b == east.transform.b == 0
        assert west.transform.d == east.transform.d == 0
        assert np.isclose(west.bounds.right, east.bounds.left, rtol=0, atol=1e-10)
        assert np.isclose(west.bounds.top, east.bounds.top, rtol=0, atol=1e-10)
        assert np.isclose(west.bounds.bottom, east.bounds.bottom, rtol=0, atol=1e-10)

        # Validate masks first. These particular tiles have no declared NoData
        # and all cells valid. Stop if that expectation has changed; never
        # interpret zero or negative elevation as an invalid cell.
        for source in (west, east):
            for _, window in source.block_windows(1):
                assert (source.read_masks(1, window=window) == 255).all()
                assert np.isfinite(source.read(1, window=window)).all()

        profile = west.profile.copy()
        profile.update(width=west.width + east.width, compress="deflate",
                       predictor=3, tiled=True, nodata=None)
        destination.parent.mkdir(parents=True, exist_ok=True)
        # The original transform is retained. Integer column offsets concatenate
        # the arrays exactly; no merge resampling or elevation blending occurs.
        with rasterio.open(destination, "w", **profile) as output:
            for source, offset in ((west, 0), (east, west.width)):
                for _, window in source.block_windows(1):
                    data = source.read(1, window=window)
                    target = Window(window.col_off + offset, window.row_off,
                                    window.width, window.height)
                    output.write(data, 1, window=target)
            output.update_tags(AREA_OR_POINT=west.tags().get("AREA_OR_POINT", "Point"),
                               sources="; ".join(p.name for p in paths),
                               processing="Exact windowed concatenation; no resampling",
                               vertical_reference="EGM2008, source product documentation")
            output.set_band_unit(1, "m")

        with rasterio.open(destination) as mosaic:
            count, total, minimum, maximum, zeros = 0, 0.0, np.inf, -np.inf, 0
            for source, offset in ((west, 0), (east, west.width)):
                for _, window in source.block_windows(1):
                    target = Window(window.col_off + offset, window.row_off,
                                    window.width, window.height)
                    values = mosaic.read(1, window=target)
                    assert np.array_equal(values, source.read(1, window=window))
                    assert np.array_equal(mosaic.read_masks(1, window=target),
                                          source.read_masks(1, window=window))
                    count += values.size
                    total += values.sum(dtype="float64")
                    minimum = min(minimum, float(values.min()))
                    maximum = max(maximum, float(values.max()))
                    zeros += np.count_nonzero(values == 0)
            print("PASS: every source value and validity mask preserved exactly")
            print(f"Mosaic: {mosaic.width} x {mosaic.height}, {mosaic.crs}, "
                  f"resolution={mosaic.res}, dtype={mosaic.dtypes}, NoData={mosaic.nodata}")
            print(f"Bounds: {mosaic.bounds}; valid cells={count:,}; zero cells={zeros:,}")
            print(f"Elevation min/mean/max: {minimum:.6f}/{total/count:.6f}/{maximum:.6f} m")

            # Adjacent columns represent different terrain locations, not
            # overlapping observations. Compare jumps with nearby gradients.
            strip = mosaic.read(1, window=Window(west.width-2, 0, 4, mosaic.height)).astype("float64")
            for name, differences in [("west adjacent", strip[:,1]-strip[:,0]),
                                      ("seam east-minus-west", strip[:,2]-strip[:,1]),
                                      ("east adjacent", strip[:,3]-strip[:,2])]:
                print(f"SEAM {name}: min/mean/max={differences.min():.6f}/"
                      f"{differences.mean():.6f}/{differences.max():.6f} m; "
                      f"median/p95 absolute={np.median(abs(differences)):.6f}/"
                      f"{np.percentile(abs(differences),95):.6f} m")

            # Connected equal-elevation terrain only: no filling or routing.
            # Use a generous local inspection window; flag truncation explicitly.
            window = from_bounds(79.5, 6.5, 80.05, 6.75, mosaic.transform).round_offsets().round_lengths()
            terrain = mosaic.read(1, window=window)
            row, column = mosaic.index(80.013709777, 6.631279111)
            local_row = row - int(window.row_off)
            local_col = column - int(window.col_off)
            value = terrain[local_row, local_col]
            labels, _ = label(terrain == value, np.ones((3,3)))
            component = labels == labels[local_row, local_col]
            border = binary_dilation(component, np.ones((3,3))) & ~component
            rr, cc = np.nonzero(component)
            truncated = bool(component[0,:].any() or component[-1,:].any()
                             or component[:,0].any() or component[:,-1].any())
            lower = border & (terrain < value)
            print(f"DOWNSTREAM original flat elevation={value}; component cells={component.sum()}; "
                  f"truncated by inspection window={truncated}; lower valid neighbouring cells={lower.sum()}")
            xs, ys = rasterio.transform.xy(mosaic.window_transform(window), rr, cc)
            print(f"DOWNSTREAM flat bounds W/S/E/N: {min(xs)}, {min(ys)}, {max(xs)}, {max(ys)}")
            low_rows, low_cols = np.nonzero(lower)
            if len(low_rows):
                k = int(np.argmin(terrain[lower]))
                lon, lat = rasterio.transform.xy(mosaic.window_transform(window),
                                                int(low_rows[k]), int(low_cols[k]))
                print(f"DOWNSTREAM lowest neighbouring sample: lat={lat:.9f}, lon={lon:.9f}, "
                      f"elevation={terrain[low_rows[k],low_cols[k]]:.6f} m; "
                      "not a selected hydrological outlet")

            reference = root / "data/raw/hydrobasins/hybas_as_lev12_v1c.shp"
            with shapefile.Reader(str(reference)) as reader:
                covered = 0
                for record in reader.iterRecords():
                    if int(record["MAIN_BAS"]) == 4120049010:
                        left, bottom, right, top = reader.shape(record.oid).bbox
                        assert (mosaic.bounds.left <= left <= right <= mosaic.bounds.right
                                and mosaic.bounds.bottom <= bottom <= top <= mosaic.bounds.top)
                        covered += 1
                assert covered == 23
                print("PASS: all 23 connected reference polygon bounds inside all-valid mosaic")

    print(f"Output: {destination}; size={destination.stat().st_size:,} bytes")
    print(f"Runtime: {time.perf_counter()-started:.1f} seconds")
    try:
        import resource
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f"Peak resident memory: {peak/(1024**3 if sys.platform=='darwin' else 1024**2):.3f} GiB")
    except ImportError:
        print("Peak memory measurement unavailable on this platform")


if __name__ == "__main__":
    main()
