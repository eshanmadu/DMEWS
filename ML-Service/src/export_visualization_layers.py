"""Export reference geography only. Never conditions terrain or extracts V2.

Run with ML-Service/.venv/bin/python (Windows: .venv/Scripts/python.exe).
Existing outputs are preserved; remove/replace them only after explicit approval.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import math
import time
import warnings

import rasterio
from rasterio.warp import transform_geom
from pyproj import CRS, Transformer
import shapefile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/visualization'
SIX = {4121158860, 4121158880, 4121158930, 4121158950, 4121158960, 4121602270}
FILES = ['kalu_reference.geojson', 'ratnapura_reference.geojson',
         'hydrorivers_kalu.geojson', 'stations.geojson', 'manifest.json']
LICENSE_URL = 'https://data.hydrosheds.org/file/technical-documentation/HydroSHEDS_TechDoc_v1_4.pdf'
# Required Exhibit B notice, with the derivative product name substituted.
ATTRIBUTION = ('This product Cascade Disaster Prediction System reference map incorporates data '
    'from the HydroSHEDS version 1 database which is © World Wildlife Fund, Inc. (2006-2022) '
    'and has been used herein under license. WWF has not evaluated the data as altered and '
    'incorporated within Cascade Disaster Prediction System reference map, and therefore gives '
    'no warranty regarding its accuracy, completeness, currency or suitability for any particular '
    'purpose. Portions of the HydroSHEDS v1 database incorporate data which are the intellectual '
    'property rights of © USGS (2006-2008), NASA (2000-2005), ESRI (1992-1998), CIAT (2004-2006), '
    'UNEP-WCMC (1993), WWF (2004), Commonwealth of Australia (2007), and Her Royal Majesty and '
    'the British Crown and are used under license. The HydroSHEDS v1 database and more '
    'information are available at https://www.hydrosheds.org.')


def validate_geometry(g):
    """Structural checks; fail rather than drop/repair suspicious geometry.

    This does not certify absence of every possible polygon self-intersection.
    pyshp groups polygon rings and holes using shapefile ring orientation.
    """
    kind, coords = g['type'], g['coordinates']
    if kind == 'Point':
        lines = [[coords]]
    elif kind in ('LineString', 'Polygon'):
        lines = [coords] if kind == 'LineString' else coords
    elif kind in ('MultiLineString', 'MultiPolygon'):
        lines = coords if kind == 'MultiLineString' else [r for p in coords for r in p]
    else:
        raise ValueError('Unsupported geometry: ' + kind)
    if not lines or any(not line for line in lines):
        raise ValueError('Empty geometry')
    for line in lines:
        for lon, lat in line:
            if not (math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90):
                raise ValueError('Invalid WGS84 longitude/latitude')
            if not (79 <= lon <= 82 and 5 <= lat <= 8):
                raise ValueError('Unexpected study-region coordinate/order')
        if 'Polygon' in kind and (len(line) < 4 or line[0] != line[-1]):
            raise ValueError('Unclosed/short polygon ring')
        if 'LineString' in kind and len(line) < 2:
            raise ValueError('Short river line')


def feature(geometry, properties):
    validate_geometry(geometry)
    return {'type': 'Feature', 'properties': properties, 'geometry': geometry}


def collection(features):
    return {'type': 'FeatureCollection', 'features': features}


def main():
    started = time.perf_counter()
    if any((OUT / name).exists() for name in FILES):
        raise FileExistsError('Preserving existing visualization exports; no files written')
    basin = ROOT / 'data/raw/hydrobasins/hybas_as_lev12_v1c.shp'
    rivers = ROOT / 'data/raw/hydrorivers/HydroRIVERS_v10_as/HydroRIVERS_v10_as.shp'
    layers = {}
    for path in (basin, rivers):
        source_crs = CRS.from_wkt(path.with_suffix('.prj').read_text())
        if not source_crs.equals(CRS.from_epsg(4326), ignore_axis_order=True):
            raise ValueError('Expected geographic WGS84 source: ' + str(path))
    # Retain every source polygon, including parts and holes; no dissolve/simplification.
    kalu, ratnapura = [], []
    with shapefile.Reader(str(basin)) as reader, warnings.catch_warnings():
        warnings.simplefilter('error')
        for rec in reader.iterRecords():
            if int(rec['MAIN_BAS']) != 4120049010:
                continue
            geom = transform_geom('EPSG:4326', 'EPSG:4326', reader.shape(rec.oid).__geo_interface__)
            props = {k: rec[k] for k in ('HYBAS_ID', 'NEXT_DOWN', 'MAIN_BAS', 'SUB_AREA', 'UP_AREA')}
            props['status'] = 'HydroBASINS reference geography; not the modeled V2 watershed'
            f = feature(geom, props)
            kalu.append(f)
            if int(rec['HYBAS_ID']) in SIX:
                ratnapura.append(f)
    assert len(kalu) == 23 and {f['properties']['HYBAS_ID'] for f in ratnapura} == SIX
    assert len({f['properties']['HYBAS_ID'] for f in kalu}) == 23
    network = []
    with shapefile.Reader(str(rivers)) as reader:
        # Scan one attribute for Asia; decode only selected geometries and records.
        for brief in reader.iterRecords(fields=['MAIN_RIV']):
            if int(brief[0]) != 41407423:
                continue
            rec = reader.record(brief.oid)
            props = {k: rec[k] for k in ('HYRIV_ID', 'NEXT_DOWN', 'MAIN_RIV', 'UPLAND_SKM',
                                       'CATCH_SKM', 'ORD_STRA', 'LENGTH_KM', 'HYBAS_L12')}
            props['status'] = 'HydroRIVERS reference river geometry; not DEM-derived channels'
            geom = transform_geom('EPSG:4326', 'EPSG:4326', reader.shape(brief.oid).__geo_interface__)
            network.append(feature(geom, props))
    assert len(network) == 403 and len({f['properties']['HYRIV_ID'] for f in network}) == 403
    ids = {f['properties']['HYRIV_ID'] for f in network}
    assert all(f['properties']['NEXT_DOWN'] == 0 or f['properties']['NEXT_DOWN'] in ids for f in network)
    dem = ROOT / 'data/processed/dem_kalu_mosaic_utm44n_30m.tif'
    with rasterio.open(dem) as src:
        assert src.crs.to_epsg() == 32644 and src.res == (30, 30)
        x, y = src.xy(1196, 5160)
        assert src.read_masks(1, window=rasterio.windows.Window(5160, 1196, 1, 1))[0, 0]
        lon, lat = Transformer.from_crs(src.crs, 4326, always_xy=True).transform(x, y)
    markers = [
        ('ratnapura_annual', 'Ratnapura — annual coordinate', 80.394166667, 6.678333333,
         'Hydrological Annual 2019/20, Table 2, printed p.7',
         'https://www.irrigation.gov.lk/web/images/Downloads/Publications/HydrologyAnnual_2019-20.pdf',
         'Printed WGS84 station listing; coordinate columns conflict; measuring section unverified'),
        ('ratnapura_dmc', 'Ratnapura — alternative published coordinate', 80.397166667, 6.678666667,
         'DMC-hosted river-status material, 2021; corroborating 15 May 2022 listing',
         'https://www.dmc.gov.lk/images/dmcreports/Water_Level_%26_Rainfall_2022__1652608785.pdf',
         'Displayed assuming WGS84; source datum and exact physical marker unverified'),
        ('ellagawa', 'Ellagawa — published station coordinate', 80.210000, 6.731944,
         'Existing DEM study metadata / Hydrological Annual station inventory',
         'https://www.irrigation.gov.lk/web/images/Downloads/Publications/HydrologyAnnual_2019-20.pdf',
         'Previously supplied approximate station marker; exact measuring section not verified'),
        ('v2', 'V2 — provisional modeled outlet', lon, lat,
         'Expanded projected DEM cell centre, zero-based row 1196 / column 5160', '',
         'Provisional research outlet; not a verified gauge cross-section; watershed polygon not exported')]
    stations = []
    for key, name, lon, lat, source, url, uncertainty in markers:
        props = dict(id=key, name=name, source=source, source_url=url, uncertainty=uncertainty)
        if key == 'v2':
            props.update(row=1196, column=5160, easting=x, northing=y, projected_crs='EPSG:32644')
        stations.append(feature({'type': 'Point', 'coordinates': [lon, lat]}, props))
    for name, fs in zip(FILES[:4], (kalu, ratnapura, network, stations)):
        layers[name] = collection(fs)
    encoded = {name: json.dumps(value, ensure_ascii=False, allow_nan=False,
                               separators=(',', ':')).encode('utf-8') for name, value in layers.items()}
    manifest = {
        'title': 'Cascade Disaster Prediction System — reference map',
        'exported_utc': datetime.now(timezone.utc).isoformat(),
        'crs': 'WGS84 / EPSG:4326; GeoJSON positions are longitude, latitude',
        'method': 'Unmodified source geometry; no simplification; hole-aware pyshp Polygon/MultiPolygon conversion; rasterio CRS normalization',
        'selection': {'kalu': 'MAIN_BAS=4120049010', 'ratnapura': sorted(SIX), 'rivers': 'MAIN_RIV=41407423'},
        'sources': {'hydrobasins': 'https://data.hydrosheds.org/file/hydrobasins/standard/hybas_as_lev12_v1c.zip',
                    'hydrorivers': 'https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_as_shp.zip',
                    'local_basin': str(basin.relative_to(ROOT)), 'local_rivers': str(rivers.relative_to(ROOT)),
                    'v2_dem': str(dem.relative_to(ROOT))},
        'layers': {name: {'features': len(layers[name]['features']), 'bytes': len(data),
                         'sha256': hashlib.sha256(data).hexdigest()} for name, data in encoded.items()},
        'research': {'published_ratnapura_km2': 603, 'previous_diagnostic_v2_km2': 644.1525,
                     'v2_polygon_exported': False, 'live_predictions': False, 'eps_context': '1e-8; not executed by exporter'},
        'limitations': ['Station cross-section and area discrepancy unresolved',
                       'HydroBASINS and HydroRIVERS share HydroSHEDS provenance; not independent surveyed truth',
                       'Reference rivers do not establish exact channel positions or validated river-to-coast routing',
                       'Structural geometry checks passed; full topological validity not certified'],
        'license': {'name': 'HydroSHEDS licence; not CC0', 'url': LICENSE_URL,
                    'notice': ATTRIBUTION, 'distribution': 'Local research prototype; retain notice and comply with licence before redistribution'},
        'citations': ['Lehner, Verdin & Jarvis (2008), Eos 89(10), 93–94.',
                      'Lehner & Grill (2013), Hydrological Processes 27(15), 2171–2186, doi:10.1002/hyp.9740',
                      'Lehner & Grill (2013), HydroBASINS technical documentation v1c.'],
    }
    encoded['manifest.json'] = json.dumps(manifest, ensure_ascii=False, allow_nan=False, indent=2).encode('utf-8')
    # All validation precedes writing. Exclusive creation prevents accidental replacement.
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in encoded.items():
        with (OUT / name).open('xb') as stream:
            stream.write(data)
        print(name, len(data), 'bytes', flush=True)
    print('PASS: 23 basin polygons, six reference polygons, 403 rivers, four markers')
    print('Runtime: %.2f seconds' % (time.perf_counter() - started))
    try:
        import resource, sys
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print('Peak resident MiB: %.1f' % (peak / (1024**2 if sys.platform == 'darwin' else 1024)))
    except ImportError:
        print('Peak memory measurement unavailable on this platform')


if __name__ == '__main__':
    main()
