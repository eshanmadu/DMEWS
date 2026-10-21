"""Exploratory J5 path reconstruction; no saved hydrological raster or watershed.

macOS: ML-Service/.venv/bin/python ML-Service/src/diagnose_j5_tributary_paths.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\diagnose_j5_tributary_paths.py
Requires about 3-4 GiB available memory. All paths use zero-based row/column.
Upstream traces follow the largest incoming accumulation: dominant stems only,
not a full tributary network. Reference areas apply at reach outlets.
"""
from pathlib import Path
from collections import defaultdict
import gc
import sys
import time
import numpy as np
import rasterio
from pyproj import CRS, Transformer
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
import shapefile
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parents[1]
DIRECTIONS=(64,128,1,2,4,8,16,32)
OFFSETS=dict(zip(DIRECTIONS,[(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]))
V2=(1196,5160)
EXPECTED=(72987,62190)  # 65.6883 and 55.9710 km2 / 0.0009 km2 per cell


def main():
    started=time.perf_counter();output=ROOT/'outputs/j5_tributary_paths.png'
    if output.exists():raise FileExistsError(f'Preserving {output}')
    path=ROOT/'data/processed/dem_kalu_mosaic_utm44n_30m.tif'
    with rasterio.open(path) as dem:
        assert dem.crs.to_epsg()==32644 and dem.res==(30,30) and dem.shape==(3701,7380)
        assert dem.nodata==-9999
        transform=dem.transform; crs=dem.crs;valid=dem.read_masks(1)!=0
        z=dem.read(1,out_dtype='float64');z[~valid]=-9999
    geo=Transformer.from_crs(crs,4326,always_xy=True)
    project=Transformer.from_crs(4326,crs,always_xy=True)
    def xy(cell):return np.array(rasterio.transform.xy(transform,*cell))
    view=ViewFinder(affine=transform,crs=crs,shape=z.shape,nodata=np.float64(-9999))
    terrain=Raster(z,viewfinder=view);del z;grid=Grid(viewfinder=view)
    print('Full-context pit filling...',flush=True)
    filled=grid.fill_pits(terrain);del terrain;gc.collect()
    print('Depression filling...',flush=True)
    filled=grid.fill_depressions(filled);filled[~valid]=filled[valid].max()+100
    print('Flat resolution eps=1e-8...',flush=True)
    conditioned=grid.resolve_flats(filled,eps=1e-8);del filled;conditioned[~valid]=-9999
    assert conditioned.dtype==np.float64
    direction=grid.flowdir(conditioned,routing='d8',dirmap=DIRECTIONS,nodata_out=0)
    assert direction.affine==transform and direction.crs.to_epsg()==32644
    codes=np.asarray(direction).astype('int16')
    print('Accumulation in memory...',flush=True)
    accumulation=grid.accumulation(direction,routing='d8',dirmap=DIRECTIONS,algorithm='iterative')
    assert accumulation[V2]==715725;del direction;gc.collect()
    def incoming(cell):
        r,c=cell; result=[]
        for code,(dr,dc) in OFFSETS.items():
            q=(r-dr,c-dc)
            if 0<=q[0]<valid.shape[0] and 0<=q[1]<valid.shape[1] and valid[q] and codes[q]==code:
                result.append((int(accumulation[q]),q))
        return sorted(result,reverse=True)
    # Rounded coordinate narrows inspection only; unique area signature verifies cell.
    seedx,seedy=project.transform(80.435228,6.748018)
    sr,sc=rasterio.transform.rowcol(transform,seedx,seedy)
    matches=[]
    for r in range(sr-7,sr+8):
        for c in range(sc-7,sc+8):
            inc=[p for p in incoming((r,c)) if p[0]*.0009>=25]
            if tuple(a for a,_ in inc)==EXPECTED:
                lon,lat=geo.transform(*xy((r,c)))
                if round(lat,6)==6.748018 and round(lon,6)==80.435228:matches.append((r,c))
    assert len(matches)==1,f'J5 not recovered unambiguously: {matches}'
    junction=matches[0];branches=incoming(junction);major=[p for p in branches if p[0]*.0009>=25]
    print('EXACT J5',junction,'E/N',xy(junction),'lon/lat',geo.transform(*xy(junction)),
          'D8',codes[junction],'acc_cells',accumulation[junction])
    print('ALL INCOMING',branches)
    for cells,p in major:print('EXACT BRANCH',p,'E/N',xy(p),'lon/lat',geo.transform(*xy(p)),
                               'D8',codes[p],'cells',cells,'area_km2',cells*.0009)
    def checked_step(a,b):
        assert valid[a] and valid[b] and int(codes[a]) in OFFSETS
        dr,dc=OFFSETS[int(codes[a])];assert b==(a[0]+dr,a[1]+dc)
        assert np.isfinite(conditioned[a]) and np.isfinite(conditioned[b]) and conditioned[a]>conditioned[b]
    def downstream(start,stop):
        cells=[start];seen={start}
        while cells[-1]!=stop:
            r,c=cells[-1];assert int(codes[r,c]) in OFFSETS,'Terminal before V2'
            dr,dc=OFFSETS[int(codes[r,c])];q=(r+dr,c+dc)
            assert 0<=q[0]<valid.shape[0] and 0<=q[1]<valid.shape[1] and q not in seen
            checked_step((r,c),q);cells.append(q);seen.add(q)
        return cells
    def upstream(start):
        cells=[start];seen={start};length=0
        while length<12000:
            inc=incoming(cells[-1])
            if not inc or inc[0][0]*.0009<10:break
            q=inc[0][1];assert q not in seen;checked_step(q,cells[-1])
            length+=np.linalg.norm(xy(q)-xy(cells[-1]));cells.append(q);seen.add(q)
        return cells
    up=[upstream(p) for _,p in major];down=downstream(junction,V2)
    modeled=[np.array([xy(p) for p in cells]) for cells in up]
    downxy=np.array([xy(p) for p in down])
    for name,cells,line in zip(('65.6883 branch','55.9710 branch'),up,modeled):
        length=np.linalg.norm(np.diff(line,axis=0),axis=1).sum()
        print('UPSTREAM',name,'steps',len(cells)-1,'length_m',length,
              'end_cell',cells[-1],'end_lonlat',geo.transform(*line[-1]),
              'end_area_km2',accumulation[cells[-1]]*.0009,'upstream_delta_E_N_m',line[-1]-line[0])
        # Compact exact index samples plus explicit endpoint; no spatial export.
        print('CELL_SAMPLES_EVERY_25_STEPS',cells[::25],'; final',cells[-1])
    print('DOWNSTREAM TO V2 steps',len(down)-1,'length_m',np.linalg.norm(np.diff(downxy,axis=0),axis=1).sum())
    print('PASS: valid D8, strict conditioned descent, no NoData, flats, pits or loops on inspected paths')
    # Report substantial side inflows near J5 along both stems and downstream.
    for p in set(up[0]+up[1]+down):
        if np.linalg.norm(xy(p)-xy(junction))>1600:continue
        inc=incoming(p)
        significant=[(n,q) for n,q in inc if n*.0009>=.5]
        if len(significant)>=2:
            print('LOCAL MODELED JOIN',p,'lonlat',geo.transform(*xy(p)),
                  'incoming_km2',[(n*.0009,q) for n,q in significant])
    del conditioned,accumulation,codes,valid;gc.collect()
    # Spatially select reference context; connectivity is expanded by required IDs.
    reader=shapefile.Reader(str(ROOT/'data/raw/hydrorivers/HydroRIVERS_v10_as/HydroRIVERS_v10_as.shp'))
    assert CRS.from_wkt(Path(reader.shapeName).with_suffix('.prj').read_text()).to_epsg()==4326
    records={};geometry={};reverse=defaultdict(list)
    for item in reader.iterShapeRecords(bbox=(80.35,6.65,80.55,6.85)):
        r=item.record.as_dict();key=r['HYRIV_ID'];records[key]=r
        indices=list(item.shape.parts)+[len(item.shape.points)]
        assert len(indices)==2,'Unexpected multipart target context'
        p=np.array(item.shape.points);geometry[key]=np.column_stack(project.transform(p[:,0],p[:,1]))
        if r['NEXT_DOWN']:reverse[r['NEXT_DOWN']].append(key)
    required={41406594,41406613,41406633,41406634,41406815}
    assert required<=records.keys()
    assert records[41406594]['NEXT_DOWN']==records[41406613]['NEXT_DOWN']==41406633
    assert records[41406633]['NEXT_DOWN']==records[41406634]['NEXT_DOWN']==41406815
    def refnode(receiver,children):
        ends=[geometry[k][[0,-1]] for k in [receiver]+children]
        candidates=np.vstack(ends)
        cost=[max(np.linalg.norm(e-p,axis=1).min() for e in ends) for p in candidates]
        i=int(np.argmin(cost));assert cost[i]<.01;return candidates[i]
    nodes=[refnode(41406633,[41406594,41406613]),refnode(41406815,[41406633,41406634])]
    for name,node in zip(('small','larger'),nodes):
        print('REFERENCE JUNCTION',name,'E/N',node,'lonlat',geo.transform(*node),
              'offset_model_J5_m',np.linalg.norm(node-xy(junction)))
        nearest=int(np.argmin(np.linalg.norm(downxy-node,axis=1)))
        print('NEAREST MODELED DOWNSTREAM POINT',name,'cell',down[nearest],
              'distance_m',np.linalg.norm(downxy[nearest]-node),
              'path_distance_from_J5_m',np.linalg.norm(np.diff(downxy[:nearest+1],axis=0),axis=1).sum())
    def reference_stem(start):
        keys=[start];seen={start}
        while True:
            candidates=reverse[keys[-1]]
            if not candidates:break
            key=max(candidates,key=lambda k:records[k]['UPLAND_SKM'])
            if records[key]['UPLAND_SKM']<10:break
            assert key not in seen;seen.add(key);keys.append(key)
            # Stop after enough context; missing upstream continuations are reported.
            if sum(records[k]['LENGTH_KM'] for k in keys)>=12:break
        print('REFERENCE DOMINANT STEM',start,keys,'end_NEXT_UP_candidates',reverse[keys[-1]])
        return keys
    stems=[reference_stem(41406633),reference_stem(41406634)]
    for key in sorted(required):print('REFERENCE',records[key])
    def distances(points,lines):
        # Exact projected point-to-segment distances, not distances to vertices.
        result=np.full(len(points),np.inf)
        for line in lines:
            for a,b in zip(line[:-1],line[1:]):
                v=b-a;square=v@v
                t=np.clip((points-a)@v/square,0,1) if square else np.zeros(len(points))
                result=np.minimum(result,np.linalg.norm(points-(a+t[:,None]*v),axis=1))
        return result
    # Model samples are 30 or 42.4 m apart (D8 cells), restricted to these two
    # topology-selected reference stems. This is a corridor diagnostic, not proof.
    for i,(line,keys) in enumerate(zip(modeled,stems)):
        d=distances(line,[geometry[k] for k in keys])
        other=distances(line,[geometry[k] for k in stems[1-i]])
        print('CORRIDOR MODEL_TO_ASSIGNED_REFERENCE',i,'samples',len(d),
              'median_p90_max_m',np.percentile(d,[50,90,100]),
              'fraction_nearer_assigned_than_other',np.mean(d<other))
    fig,ax=plt.subplots(figsize=(11,10))
    for k,line in geometry.items():ax.plot(line[:,0],line[:,1],color='lightgrey',lw=.8)
    for k in required|set(stems[0]+stems[1]):
        line=geometry[k];ax.plot(line[:,0],line[:,1],color='navy',ls='--',lw=1.4)
        if k in required:
            p=line[len(line)//2];ax.text(*p,str(k),fontsize=8,color='navy')
    for line,color,label in zip(modeled,('darkorange','green'),('Modeled 65.6883 km² stem','Modeled 55.9710 km² stem')):
        ax.plot(line[:,0],line[:,1],color=color,lw=2,label=label)
        n=min(20,len(line)-1);ax.annotate('',xy=line[0],xytext=line[n],arrowprops={'arrowstyle':'->','color':color})
    ax.plot(downxy[:,0],downxy[:,1],color='red',lw=1.5,label='Modeled downstream to V2')
    ax.scatter(*xy(junction),marker='*',s=160,color='red',zorder=6,label='Exact modeled J5')
    for i,node in enumerate(nodes):
        ax.scatter(*node,marker='x',s=90,color='black',zorder=5)
        ax.annotate('Reference small junction' if i==0 else 'Reference larger junction',node,
                    xytext=(-130,-20 if i==0 else -35),textcoords='offset points',fontsize=8)
    ax.set(xlim=(xy(junction)[0]-1800,xy(junction)[0]+7000),
           ylim=(xy(junction)[1]-4500,xy(junction)[1]+4500),xlabel='UTM 44N easting (m)',ylabel='Northing (m)')
    ax.set_aspect('equal');ax.ticklabel_format(style='plain',useOffset=False);ax.grid(alpha=.2);ax.legend(fontsize=8)
    ax.set_title('EXPLORATORY J5 TRIBUTARY PATH COMPARISON — NOT VERIFIED CHANNEL GEOMETRY',fontsize=10)
    fig.text(.07,.025,'Dashed navy: topology-selected HydroRIVERS reference stems; pale grey: other reference reaches.\n'
             'Upstream modeled lines follow the largest incoming accumulation, not every tributary. eps=1e-8, no outlet changes.\n'
             'HydroRIVERS v1.0 / HydroSHEDS (WWF), Lehner & Grill (2013); shared provenance with HydroBASINS.',fontsize=8)
    fig.tight_layout(rect=(0,.08,1,1));fig.savefig(output,dpi=160);plt.close(fig)
    print('Saved',output,'; runtime_seconds',round(time.perf_counter()-started,2))
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print('Peak resident GiB',round(peak/(1024**3 if sys.platform=='darwin' else 1024**2),3))
    except ImportError:print('Peak memory unavailable on this platform')


if __name__=='__main__':main()
