"""Exploratory boundary/tributary diagnostic; no spatial exports or downloads.

macOS: ML-Service/.venv/bin/python ML-Service/src/diagnose_ratnapura_boundary.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\diagnose_ratnapura_boundary.py
Check available RAM first; allow about 3-4 GiB. Uses expanded DEM only.
Derived channels and terrain slopes are NOT independent validation evidence.
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
from scipy.ndimage import label, find_objects
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
    output=root/'outputs/ratnapura_boundary_diagnostic.png'
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
    model=np.asarray(catch,dtype=bool);del direction;gc.collect()
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
    del conditioned;gc.collect()
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
    outlet_xy=np.array(rasterio.transform.xy(affine,*OUTLET))
    def trace(start):
        p=start;path=[];seen=set()
        while True:
            assert p not in seen,'Routing loop';seen.add(p);path.append(p)
            code=int(codes[p])
            if code not in OFFSETS:return path,code
            dr,dc=OFFSETS[code];q=(p[0]+dr,p[1]+dc)
            assert 0<=q[0]<valid.shape[0] and 0<=q[1]<valid.shape[1] and valid[q]
            p=q
    outlet_path,_=trace(OUTLET);outlet_path_set=set(outlet_path)
    all_zones=[]
    for prefix,mask in [('M',model_only),('R',ref_only)]:
        labels,n=label(mask,np.ones((3,3)));sizes=np.bincount(labels.ravel());sizes[0]=0
        objects=find_objects(labels)
        order=np.argsort(sizes)[::-1];order=[int(i) for i in order if i and sizes[i]][:5]
        print(f'ZONE_DISTRIBUTION {prefix}: components={n}; total_km2={mask.sum()*.0009:.6f}; '
              f'largest5_km2={sum(sizes[i] for i in order)*.0009:.6f}')
        for rank,i in enumerate(order,1):
            sl=objects[i-1];part=labels[sl]==i
            sr,sc=np.nonzero(part);sr+=sl[0].start;sc+=sl[1].start
            er=original[sr,sc];ss=slope[sr,sc]
            cx=tr.c+(sc.mean()+.5)*30;cy=tr.f-(sr.mean()+.5)*30
            lon,lat=to_geo.transform(cx,cy)
            box=rasterio.windows.bounds(Window(int(sc.min()),int(sr.min()),int(sc.max()-sc.min()+1),int(sr.max()-sr.min()+1)),tr)
            k=int(np.argmax(local_acc[sr,sc]));representative=(int(sr[k]+r0),int(sc[k]+c0))
            rep_path,terminal=trace(representative);shared=set(rep_path)&outlet_path_set
            first=next((p for p in rep_path if p in shared),None)
            merge_geo=to_geo.transform(*rasterio.transform.xy(affine,*first)) if first else None
            merge_index=outlet_path.index(first) if first else None
            name=f'{prefix}{rank}'
            all_zones.append((name,cx,cy,box))
            print(f'ZONE {name}: cells={sizes[i]}; km2={sizes[i]*.0009:.6f}; centroid_latlon={lat:.6f},{lon:.6f}; '
                  f'UTM_bounds={box}; centroid_to_outlet_km={np.linalg.norm(np.array([cx,cy])-outlet_xy)/1000:.3f}; '
                  f'original_elev_min_median_max={er.min():.2f},{np.median(er):.2f},{er.max():.2f}; '
                  f'slope_median_p90_deg={np.median(ss):.2f},{np.percentile(ss,90):.2f}; fraction_slope_lt5={np.mean(ss<5):.3f}')
            print(f'ZONE_PATH {name}: representative={representative}; representative_area_km2={local_acc[sr[k],sc[k]]*.0009:.6f}; '
                  f'joins_outlet_downstream_path_at_lonlat={merge_geo}; steps_downstream_of_outlet={merge_index}; '
                  f'terminal_code={terminal}; representative_only_not_entire_zone')
        del labels,sizes,objects
    # Major modeled confluences: at least two incoming >=25km2 branches.
    stream=local_model & (local_acc*.0009>=25)
    sr,sc=np.nonzero(stream);segments=[];junctions=[]
    for r,c in zip(sr,sc):
        gr,gc_=int(r+r0),int(c+c0);dr,dc=OFFSETS[int(codes[gr,gc_])]
        if (gr,gc_)!=OUTLET:
            p=rasterio.transform.xy(affine,gr,gc_);q=rasterio.transform.xy(affine,gr+dr,gc_+dc);segments.append((p,q))
        incoming=[]
        for code,(dr,dc) in OFFSETS.items():
            ir,ic=r-dr,c-dc
            if 0<=ir<stream.shape[0] and 0<=ic<stream.shape[1] and stream[ir,ic] and codes[ir+r0,ic+c0]==code:
                incoming.append(float(local_acc[ir,ic])*.0009)
        if len(incoming)>=2:
            x,y=rasterio.transform.xy(affine,gr,gc_);lon,lat=to_geo.transform(x,y)
            junctions.append((float(local_acc[r,c])*.0009,x,y,lat,lon,sorted(incoming,reverse=True)))
    junctions.sort(reverse=True)
    for i,j in enumerate(junctions,1):print(f'MODELED_CONFLUENCE J{i}: area_km2={j[0]:.6f}; latlon={j[3]:.6f},{j[4]:.6f}; incoming_km2={j[5]}')
    print('Model network >=25km2 cells:',stream.sum(),'; major confluences:',len(junctions),'; independent river-vector check: UNAVAILABLE LOCALLY')
    fig=plt.figure(figsize=(17,11));gs=fig.add_gridspec(2,2,width_ratios=[1.6,1])
    ax=fig.add_subplot(gs[:,0]);details=[fig.add_subplot(gs[0,1]),fig.add_subplot(gs[1,1])]
    classes=np.zeros(original.shape,dtype='uint8');classes[overlap]=1;classes[model_only]=2;classes[ref_only]=3
    xs=tr.c+(np.arange(original.shape[1])+.5)*30;ys=tr.f-(np.arange(original.shape[0])+.5)*30
    extent=plotting_extent(original,tr)
    def draw(target):
        target.imshow(original,extent=extent,origin='upper',cmap='Greys',alpha=.6)
        target.imshow(np.ma.masked_where(classes==0,classes),extent=extent,origin='upper',
                      cmap=ListedColormap(['white','#66ccee','#ee7733','#aa4499']),vmin=0,vmax=3,alpha=.65,interpolation='nearest')
        target.contour(xs,ys,local_model.astype('uint8'),levels=[.5],colors=['black'],linewidths=.8)
        target.contour(xs,ys,ref.astype('uint8'),levels=[.5],colors=['#882255'],linewidths=.8,linestyles='--')
        target.add_collection(LineCollection(segments,colors='#004488',linewidths=.7))
        target.scatter(*outlet_xy,marker='*',color='red',edgecolors='black',s=110,zorder=5)
        target.set_aspect('equal');target.ticklabel_format(style='plain',useOffset=False)
        target.set_xlabel('UTM 44N easting (m)');target.set_ylabel('Northing (m)');target.grid(alpha=.2)
    draw(ax);ax.set_xlim(extent[0],extent[1]);ax.set_ylim(extent[2],extent[3])
    ax.annotate('V2 / Muwagama Bridge vicinity',outlet_xy,xytext=(10,-20),textcoords='offset points',fontsize=8)
    for name,x,y,box in all_zones:
        ax.text(x,y,name,fontsize=8,bbox={'facecolor':'white','alpha':.7,'edgecolor':'none'})
    for i,j in enumerate(junctions,1):
        ax.scatter(j[1],j[2],s=18,color='navy');ax.text(j[1],j[2],f' J{i}',fontsize=7)
    for target,prefix in zip(details,('M','R')):
        draw(target);zone=next(z for z in all_zones if z[0]==prefix+'1');box=zone[3]
        target.set_xlim(box[0]-500,box[2]+500);target.set_ylim(box[1]-500,box[3]+500)
        target.set_title(f'{prefix}1: largest '+('modeled-only zone' if prefix=='M' else 'reference-only zone'),fontsize=10)
    legend=[Line2D([0],[0],color='#66ccee',lw=8,label='Overlap'),Line2D([0],[0],color='#ee7733',lw=8,label='Modeled only (M)'),
            Line2D([0],[0],color='#aa4499',lw=8,label='Reference only (R)'),Line2D([0],[0],color='black',label='V2 modeled boundary'),
            Line2D([0],[0],color='#882255',ls='--',label='HydroBASINS union'),Line2D([0],[0],color='#004488',label='DEM-modeled channels >=25km²')]
    ax.legend(handles=legend,loc='lower left',fontsize=8)
    fig.suptitle('EXPLORATORY RATNAPURA UPSTREAM BOUNDARY COMPARISON — NOT A VERIFIED GAUGE WATERSHED',fontsize=12)
    fig.text(.05,.025,'HydroBASINS Level 12: six connected polygons; cell-centre union rasterization at 30 m, holes preserved.\n'
             'Channels, slopes and V2 boundary derive from the SAME DEM: internal terrain context, not independent river validation. eps=1e-8; no outlet changes.',fontsize=9)
    fig.tight_layout(rect=(0,.07,1,.95));fig.savefig(output,dpi=150);plt.close(fig)
    print('Saved:',output);print(f'Runtime: {time.perf_counter()-started:.1f} seconds')
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f'Peak resident memory: {peak/(1024**3 if sys.platform=="darwin" else 1024**2):.3f} GiB')
    except ImportError:print('Peak memory unavailable on this platform')
    print('No downloads, old flow inputs, Candidate 1 extraction, watershed exports or production changes.')


if __name__=='__main__':main()
