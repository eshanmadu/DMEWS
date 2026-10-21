"""Read-only M2 connection dependency; all hydrology remains in memory.

macOS: ML-Service/.venv/bin/python ML-Service/src/assess_m2_connection_dependency.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\assess_m2_connection_dependency.py
Allow approximately 3-4 GiB available memory. No network access or raster exports.
Baseline full-context conditioning is unchanged, float64 with eps=1e-8.
Membership-loss bounds are conditional, not demonstrated drainage errors.
"""
from pathlib import Path
from collections import defaultdict
import gc
import sys
import time

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from matplotlib.collections import LineCollection
from matplotlib.lines import Line2D
import numpy as np
import rasterio
from rasterio.windows import Window, from_bounds
from rasterio.features import rasterize, bounds as geometry_bounds
from rasterio.warp import transform_geom
from rasterio.plot import plotting_extent
from pyproj import Transformer
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
from scipy.ndimage import label, find_objects, binary_dilation, binary_erosion
from scipy.spatial import cKDTree
import urllib.request
import xml.etree.ElementTree as ET
import datetime
import shapefile

DIRECTIONS=(64,128,1,2,4,8,16,32)
OFFSETS=dict(zip(DIRECTIONS,[(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]))
OUTLET=(1196,5160)


def polygon_area(geometry):
    """Projected square metres: exterior area minus holes, no geographic units."""
    polygons=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
    def ring_area(ring):
        p=np.asarray(ring,dtype='float64');p=p-p[0]  # Reduce cancellation.
        return abs(np.sum(p[:-1,0]*p[1:,1]-p[1:,0]*p[:-1,1]))/2
    return sum(ring_area(p[0])-sum(ring_area(h) for h in p[1:]) for p in polygons)


def main():
    started=time.perf_counter();root=Path(__file__).resolve().parents[1]
    path=root/'data/processed/dem_kalu_mosaic_utm44n_30m.tif'
    output=root/'outputs/m2_connection_dependency.png'
    if output.exists():raise FileExistsError(f'Preserving existing output: {output}')
    with rasterio.open(path) as dem:
        assert dem.crs.to_epsg()==32644 and dem.res==(30,30) and dem.nodata==-9999
        assert dem.shape==(3701,7380)
        affine,crs=dem.transform,dem.crs
        elevations=dem.read(1,out_dtype='float64');valid=dem.read_masks(1)!=0
        assert valid[OUTLET] and np.isfinite(elevations[valid]).all()
        assert dem.index(*dem.xy(*OUTLET))==OUTLET
    to_geo=Transformer.from_crs(crs,4326,always_xy=True)
    nodata=np.float64(-9999);elevations[~valid]=nodata
    view=ViewFinder(affine=affine,crs=crs,shape=valid.shape,nodata=nodata)
    terrain=Raster(elevations,viewfinder=view);del elevations
    grid=Grid(viewfinder=view)
    print('Full-context pit filling...',flush=True)
    filled=grid.fill_pits(terrain);del terrain;gc.collect()
    print('Depression filling...',flush=True)
    filled=grid.fill_depressions(filled);filled[~valid]=filled[valid].max()+100
    print('Resolving flats eps=1e-8...',flush=True)
    conditioned=grid.resolve_flats(filled,eps=1e-8);del filled
    conditioned[~valid]=nodata
    assert conditioned.dtype==np.float64 and np.isfinite(conditioned[valid]).all()
    direction=grid.flowdir(conditioned,routing='d8',dirmap=DIRECTIONS,nodata_out=0)
    assert direction.affine==affine and direction.crs.to_epsg()==32644
    codes=np.asarray(direction).astype('int16')
    assert (codes[~valid]==0).all() and np.isin(codes[valid],list(DIRECTIONS)+[-1,-2]).all()
    print('Diagnostic accumulation in memory (modeled tributary context)...',flush=True)
    accumulation=grid.accumulation(direction,routing='d8',dirmap=DIRECTIONS,algorithm='iterative')
    assert accumulation[OUTLET]==715725
    catch=grid.catchment(x=OUTLET[1],y=OUTLET[0],fdir=direction,routing='d8',
                         dirmap=DIRECTIONS,xytype='index',algorithm='iterative')
    model=np.asarray(catch,dtype=bool);gc.collect()
    assert model.sum()==715725 and model[OUTLET] and not (model & ~valid).any()
    assert not (model[0].any() or model[-1].any() or model[:,0].any() or model[:,-1].any())
    rr,cc=np.nonzero(model)
    assert np.isin(codes[rr,cc],DIRECTIONS).all()
    for code,(dr,dc) in OFFSETS.items():
        use=(codes[rr,cc]==code)&~((rr==OUTLET[0])&(cc==OUTLET[1]))
        r,c=rr[use],cc[use];tr,tc=r+dr,c+dc
        assert model[tr,tc].all() and (conditioned[r,c]>conditioned[tr,tc]).all()
        ir,ic=rr-dr,cc-dc;inside=(ir>=0)&(ir<valid.shape[0])&(ic>=0)&(ic<valid.shape[1])
        ir,ic=ir[inside],ic[inside];incoming=valid[ir,ic]&(codes[ir,ic]==code)
        assert model[ir[incoming],ic[incoming]].all()
    print('PASS: V2=715725 cells / 644.1525km2; accumulation, NoData, rim, strict downhill and reverse closure checks')
    # Retain float64 conditioned elevations for local original-versus-conditioned checks.
    reference=root/'data/raw/hydrobasins/hybas_as_lev12_v1c.shp'
    records={};upstream=defaultdict(list)
    with shapefile.Reader(str(reference)) as reader:
        for record in reader.iterRecords():
            i=int(record['HYBAS_ID']);records[i]=(record.oid,record.as_dict())
            if int(record['NEXT_DOWN']) and int(record['ENDO'])!=2:upstream[int(record['NEXT_DOWN'])].append(i)
        selected=set();pending=[4121158930]
        while pending:
            i=pending.pop()
            if i not in selected:selected.add(i);pending.extend(upstream[i])
        assert len(selected)==6
        reference_crs=rasterio.crs.CRS.from_wkt(reference.with_suffix('.prj').read_text())
        assert reference_crs.to_epsg()==4326
        geometries=[transform_geom(reference_crs,crs,reader.shape(records[i][0]).__geo_interface__) for i in sorted(selected)]
        attribute_area=sum(records[i][1]['SUB_AREA'] for i in selected)
    del records,upstream;gc.collect()
    boxes=[geometry_bounds(g) for g in geometries]
    modelbox=rasterio.windows.bounds(Window(int(cc.min()),int(rr.min()),int(cc.max()-cc.min()+1),int(rr.max()-rr.min()+1)),affine)
    boxes.append(modelbox)
    fractional=from_bounds(min(b[0] for b in boxes)-300,min(b[1] for b in boxes)-300,
                           max(b[2] for b in boxes)+300,max(b[3] for b in boxes)+300,affine)
    c0=int(np.floor(fractional.col_off));r0=int(np.floor(fractional.row_off))
    c1=int(np.ceil(fractional.col_off+fractional.width));r1=int(np.ceil(fractional.row_off+fractional.height))
    assert 0<=r0<r1<=valid.shape[0] and 0<=c0<c1<=valid.shape[1]
    window=Window(c0,r0,c1-c0,r1-r0)
    local_model=model[r0:r1,c0:c1].copy();local_acc=np.asarray(accumulation[r0:r1,c0:c1]).copy()
    del accumulation,rr,cc;gc.collect()
    with rasterio.open(path) as dem:
        original=dem.read(1,window=window);assert (dem.read_masks(1,window=window)==255).all()
        tr=dem.window_transform(window)
    # Count rasterized membership, then union: holes retained; no double counting.
    coverage=np.zeros(original.shape,dtype='uint8')
    for geometry in geometries:
        coverage+=rasterize([(geometry,1)],out_shape=original.shape,transform=tr,dtype='uint8',all_touched=False)
    ref=coverage>0;print('Raster cells covered by multiple reference polygons:',np.count_nonzero(coverage>1))
    overlap=local_model & ref;model_only=local_model & ~ref;ref_only=ref & ~local_model
    counts={n:int(m.sum()) for n,m in [('model',local_model),('reference',ref),('overlap',overlap),('model_only',model_only),('reference_only',ref_only)]}
    assert counts['model']==counts['overlap']+counts['model_only']==715725
    assert counts['reference']==counts['overlap']+counts['reference_only']
    assert not (model_only & ref_only).any()
    print('AREA_ACCOUNTING cells:',counts)
    print('AREA_ACCOUNTING km2:',{n:v*.0009 for n,v in counts.items()})
    print('REFERENCE SUB_AREA sum_km2:',attribute_area,'; projected individual-vector area sum_km2:',sum(polygon_area(g) for g in geometries)/1e6)
    print('Raster union area uses cell-centre inclusion, 900m2 cells; no reference or model touches inspection-window edge:',
          not any(m[0].any() or m[-1].any() or m[:,0].any() or m[:,-1].any() for m in (ref,local_model)))
    for m in (ref,local_model):assert not (m[0].any() or m[-1].any() or m[:,0].any() or m[:,-1].any())
    dy,dx=np.gradient(original,30,30);slope=np.degrees(np.arctan(np.hypot(dx,dy)));del dy,dx
    # Reproduce M2: second-largest 8-connected component of modeled-only terrain.
    labels,n=label(model_only,np.ones((3,3)));sizes=np.bincount(labels.ravel());sizes[0]=0
    component_order=np.argsort(sizes)[::-1];m2=labels==int(component_order[1])
    assert m2.sum()==3962,'M2 area differs; stop before interpretation'
    mr,mc=np.nonzero(m2);m2xy=np.column_stack((tr.c+(mc+.5)*30,tr.f-(mr+.5)*30))
    centroid=m2xy.mean(axis=0);lon,lat=to_geo.transform(*centroid)
    assert round(lat,6)==6.537476 and round(lon,6)==80.557810
    box=rasterio.windows.bounds(Window(int(mc.min()),int(mr.min()),int(mc.max()-mc.min()+1),int(mr.max()-mr.min()+1)),tr)
    print('M2_REPRODUCED cells',m2.sum(),'km2',m2.sum()*.0009,'centroid_latlon',(lat,lon),'UTM_bounds',box,
          'bbox_width_height_m',(box[2]-box[0],box[3]-box[1]))
    west,south=to_geo.transform(box[0],box[1]);east,north=to_geo.transform(box[2],box[3])
    A=(1734,5790);B=(1733,5790)
    def xy(cell):return np.array(rasterio.transform.xy(affine,*cell))
    def loc(cell):return cell[0]-r0,cell[1]-c0
    assert valid[A] and valid[B] and int(codes[A])==64
    assert (A[0]-1,A[1])==B and model[A] and model[B]
    assert np.isclose(original[loc(A)],290.2893371582031,rtol=0,atol=1e-8)
    assert np.isclose(original[loc(B)],293.37554931640625,rtol=0,atol=1e-8)
    assert np.isclose(conditioned[A],293.6554265053906,rtol=0,atol=1e-10)
    assert np.isclose(conditioned[B],293.65542648539065,rtol=0,atol=1e-10)
    print('BASELINE A/B VERIFIED',A,B,'original_m',float(original[loc(A)]),float(original[loc(B)]),
          'conditioned_m',float(conditioned[A]),float(conditioned[B]),'D8',int(codes[A]),int(codes[B]),
          'A_latlon',to_geo.transform(*xy(A))[::-1],'B_latlon',to_geo.transform(*xy(B))[::-1])
    # Exact reverse D8 graph traversal, restricted only by actual incoming edges.
    # Unlike a flood fill of elevations, this follows directed routing connectivity.
    dependent=np.zeros(valid.shape,dtype=bool);pending=[A];dependent[A]=True;visited=[]
    while pending:
        p=pending.pop();visited.append(p)
        for code,(dr,dc) in OFFSETS.items():
            q=(p[0]-dr,p[1]-dc)
            if 0<=q[0]<valid.shape[0] and 0<=q[1]<valid.shape[1] and valid[q] and codes[q]==code:
                assert conditioned[q]>conditioned[p]
                if not dependent[q]:dependent[q]=True;pending.append(q)
    expected=int(local_acc[loc(A)])
    assert len(visited)==int(dependent.sum())==expected
    # Independently compare pysheds catchment extraction with the explicit graph.
    reverse=np.asarray(grid.catchment(x=A[1],y=A[0],fdir=direction,routing='d8',
                       dirmap=DIRECTIONS,xytype='index',algorithm='iterative'),dtype=bool)
    assert np.array_equal(reverse,dependent)
    del reverse,direction;gc.collect()
    for p in visited:
        assert valid[p] and codes[p] in OFFSETS
        if p!=A:
            dr,dc=OFFSETS[int(codes[p])];q=(p[0]+dr,p[1]+dc)
            assert dependent[q] and conditioned[p]>conditioned[q]
    local_dep=dependent[r0:r1,c0:c1]
    count=int(dependent.sum());inside_v2=int((dependent & model).sum());outside_v2=count-inside_v2
    assert outside_v2==0 and int(local_dep.sum())==count
    inside_m2=int((local_dep & m2).sum());outside_m2=count-inside_m2
    inside_ref=int((local_dep & ref).sum());outside_ref=count-inside_ref
    assert inside_m2+outside_m2==inside_ref+outside_ref==inside_v2+outside_v2==count
    assert not (local_dep & m2 & ref).any()
    print('PASS: explicit reverse graph = pysheds catchment = A accumulation;',count,'cells')
    print('PARTITIONS cells',{'total':count,'inside_V2':inside_v2,'outside_V2':outside_v2,
                             'inside_M2':inside_m2,'outside_M2':outside_m2,
                             'inside_reference':inside_ref,'outside_reference':outside_ref})
    print('PARTITIONS km2',{'total':count*.0009,'inside_M2':inside_m2*.0009,
                          'outside_M2':outside_m2*.0009,'inside_reference':inside_ref*.0009,
                          'outside_reference':outside_ref*.0009})
    ranks={int(component):i for i,component in enumerate(component_order,1) if sizes[component]}
    intersections=[]
    for component in np.unique(labels[local_dep & ~ref]):
        if component==0:continue
        n=int((local_dep & (labels==component)).sum())
        intersections.append((ranks[int(component)],n))
        print('MODELED_ONLY_INTERSECTION','M'+str(ranks[int(component)]),'dependent_cells',n,
              'dependent_km2',n*.0009,'component_total_cells',int(sizes[component]))
    assert sum(n for _,n in intersections)==outside_ref
    print('B full accumulation cells',float(local_acc[loc(B)]),'km2',float(local_acc[loc(B)])*.0009,
          'difference from A',float(local_acc[loc(B)])-count,'includes B itself and other incoming cells')
    def trace(start):
        p=start;cells=[];seen=set()
        while True:
            assert p not in seen and valid[p] and int(codes[p]) in OFFSETS
            seen.add(p);cells.append(p)
            if p==OUTLET:return cells
            dr,dc=OFFSETS[int(codes[p])];q=(p[0]+dr,p[1]+dc)
            assert 0<=q[0]<valid.shape[0] and 0<=q[1]<valid.shape[1] and valid[q]
            assert model[q] and conditioned[p]>conditioned[q]
            p=q
    route=trace(A);assert route[1]==B
    H=(1740,5779);hroute=trace(H);assert A in hroute
    entry=next(i for i,p in enumerate(hroute) if ref[loc(p)])
    print('REFERENCE_POSITION H_path_first_reference_entry',hroute[entry],'index',entry,
          'A_index',hroute.index(A),'A_steps_downstream_of_first_entry',hroute.index(A)-entry,
          'A_in_reference',bool(ref[loc(A)]),'B_in_reference',bool(ref[loc(B)]))
    print('A_TO_V2 steps',len(route)-1,'length_m',sum(np.linalg.norm(xy(q)-xy(p)) for p,q in zip(route[:-1],route[1:])),
          'PASS: no invalid directions, loops, NoData or unresolved flats')
    area=count*.0009
    print('CONDITIONAL_LOSS_BOUND km2',(0,area),'percent_V2',100*area/644.1525,
          'percent_of_published_gap',100*area/41.1525,
          'dependent_M2_percent',100*inside_m2/3962)
    print('Scope: hypothetical change limited to the A-edge dependency network only. No loss demonstrated; broad reconditioning is outside this bound.')
    del conditioned;gc.collect()
    # Render full V2/reference context plus M2 detail, without exporting masks.
    fig,axes=plt.subplots(1,2,figsize=(15,8))
    extent=plotting_extent(original,tr)
    xs=tr.c+(np.arange(original.shape[1])+.5)*30
    ys=tr.f-(np.arange(original.shape[0])+.5)*30
    dependency_display=np.ma.masked_where(~local_dep,np.ones(local_dep.shape))
    m2_display=np.ma.masked_where(~m2,np.ones(m2.shape))
    route_xy=np.array([xy(p) for p in route])
    for ax in axes:
        ax.imshow(original,extent=extent,cmap='Greys',origin='upper',alpha=.65)
        ax.imshow(m2_display,extent=extent,cmap=ListedColormap(['orange']),alpha=.55,interpolation='nearest')
        ax.imshow(dependency_display,extent=extent,cmap=ListedColormap(['#0077bb']),alpha=.7,interpolation='nearest')
        ax.contour(xs,ys,local_model.astype('uint8'),levels=[.5],colors='black',linewidths=.8)
        ax.contour(xs,ys,ref.astype('uint8'),levels=[.5],colors='purple',linestyles='--',linewidths=1)
        ax.plot(route_xy[:,0],route_xy[:,1],color='red',lw=.7)
        for name,p in [('A',A),('B',B),('V2',OUTLET)]:
            x,y=xy(p);ax.scatter(x,y,s=20,color='red');ax.annotate(name,(x,y),xytext=(4,4),textcoords='offset points',fontsize=8)
        ax.set_aspect('equal');ax.ticklabel_format(style='plain',useOffset=False);ax.grid(alpha=.2)
        ax.set_xlabel('UTM 44N easting (m)');ax.set_ylabel('Northing (m)')
    axes[0].set(xlim=(extent[0],extent[1]),ylim=(extent[2],extent[3]),title='V2/reference context and unchanged downstream route')
    dr,dc=np.nonzero(local_dep);left=min(box[0],tr.c+dc.min()*30)-400
    right=max(box[2],tr.c+(dc.max()+1)*30)+400
    bottom=min(box[1],tr.f-(dr.max()+1)*30)-400;top=max(box[3],tr.f-dr.min()*30)+400
    axes[1].set(xlim=(left,right),ylim=(bottom,top),title='Exact dependent network and M2 overlap')
    legend=[Line2D([0],[0],color='orange',lw=7,label='M2 disagreement'),
            Line2D([0],[0],color='#0077bb',lw=7,label='A→B-dependent cells (overlay)'),
            Line2D([0],[0],color='black',label='Provisional V2 boundary'),
            Line2D([0],[0],color='purple',ls='--',label='HydroBASINS reference'),
            Line2D([0],[0],color='red',label='Baseline A→V2 path')]
    axes[0].legend(handles=legend,fontsize=7,loc='upper right')
    fig.suptitle('EXPLORATORY M2 CONNECTION DEPENDENCY — NOT A VERIFIED ROUTING ERROR',fontsize=12)
    fig.text(.05,.025,'Unchanged full-context float64 conditioning, eps=1e-8; cell-centre HydroBASINS rasterization, polygon holes preserved.\n'
             'Blue shows exact baseline connectivity, not verified physical drainage or predicted watershed loss. No alternative routing run.\n'
             'Background: Copernicus DEM. HydroBASINS: HydroSHEDS/WWF. No permanent hydrological exports or network downloads.',fontsize=8)
    fig.tight_layout(rect=(0,.1,1,.94));fig.savefig(output,dpi=150);plt.close(fig)
    print('Saved',output,'runtime_seconds',round(time.perf_counter()-started,2))
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print('Peak resident GiB',round(peak/(1024**3 if sys.platform=='darwin' else 1024**2),3))
    except ImportError:print('Peak memory unavailable')


if __name__=='__main__':main()
