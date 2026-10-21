"""Focused full-context spill diagnostic; never exports hydrological rasters.

macOS: ML-Service/.venv/bin/python ML-Service/src/inspect_m1_spill_connection.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\inspect_m1_spill_connection.py
Allow about 3-4 GiB memory. Original terrain windows are inspection only; all
conditioning uses the entire expanded DEM, float64 and unchanged eps=1e-8.
The filled footprint is the 8-connected raised component at the target fill level
(tolerance 1e-5 m), not a newly delineated watershed or a surveyed water body.
Small OSM/imagery metadata responses stay in memory. No imagery is reproduced.
"""
from pathlib import Path
import gc
import sys
import time
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from collections import Counter
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.plot import plotting_extent
from pyproj import Transformer
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
from scipy.ndimage import label, binary_dilation
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource

ROOT=Path(__file__).resolve().parents[1]
A=(1506,6205);B=(1507,6204);V2=(1196,5160)
DIRECTIONS=(64,128,1,2,4,8,16,32)
OFFSETS=dict(zip(DIRECTIONS,[(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]))


def fetch(url,limit=1000000):
    req=urllib.request.Request(url,headers={'User-Agent':'DMEWS-research-diagnostic/1.0'})
    with urllib.request.urlopen(req,timeout=35) as response:data=response.read(limit+1)
    if len(data)>limit:raise ValueError('Reference response exceeds size limit')
    return data


def main():
    started=time.perf_counter();out=ROOT/'outputs/m1_spill_connection.png'
    if out.exists():raise FileExistsError(f'Preserving existing output: {out}')
    path=ROOT/'data/processed/dem_kalu_mosaic_utm44n_30m.tif'
    with rasterio.open(path) as dem:
        assert dem.crs.to_epsg()==32644 and dem.res==(30,30) and dem.shape==(3701,7380) and dem.nodata==-9999
        affine=dem.transform;crs=dem.crs;valid=dem.read_masks(1)!=0
        z=dem.read(1,out_dtype='float64');z[~valid]=-9999
        # 7.2km inspection window; never used as a conditioning input.
        window=Window(A[1]-120,A[0]-120,241,241)
        original=dem.read(1,window=window,out_dtype='float64');local_transform=dem.window_transform(window)
    def xy(p):return np.array(rasterio.transform.xy(affine,*p))
    geo=Transformer.from_crs(crs,4326,always_xy=True)
    project=Transformer.from_crs(4326,crs,always_xy=True)
    def local(p):return p[0]-int(window.row_off),p[1]-int(window.col_off)
    print('EXACT RECORDED CELLS A/B',A,B,'UTM',xy(A),xy(B),'lonlat',geo.transform(*xy(A)),geo.transform(*xy(B)))
    assert np.isclose(z[A],472.8932189941406) and np.isclose(z[B],484.9322204589844)
    print('ORIGINAL elevations A/B',z[A],z[B],'rise',z[B]-z[A],
          'step_length_m',np.linalg.norm(xy(B)-xy(A)))
    view=ViewFinder(affine=affine,crs=crs,shape=z.shape,nodata=np.float64(-9999))
    terrain=Raster(z,viewfinder=view);del z;grid=Grid(viewfinder=view)
    print('Full-context pit filling...',flush=True)
    filled=grid.fill_pits(terrain);del terrain;gc.collect()
    pit_pair=(float(filled[A]),float(filled[B]))
    print('Depression filling...',flush=True)
    filled=grid.fill_depressions(filled)
    fill_pair=(float(filled[A]),float(filled[B]));spill=float(filled[A])
    # Build the fill-level mask blockwise, avoiding a second full original array.
    raised=np.zeros(valid.shape,dtype=bool);max_depth=0
    with rasterio.open(path) as dem:
        for _,w in dem.block_windows(1):
            rs,cs=w.toslices();o=dem.read(1,window=w,out_dtype='float64');f=np.asarray(filled[rs,cs])
            raised[rs,cs]=valid[rs,cs] & (f-o>1e-6) & (np.abs(f-spill)<=1e-5)
    labels,n=label(raised,structure=np.ones((3,3)));key=int(labels[A]);assert key>0
    component=labels==key;del labels,raised;gc.collect()
    rr,cc=np.nonzero(component)
    print('FILLED COMPONENT cells',len(rr),'area_km2',len(rr)*.0009,'spill_m',spill,
          'bbox_rows_cols',(int(rr.min()),int(cc.min()),int(rr.max()),int(cc.max())))
    component_local=component[window.toslices()].copy()
    depths=[]
    with rasterio.open(path) as dem:
        for _,w in dem.block_windows(1):
            rs,cs=w.toslices();m=component[rs,cs]
            if m.any():depths.extend((np.asarray(filled[rs,cs])[m]-dem.read(1,window=w)[m]).tolist())
    print('FILL_DEPTH min_median_max_m',np.percentile(depths,[0,50,100]),
          'filled_volume_m3',sum(depths)*900)
    margin=binary_dilation(component,np.ones((3,3))) & ~component & valid
    br,bc=np.nonzero(margin);outside=[]
    with rasterio.open(path) as dem:
        outside=np.array([v[0] for v in dem.sample([xy((int(r),int(c))) for r,c in zip(br,bc)])])
    order=np.argsort(outside)
    print('LOWEST ORIGINAL COMPONENT-MARGIN CELLS',[(int(br[i]),int(bc[i]),float(outside[i]),geo.transform(*xy((int(br[i]),int(bc[i]))))) for i in order[:8]])
    print('Component reaches DEM rim/NoData adjacency:',bool(component[0].any() or component[-1].any() or component[:,0].any() or component[:,-1].any()),
          bool((binary_dilation(component,np.ones((3,3))) & ~valid).any()))
    del component,margin,rr,cc,br,bc,depths,outside;gc.collect()
    filled[~valid]=filled[valid].max()+100
    print('Resolve flats eps=1e-8...',flush=True)
    conditioned=grid.resolve_flats(filled,eps=1e-8);del filled;conditioned[~valid]=-9999
    assert conditioned.dtype==np.float64
    direction=grid.flowdir(conditioned,routing='d8',dirmap=DIRECTIONS,nodata_out=0)
    assert direction.affine==affine and direction.crs.to_epsg()==32644
    codes=np.asarray(direction).astype('int16')
    assert int(codes[A])==8 and (A[0]+1,A[1]-1)==B
    print('STAGES original/pit/depression/flat A',original[local(A)],pit_pair[0],fill_pair[0],float(conditioned[A]))
    print('STAGES original/pit/depression/flat B',original[local(B)],pit_pair[1],fill_pair[1],float(conditioned[B]))
    print('D8 A/B',int(codes[A]),int(codes[B]),'conditioned_downhill_difference_m',float(conditioned[A]-conditioned[B]))
    print('Accumulation in memory...',flush=True)
    accumulation=grid.accumulation(direction,routing='d8',dirmap=DIRECTIONS,algorithm='iterative')
    assert accumulation[V2]==715725
    print('AREA_THROUGH_A cells',float(accumulation[A]),'km2',float(accumulation[A])*.0009,
          'AREA_AT_B cells',float(accumulation[B]),'km2',float(accumulation[B])*.0009)
    def inc(p):
        r,c=p;incoming=[]
        for code,(dr,dc) in OFFSETS.items():
            q=(r-dr,c-dc)
            if 0<=q[0]<valid.shape[0] and 0<=q[1]<valid.shape[1] and valid[q] and codes[q]==code:
                incoming.append((float(accumulation[q]),q))
        return sorted(incoming,reverse=True)
    down=[A];seen={A}
    while down[-1]!=V2:
        r,c=down[-1];assert valid[r,c] and int(codes[r,c]) in OFFSETS
        dr,dc=OFFSETS[int(codes[r,c])];q=(r+dr,c+dc)
        assert 0<=q[0]<valid.shape[0] and 0<=q[1]<valid.shape[1] and valid[q] and q not in seen
        assert conditioned[r,c]>conditioned[q]
        seen.add(q);down.append(q)
    up=[A];length=0
    while length<2500:
        incoming=inc(up[-1])
        if not incoming:break
        q=incoming[0][1];assert q not in up
        length+=np.linalg.norm(xy(q)-xy(up[-1]));up.append(q)
    print('MODELED UPSTREAM dominant stem steps',len(up)-1,'length_m',length,'end_cell',up[-1],'end_lonlat',geo.transform(*xy(up[-1])))
    dp=np.array([xy(p) for p in down])
    print('MODELED DOWNSTREAM reaches V2 steps',len(down)-1,'length_m',np.linalg.norm(np.diff(dp,axis=0),axis=1).sum())
    print('LOCAL PATH SAMPLES',[(p,geo.transform(*xy(p)),int(codes[p]),float(accumulation[p])*.0009,float(conditioned[p])) for p in up[::10]+down[:60:10]])
    del direction,accumulation,codes,conditioned;gc.collect()
    # Descriptive steepest descent in ORIGINAL local terrain, not conditioning.
    raw_route=[A];raw_seen={A};reason=''
    while True:
        p=raw_route[-1];r,c=local(p);options=[]
        for code,(dr,dc) in OFFSETS.items():
            nr,nc=r+dr,c+dc
            if not (0<=nr<original.shape[0] and 0<=nc<original.shape[1]):continue
            drop=original[r,c]-original[nr,nc]
            if drop>0:options.append((drop/(30*np.hypot(dr,dc)),(p[0]+dr,p[1]+dc)))
        if not options:reason='No strictly lower neighbour in original terrain';break
        q=max(options)[1]
        assert q not in raw_seen;raw_seen.add(q);raw_route.append(q)
        qr,qc=local(q)
        if qr in (0,original.shape[0]-1) or qc in (0,original.shape[1]-1):reason='Inspection-window edge, not a natural outlet';break
    print('ORIGINAL STEEPEST TRACE',raw_route,'termination',reason,'endpoint_elevation_m',original[local(raw_route[-1])])
    # Small independent map/imagery metadata requests, no imagery saved.
    osm=[];url='https://api.openstreetmap.org/api/0.6/map?bbox=80.675,6.589,80.688,6.602'
    try:
        raw=fetch(url);tree=ET.fromstring(raw);nodes={n.get('id'):(float(n.get('lon')),float(n.get('lat'))) for n in tree.findall('node')}
        print('OSM_SOURCE',url,'bytes',len(raw))
        for w in tree.findall('way'):
            tags={t.get('k'):t.get('v') for t in w.findall('tag')}
            if not any(k in tags for k in ('waterway','highway','bridge','tunnel','water','man_made')):continue
            refs=[n.get('ref') for n in w.findall('nd')]
            if not all(n in nodes for n in refs):continue
            p=np.array([project.transform(*nodes[n]) for n in refs]);osm.append((p,tags))
            print('OSM_FEATURE',w.get('id'),'edited',w.get('timestamp'),'tags',tags)
    except Exception as error:print('OSM_UNAVAILABLE',type(error).__name__,str(error))
    metadata_url='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/identify?'+urllib.parse.urlencode(
        {'f':'json','geometry':'80.68127191,6.59545449','geometryType':'esriGeometryPoint','sr':4326,
         'layers':'all','tolerance':1,'mapExtent':'80.675,6.589,80.688,6.602','imageDisplay':'1000,1000,96','returnGeometry':'false'})
    try:
        metadata=json.loads(fetch(metadata_url,300000))
        print('IMAGERY_METADATA_URL',metadata_url)
        print('IMAGERY_METADATA',[r for r in metadata.get('results',[]) if r.get('layerId') in (0,2,10)])
    except Exception as error:print('IMAGERY_METADATA_UNAVAILABLE',type(error).__name__,str(error))
    dy,dx=np.gradient(original,30,30);slope=np.degrees(np.arctan(np.hypot(dx,dy)))
    print('ORIGINAL SLOPE at A/B degrees',float(slope[local(A)]),float(slope[local(B)]))
    print('ORIGINAL 9x9 at A',original[local(A)[0]-4:local(A)[0]+5,local(A)[1]-4:local(A)[1]+5].tolist())
    fig,axes=plt.subplots(1,2,figsize=(15,8))
    extent=plotting_extent(original,local_transform)
    hill=LightSource(azdeg=315,altdeg=45).hillshade(original,vert_exag=1,dx=30,dy=30)
    for ax in axes:
        ax.imshow(hill,extent=extent,cmap='gray',origin='upper')
        im=ax.imshow(original,extent=extent,cmap='terrain',alpha=.5,origin='upper')
        xs=local_transform.c+(np.arange(original.shape[1])+.5)*30
        ys=local_transform.f-(np.arange(original.shape[0])+.5)*30
        ax.contour(xs,ys,component_local.astype('uint8'),levels=[.5],colors='magenta',linewidths=1.3)
        for p,tags in osm:ax.plot(p[:,0],p[:,1],color='cyan' if tags.get('waterway') else 'grey',lw=1.5)
        for cells,color,labeltext in [(up,'orange','Modeled upstream dominant stem'),(down,'red','Modeled downstream to V2'),(raw_route,'blue','Original-terrain strict descent')]:
            p=np.array([xy(c) for c in cells]);ax.plot(p[:,0],p[:,1],color=color,lw=1.5,label=labeltext)
        for name,p in [('A',A),('B',B)]:
            x,y=xy(p);ax.scatter(x,y,color='black',s=25);ax.annotate(name,(x,y),xytext=(5,4),textcoords='offset points')
        ax.set_aspect('equal');ax.grid(alpha=.2);ax.set_xlabel('UTM 44N easting (m)');ax.set_ylabel('Northing (m)')
        ax.ticklabel_format(style='plain',useOffset=False)
    axes[0].set(xlim=(xy(A)[0]-1300,xy(A)[0]+1300),ylim=(xy(A)[1]-1300,xy(A)[1]+1300),title='Original terrain/hillshade and reconstructed paths')
    axes[1].set(xlim=(xy(A)[0]-350,xy(A)[0]+350),ylim=(xy(A)[1]-350,xy(A)[1]+350),title='Exact spill step; magenta: connected raised footprint')
    axes[0].legend(fontsize=8);fig.colorbar(im,ax=axes[1],label='Original elevation (m)',shrink=.6)
    fig.suptitle('EXPLORATORY M1 CONDITIONING-DEPENDENT SPILL — NOT A VERIFIED DRAINAGE CONNECTION',fontsize=11)
    fig.text(.05,.025,'All conditioning uses full expanded DEM, float64, eps=1e-8. Original strict descent is local descriptive terrain inspection.\n'
             'Magenta footprint = 8-connected positive fill at the target spill level, not a watershed or surveyed lake. No imagery reproduced.\n'
             'Grey/cyan: available OSM roads/waterways, © OpenStreetMap contributors / ODbL. Missing mapping does not imply absent drainage.',fontsize=8)
    fig.subplots_adjust(bottom=.15,top=.88,wspace=.3);fig.savefig(out,dpi=150);plt.close(fig)
    print('Saved',out,'runtime_seconds',round(time.perf_counter()-started,2))
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print('Peak resident GiB',round(peak/(1024**3 if sys.platform=='darwin' else 1024**2),3))
    except ImportError:print('Peak memory unavailable')


if __name__=='__main__':main()
