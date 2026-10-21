"""Focused full-context spill diagnostic; never exports hydrological rasters.

macOS: ML-Service/.venv/bin/python ML-Service/src/assess_m1_spill_sensitivity.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\assess_m1_spill_sensitivity.py
Allow about 3-4 GiB memory. Original terrain windows are inspection only; all
conditioning uses the entire expanded DEM, float64 and unchanged eps=1e-8.
The filled footprint is the 8-connected raised component at the target fill level
(tolerance 1e-5 m), not a newly delineated watershed or a surveyed water body.
No network access or alternative conditioning. Baseline arrays are never edited.
This computes conditional sensitivity bounds, not an alternative watershed.
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
import shapefile
from rasterio.features import rasterize
from rasterio.warp import transform_geom
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
    started=time.perf_counter();out=ROOT/'outputs/m1_spill_sensitivity.png'
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
    del margin,rr,cc,br,bc,depths,outside;gc.collect()
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
    # Exact eastern rim was recorded in inspect_m1_spill_connection.py output.
    E=(1507,6215)
    with rasterio.open(path) as dem:
        e_original=float(next(dem.sample([xy(E)]))[0])
    assert np.isclose(e_original,485.0522155761719,rtol=0,atol=1e-8)
    print('EASTERN RIM EXACT',E,'E/N',xy(E),'lonlat',geo.transform(*xy(E)),
          'original_m',e_original,'conditioned_m',float(conditioned[E]),
          'D8',int(codes[E]),'height_above_B_m',e_original-float(original[local(B)]))
    # Identify the complete reverse-connected network whose baseline exit is A->B.
    dependent=np.asarray(grid.catchment(x=A[1],y=A[0],fdir=direction,dirmap=DIRECTIONS,
                         routing='d8',xytype='index',algorithm='iterative'),dtype=bool)
    v2=np.asarray(grid.catchment(x=V2[1],y=V2[0],fdir=direction,dirmap=DIRECTIONS,
                 routing='d8',xytype='index',algorithm='iterative'),dtype=bool)
    assert dependent.sum()==1861 and v2.sum()==715725 and not (dependent & ~v2).any()
    # Reverse closure plus strict descent establishes all dependency cells reach A.
    rr,cc=np.nonzero(dependent)
    for r,c in zip(rr,cc):
        if (int(r),int(c))==A:continue
        dr,dc=OFFSETS[int(codes[r,c])];q=(int(r)+dr,int(c)+dc)
        assert dependent[q] and conditioned[r,c]>conditioned[q]
    print('DEPENDENT_NETWORK cells',dependent.sum(),'km2',dependent.sum()*.0009,
          'all_within_V2',True,'filled_component_cells',component.sum(),
          'component_cells_using_A_exit',int((dependent & component).sum()))
    print('BASELINE_SCOPE area_at_B_includes_other_inflows:',float(accumulation[B])*.0009)
    # Determine which baseline-dependent cells are in the previously defined M1.
    rmin,cmin=np.nonzero(v2);rstart,cstart=int(rmin.min()),int(cmin.min())
    height,width=int(rmin.max()-rstart+1),int(cmin.max()-cstart+1)
    vw=Window(cstart,rstart,width,height)
    with rasterio.open(path) as dem:vt=dem.window_transform(vw)
    basins=shapefile.Reader(str(ROOT/'data/raw/hydrobasins/hybas_as_lev12_v1c.shp'))
    six={4121158860,4121158880,4121158930,4121158950,4121158960,4121602270};geometries=[]
    for record in basins.iterRecords(fields=['HYBAS_ID']):
        if record[0] in six:
            geometries.append(transform_geom(4326,32644,basins.shape(record.oid).__geo_interface__))
    assert len(geometries)==6
    reference=rasterize([(g,1) for g in geometries],out_shape=(height,width),transform=vt,
                        all_touched=False,dtype='uint8')!=0
    vm=v2[vw.toslices()];labels,n=label(vm & ~reference,np.ones((3,3)))
    sizes=np.bincount(labels.ravel());sizes[0]=0;m1=labels==int(sizes.argmax())
    assert m1.sum()==5900
    overlap=int((dependent[vw.toslices()] & m1).sum())
    print('DEPENDENT_NETWORK_M1_OVERLAP cells',overlap,'km2',overlap*.0009,
          'NOTE: overlapping membership, not demonstrated lost area')
    del labels,reference,vm,m1,rmin,cmin;gc.collect()
    west_set=set(down)
    def route(start):
        cells=[];seen=set();current=start
        while True:
            assert current not in seen,'Baseline routing loop';seen.add(current);cells.append(current)
            assert valid[current],'NoData entry'
            if current==V2:return cells,'reached V2'
            if component[current]:return cells,'returned to original filled component'
            if current in west_set:return cells,'joined western route to V2'
            code=int(codes[current])
            if code not in OFFSETS:return cells,f'baseline terminal code {code}'
            dr,dc=OFFSETS[code];q=(current[0]+dr,current[1]+dc)
            if not (0<=q[0]<valid.shape[0] and 0<=q[1]<valid.shape[1]):return cells,'raster edge'
            if not valid[q]:return cells,'next step would enter NoData'
            assert conditioned[current]>conditioned[q],'Non-descending valid baseline edge'
            current=q
    eastern_paths={};points_to_check=[E]
    print('ORIGINAL EASTERN RIM 5x5',original[local(E)[0]-2:local(E)[0]+3,local(E)[1]-2:local(E)[1]+3].tolist())
    # Candidate outward neighbours are selected by original local downslope only.
    # Their BASELINE destinations are inspected; no hypothetical edge is inserted.
    with rasterio.open(path) as dem:
        for code,(dr,dc) in OFFSETS.items():
            q=(E[0]+dr,E[1]+dc);z=float(next(dem.sample([xy(q)]))[0])
            print('E_NEIGHBOUR',q,'original_m',z,'in_filled_component',bool(component[q]),
                  'baseline_D8',int(codes[q]))
            if z<e_original and not component[q]:points_to_check.append(q)
        for start in points_to_check:
            cells,reason=route(start);p=np.array([xy(c) for c in cells]);eastern_paths[start]=(cells,p,reason)
            # First 30 cells provide an original/conditioned receiving profile.
            profile=np.array([v[0] for v in dem.sample(p[:30])])
            print('EASTERN_BASELINE_ROUTE from',start,'reason',reason,'steps',len(cells)-1,
                  'length_m',np.linalg.norm(np.diff(p,axis=0),axis=1).sum() if len(p)>1 else 0,
                  'final_cell',cells[-1],'final_lonlat',geo.transform(*p[-1]),
                  'start_in_V2',bool(v2[start]),'start_baseline_area_km2',float(accumulation[start])*.0009)
            print('EASTERN ORIGINAL PROFILE first30',list(zip(cells[:30],profile.tolist())))
            print('EASTERN CONDITIONED PROFILE first30',[(c,float(conditioned[c])) for c in cells[:30]])
            print('EASTERN PATH SAMPLES 100 STEPS',cells[::100])
    # Original outside-corridor descent is descriptive only. Stop if a lower
    # original neighbour leads back into the source depression or another pit.
    for start in points_to_check:
        cells=[start];seen={start};reason=''
        while len(cells)<1000:
            p=cells[-1];r,c=local(p)
            if not (1<=r<original.shape[0]-1 and 1<=c<original.shape[1]-1):reason='inspection edge';break
            options=[]
            for code,(dr,dc) in OFFSETS.items():
                drop=original[r,c]-original[r+dr,c+dc]
                if drop>0:options.append((drop/(30*np.hypot(dr,dc)),(p[0]+dr,p[1]+dc)))
            if not options:reason='original-terrain local pit';break
            q=max(options)[1]
            if component[q]:reason='descends back into source depression';break
            assert q not in seen;seen.add(q);cells.append(q)
        print('ORIGINAL_CORRIDOR_CHECK',start,'reason',reason,'cells',cells[:40],
              'last',cells[-1],'last_original_m',float(original[local(cells[-1])]))
    affected=1861*.0009
    print('NONINVASIVE_UPPER_BOUND km2',affected,'percent_V2',100*affected/644.1525,
          'percent_published_area_gap',100*affected/41.1525,
          'conditional_remaining_gap_if_all_exit_V2',41.1525-affected)
    print('CONDITIONAL_LOSS_RANGE km2 0 to',affected,
          '; only for a change limited to the identified A-exit dependency network. No modified routing was executed.')
    print('Larger reconditioning may affect other cells; this bound is not global to arbitrary DEM changes.')
    fig,axes=plt.subplots(1,2,figsize=(15,8))
    hill=LightSource(azdeg=315,altdeg=45).hillshade(original,dx=30,dy=30)
    extent=plotting_extent(original,local_transform)
    xs=local_transform.c+(np.arange(original.shape[1])+.5)*30
    ys=local_transform.f-(np.arange(original.shape[0])+.5)*30
    for ax in axes:
        ax.imshow(hill,extent=extent,cmap='gray');ax.imshow(original,extent=extent,cmap='terrain',alpha=.5)
        ax.contour(xs,ys,component_local.astype('uint8'),levels=[.5],colors='magenta',linewidths=1.5)
        ax.contour(xs,ys,v2[window.toslices()].astype('uint8'),levels=[.5],colors='black',linewidths=1.3)
        ax.plot(dp[:,0],dp[:,1],color='red',label='Baseline western route to V2')
        for start,(cells,p,reason) in eastern_paths.items():
            ax.plot(p[:,0],p[:,1],color='navy',ls='--',label='Unchanged baseline route from E' if start==E else None)
        for name,p in [('A',A),('B',B),('E',E)]:
            x,y=xy(p);ax.scatter(x,y,color='black',s=25);ax.annotate(name,(x,y),xytext=(5,5),textcoords='offset points')
        ax.set_aspect('equal');ax.ticklabel_format(style='plain',useOffset=False);ax.grid(alpha=.2)
        ax.set_xlabel('UTM 44N easting (m)');ax.set_ylabel('Northing (m)')
    axes[0].set(xlim=(xy(A)[0]-1100,xy(A)[0]+1600),ylim=(xy(A)[1]-1300,xy(A)[1]+1000),title='Original terrain; black: provisional V2 boundary')
    axes[1].set(xlim=(xy(A)[0]-200,xy(A)[0]+700),ylim=(xy(A)[1]-500,xy(A)[1]+450),title='Candidate eastern rim, not a forced alternative outlet')
    axes[0].legend(fontsize=8)
    fig.suptitle('EXPLORATORY M1 SPILL-OUTLET SENSITIVITY — NO ROUTING CORRECTION',fontsize=12)
    fig.text(.05,.025,'Magenta: baseline filled footprint; dashed navy: existing baseline routing from candidate rim/outside neighbours.\n'
             'No route from the filled depression to E was created. eps=1e-8 unchanged. Bounds are conditional, not an alternative watershed.\n'
             'Background: original Copernicus DEM. No network access, elevation edits, routing edits or spatial exports.',fontsize=8)
    fig.subplots_adjust(bottom=.15,top=.88,wspace=.28);fig.savefig(out,dpi=150);plt.close(fig)
    print('Saved',out,'runtime_seconds',round(time.perf_counter()-started,2))
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print('Peak resident GiB',round(peak/(1024**3 if sys.platform=='darwin' else 1024**2),3))
    except ImportError:print('Peak memory unavailable')


if __name__=='__main__':main()
