"""Reproduce and export the exact provisional V2 upstream cell footprint.

No old flow rasters are used. No smoothing, repair, outlet movement or DEM edits.
Run using the existing .venv Python; outputs must not already exist.
"""
from pathlib import Path
from datetime import datetime, timezone
import gc
import hashlib
import importlib.metadata
import json
import os
import platform
import subprocess
import sys
import time

import numpy as np
import rasterio
from rasterio.features import shapes, rasterize
from pyproj import Transformer
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.ops import transform
from shapely.validation import explain_validity

ROOT = Path(__file__).resolve().parents[1]
OUTLET = (1196, 5160)
DIRECTIONS = (64, 128, 1, 2, 4, 8, 16, 32)
OFFSETS = dict(zip(DIRECTIONS, [(-1, 0), (-1, 1), (0, 1), (1, 1),
                               (1, 0), (1, -1), (0, -1), (-1, -1)]))
EXPECTED = 715725
AREA_M2 = EXPECTED * 900


def require(condition, message):
    if not condition:
        raise RuntimeError('VALIDATION FAILED: ' + message)


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def memory_check():
    """Conservative available-memory estimate using only platform tools."""
    if sys.platform == 'darwin':
        output = subprocess.check_output(['vm_stat'], text=True)
        page_size = int(output.split('page size of ')[1].split(' bytes')[0])
        counts = {line.split(':')[0]: int(line.split(':')[1].strip().rstrip('.'))
                  for line in output.splitlines()[1:] if ':' in line}
        available = sum(counts.get(k, 0) for k in ('Pages free', 'Pages inactive', 'Pages speculative')) * page_size
    elif sys.platform == 'win32':
        import ctypes
        class MemoryStatus(ctypes.Structure):
            _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong)] + [
                (k, ctypes.c_ulonglong) for k in ('total', 'available', 'page_total', 'page_available',
                                                'virtual_total', 'virtual_available', 'extended')]
        status = MemoryStatus(); status.length = ctypes.sizeof(status)
        require(ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)), 'Cannot query available RAM')
        available = status.available
    else:
        lines = Path('/proc/meminfo').read_text().splitlines()
        available = int(next(s for s in lines if s.startswith('MemAvailable:')).split()[1]) * 1024
    print('Available/reclaimable RAM estimate: %.2f GiB; require >=4 GiB' % (available / 1024**3), flush=True)
    require(available >= 4 * 1024**3, 'Insufficient memory for full-context conditioning')
    return available


def peak_mib():
    try:
        import resource
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024**2 if sys.platform == 'darwin' else 1024)
    except ImportError:
        return None


def main():
    started = time.perf_counter()
    destination = ROOT / 'outputs/visualization/ratnapura_v2.geojson'
    manifest_path = destination.with_name('manifest.json')
    require(not destination.exists(), 'Preserving existing V2 export')
    original_manifest = manifest_path.read_bytes()
    manifest = json.loads(original_manifest)
    # Preserve and verify all reference exports before any expensive processing.
    for name, info in manifest['layers'].items():
        p = destination.with_name(name)
        require(digest(p) == info['sha256'], 'Reference export checksum mismatch: ' + name)
    available = memory_check()
    dem = ROOT / 'data/processed/dem_kalu_mosaic_utm44n_30m.tif'
    dem_hash = digest(dem)
    with rasterio.open(dem) as src:
        require(src.crs.to_epsg() == 32644 and src.res == (30, 30) and src.shape == (3701, 7380)
                and src.nodata == -9999, 'Unexpected DEM metadata')
        affine, crs = src.transform, src.crs
        require(affine.b == 0 and affine.d == 0, 'Unexpected rotated grid')
        elevation = src.read(1, out_dtype='float64')
        valid = src.read_masks(1) != 0
        require(int(valid.sum()) == 27169459, 'Unexpected valid-data coverage')
        require(valid[OUTLET] and np.isfinite(elevation[valid]).all(), 'Invalid outlet or elevations')
        x, y = src.xy(*OUTLET)
    nodata = np.float64(-9999)
    elevation[~valid] = nodata
    view = ViewFinder(affine=affine, crs=crs, shape=valid.shape, nodata=nodata)
    terrain = Raster(elevation, viewfinder=view); del elevation
    grid = Grid(viewfinder=view)
    print('Full-context fill_pits...', flush=True)
    filled = grid.fill_pits(terrain); del terrain; gc.collect()
    print('Full-context fill_depressions...', flush=True)
    filled = grid.fill_depressions(filled)
    # Same temporary high invalid border used by the validated comparison.
    filled[~valid] = filled[valid].max() + 100
    print('Full-context resolve_flats eps=1e-8, float64...', flush=True)
    conditioned = grid.resolve_flats(filled, eps=1e-8); del filled; gc.collect()
    conditioned[~valid] = nodata
    require(conditioned.dtype == np.float64 and np.isfinite(conditioned[valid]).all(), 'Conditioned precision/values')
    print('Calculating D8 directions...', flush=True)
    direction = grid.flowdir(conditioned, routing='d8', dirmap=DIRECTIONS, nodata_out=0)
    require(direction.affine == affine and direction.crs == crs and (direction[~valid] == 0).all(), 'D8 georeferencing/NoData')
    print('Extracting fixed-cell V2 catchment...', flush=True)
    catch = grid.catchment(x=OUTLET[1], y=OUTLET[0], fdir=direction, dirmap=DIRECTIONS,
                           routing='d8', xytype='index', algorithm='iterative')
    require(catch.affine == affine and catch.crs == crs and catch.shape == valid.shape, 'Catchment georeferencing')
    mask = np.asarray(catch, dtype=bool); del catch
    count = int(mask.sum())
    require(count == EXPECTED and count * 900 == AREA_M2, 'V2 count/area mismatch')
    require(mask[OUTLET] and not (mask & ~valid).any(), 'Outlet exclusion or NoData included')
    require(not (mask[0].any() or mask[-1].any() or mask[:, 0].any() or mask[:, -1].any()), 'Catchment touches outer rim')
    codes = np.asarray(direction).astype('int16')
    rr, cc = np.nonzero(mask)
    require(np.isin(codes[rr, cc], DIRECTIONS).all(), 'Pit, flat or invalid code in V2')
    for code, (dr, dc) in OFFSETS.items():
        use = (codes[rr, cc] == code) & ~((rr == OUTLET[0]) & (cc == OUTLET[1]))
        r, c = rr[use], cc[use]; tr, tc = r + dr, c + dc
        require(((tr >= 0) & (tr < mask.shape[0]) & (tc >= 0) & (tc < mask.shape[1])).all(), 'Route outside raster')
        require(valid[tr, tc].all() and mask[tr, tc].all(), 'Non-outlet route leaves valid catchment')
        require((conditioned[r, c] > conditioned[tr, tc]).all(), 'Non-descending edge; possible cycle')
        ir, ic = rr - dr, cc - dc
        inside = (ir >= 0) & (ir < mask.shape[0]) & (ic >= 0) & (ic < mask.shape[1])
        ir, ic = ir[inside], ic[inside]
        incoming = valid[ir, ic] & (codes[ir, ic] == code)
        require(mask[ir[incoming], ic[incoming]].all(), 'Upstream closure failure')
    # Finite strict descent + closure means each non-outlet route reaches V2, without cycles.
    del conditioned, codes, rr, cc; gc.collect()
    print('PASS connectivity, strict descent, closure, no internal terminal/NoData. Accumulation...', flush=True)
    accumulation = grid.accumulation(direction, routing='d8', dirmap=DIRECTIONS, algorithm='iterative')
    accumulation_count = float(accumulation[OUTLET])
    require(accumulation_count == EXPECTED, 'Independent accumulation disagrees with extraction')
    for first in range(0, mask.shape[0], 128):
        block = np.asarray(accumulation[first:first + 128])[mask[first:first + 128]]
        require(np.isfinite(block).all() and (block >= 1).all(), 'Invalid upstream accumulation')
    del accumulation, direction, valid, grid; gc.collect()
    hydro_seconds = time.perf_counter() - started
    print('PASS accumulation =', accumulation_count, 'Hydrology seconds:', hydro_seconds, flush=True)

    # Four-neighbour polygonization keeps simple cell-edge parts. D8-connected
    # parts can legitimately touch at a corner; never bridge or discard them.
    print('Polygonizing exact binary mask...', flush=True)
    polygons = []
    for geo, value in shapes(mask.astype('uint8'), mask=mask, connectivity=4, transform=affine):
        require(value == 1, 'Unexpected polygon value')
        poly = shape(geo)
        require(poly.is_valid and poly.geom_type == 'Polygon', 'Invalid polygon: ' + explain_validity(poly))
        polygons.append(poly)
    require(bool(polygons), 'No polygons')
    geometry = polygons[0] if len(polygons) == 1 else MultiPolygon(polygons)
    require(geometry.is_valid, 'Invalid aggregate topology: ' + explain_validity(geometry))
    require(abs(geometry.area - AREA_M2) <= 0.01, 'Projected area differs by >0.01 m²')
    recovered = rasterize([(mapping(geometry), 1)], out_shape=mask.shape, transform=affine,
                          dtype='uint8', all_touched=False)
    different = int(np.count_nonzero(recovered != mask))
    require(different == 0 and int(recovered.sum()) == EXPECTED, 'Polygon rasterization mismatch')
    del recovered, mask; gc.collect()
    parts = len(polygons)
    holes = sum(len(p.interiors) for p in polygons)
    vertices = sum(len(p.exterior.coords) + sum(len(r.coords) for r in p.interiors) for p in polygons)
    to_geo = Transformer.from_crs(32644, 4326, always_xy=True)
    to_projected = Transformer.from_crs(4326, 32644, always_xy=True)
    wgs = transform(to_geo.transform, geometry)
    require(wgs.is_valid, 'Invalid WGS84 geometry: ' + explain_validity(wgs))
    lon, lat = to_geo.transform(x, y)
    props = {'name': 'Ratnapura V2 Provisional Watershed', 'method': 'DEM-derived D8 upstream catchment',
             'area_km2': count * 900 / 1e6, 'raster_cells': count, 'dem_resolution_m': 30,
             'outlet_row': OUTLET[0], 'outlet_column': OUTLET[1], 'outlet_longitude': lon, 'outlet_latitude': lat,
             'status': 'Provisional research boundary', 'gauge_cross_section': 'Unverified',
             'uncertainty': 'Present-day Ratnapura gauge cross-section unverified; 603 km² discrepancy unresolved, not a confirmed routing error',
             'source_dem': str(dem.relative_to(ROOT)), 'source_dem_sha256': dem_hash,
             'original_crs': 'EPSG:32644', 'eps': 1e-8,
             'conditioning': 'Full-context float64 fill_pits → fill_depressions → resolve_flats',
             'd8_mapping': 'N64 NE128 E1 SE2 S4 SW8 W16 NW32', 'simplified': False}
    obj = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'id': 'ratnapura-v2',
                                                   'properties': props, 'geometry': mapping(wgs)}]}
    encoded = json.dumps(obj, allow_nan=False, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    reread = shape(json.loads(encoded)['features'][0]['geometry'])
    require(reread.is_valid and reread.geom_type in ('Polygon', 'MultiPolygon'), 'Serialized topology/type')
    w, s, e, n = reread.bounds
    require(79 < w < e < 82 and 5 < s < n < 8, 'Longitude/latitude range or order')
    back = transform(to_projected.transform, reread)
    require(back.is_valid, 'Inverse transformed topology')
    back_parts = list(back.geoms) if back.geom_type == 'MultiPolygon' else [back]
    require(len(back_parts) == parts and sum(len(p.interiors) for p in back_parts) == holes, 'Lost parts/holes')
    area_error = abs(back.area - geometry.area)
    displacement = geometry.hausdorff_distance(back)
    require(area_error <= 0.1 and displacement <= 0.00001, 'Coordinate transformation precision failure')
    require(digest(dem) == dem_hash, 'DEM changed during processing')
    require(manifest_path.read_bytes() == original_manifest, 'Manifest changed concurrently')
    elapsed = time.perf_counter() - started
    result = {'features': 1, 'bytes': len(encoded), 'sha256': hashlib.sha256(encoded).hexdigest(),
              'geometry_type': reread.geom_type, 'parts': parts, 'holes': holes, 'vertices_including_ring_closures': vertices,
              'part_areas_m2': [p.area for p in polygons],
              'part_note': 'Four-neighbour cell-edge parts retained; D8 graph connectivity verified independently',
              'projected_area_m2': geometry.area, 'source_dem': props['source_dem'], 'source_dem_sha256': dem_hash,
              'script': 'src/export_ratnapura_v2_watershed.py', 'exported_utc': datetime.now(timezone.utc).isoformat(),
              'outlet': {'row': OUTLET[0], 'column': OUTLET[1], 'easting': x, 'northing': y, 'longitude': lon, 'latitude': lat},
              'conditioning': props['conditioning'], 'eps': 1e-8, 'd8_mapping': props['d8_mapping'],
              'validation': {'cells': count, 'area_km2': props['area_km2'], 'accumulation_cells': accumulation_count,
                             'connectivity_closure_strict_descent': True, 'unexpected_terminals': 0, 'NoData_cells': 0,
                             'raster_roundtrip_differing_cells': different, 'recovered_cells': EXPECTED,
                             'projected_geometry_valid': True, 'wgs84_geometry_valid': True,
                             'area_tolerance_m2': 0.01, 'inverse_area_error_m2': area_error,
                             'inverse_area_tolerance_m2': 0.1, 'inverse_boundary_displacement_m': displacement},
              'runtime_seconds': elapsed, 'hydrology_seconds': hydro_seconds, 'peak_resident_mib': peak_mib(),
              'available_memory_estimate_bytes': available,
              'versions': {p: importlib.metadata.version(p) for p in ('numpy', 'rasterio', 'pysheds', 'pyproj', 'shapely')},
              'uncertainty': props['uncertainty'], 'simplified': False}
    manifest['layers'][destination.name] = result
    manifest['research']['v2_polygon_exported'] = True
    manifest['research']['v2_export_eps'] = 1e-8
    # Preserve all existing source/reference metadata. No large intermediates saved.
    with destination.open('xb') as stream:
        stream.write(encoded)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('PASS EXACT V2 EXPORT:', json.dumps(result, indent=2), flush=True)


if __name__ == '__main__':
    main()
