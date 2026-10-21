"""Focused M1 divide diagnostic; no permanent watershed exports.
Reads one small OSM map into memory if accessible; saves only the PNG.
Boundary separation uses nearest raster edge-cell centres, not surveyed lines.

macOS: ML-Service/.venv/bin/python ML-Service/src/diagnose_ratnapura_m1_divide.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\diagnose_ratnapura_m1_divide.py
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
    output=root/'outputs/ratnapura_m1_divide.png'
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
    # Reproduce M1: largest 8-connected component of modeled-only terrain.
    labels,n=label(model_only,np.ones((3,3)));sizes=np.bincount(labels.ravel());sizes[0]=0
    m1=labels==int(np.argmax(sizes));del labels
    assert m1.sum()==5900,'M1 area differs; stop before interpretation'
    mr,mc=np.nonzero(m1);m1xy=np.column_stack((tr.c+(mc+.5)*30,tr.f-(mr+.5)*30))
    centroid=m1xy.mean(axis=0);lon,lat=to_geo.transform(*centroid)
    assert round(lat,6)==6.598702 and round(lon,6)==80.700671
    box=rasterio.windows.bounds(Window(int(mc.min()),int(mr.min()),int(mc.max()-mc.min()+1),int(mr.max()-mr.min()+1)),tr)
    print('M1_REPRODUCED cells',m1.sum(),'km2',m1.sum()*.0009,'centroid_latlon',(lat,lon),'UTM_bounds',box,
          'bbox_width_height_m',(box[2]-box[0],box[3]-box[1]))
    west,south=to_geo.transform(box[0],box[1]);east,north=to_geo.transform(box[2],box[3])
    print('M1_PROJECTED_BOX_GEOGRAPHIC_CORNERS',(west,south,east,north))
    # Actual cell-footprint geographic bounds, accounting for the UTM grid angle.
    glons=[];glats=[]
    for dr,dc in ((0,0),(0,1),(1,0),(1,1)):
        x,y=tr*(mc+dc,mr+dr);ll,pp=to_geo.transform(x,y);glons.extend(ll);glats.extend(pp)
    print('M1_ACTUAL_GEOGRAPHIC_BOUNDS',(min(glons),min(glats),max(glons),max(glats)))
    print('M1_ELEVATION min_p25_median_p75_max',np.percentile(original[m1],[0,25,50,75,100]))
    print('M1_SLOPE_DEG min_median_p90_max',np.percentile(slope[m1],[0,50,90,100]))
    model_edge=m1 & ~binary_erosion(local_model,structure=np.ones((3,3)))
    ref_edge=m1 & binary_dilation(ref,structure=np.ones((3,3)))
    assert model_edge.any() and ref_edge.any()
    def maskxy(mask):
        rr,cc=np.nonzero(mask)
        return np.column_stack((tr.c+(cc+.5)*30,tr.f-(rr+.5)*30))
    medge=maskxy(model_edge);redge=maskxy(ref_edge)
    dmodel=cKDTree(redge).query(medge)[0];dref=cKDTree(medge).query(redge)[0]
    print('EDGE_SEPARATION modeled_to_reference median_p90_max_m',np.percentile(dmodel,[50,90,100]))
    print('EDGE_SEPARATION reference_to_modeled median_p90_max_m',np.percentile(dref,[50,90,100]))
    print('Edge-cell-centre nearest distances; 8-neighbour raster edges, 30m grid; endpoint effects and generalization apply.')
    # Test high-ground plausibility using perpendicular-ish transects joining each
    # modeled edge cell to its closest reference edge cell, extended 300m outward.
    _,nearest_ref=cKDTree(redge).query(medge)
    terrain_checks=[]
    with rasterio.open(path) as dem:
        for p,q in zip(medge,redge[nearest_ref]):
            vector=p-q;length=np.linalg.norm(vector)
            if length<60:continue
            unit=vector/length
            samples=p+np.arange(-300,301,30)[:,None]*unit
            heights=np.array([v[0] for v in dem.sample(samples)])
            if np.any(heights==-9999):continue
            terrain_checks.append((heights[10]>=heights[:10].max(),
                                   heights[10]>=heights[11:].max(),
                                   max(heights)-heights[10]))
    checks=np.array(terrain_checks)
    print('MODELED_EDGE_HIGH_GROUND_300M tests',len(checks),'fraction_higher_than_all_samples_each_side',
          np.mean(np.logical_and(checks[:,0]>0,checks[:,1]>0)),'centre_deficit_to_transect_max_median_p90_m',np.percentile(checks[:,2],[50,90]))
    print('Transects approximate normal via nearest reference edge, not rigorously mapped ridge-normal sections.')
    def xy(cell):return np.array(rasterio.transform.xy(affine,*cell))
    def trace(start):
        current=start;seen=set();cells=[]
        while True:
            assert current not in seen,'Routing loop';seen.add(current);cells.append(current)
            assert valid[current] and int(codes[current]) in OFFSETS,'Invalid/terminal/NoData on M1 path'
            if current==OUTLET:break
            dr,dc=OFFSETS[int(codes[current])];target=(current[0]+dr,current[1]+dc)
            assert 0<=target[0]<valid.shape[0] and 0<=target[1]<valid.shape[1] and valid[target]
            assert model[target] and conditioned[current]>conditioned[target]
            current=target
        return cells
    k=int(np.argmax(local_acc[mr,mc]));channel=(int(mr[k]+r0),int(mc[k]+c0))
    er,ec=np.nonzero(model_edge);maxi=int(np.argmax(dmodel));wide=(int(er[maxi]+r0),int(ec[maxi]+c0))
    main_path=trace(channel)
    def membership(cell,mask):
        r,c=cell[0]-r0,cell[1]-c0
        return 0<=r<mask.shape[0] and 0<=c<mask.shape[1] and bool(mask[r,c])
    crossing=next((p for p in main_path if membership(p,ref)),None)
    assert crossing is not None
    selected={'H_highest_accumulation_M1':channel,'W_max_edge_separation':wide,
              'X_first_reference_entry_on_H_path':crossing}
    traced={};potential=[]
    with rasterio.open(path) as dem:
        for name,cell in selected.items():
            cells=trace(cell);points=np.array([xy(p) for p in cells]);heights=np.array([v[0] for v in dem.sample(points)])
            first_ref=next((i for i,p in enumerate(cells) if membership(p,ref)),None)
            local_end=min(len(cells)-1,(first_ref or 0)+15)
            rises=np.diff(heights[:local_end+1]);largest=int(np.argmax(rises)) if len(rises) else 0
            print('REPRESENTATIVE',name,'cell',cell,'UTM',xy(cell),'latlon',to_geo.transform(*xy(cell))[::-1],
                  'original_m',heights[0],'conditioned_m',conditioned[cell],
                  'D8',codes[cell],'acc_area_km2',local_acc[cell[0]-r0,cell[1]-c0]*.0009,
                  'steps_to_V2',len(cells)-1,'length_m',np.linalg.norm(np.diff(points,axis=0),axis=1).sum(),
                  'first_reference_entry_cell',cells[first_ref] if first_ref is not None else None)
            print('PATH_SAMPLES_100_STEPS',[(p,int(codes[p]),float(conditioned[p])) for p in cells[::100]],'final',cells[-1])
            print('LOCAL_TO_REF_PLUS_15STEPS max_original_uphill_step_m',float(rises[largest]) if len(rises) else 0,
                  'from_cell',cells[largest],'to_cell',cells[min(largest+1,len(cells)-1)])
            if len(rises) and rises[largest]>0:potential.append((float(rises[largest]),cells[largest],cells[largest+1]))
            traced[name]=(cells,points)
        # X is a reference-boundary crossing, not presumed to be a real divide.
        xr,xc=crossing
        for name,cell in [('X_reference_entry',crossing)]+[('largest_local_original_rise',p[1]) for p in sorted(potential,reverse=True)[:1]]:
            r,c=cell;neighbourhood=dem.read(1,window=Window(c-2,r-2,5,5))
            print('TERRAIN_CHECK',name,'cell',cell,'latlon',to_geo.transform(*xy(cell))[::-1],
                  'original_5x5',neighbourhood.tolist(),'conditioned_5x5',np.asarray(conditioned[r-2:r+3,c-2:c+3]).tolist(),
                  'D8_3x3',codes[r-1:r+2,c-1:c+2].tolist())
    del conditioned;gc.collect()
    # Keep compact reference geometries locally; topology fields establish receiver.
    rivers=shapefile.Reader(str(root/'data/raw/hydrorivers/HydroRIVERS_v10_as/HydroRIVERS_v10_as.shp'))
    river_data={};river_lines={}
    for feature in rivers.iterShapeRecords(bbox=(80.62,6.50,80.79,6.69)):
        record=feature.record.as_dict();key=record['HYRIV_ID'];river_data[key]=record
        p=np.array(feature.shape.points);project=Transformer.from_crs(4326,crs,always_xy=True)
        stops=list(feature.shape.parts)+[len(p)]
        river_lines[key]=[np.column_stack(project.transform(p[a:b,0],p[a:b,1])) for a,b in zip(stops[:-1],stops[1:])]
    def distances(points,lines):
        best=np.full(len(points),np.inf)
        for line in lines:
            for a,b in zip(line[:-1],line[1:]):
                v=b-a;den=v@v;t=np.clip((points-a)@v/den,0,1) if den else np.zeros(len(points))
                best=np.minimum(best,np.linalg.norm(points-(a+t[:,None]*v),axis=1))
        return best
    # Sample M1 cells against the generalized lines. Nearest-reach distribution is
    # context only, never an assignment of all cells to that reference network.
    nearpoints=m1xy[::10]
    candidates=sorted((float(distances(np.array([centroid]),v)[0]),k) for k,v in river_lines.items())[:8]
    print('HYDRORIVERS NEAR M1 CENTROID',[(round(d,1),river_data[k]) for d,k in candidates])
    for name,(cells,points) in traced.items():
        local_points=np.array([xy(p) for p in cells if membership(p,m1)])
        if not len(local_points):continue
        best=sorted((float(np.median(distances(local_points,lines))),k) for k,lines in river_lines.items())[:3]
        print('REFERENCE_NEAREST_TO_LOCAL_PATH',name,[(round(d,1),river_data[k]) for d,k in best])
    # Load attributes (not geometry) for complete connected reference networks.
    # This avoids repeatedly scanning Asia for each downstream missing reach.
    main_ids={river_data[k]['MAIN_RIV'] for _,k in candidates[:4]}
    for record in rivers.iterRecords(fields=['MAIN_RIV']):
        if record[0] in main_ids:
            full=rivers.record(record.oid).as_dict();river_data[full['HYRIV_ID']]=full
    print('REFERENCE_NETWORKS_COMPLETE_MAIN_RIV',sorted(main_ids))
    for _,key in candidates[:4]:
        route=[];current=key;seen=set()
        while current:
            assert current not in seen;seen.add(current);route.append(current);current=river_data[current]['NEXT_DOWN']
        print('REFERENCE_DOWNSTREAM',key,route,'terminal_MAIN_RIV',river_data[key]['MAIN_RIV'])
    # Optional tiny independent OSM extract: no raw files saved; no imagery fetched.
    osm_lines=[];url='https://api.openstreetmap.org/api/0.6/map?bbox=80.635,6.558,80.746,6.632'
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'DMEWS-research-diagnostic/1.0'})
        with urllib.request.urlopen(req,timeout=40) as response:raw=response.read(3000001)
        if len(raw)>3000000:raise ValueError('OSM extract >3MB; do not parse')
        tree=ET.fromstring(raw);nodes={n.get('id'):(float(n.get('lon')),float(n.get('lat'))) for n in tree.findall('node')}
        print('OSM_REFERENCE',url,'UTC',datetime.datetime.now(datetime.timezone.utc).isoformat(),'bytes',len(raw))
        for w in tree.findall('way'):
            tags={t.get('k'):t.get('v') for t in w.findall('tag')}
            if not tags.get('waterway'):continue
            ids=[n.get('ref') for n in w.findall('nd')]
            if not all(n in nodes for n in ids):continue
            p=np.array([project.transform(*nodes[n]) for n in ids]);osm_lines.append(p)
            print('OSM_WATERWAY',w.get('id'),'version',w.get('version'),'edited',w.get('timestamp'),'tags',tags,
                  'endpoints_lonlat',nodes[ids[0]],nodes[ids[-1]])
        print('OSM waterway count',len(osm_lines),'; edits are not imagery dates; source independence not verified.')
    except Exception as error:print('OSM_UNAVAILABLE',type(error).__name__,str(error))
    print('M1 maximum hypothetical area contribution km2',5.31,'fraction_of_41.1525_excess_percent',5.31/41.1525*100,
          'remaining_excess_if_entire_M1_removed',644.1525-5.31-603,'NOT a verified error or removal proposal')
    fig,axes=plt.subplots(1,2,figsize=(16,8),gridspec_kw={'width_ratios':[1.5,1]})
    extent=plotting_extent(original,tr)
    xs=tr.c+(np.arange(original.shape[1])+.5)*30;ys=tr.f-(np.arange(original.shape[0])+.5)*30
    for ax in axes:
        ax.imshow(original,extent=extent,cmap='terrain',origin='upper',vmin=200,vmax=1100)
        ax.contour(xs,ys,original,levels=np.arange(200,1200,100),colors='black',linewidths=.3,alpha=.4)
        ax.contourf(xs,ys,m1.astype('uint8'),levels=[.5,1.5],colors=['orange'],alpha=.35)
        ax.contour(xs,ys,local_model.astype('uint8'),levels=[.5],colors='red',linewidths=1.5)
        ax.contour(xs,ys,ref.astype('uint8'),levels=[.5],colors='purple',linestyles='--',linewidths=1.5)
        for line in river_lines.values():
            for p in line:ax.plot(p[:,0],p[:,1],color='navy',lw=.8,ls='--')
        for p in osm_lines:ax.plot(p[:,0],p[:,1],color='cyan',lw=1.3)
        for name,(cells,p) in traced.items():ax.plot(p[:,0],p[:,1],color='black',lw=1)
        for name,p in selected.items():
            x,y=xy(p);ax.scatter(x,y,color='black',s=25);ax.annotate(name[0],(x,y),xytext=(4,4),textcoords='offset points')
        ax.set_aspect('equal');ax.set_xlabel('UTM 44N easting (m)');ax.set_ylabel('Northing (m)');ax.grid(alpha=.2)
        ax.ticklabel_format(style='plain',useOffset=False)
    axes[0].set_xlim(box[0]-600,box[2]+600);axes[0].set_ylim(box[1]-600,box[3]+600)
    axes[0].set_title('M1: orange; modeled divide: red; HydroBASINS: purple dashed',fontsize=9)
    x,y=xy(crossing);axes[1].set_xlim(x-800,x+800);axes[1].set_ylim(y-800,y+800)
    axes[1].set_title('X: reference-boundary entry, not a verified terrain divide',fontsize=9)
    fig.suptitle('EXPLORATORY M1 UPSTREAM DIVIDE INVESTIGATION — NOT A VERIFIED WATERSHED BOUNDARY',fontsize=11)
    fig.text(.05,.025,'Terrain/contours: original projected DEM; black paths: provisional D8 eps=1e-8; navy dashed: HydroRIVERS; cyan: OSM waterways.\n'
             'H: largest M1 accumulation; W: greatest edge separation; X: first reference entry. No surveyed ridge or saddle is asserted.\n'
             '© OpenStreetMap contributors / ODbL. HydroRIVERS/HydroBASINS: HydroSHEDS (WWF), shared provenance. No watershed exports.',fontsize=8)
    fig.tight_layout(rect=(0,.09,1,.94));fig.savefig(output,dpi=150);plt.close(fig)
    print('Saved',output,'runtime_seconds',round(time.perf_counter()-started,2))
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print('Peak resident GiB',round(peak/(1024**3 if sys.platform=='darwin' else 1024**2),3))
    except ImportError:print('Peak memory unavailable')


def inspect_small_osm_windows():
    """Optional reference-only follow-up; never invokes hydrological processing."""
    started=time.perf_counter()
    boxes={'H_channel':(80.697,6.607,80.710,6.619),
           'W_candidate_spill':(80.675,6.589,80.688,6.602)}
    for name,box in boxes.items():
        url='https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(map(str,box))
        req=urllib.request.Request(url,headers={'User-Agent':'DMEWS-research-diagnostic/1.0'})
        with urllib.request.urlopen(req,timeout=40) as response:raw=response.read(1000001)
        if len(raw)>1000000:
            print('SMALL_OSM_LIMIT',name,url);continue
        tree=ET.fromstring(raw);count=0
        nodes={n.get('id'):(n.get('lon'),n.get('lat')) for n in tree.findall('node')}
        for w in tree.findall('way'):
            tags={t.get('k'):t.get('v') for t in w.findall('tag')}
            if not (tags.get('waterway') or tags.get('water') or tags.get('natural')=='water'):continue
            ids=[n.get('ref') for n in w.findall('nd')];count+=1
            print('SMALL_OSM_FEATURE',name,w.attrib,'tags',tags,
                  'endpoints',nodes.get(ids[0]),nodes.get(ids[-1]))
        print('SMALL_OSM_SUMMARY',name,url,'bytes',len(raw),'water_features',count,
              'UTC',datetime.datetime.now(datetime.timezone.utc).isoformat())
    print('Reference-only elapsed seconds',time.perf_counter()-started)


if __name__=='__main__':
    if '--small-osm-only' in sys.argv:inspect_small_osm_windows()
    else:main()
