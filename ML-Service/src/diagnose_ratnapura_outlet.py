"""Read-only gauge/channel comparison; no outlet selection or saved rasters.

macOS: ML-Service/.venv/bin/python ML-Service/src/diagnose_ratnapura_outlet.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\diagnose_ratnapura_outlet.py
Check available RAM first; allow roughly 3-4 GiB for full-context diagnostics.
"""
from pathlib import Path
import gc
import sys
import time

import numpy as np
from affine import Affine
import rasterio
from rasterio.warp import transform, transform_geom
from rasterio.windows import Window
from rasterio.features import rasterize
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
import shapefile

DIRECTIONS=(64,128,1,2,4,8,16,32)
OFFSETS=dict(zip(DIRECTIONS,[(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]))


def main():
    started=time.perf_counter(); root=Path(__file__).resolve().parents[1]
    source_path=root/'data/processed/dem_kalu_mosaic_utm44n_30m.tif'
    with rasterio.open(source_path) as source:
        assert source.crs.to_epsg()==32644 and source.res==(30,30)
        affine,crs=source.transform,source.crs
        xx,yy=transform('EPSG:4326',crs,[80.394167],[6.678333]); gx,gy=xx[0],yy[0]
        lon,lat=transform(crs,'EPSG:4326',[gx],[gy])
        assert abs(lon[0]-80.394167)<1e-8 and abs(lat[0]-6.678333)<1e-8
        gauge=source.index(gx,gy)
        values=source.read(1,out_dtype='float64'); valid=source.read_masks(1)!=0
        assert valid[gauge] and np.isfinite(values[valid]).all()
        print(f'Gauge E={gx:.6f}, N={gy:.6f}; row,col={gauge}; round-trip PASS',flush=True)
        r,c=gauge
        print('Original gauge 5x5:\n',values[r-2:r+3,c-2:c+3])
    # Save only the small local original elevations, not a full extra surface.
    r0,c0=gauge[0]-20,gauge[1]-20
    local_original=values[r0:r0+41,c0:c0+41].copy()
    nodata=np.float64(-9999); values[~valid]=nodata
    view=ViewFinder(affine=affine,shape=valid.shape,crs=crs,nodata=nodata)
    terrain=Raster(values,viewfinder=view); del values
    grid=Grid(viewfinder=view)
    print('Full-context pit filling...',flush=True)
    filled=grid.fill_pits(terrain); del terrain; gc.collect()
    print('Full-context depression filling...',flush=True)
    filled=grid.fill_depressions(filled)
    filled[~valid]=filled[valid].max()+100
    print('Resolving flats eps=1e-8...',flush=True)
    conditioned=grid.resolve_flats(filled,eps=1e-8); del filled
    conditioned[~valid]=nodata
    assert conditioned.dtype==np.float64 and np.isfinite(conditioned[valid]).all()
    local_conditioned=np.asarray(conditioned[r0:r0+41,c0:c0+41]).copy()
    gc.collect()
    print('D8 directions...',flush=True)
    direction=grid.flowdir(conditioned,routing='d8',dirmap=DIRECTIONS,nodata_out=0)
    del conditioned; gc.collect()
    assert (direction[~valid]==0).all()
    assert np.isin(direction[valid],list(DIRECTIONS)+[-1,-2]).all()
    # Accumulation can replace terminal codes internally; retain compact codes.
    codes=np.asarray(direction).astype('int16')
    print('Diagnostic iterative D8 accumulation IN MEMORY ONLY...',flush=True)
    accumulation=grid.accumulation(direction,routing='d8',dirmap=DIRECTIONS,algorithm='iterative')
    del direction; gc.collect()
    for first in range(0,valid.shape[0],128):
        mask=valid[first:first+128]; block=np.asarray(accumulation[first:first+128])
        assert np.isfinite(block[mask]).all() and (block[mask]>=1).all()
        assert (block[~mask]==0).all()
    print('PASS accumulation: finite, >=1 for valid cells; zero in NoData',flush=True)
    print('Gauge D8 5x5:\n',codes[gauge[0]-2:gauge[0]+3,gauge[1]-2:gauge[1]+3])
    print('Gauge accumulation 5x5 (cells):\n',np.asarray(accumulation[gauge[0]-2:gauge[0]+3,gauge[1]-2:gauge[1]+3]))
    area=lambda p:float(accumulation[p])*0.0009  # 30 x 30 m, including cell itself.
    print(f'GAUGE elevation={local_original[20,20]:.9f}; conditioned={local_conditioned[20,20]:.12f}; '
          f'D8={codes[gauge]}; accumulation={accumulation[gauge]:.0f}; area_km2={area(gauge):.6f}')

    path_cache={}
    def trace(start):
        if start in path_cache: return path_cache[start]
        path=[]; seen=set(); cell=start; length=0.0
        while True:
            if cell in seen: raise ValueError(f'Loop at {cell}')
            seen.add(cell); path.append(cell)
            code=int(codes[cell])
            if code not in OFFSETS:
                reason={-1:'unresolved flat',-2:'pit'}.get(code,'invalid code')
                break
            dr,dc=OFFSETS[code]; target=(cell[0]+dr,cell[1]+dc)
            assert 0<=target[0]<valid.shape[0] and 0<=target[1]<valid.shape[1] and valid[target]
            length+=30*np.hypot(dr,dc); cell=target
        path_cache[start]=(path,reason,length)
        return path_cache[start]

    rr,cc=np.indices((41,41)); rr+=r0; cc+=c0
    xs=affine.c+(cc+0.5)*30; ys=affine.f-(rr+0.5)*30
    distance=np.hypot(xs-gx,ys-gy)
    local_acc=np.asarray(accumulation[r0:r0+41,c0:c0+41])
    candidates={}
    for radius in (150,300,500):
        eligible=(distance<=radius)&valid[r0:r0+41,c0:c0+41]&(codes[r0:r0+41,c0:c0+41]>0)
        index=np.flatnonzero(eligible)
        best=index[np.argmax(local_acc.ravel()[index])]
        p=(int(rr.ravel()[best]),int(cc.ravel()[best]))
        candidates.setdefault(p,[]).append(f'peak within {radius}m')
        # 50 km2 is a transparent exploratory threshold, not proof of a river
        # and not calibrated against the published 603 km2 gauge area.
        substantial=np.flatnonzero(eligible & (local_acc*0.0009>=50))
        if len(substantial):
            nearest=substantial[np.argmin(distance.ravel()[substantial])]
            p=(int(rr.ravel()[nearest]),int(cc.ravel()[nearest]))
            candidates.setdefault(p,[]).append(f'nearest >=50km2 within {radius}m')
        else: print(f'RADIUS {radius}m: no routed cell with >=50km2')
    # Look for up to three additional >=10 km2 branches that are not simply
    # upstream/downstream points on one already represented path.
    eligible=np.flatnonzero((distance<=500)&(local_acc*0.0009>=10))
    additional=0
    for k in sorted(eligible,key=lambda k:distance.ravel()[k]):
        p=(int(rr.ravel()[k]),int(cc.ravel()[k]))
        path=trace(p)[0]
        if all(p not in trace(q)[0] and q not in path for q in candidates):
            candidates.setdefault(p,[]).append('additional distinct >=10km2 branch within 500m')
            additional+=1
            if additional==3: break
    print('Additional distinct branch representatives:',additional)
    reference=root/'data/raw/hydrobasins/hybas_as_lev12_v1c.shp'
    ref_crs=rasterio.crs.CRS.from_wkt(reference.with_suffix('.prj').read_text())
    geometries=[]
    with shapefile.Reader(str(reference)) as reader:
        for record in reader.iterRecords():
            if int(record['MAIN_BAS'])==4120049010:
                geometries.append((int(record['HYBAS_ID']),transform_geom(ref_crs,crs,reader.shape(record.oid).__geo_interface__)))
    def membership(p):
        return [i for i,g in geometries if rasterize([(g,1)],out_shape=(1,1),
                transform=affine*Affine.translation(p[1],p[0]),dtype='uint8')[0,0]]
    print('Gauge HydroBASINS:',membership(gauge))
    for number,(p,tags) in enumerate(candidates.items(),1):
        x,y=rasterio.transform.xy(affine,*p); lons,lats=transform(crs,'EPSG:4326',[x],[y])
        d=float(np.hypot(x-gx,y-gy)); lr,lc=p[0]-r0,p[1]-c0
        print(f'CANDIDATE {number}: tags={tags}; row,col={p}; latlon={lats[0]:.9f},{lons[0]:.9f}; '
              f'distance_m={d:.3f}; original_m={local_original[lr,lc]:.9f}; '
              f'conditioned_m={local_conditioned[lr,lc]:.12f}; D8={codes[p]}; '
              f'cells={accumulation[p]:.0f}; area_km2={area(p):.6f}; '
              f'difference_from603_pct={(area(p)/603-1)*100:.2f}; HydroBASINS={membership(p)}',flush=True)
        path,reason,length=trace(p)
        print(f'CONTINUITY candidate {number}: downstream_steps={len(path)-1}; '
              f'length_km={length/1000:.3f}; final_cell={path[-1]}; reason={reason}')
        # Trace one dominant local upstream branch, not the full watershed.
        upstream=[p]; cell=p
        for _ in range(40):
            incoming=[]
            for code,(dr,dc) in OFFSETS.items():
                q=(cell[0]-dr,cell[1]-dc)
                if 0<=q[0]<valid.shape[0] and 0<=q[1]<valid.shape[1] and int(codes[q])==code:
                    incoming.append(q)
            if not incoming: break
            cell=max(incoming,key=lambda q:float(accumulation[q]))
            if cell in upstream: raise ValueError('Upstream loop')
            upstream.append(cell)
        print(f'UPSTREAM candidate {number}: dominant-branch steps={len(upstream)-1}; '
              f'far-cell={upstream[-1]}; far-area_km2={area(upstream[-1]):.6f}')
    listed=list(candidates)
    for i,p in enumerate(listed):
        for j,q in enumerate(listed[i+1:],i+1):
            pp=set(trace(p)[0]); qq=set(trace(q)[0]); shared=pp&qq
            relation='same path' if p in qq or q in pp else ('different branches that merge' if shared else 'disconnected paths')
            print(f'PAIR {i+1}/{j+1}: {relation}; shared_cells={len(shared)}')
    gauge_path=set(trace(gauge)[0])
    for i,p in enumerate(listed,1):
        print(f'Gauge/candidate {i}: candidate on gauge downstream path={p in gauge_path}; '
              f'gauge on candidate downstream path={gauge in trace(p)[0]}')
    print('Accumulation is contributing terrain cells, not observed discharge. No outlet selected.')
    print(f'Runtime: {time.perf_counter()-started:.1f} seconds')
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f'Peak resident memory: {peak/(1024**3 if sys.platform=="darwin" else 1024**2):.3f} GiB')
    except ImportError: print('Peak resident memory unavailable on this platform')
    print('No rasters, snapping, watershed extraction or production changes.')


if __name__=='__main__':
    main()
