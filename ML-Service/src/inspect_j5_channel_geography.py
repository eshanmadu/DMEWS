"""Small public OSM geography check; no DEM conditioning or exact path recovery.

macOS: ML-Service/.venv/bin/python ML-Service/src/inspect_j5_channel_geography.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\inspect_j5_channel_geography.py
Reads a <3 MB OSM window into memory; saves only a vector comparison PNG.
OSM edit dates are NOT imagery capture dates. Model cell samples below were
printed every 25 steps by the previous diagnostic; connecting lines are simplified.
Imagery was inspected separately in memory, not reproduced in this figure.
"""
from pathlib import Path
import datetime
import time
import sys
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import numpy as np
from pyproj import Transformer
import rasterio
import shapefile
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parents[1]
URL='https://api.openstreetmap.org/api/0.6/map?bbox=80.425,6.733,80.460,6.756'
MODEL_SAMPLES=[(943,5299),(942,5300),(955,5322),(961,5342),(959,5367)]
DOWNSTREAM_SAMPLES=[(943,5299),(968,5312),(972,5317)]
IMAGERY='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'


def fetch(url,limit=3000000):
    request=urllib.request.Request(url,headers={'User-Agent':'DMEWS-research-diagnostic/1.0'})
    with urllib.request.urlopen(request,timeout=30) as response:
        data=response.read(limit+1)
    if len(data)>limit:raise ValueError('Unexpectedly large reference response; stopping')
    return data


def main():
    started=time.perf_counter();output=ROOT/'outputs/j5_channel_geography.png'
    if output.exists():raise FileExistsError(f'Preserving {output}')
    project=Transformer.from_crs(4326,32644,always_xy=True)
    geo=Transformer.from_crs(32644,4326,always_xy=True)
    raw=fetch(URL);tree=ET.fromstring(raw)
    nodes={n.get('id'):(float(n.get('lon')),float(n.get('lat'))) for n in tree.findall('node')}
    ways={}
    for w in tree.findall('way'):
        tags={t.get('k'):t.get('v') for t in w.findall('tag')}
        if not (tags.get('waterway') or tags.get('bridge')):continue
        ids=[n.get('ref') for n in w.findall('nd')]
        if not all(i in nodes for i in ids):continue
        points=np.array([project.transform(*nodes[i]) for i in ids])
        ways[int(w.get('id'))]=(ids,points,tags,w.attrib)
    assert 519254402 in ways and 99659800 in ways,'Required mapped rivers unavailable'
    print('Retrieved UTC:',datetime.datetime.now(datetime.timezone.utc).isoformat())
    print('OSM source:',URL,'bytes:',len(raw),'licence: ODbL; © OpenStreetMap contributors')
    for key,(ids,points,tags,attrs) in ways.items():
        print('OSM WAY',key,'version',attrs.get('version'),'edited_UTC',attrs.get('timestamp'),'tags',tags)
    # Determine actual shared OSM node topology, not nearest geometric intersection.
    east_ids,east,_,_=ways[519254402]
    north_ids,north,_,_=ways[99659800]
    shared=set(east_ids)&set(north_ids)
    print('Shared eastern/northern river node IDs:',sorted(shared))
    assert len(shared)==1,'No unique mapped confluence; do not guess'
    node=shared.pop();junction=np.array(project.transform(*nodes[node]))
    with rasterio.open(ROOT/'data/processed/dem_kalu_mosaic_utm44n_30m.tif') as dem:
        assert dem.crs.to_epsg()==32644
        model=np.array([dem.xy(*p) for p in MODEL_SAMPLES])
        down=np.array([dem.xy(*p) for p in DOWNSTREAM_SAMPLES])
    reference=np.array(project.transform(80.43958333333305,6.73958333333325))
    print('MAPPED CONFLUENCE OSM node',node,'lonlat',nodes[node],'E/N',junction,
          'distance_to_model_J5_m',np.linalg.norm(junction-model[0]),
          'distance_to_larger_reference_m',np.linalg.norm(junction-reference))
    print('MODEL cell samples:',MODEL_SAMPLES,'; connecting segments are NOT exact D8 paths')
    print('OSM branches meeting shared node:',[(k,tags.get('waterway')) for k,(ids,_,tags,_) in ways.items() if node in ids])
    # Changeset source tags can document mapping provenance; never call edit time
    # the date of underlying imagery. Failure is a reported limitation.
    for change in ('177688866','163589341'):
        url=f'https://api.openstreetmap.org/api/0.6/changeset/{change}'
        try:
            change_tree=ET.fromstring(fetch(url,100000))
            tags={t.get('k'):t.get('v') for t in change_tree.findall('.//changeset/tag')}
            print('CHANGESET',url,tags)
        except Exception as error:print('CHANGESET NOT INSPECTED',url,type(error).__name__,str(error))
    params={'f':'json','geometry':'80.435228,6.748018','geometryType':'esriGeometryPoint',
            'sr':4326,'layers':'all','tolerance':1,'mapExtent':'80.425,6.733,80.460,6.756',
            'imageDisplay':'1200,800,96','returnGeometry':'false'}
    identify=IMAGERY+'/identify?'+urllib.parse.urlencode(params)
    try:
        metadata=json.loads(fetch(identify,300000))
        print('IMAGERY METADATA URL',identify)
        print('IMAGERY METADATA',metadata)
    except Exception as error:print('IMAGERY METADATA UNAVAILABLE',type(error).__name__,str(error))
    print('Imagery inspected separately: Esri World Imagery public export, bbox 80.430,6.73596875,80.451,6.75303125; 640x520 pixels (~3.6m display sampling).')
    print('Display sampling is NOT native resolution or positional accuracy. Capture date unknown unless metadata above establishes it.')
    fig,axes=plt.subplots(1,2,figsize=(15,8),gridspec_kw={'width_ratios':[1.3,1]})
    reader=shapefile.Reader(str(ROOT/'data/raw/hydrorivers/HydroRIVERS_v10_as/HydroRIVERS_v10_as.shp'))
    refs={}
    for item in reader.iterShapeRecords(bbox=(80.425,6.733,80.460,6.756)):
        key=item.record['HYRIV_ID']
        if key in {41406594,41406613,41406633,41406634,41406815}:
            p=np.array(item.shape.points);refs[key]=np.column_stack(project.transform(p[:,0],p[:,1]))
    assert len(refs)==5
    for ax in axes:
        for k,(ids,points,tags,attrs) in ways.items():
            if tags.get('waterway'):
                ax.plot(points[:,0],points[:,1],color='teal',lw=2 if tags['waterway']=='river' else .9,
                        label='OSM mapped waterways' if k==519254402 else None)
            elif tags.get('bridge'):
                ax.plot(points[:,0],points[:,1],color='grey',lw=3)
        for k,line in refs.items():
            ax.plot(line[:,0],line[:,1],color='navy',ls='--',lw=1,label='HydroRIVERS' if k==41406633 else None)
        ax.plot(model[:,0],model[:,1],color='darkorange',ls=':',marker='.',lw=2,label='Simplified modeled approach (25-step samples)')
        ax.plot(down[:,0],down[:,1],color='red',ls=':',lw=1.5,label='Simplified modeled downstream samples')
        ax.scatter(*model[0],marker='*',s=140,color='red',zorder=6,label='Modeled J5')
        ax.scatter(*reference,marker='x',s=85,color='navy',zorder=6,label='Larger HydroRIVERS junction')
        ax.scatter(*junction,s=75,facecolors='none',edgecolors='black',zorder=7,label='OSM shared-node confluence')
        ax.set_aspect('equal');ax.ticklabel_format(style='plain',useOffset=False);ax.grid(alpha=.2)
        ax.set_xlabel('UTM 44N easting (m)');ax.set_ylabel('Northing (m)')
    axes[0].set(xlim=(436800,440100),ylim=(744600,746900),title='Final approach and competing junction locations')
    axes[1].set(xlim=(437250,437950),ylim=(745700,746400),title='Mapped branches near J5: complex arrangement')
    axes[0].legend(fontsize=7,loc='lower right')
    fig.suptitle('EXPLORATORY J5 CHANNEL GEOMETRY VALIDATION — NOT SURVEYED HYDROGRAPHY',fontsize=11)
    fig.text(.05,.025,'© OpenStreetMap contributors / ODbL, https://www.openstreetmap.org/copyright. Edit dates are not imagery acquisition dates.\n'
             'HydroRIVERS v1.0 / HydroSHEDS (WWF), Lehner & Grill (2013). Modeled lines are simplified context, not exact rerouted channels.\n'
             'No imagery reproduced, no DEM processing, no outlet changes. OSM mapping provenance and positional accuracy remain limited.',fontsize=8)
    fig.tight_layout(rect=(0,.09,1,.94));fig.savefig(output,dpi=160);plt.close(fig)
    print('Saved',output,'runtime_seconds',round(time.perf_counter()-started,2))
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print('Peak resident MiB',round(peak/(1024**2 if sys.platform=='darwin' else 1024),1))
    except ImportError:print('Peak memory unavailable')


if __name__=='__main__':main()
