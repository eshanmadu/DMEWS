"""Diagnostic-only comparison; no saved rasters, snapping or watershed extraction.

macOS: ML-Service/.venv/bin/python ML-Service/src/compare_ratnapura_outlets.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\compare_ratnapura_outlets.py
Allow roughly 3-4 GiB RAM; inspect current memory availability before running.
No network requests. Bridge distances use an endpoint chord, NOT a surveyed CS.
"""
from pathlib import Path
import gc
import sys
import time

import numpy as np
import rasterio
from rasterio.warp import transform
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder

DIRECTIONS=(64,128,1,2,4,8,16,32)
OFFSETS=dict(zip(DIRECTIONS,[(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]))
# Previously retrieved OSM way 160312926, version 13, edited 2026-05-07.
# Endpoints only: straight chord is contextual, not exact curved bridge geometry.
BRIDGE_LONLAT=[(80.3971498,6.6790342),(80.3976967,6.6794494)]


def main():
    started=time.perf_counter();root=Path(__file__).resolve().parents[1]
    with rasterio.open(root/'data/processed/dem_kalu_mosaic_utm44n_30m.tif') as source:
        assert source.crs.to_epsg()==32644 and source.res==(30,30)
        assert source.shape==(3701,7380) and source.nodata==-9999
        affine,crs=source.transform,source.crs
        x,y=transform('EPSG:4326',crs,[80.397036763],[6.679858803])
        points={'V1':(1196,5159),'V4':(1197,5159),'Candidate 1':source.index(x[0],y[0])}
        assert points['Candidate 1']==(1194,5158)
        for name,p in points.items():
            assert source.index(*source.xy(*p))==p
            print('CELL_INDEX_CHECK',name,p,source.xy(*p))
        elevations=source.read(1,out_dtype='float64');valid=source.read_masks(1)!=0
        assert int(valid.sum())==27169459 and np.isfinite(elevations[valid]).all()
        assert all(valid[p] for p in points.values())
    # Keep only small original and conditioned windows for later reporting.
    r0,c0=1187,5150
    original=elevations[r0:r0+23,c0:c0+23].copy()
    nodata=np.float64(-9999);elevations[~valid]=nodata
    view=ViewFinder(affine=affine,crs=crs,shape=valid.shape,nodata=nodata)
    terrain=Raster(elevations,viewfinder=view);del elevations
    grid=Grid(viewfinder=view)
    print('Full-context pit filling...',flush=True)
    filled=grid.fill_pits(terrain);del terrain;gc.collect()
    print('Full-context depression filling...',flush=True)
    filled=grid.fill_depressions(filled)
    filled[~valid]=filled[valid].max()+100
    print('Resolving flats eps=1e-8...',flush=True)
    conditioned=grid.resolve_flats(filled,eps=1e-8);del filled
    conditioned[~valid]=nodata
    assert conditioned.dtype==np.float64 and np.isfinite(conditioned[valid]).all()
    local_conditioned=np.asarray(conditioned[r0:r0+23,c0:c0+23]).copy()
    gc.collect()
    print('D8 directions...',flush=True)
    direction=grid.flowdir(conditioned,routing='d8',dirmap=DIRECTIONS,nodata_out=0)
    del conditioned;gc.collect()
    # Pysheds exposes pyproj.Proj, while rasterio exposes rasterio.CRS.
    # Compare the CRS definitions, not the two different wrapper objects.
    assert direction.shape==valid.shape and direction.affine==affine and direction.crs.crs.to_epsg()==32644
    assert (direction[~valid]==0).all()
    assert np.isin(direction[valid],list(DIRECTIONS)+[-1,-2]).all()
    # Accumulation can change terminal codes; preserve compact codes for tracing.
    codes=np.asarray(direction).astype('int16')
    print('Iterative D8 accumulation, in memory only...',flush=True)
    accumulation=grid.accumulation(direction,routing='d8',dirmap=DIRECTIONS,algorithm='iterative')
    del direction;gc.collect()
    assert accumulation.shape==valid.shape and accumulation.affine==affine and accumulation.crs.crs.to_epsg()==32644
    for first in range(0,valid.shape[0],128):
        mask=valid[first:first+128];block=np.asarray(accumulation[first:first+128])
        assert np.isfinite(block[mask]).all() and (block[mask]>=1).all() and (block[~mask]==0).all()
    assert accumulation[points['Candidate 1']]==715763
    print('PASS: shape, CRS, transform, cell indexing, finite accumulation and previous Candidate 1 count')
    bridge=np.array([transform('EPSG:4326',crs,[lon],[lat]) for lon,lat in BRIDGE_LONLAT]).reshape(2,2)
    xx,yy=transform('EPSG:4326',crs,[80.397166667],[6.678666667]);official=np.array([xx[0],yy[0]])
    def centre(p):return np.array(rasterio.transform.xy(affine,*p))
    def bridge_distance(p):
        a,b=bridge;v=b-a;t=np.clip(np.dot(p-a,v)/np.dot(v,v),0,1)
        return float(np.linalg.norm(p-(a+t*v)))
    def area(p):return float(accumulation[p])*0.0009
    paths={}
    def trace(start):
        if start in paths:return paths[start]
        path=[];seen=set();p=start;length=0.
        while True:
            if p in seen:raise ValueError(f'D8 loop at {p}')
            seen.add(p);path.append(p)
            code=int(codes[p])
            if code not in OFFSETS:
                assert code in (-1,-2),'Unexpected terminal code'
                reason='unresolved flat' if code==-1 else 'pit';break
            dr,dc=OFFSETS[code];q=(p[0]+dr,p[1]+dc)
            assert 0<=q[0]<valid.shape[0] and 0<=q[1]<valid.shape[1] and valid[q],'Invalid route'
            length+=30*np.hypot(dr,dc);p=q
        paths[start]=(path,reason,length);return paths[start]
    reference_path=set(trace(points['Candidate 1'])[0])
    def relationship(p):
        path=set(trace(p)[0]);ref=points['Candidate 1']
        if p==ref:return 'reference cell'
        if ref in path:return 'upstream: drains into Candidate 1'
        if p in reference_path:return 'downstream of Candidate 1'
        return 'separate branch merging downstream' if path & reference_path else 'disconnected'
    def report(name,p):
        xy=centre(p);lon,lat=transform(crs,'EPSG:4326',[xy[0]],[xy[1]])
        r,c=p[0]-r0,p[1]-c0
        print(f'RESULT {name}: row,col={p}; E/N={xy[0]:.3f},{xy[1]:.3f}; '
              f'latlon={lat[0]:.9f},{lon[0]:.9f}; original_m={original[r,c]:.9f}; '
              f'conditioned_m={local_conditioned[r,c]:.12f}; D8={codes[p]}; '
              f'cells={accumulation[p]:.0f}; area_km2={area(p):.6f}; '
              f'bridge_chord_distance_m={bridge_distance(xy):.3f}; '
              f'alternative_official_distance_m={np.linalg.norm(xy-official):.3f}; '
              f'Candidate1_distance_m={np.linalg.norm(xy-centre(points["Candidate 1"])):.3f}; '
              f'relationship={relationship(p)}; difference_from603_pct={(area(p)/603-1)*100:.3f}',flush=True)
        path,reason,length=trace(p)
        print(f'PATH {name}: steps={len(path)-1}; length_km={length/1000:.6f}; final_cell={path[-1]}; reason={reason}')
    for name,p in points.items():
        report(name,p)
        if name in ('V1','V4'):
            r,c=p;print(f'{name} D8 3x3:\n',codes[r-1:r+2,c-1:c+2]);print(f'{name} D8 5x5:\n',codes[r-2:r+3,c-2:c+3])
    for name in ('V1','V4'):
        p=points[name];path=trace(p)[0]
        if points['Candidate 1'] in path:
            k=path.index(points['Candidate 1']);segment=path[:k+1]
            distance=sum(30*np.hypot(b[0]-a[0],b[1]-a[1]) for a,b in zip(segment[:-1],segment[1:]))
            print(f'LOCAL_CONNECTION {name} to Candidate 1: steps={k}; length_m={distance:.3f}; cells={segment}')
    a,b=points['V1'],points['V4']
    print('V4 drains through V1:',a in trace(b)[0],'; V1 drains through V4:',b in trace(a)[0])
    # Tight local search, bounded by 90 m from the bridge endpoint chord.
    # >=50 km2 is exploratory and independent of the 603 km2 reported area.
    if any(area(points[name])<50 or relationship(points[name]).startswith('separate') for name in ('V1','V4')):
        count=0
        exact_bridge_cells={(1196,5159),(1196,5160),(1197,5158),(1197,5159)}
        # These four cells were identified by full OSM geometry in the prior
        # overlay. No geometry is downloaded or re-rasterized in this task.
        for r in range(r0,r0+23):
            for c in range(c0,c0+23):
                p=(r,c);d=bridge_distance(centre(p))
                if valid[p] and int(codes[p]) in OFFSETS and d<=90 and area(p)>=50:
                    count+=1;label=f'N{count}';report(label,p)
                    print(f'SEARCH {label}: within_radius_m={next(x for x in (30,60,90) if d<=x)}; '
                          f'prior_exact_bridge_intersection={p in exact_bridge_cells}')
        print('Substantial local cells within 90m of bridge chord:',count)
    print('Areas are contributing terrain, not observed discharge. No cell selected as outlet.')
    print(f'Runtime: {time.perf_counter()-started:.1f} seconds')
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f'Peak resident memory: {peak/(1024**3 if sys.platform=="darwin" else 1024**2):.3f} GiB')
    except ImportError:print('Peak resident memory unavailable on this platform')
    print('No saved rasters, dataset downloads, snapping or watershed extraction.')


if __name__=='__main__':main()
