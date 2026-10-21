"""Local HydroRIVERS inventory only: no DEM processing or watershed extraction.

macOS: ML-Service/.venv/bin/python ML-Service/src/inventory_hydrorivers.py
Windows PowerShell: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\inventory_hydrorivers.py
Points below are earlier diagnostic summaries, not saved disagreement geometries.
"""
from pathlib import Path
import time
import sys
import numpy as np
import shapefile
from pyproj import CRS, Transformer
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection

ROOT = Path(__file__).resolve().parents[1]
# Broad geographic inventory window, NOT the V2 watershed boundary.
WINDOW = (79.90, 6.40, 80.85, 6.95)
SIX = {4121158860, 4121158880, 4121158930, 4121158950, 4121158960, 4121602270}
POINTS = {
    'V2': (80.397580262, 6.679316732),
    'R1 centre': (80.380574, 6.725027),
    'R2 centre': (80.504828, 6.788638),
    'M1 centre': (80.700671, 6.598702),
    'M2 centre': (80.557810, 6.537476),
    'J1': (80.405184, 6.676341),
    'J2': (80.436634, 6.705957),
    'J3': (80.575721, 6.576651),
    'J4': (80.473020, 6.693243),
    'J5': (80.435228, 6.748018),
}


def parts(shape):
    """Keep separate polyline parts separate; do not bridge them."""
    stops = list(shape.parts) + [len(shape.points)]
    return [np.asarray(shape.points[a:b]) for a, b in zip(stops[:-1], stops[1:])]


def distance(point, lines):
    """Shortest point-to-segment distance in projected metres."""
    best = float('inf')
    for line in lines:
        a, vector = line[:-1], np.diff(line, axis=0)
        square = np.sum(vector * vector, axis=1)
        fraction = np.divide(np.sum((point-a)*vector, axis=1), square,
                             out=np.zeros_like(square), where=square > 0)
        nearest = a + np.clip(fraction, 0, 1)[:, None]*vector
        if len(nearest):
            best = min(best, float(np.linalg.norm(nearest-point, axis=1).min()))
    return best


def main():
    started = time.perf_counter()
    source = ROOT/'data/raw/hydrorivers/HydroRIVERS_v10_as/HydroRIVERS_v10_as.shp'
    output = ROOT/'outputs/hydrorivers_ratnapura_inventory.png'
    if output.exists():
        raise FileExistsError(f'Preserving existing output: {output}')
    crs = CRS.from_wkt(source.with_suffix('.prj').read_text())
    assert crs.equals(CRS.from_epsg(4326), ignore_axis_order=True)
    project = Transformer.from_crs(crs, 32644, always_xy=True)
    reader = shapefile.Reader(str(source))
    print('Asia inventory:', len(reader), reader.shapeTypeName, reader.bbox)
    print('CRS:', crs.to_string(), '; fields:', reader.fields[1:])
    # pyshp scans geometry bounding boxes, decoding records only for local hits.
    # This is a bbox candidate filter, not an exact polygon intersection.
    local = {}
    for feature in reader.iterShapeRecords(bbox=WINDOW):
        record = feature.record.as_dict()
        lines = parts(feature.shape)
        projected = [np.column_stack(project.transform(p[:, 0], p[:, 1])) for p in lines]
        local[record['HYRIV_ID']] = (record, lines, projected)
    print('Local bbox-filtered reaches:', len(local), 'window:', WINDOW)
    linked = {k: v for k, v in local.items() if v[0]['HYBAS_L12'] in SIX}
    print('Reaches linked by HYBAS_L12 to six reference polygons:', len(linked))
    for basin in sorted(SIX):
        reaches = [v[0] for v in linked.values() if v[0]['HYBAS_L12'] == basin]
        print('Basin', basin, 'reach count', len(reaches),
              'IDs', [r['HYRIV_ID'] for r in reaches])
    print('Local upstream-area range km2:', min(v[0]['UPLAND_SKM'] for v in local.values()),
          max(v[0]['UPLAND_SKM'] for v in local.values()))
    print('Strahler orders:', sorted({v[0]['ORD_STRA'] for v in local.values()}))
    print('Local downstream references: within subset / zero / outside subset:',
          sum(v[0]['NEXT_DOWN'] in local for v in local.values()),
          sum(v[0]['NEXT_DOWN'] == 0 for v in local.values()),
          sum(v[0]['NEXT_DOWN'] != 0 and v[0]['NEXT_DOWN'] not in local for v in local.values()))
    # Only local topology completeness is checked; outside-window IDs are not errors.
    for start in local:
        seen = set(); current = start
        while current in local:
            assert current not in seen, f'Connectivity cycle at {current}'
            seen.add(current); current = local[current][0]['NEXT_DOWN']
    print('PASS: no cycles within selected reference topology')
    for name, xy in POINTS.items():
        point = np.asarray(project.transform(*xy))
        nearest = sorted((distance(point, v[2]), k) for k, v in local.items())[:3]
        for rank, (metres, reach) in enumerate(nearest, 1):
            r = local[reach][0]
            print(name, 'rank', rank, 'distance_m', round(metres, 1),
                  {k: r[k] for k in ('HYRIV_ID','NEXT_DOWN','MAIN_RIV','HYBAS_L12','UPLAND_SKM','ORD_STRA')})
    fig, ax = plt.subplots(figsize=(12, 9))
    # Existing reference polygons only; V2 mask and exact difference zones are not saved.
    basins = shapefile.Reader(str(ROOT/'data/raw/hydrobasins/hybas_as_lev12_v1c.shp'))
    for record in basins.iterRecords(fields=['HYBAS_ID']):
        if record[0] in SIX:
            for ring in parts(basins.shape(record.oid)):
                ax.plot(ring[:, 0], ring[:, 1], color='purple', alpha=.65, linewidth=1)
    ax.add_collection(LineCollection([p for v in local.values() for p in v[1]],
                                    colors='lightsteelblue', linewidths=.8, label='Local HydroRIVERS'))
    ax.add_collection(LineCollection([p for v in linked.values() for p in v[1]],
                                    colors='navy', linewidths=1.3, label='HYBAS_L12 linked to six polygons'))
    for name, (x, y) in POINTS.items():
        ax.scatter(x, y, marker='*' if name == 'V2' else 'o',
                   s=100 if name == 'V2' else 22, color='red' if name == 'V2' else 'darkorange', zorder=5)
        ax.annotate(name, (x,y), xytext=(4,5), textcoords='offset points', fontsize=8)
    ax.set(xlim=(80.30,80.80), ylim=(6.47,6.85), xlabel='Longitude (WGS84)', ylabel='Latitude (WGS84)')
    ax.set_aspect(1/np.cos(np.deg2rad(6.66))); ax.grid(alpha=.2); ax.legend(loc='lower left')
    ax.set_title('EXPLORATORY HYDRORIVERS INVENTORY — NOT A VALIDATED RATNAPURA WATERSHED')
    fig.text(.08,.025,'Purple: six HydroBASINS outlines; orange points: earlier zone centres / modeled confluences.\n'
             'V2 outline and exact disagreement geometries unavailable. HydroRIVERS and HydroBASINS share HydroSHEDS provenance.\n'
             'Reference: Lehner & Grill (2013); HydroRIVERS v1.0 / HydroSHEDS, WWF. See raw-data METADATA.md for licence.',fontsize=8)
    fig.tight_layout(rect=(0,.08,1,1));fig.savefig(output,dpi=160);plt.close(fig)
    print('Saved',output)
    print('Runtime seconds:',round(time.perf_counter()-started,2))
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print('Peak resident MiB:',round(peak/(1024**2 if sys.platform=='darwin' else 1024),1))
    except ImportError:
        print('Peak resident memory unavailable on this platform')
    print('No DEM processing, new catchment areas, exact-zone intersections or final tributary validation.')


if __name__ == '__main__':
    main()
