"""Compact terrain and public-map inspection; never conditions or routes a DEM.

macOS: ML-Service/.venv/bin/python ML-Service/src/inspect_m2_channel_geography.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\inspect_m2_channel_geography.py
Small online extracts remain in memory. Saves only a terrain/vector PNG, no imagery.
Only previously recorded modeled cells/step are shown: intermediate path geometry
was not saved. Conditioned elevations below are prior results, not recalculated.
"""
from pathlib import Path
import time
import sys
import datetime
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.plot import plotting_extent
from pyproj import Transformer, CRS
import shapefile
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource

ROOT=Path(__file__).resolve().parents[1]
A=(1734,5790);B=(1733,5790)
KNOWN={'A':A,'B':B,'H':(1740,5779),'X':(1739,5780)}
OSM='https://api.openstreetmap.org/api/0.6/map?bbox=80.562,6.527,80.578,6.541'
IMAGERY='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'


def fetch(url,limit=1000000):
    request=urllib.request.Request(url,headers={'User-Agent':'DMEWS-research-diagnostic/1.0'})
    with urllib.request.urlopen(request,timeout=35) as response:data=response.read(limit+1)
    if len(data)>limit:raise ValueError('Reference response exceeds 1 MB limit')
    return data


def main():
    started=time.perf_counter();output=ROOT/'outputs/m2_channel_geography.png'
    if output.exists():raise FileExistsError(f'Preserving {output}')
    with rasterio.open(ROOT/'data/processed/dem_kalu_mosaic_utm44n_30m.tif') as dem:
        assert dem.crs.to_epsg()==32644 and dem.res==(30,30) and dem.nodata==-9999
        transform=dem.transform;window=Window(A[1]-90,A[0]-90,181,181)
        terrain=dem.read(1,window=window,out_dtype='float64');assert (dem.read_masks(1,window=window)==255).all()
        local_transform=dem.window_transform(window)
    geo=Transformer.from_crs(32644,4326,always_xy=True)
    project=Transformer.from_crs(4326,32644,always_xy=True)
    def xy(cell):return np.array(rasterio.transform.xy(transform,*cell))
    def local(cell):return cell[0]-int(window.row_off),cell[1]-int(window.col_off)
    assert np.isclose(terrain[local(A)],290.2893371582031,rtol=0,atol=1e-8)
    assert np.isclose(terrain[local(B)],293.37554931640625,rtol=0,atol=1e-8)
    dy,dx=np.gradient(terrain,30,30);slope=np.degrees(np.arctan(np.hypot(dx,dy)))
    for name,cell in KNOWN.items():
        print('EXACT CELL',name,cell,'E/N',xy(cell),'latlon',geo.transform(*xy(cell))[::-1],
              'original_m',terrain[local(cell)],'original_slope_deg',slope[local(cell)])
    print('ORIGINAL RISE A_TO_B',terrain[local(B)]-terrain[local(A)])
    print('PRIOR CONDITIONED RESULTS A=293.6554265053906; B=293.65542648539065; D8 A=64 (north). Not recomputed.')
    r,c=local(A);print('ORIGINAL 9x9 A',terrain[r-4:r+5,c-4:c+5].tolist())
    print('ORIGINAL NEIGHBOUR DROPS (positive=lower)',[(dr,dc,float(terrain[r,c]-terrain[r+dr,c+dc]))
          for dr in (-1,0,1) for dc in (-1,0,1) if (dr,dc)!=(0,0)])
    maplines=[]
    try:
        raw=fetch(OSM);tree=ET.fromstring(raw)
        nodes={n.get('id'):(float(n.get('lon')),float(n.get('lat'))) for n in tree.findall('node')}
        print('OSM_SOURCE',OSM,'bytes',len(raw),'retrieved_UTC',datetime.datetime.now(datetime.timezone.utc).isoformat())
        for w in tree.findall('way'):
            tags={t.get('k'):t.get('v') for t in w.findall('tag')}
            if not any(k in tags for k in ('waterway','highway','bridge','tunnel','water','man_made')):continue
            ids=[n.get('ref') for n in w.findall('nd')]
            if not all(n in nodes for n in ids):continue
            p=np.array([project.transform(*nodes[n]) for n in ids]);maplines.append((p,tags))
            print('OSM_FEATURE',w.get('id'),'version',w.get('version'),'edited_UTC',w.get('timestamp'),
                  'tags',tags,'first_last_lonlat',nodes[ids[0]],nodes[ids[-1]])
        print('OSM edit dates are not imagery acquisition dates; volunteered map accuracy/provenance unverified.')
    except Exception as error:print('OSM_UNAVAILABLE',type(error).__name__,str(error))
    metadata_url=IMAGERY+'/identify?'+urllib.parse.urlencode({'f':'json','geometry':'80.568702176,6.533496075',
        'geometryType':'esriGeometryPoint','sr':4326,'layers':'all','tolerance':1,
        'mapExtent':'80.562,6.527,80.578,6.541','imageDisplay':'1000,1000,96','returnGeometry':'false'})
    try:
        metadata=json.loads(fetch(metadata_url,300000))
        print('IMAGERY_METADATA_URL',metadata_url)
        print('IMAGERY_METADATA',[r for r in metadata.get('results',[]) if r.get('layerId') in (0,2,10)])
    except Exception as error:print('IMAGERY_METADATA_UNAVAILABLE',type(error).__name__,str(error))
    reader=shapefile.Reader(str(ROOT/'data/raw/hydrorivers/HydroRIVERS_v10_as/HydroRIVERS_v10_as.shp'))
    assert CRS.from_wkt(Path(reader.shapeName).with_suffix('.prj').read_text()).to_epsg()==4326
    records={};lines={}
    for feature in reader.iterShapeRecords(bbox=(80.51,6.50,80.61,6.58)):
        record=feature.record.as_dict();key=record['HYRIV_ID'];records[key]=record
        p=np.array(feature.shape.points);stops=list(feature.shape.parts)+[len(p)]
        lines[key]=[np.column_stack(project.transform(p[a:b,0],p[a:b,1])) for a,b in zip(stops[:-1],stops[1:])]
    required={41407694,41407747,41406940,41406849,41406848}
    # Load compact attributes for the entire Kalu reference network, not all Asia.
    for record in reader.iterRecords(fields=['MAIN_RIV']):
        if record[0]==41407423:
            full=reader.record(record.oid).as_dict();records[full['HYRIV_ID']]=full
    assert required<=records.keys()
    for start in (41407694,41407747,41406940):
        key=start;seen=set();path=[]
        while key:
            assert key in records and key not in seen
            seen.add(key);path.append(key);key=records[key]['NEXT_DOWN']
        print('VERIFIED REFERENCE PATH',start,path)
    print('Reference reaches are generalized HydroSHEDS geometry; no nearest-line drainage assignment is made.')
    fig,axes=plt.subplots(1,2,figsize=(15,8),gridspec_kw={'width_ratios':[1.2,1]})
    extent=plotting_extent(terrain,local_transform)
    hill=LightSource(azdeg=315,altdeg=45).hillshade(terrain,dx=30,dy=30)
    xs=local_transform.c+(np.arange(terrain.shape[1])+.5)*30
    ys=local_transform.f-(np.arange(terrain.shape[0])+.5)*30
    for ax in axes:
        ax.imshow(hill,extent=extent,cmap='gray');ax.imshow(terrain,extent=extent,cmap='terrain',alpha=.5)
        ax.contour(xs,ys,terrain,levels=np.arange(200,700,20),colors='black',linewidths=.3,alpha=.5)
        for p,tags in maplines:
            ax.plot(p[:,0],p[:,1],color='cyan' if tags.get('waterway') else 'grey',lw=1.6)
        for key,parts in lines.items():
            for p in parts:ax.plot(p[:,0],p[:,1],color='navy',ls='--',lw=1)
        for name,cell in KNOWN.items():
            ax.scatter(*xy(cell),s=25,color='red');ax.annotate(name,xy(cell),xytext=(5,4),textcoords='offset points')
        ax.annotate('',xy=xy(B),xytext=xy(A),arrowprops={'arrowstyle':'->','color':'red','lw':2})
        ax.set_aspect('equal');ax.ticklabel_format(style='plain',useOffset=False);ax.grid(alpha=.2)
        ax.set_xlabel('UTM 44N easting (m)');ax.set_ylabel('Northing (m)')
    axes[0].set(xlim=(xy(A)[0]-2600,xy(A)[0]+1900),ylim=(xy(A)[1]-2200,xy(A)[1]+1800),title='Original terrain; navy dashed: HydroRIVERS; grey/cyan: OSM')
    axes[1].set(xlim=(xy(A)[0]-400,xy(A)[0]+500),ylim=(xy(A)[1]-450,xy(A)[1]+450),title='Exact recorded northward step; no intermediate route invented')
    fig.suptitle('EXPLORATORY M2 CHANNEL GEOGRAPHY — NOT VERIFIED DRAINAGE ROUTING',fontsize=12)
    fig.text(.05,.025,'Red arrow: prior modeled D8 A→B. H/X: prior recorded cells. Background: unchanged original Copernicus DEM. No conditioning run.\n'
             '© OpenStreetMap contributors / ODbL. HydroRIVERS v1.0 / HydroSHEDS (WWF), Lehner & Grill (2013); shared provenance with HydroBASINS.\n'
             'No imagery reproduced. Missing waterway mapping does not establish absent drainage. Complete local D8 path was not saved.',fontsize=8)
    fig.subplots_adjust(bottom=.16,top=.88,wspace=.27);fig.savefig(output,dpi=150);plt.close(fig)
    print('Saved',output,'runtime_seconds',round(time.perf_counter()-started,2))
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print('Peak resident MiB',round(peak/(1024**2 if sys.platform=='darwin' else 1024),1))
    except ImportError:print('Peak memory unavailable')


if __name__=='__main__':main()
