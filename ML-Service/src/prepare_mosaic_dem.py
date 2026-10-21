"""Reproject the full mosaic without hydrological conditioning.

macOS: ML-Service/.venv/bin/python ML-Service/src/prepare_mosaic_dem.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\prepare_mosaic_dem.py
"""
from pathlib import Path
import sys
import time

import numpy as np
import rasterio
from rasterio.features import rasterize
from rasterio.warp import (calculate_default_transform, reproject, Resampling,
                           transform, transform_geom)
from rasterio.windows import from_bounds, Window
import shapefile


def main():
    started = time.perf_counter()
    root = Path(__file__).resolve().parents[1]
    source_path = root / 'data/processed/dem_kalu_mosaic_wgs84.tif'
    output_path = root / 'data/processed/dem_kalu_mosaic_utm44n_30m.tif'
    if output_path.exists():
        raise FileExistsError(f'Preserving existing output: {output_path}')
    nodata = -9999.0
    # Bound GDAL's cache and warp buffers. Band-to-band reprojection avoids
    # allocating full-size source and destination NumPy arrays.
    with rasterio.Env(GDAL_CACHEMAX=64 * 1024 * 1024):
        with rasterio.open(source_path) as source:
            if source.crs.to_epsg() != 4326 or source.nodata is not None:
                raise ValueError('Expected geographic, all-valid source with no declared NoData')
            for _, window in source.block_windows(1):
                values = source.read(1, window=window)
                if (not np.isfinite(values).all() or (values == nodata).any()
                        or not (source.read_masks(1, window=window) == 255).all()):
                    raise ValueError('Unexpected source mask/value; stop before reprojection')
            affine, width, height = calculate_default_transform(
                source.crs, 'EPSG:32644', source.width, source.height,
                *source.bounds, resolution=30)
            profile = source.profile.copy()
            profile.update(crs='EPSG:32644', transform=affine, width=width,
                           height=height, nodata=nodata, tiled=True,
                           blockxsize=256, blockysize=256, compress='deflate', predictor=3)
            with rasterio.open(output_path, 'w', **profile) as destination:
                # Bilinear elevation interpolation matches prepare_dem.py.
                # No src_nodata is set: zero and negative heights remain valid.
                # GDAL derives footprint coverage from the all-valid source;
                # unrepresented destination pixels get distinct -9999 NoData.
                reproject(source=rasterio.band(source, 1),
                          destination=rasterio.band(destination, 1),
                          resampling=Resampling.bilinear, dst_nodata=nodata,
                          init_dest_nodata=True, warp_mem_limit=64, num_threads=1)
                destination.set_band_unit(1, 'm')
                destination.update_tags(
                    AREA_OR_POINT='Area', source_file=source_path.name,
                    resampling='bilinear',
                    vertical_reference='EGM2008, source product documentation; unchanged',
                    processing='Full mosaic reprojection only; no hydrological conditioning')

        with rasterio.open(output_path) as result:
            assert result.crs.to_epsg() == 32644 and result.res == (30, 30)
            assert result.transform == affine and (result.width, result.height) == (width, height)
            valid_count = invalid_count = zeros = negatives = 0
            minimum, maximum = np.inf, -np.inf
            for _, window in result.block_windows(1):
                values = result.read(1, window=window)
                valid = result.read_masks(1, window=window) != 0
                assert np.array_equal(valid, values != nodata)
                assert np.isfinite(values[valid]).all()
                valid_count += np.count_nonzero(valid)
                invalid_count += np.count_nonzero(~valid)
                zeros += np.count_nonzero(valid & (values == 0))
                negatives += np.count_nonzero(valid & (values < 0))
                if valid.any():
                    minimum = min(minimum, float(values[valid].min()))
                    maximum = max(maximum, float(values[valid].max()))
            print(f'Raster: {width} x {height}; {result.crs}; resolution={result.res}')
            print(f'Bounds: {result.bounds}; dtype={result.dtypes}; NoData={result.nodata}')
            print(f'Valid={valid_count:,}; NoData={invalid_count:,}; zero={zeros:,}; negative={negatives:,}')
            print(f'Elevation range: {minimum:.6f} to {maximum:.6f} m')

            locations = {'Ratnapura': (80.394167, 6.678333),
                         'Ellagawa': (80.210000, 6.731944),
                         'Former termination': (80.013709777, 6.631279111),
                         'Western lower terrain': (79.988333333, 6.622222222)}
            for name, (lon, lat) in locations.items():
                xx, yy = transform('EPSG:4326', result.crs, [lon], [lat])
                row, col = result.index(xx[0], yy[0])
                assert 0 <= row < height and 0 <= col < width
                sample = result.read(1, window=Window(col, row, 1, 1), masked=True)
                assert not np.ma.getmaskarray(sample).any()
                print(f'PASS {name}: E={xx[0]:.3f}, N={yy[0]:.3f}; elevation={sample[0,0]:.6f} m')

            # Rasterize each actual polygon (including holes) on the output
            # grid. all_touched includes boundary pixels, a conservative check.
            reference = root / 'data/raw/hydrobasins/hybas_as_lev12_v1c.shp'
            prj = reference.with_suffix('.prj').read_text()
            if rasterio.crs.CRS.from_wkt(prj).to_epsg() != 4326:
                raise ValueError('Unexpected HydroBASINS CRS')
            count = missing = 0
            with shapefile.Reader(str(reference)) as reader:
                for record in reader.iterRecords():
                    if int(record['MAIN_BAS']) != 4120049010:
                        continue
                    geometry = transform_geom('EPSG:4326', result.crs,
                                              reader.shape(record.oid).__geo_interface__)
                    from rasterio.features import bounds
                    left, bottom, right, top = bounds(geometry)
                    fractional = from_bounds(left, bottom, right, top, result.transform)
                    col0, row0 = int(np.floor(fractional.col_off))-1, int(np.floor(fractional.row_off))-1
                    col1 = int(np.ceil(fractional.col_off + fractional.width))+1
                    row1 = int(np.ceil(fractional.row_off + fractional.height))+1
                    assert 0 <= col0 < col1 <= width and 0 <= row0 < row1 <= height
                    window = Window(col0, row0, col1-col0, row1-row0)
                    polygon = rasterize([(geometry, 1)], out_shape=(row1-row0, col1-col0),
                                        transform=result.window_transform(window),
                                        all_touched=True, dtype='uint8') != 0
                    invalid = result.read_masks(1, window=window) == 0
                    absent = np.count_nonzero(polygon & invalid)
                    missing += absent
                    count += 1
                    if absent:
                        print(f'WARNING polygon {record["HYBAS_ID"]}: {absent} invalid covered cells')
            assert count == 23 and missing == 0, 'Reference polygons lack valid coverage'
            print('PASS: all 23 reference polygons have valid coverage, including touched boundary cells')

            # Inspect a narrow strip around the former geographic seam. Its
            # projected column varies with latitude; do not assume a vertical seam.
            differences = []
            for lat in np.linspace(6.01, 6.99, 1000):
                xx, yy = transform('EPSG:4326', result.crs, [79.99986111111112], [lat])
                row, col = result.index(xx[0], yy[0])
                strip = result.read(1, window=Window(col-3, row, 7, 1), masked=True)
                assert not np.ma.getmaskarray(strip).any(), 'NoData gap at seam'
                differences.append(np.diff(strip.data[0]))
            differences = np.abs(np.array(differences))
            print(f'PASS seam: 1000 sampled 7-cell strips, no NoData gaps; adjacent absolute differences '
                  f'median/p95/max={np.median(differences):.3f}/{np.percentile(differences,95):.3f}/{differences.max():.3f} m')
            print('Seam statistics are a screening check, not proof of terrain accuracy.')
    print(f'Output: {output_path}; bytes={output_path.stat().st_size:,}')
    print(f'Runtime: {time.perf_counter()-started:.1f} seconds')
    try:
        import resource
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f'Peak resident memory: {peak/(1024**3 if sys.platform == "darwin" else 1024**2):.3f} GiB')
    except ImportError:
        print('Peak resident memory measurement unavailable on this platform')


if __name__ == '__main__':
    main()
