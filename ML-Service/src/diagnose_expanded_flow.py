"""Expanded DEM diagnostic only: no raster output or accumulation.

macOS: ML-Service/.venv/bin/python ML-Service/src/diagnose_expanded_flow.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\diagnose_expanded_flow.py
Requires several GiB of available RAM; check memory before running.
"""
from pathlib import Path
import gc
import sys
import time

import numpy as np
import rasterio
from rasterio.warp import transform, transform_geom
from rasterio.features import rasterize
from scipy.ndimage import binary_erosion
from scipy.spatial import cKDTree
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
import shapefile

DIRECTIONS = (64, 128, 1, 2, 4, 8, 16, 32)
OFFSETS = dict(zip(DIRECTIONS, [(-1,0),(-1,1),(0,1),(1,1),
                               (1,0),(1,-1),(0,-1),(-1,-1)]))


def main():
    start = time.perf_counter()
    root = Path(__file__).resolve().parents[1]
    source = root / 'data/processed/dem_kalu_mosaic_utm44n_30m.tif'
    with rasterio.open(source) as dataset:
        assert dataset.crs.to_epsg() == 32644 and dataset.res == (30,30)
        elevations = dataset.read(1, out_dtype='float64')
        valid = dataset.read_masks(1) != 0
        original_zero = valid & (elevations == 0)
        assert np.isfinite(elevations[valid]).all()
        affine, crs = dataset.transform, dataset.crs
        points = {}
        for name, lon, lat in [('A',80.427488495,6.697871898),
                                ('B',80.349851704,6.704288066),
                                ('C',80.053331639,6.591401893),
                                ('old-west',80.013709777,6.631279111)]:
            x,y = transform('EPSG:4326',crs,[lon],[lat])
            points[name] = dataset.index(x[0],y[0])
            assert valid[points[name]]
        print(f'Full DEM {dataset.shape}; float64 array={elevations.nbytes/1024**2:.1f} MiB',flush=True)
    nodata = np.float64(-9999)
    elevations[~valid] = nodata
    view = ViewFinder(affine=affine, crs=crs, shape=elevations.shape, nodata=nodata)
    terrain = Raster(elevations, viewfinder=view)
    del elevations
    grid = Grid(viewfinder=view)
    def local_summary(name, array):
        for point, (r,c) in points.items():
            window=np.asarray(array[r-1:r+2,c-1:c+2]).copy()
            centre=float(window[1,1]); window[1,1]=np.inf
            print(f'LOCAL {name} {point}: elevation={centre:.15f}; '
                  f'centre-minus-lowest-neighbour={centre-window.min():.15g} m',flush=True)
    local_summary('original',terrain)
    print('Filling pits...',flush=True)
    filled = grid.fill_pits(terrain)
    del terrain
    gc.collect()
    print('Filling depressions...',flush=True)
    filled = grid.fill_depressions(filled)
    local_summary('depression-filled',filled)
    # Established workflow: invalid border is a temporary high barrier only
    # during flat resolution, never a low artificial outlet. No padding/crop.
    filled[~valid] = filled[valid].max()+100
    print('Resolving flats eps=1e-8...',flush=True)
    conditioned = grid.resolve_flats(filled, eps=1e-8)
    # The installed implementation uses an integer drainage gradient independent
    # of eps. Recover it blockwise to reconstruct the PREVIOUS 1e-7 surface,
    # avoiding a second full flat-resolution run. Require exact reproduction of
    # the candidate surface and validate previous terminal counts below.
    baseline = filled.copy()
    for first in range(0,valid.shape[0],128):
        sl=slice(first,first+128)
        gradient=np.rint((conditioned[sl]-filled[sl])/1e-8)
        assert np.array_equal(filled[sl]+1e-8*gradient,conditioned[sl])
        baseline[sl]=filled[sl]+1e-7*gradient
    del filled
    conditioned[~valid] = nodata
    baseline[~valid] = nodata
    local_summary('candidate 1e-8',conditioned)
    local_summary('reconstructed baseline 1e-7',baseline)
    baseline_direction=grid.flowdir(baseline,routing='d8',dirmap=DIRECTIONS,nodata_out=0)
    del baseline
    # Only prior terminal classifications are needed for cellwise comparisons.
    previous_terminals=np.zeros(valid.shape,dtype='int8')
    for code in (-1,-2): previous_terminals[baseline_direction==code]=code
    for name,cell in points.items():
        print(f'BASELINE {name} D8={int(baseline_direction[cell])}')
    del baseline_direction
    assert conditioned.dtype == np.float64
    assert np.isfinite(conditioned[valid]).all()
    gc.collect()
    print('Computing D8 directions only...',flush=True)
    direction = grid.flowdir(conditioned, routing='d8', dirmap=DIRECTIONS, nodata_out=0)
    del conditioned
    gc.collect()
    assert (direction[~valid] == 0).all()
    assert np.isin(direction[valid], list(DIRECTIONS)+[-1,-2]).all()
    # Validate destinations in row blocks to avoid huge index arrays.
    height,width = valid.shape
    for row0 in range(0,height,128):
        row1=min(row0+128,height)
        for code,(dr,dc) in OFFSETS.items():
            rr,cc=np.nonzero(direction[row0:row1] == code)
            rr=rr+row0+dr
            cc=cc+dc
            assert ((rr>=0)&(rr<height)&(cc>=0)&(cc<width)).all()
            assert valid[rr,cc].all(), 'Route into NoData'
    interior = binary_erosion(valid, np.ones((3,3)), border_value=0)
    reference = root/'data/raw/hydrobasins/hybas_as_lev12_v1c.shp'
    reference_crs = rasterio.crs.CRS.from_wkt(reference.with_suffix('.prj').read_text())
    geometries, ids, next_down = [],[],{}
    with shapefile.Reader(str(reference)) as reader:
        for record in reader.iterRecords():
            if int(record['MAIN_BAS']) == 4120049010:
                ids.append(int(record['HYBAS_ID']))
                next_down[ids[-1]]=int(record['NEXT_DOWN'])
                geometries.append(transform_geom(reference_crs,crs,
                                  reader.shape(record.oid).__geo_interface__))
    assert len(ids)==23
    # __geo_interface__ retains polygon exteriors/holes; ordinal labels fit uint8.
    labels = rasterize([(g,k+1) for k,g in enumerate(geometries)],
                       out_shape=valid.shape, transform=affine, dtype='uint8')
    for code,kind in [(-2,'pits'),(-1,'unresolved flats')]:
        print(f'COUNT {kind}: full valid={np.count_nonzero(valid & (direction==code))}; '
              f'interior={np.count_nonzero(interior & (direction==code))}; '
              f'inside23={np.count_nonzero((labels>0) & valid & (direction==code))}; '
              f'interior_inside23={np.count_nonzero((labels>0) & interior & (direction==code))}',flush=True)
        for title,mask in [('full interior',interior),('inside23',valid & (labels>0))]:
            old=mask & (previous_terminals==code)
            new=mask & (direction==code)
            print(f'CHANGE {title} {kind}: previous={old.sum()}; candidate={new.sum()}; '
                  f'newly_classified={np.count_nonzero(new & ~old)}; '
                  f'no_longer_classified={np.count_nonzero(old & ~new)}',flush=True)
    assert np.count_nonzero(interior & (previous_terminals==-2))==40
    assert np.count_nonzero(interior & (previous_terminals==-1))==2145575
    assert np.count_nonzero((labels>0) & (previous_terminals==-2))==2
    assert np.count_nonzero((labels>0) & (previous_terminals==-1))==133
    print('PASS: reconstructed previous configuration matches all four reported baseline counts')
    print(f'ZERO TERRAIN: original zero cells={original_zero.sum()}; '
          f'candidate interior flats on original zeros={np.count_nonzero(interior & original_zero & (direction==-1))}; '
          f'inside23 flats on original zeros={np.count_nonzero((labels>0) & original_zero & (direction==-1))}')
    del previous_terminals
    print('PASS: finite float64 conditioning, valid direction codes, no routes into NoData/outside raster',flush=True)

    paths=[]
    def location(cell):
        x,y=rasterio.transform.xy(affine,*cell)
        lon,lat=transform(crs,'EPSG:4326',[x],[y])
        return f'{lat[0]:.9f},{lon[0]:.9f}'
    for name in ('A','B','C'):
        cell=points[name]
        print(f'{name}: initial D8 code={int(direction[cell])}',flush=True)
        path=[]; seen=set(); length=0.0
        while True:
            if cell in seen:
                reason='LOOP'; break
            seen.add(cell); path.append(cell)
            code=int(direction[cell])
            if not valid[cell]:
                reason='ERROR NoData'; break
            if code not in OFFSETS:
                reason={-1:'unresolved flat',-2:'pit'}.get(code,'INVALID CODE')
                reason += '; interior' if interior[cell] else '; footprint edge'
                break
            dr,dc=OFFSETS[code]
            target=(cell[0]+dr,cell[1]+dc)
            if not (0<=target[0]<height and 0<=target[1]<width):
                reason='ERROR outside raster'; break
            length+=30*np.hypot(dr,dc)
            cell=target
        paths.append(path)
        print(f'PATH {name}: steps={len(path)-1}; length_km={length/1000:.6f}; '
              f'endpoint={location(path[-1])}; reason={reason}',flush=True)
        for target in ('A','B','C','old-west'):
            distances=np.linalg.norm((np.array(path)-np.array(points[target]))*30,axis=1)
            print(f'PATH {name}: target={target}; exact_cell={points[target] in seen}; '
                  f'closest_m={distances.min():.1f}; target_code={int(direction[points[target]])}',flush=True)
        print(f'ENDPOINT original_zero={bool(original_zero[path[-1]])}; '
              f'inside23={bool(labels[path[-1]])}')
        sequence=[]
        for p in path:
            ordinal=int(labels[p]); basin=ids[ordinal-1] if ordinal else None
            if not sequence or sequence[-1]!=basin: sequence.append(basin)
        print(f'REFERENCE {name}: sequence={sequence}')
        print('NEXT_DOWN for visited basins:',{i:next_down[i] for i in sequence if i is not None})
    shared=set(paths[0]) & set(paths[1])
    print(f'Paths connect: {bool(shared)}; shared cells={len(shared)}')
    print('Three-way shared cells:',len(set(paths[0]) & set(paths[1]) & set(paths[2])))
    # Small point-tree compares remaining problems to the two paths without a
    # full-DEM distance-transform float64 array. Distance means proximity only.
    path_cells=np.array(sorted(set(paths[0])|set(paths[1])|set(paths[2])))
    tree=cKDTree(path_cells*30)
    for code,kind in [(-2,'pits'),(-1,'flats')]:
        rr,cc=np.nonzero(interior & (direction==code))
        if len(rr):
            distance,_=tree.query(np.column_stack((rr,cc))*30)
            print(f'PROXIMITY {kind}: on_path={np.count_nonzero(distance==0)}; '
                  f'within300m={np.count_nonzero(distance<=300)}; '
                  f'within1000m={np.count_nonzero(distance<=1000)}; min_m={distance.min():.1f}')
            for k in np.argsort(distance)[:5]:
                cell=(int(rr[k]),int(cc[k]))
                print(f'NEAR {kind}: {location(cell)}; distance_m={distance[k]:.1f}; '
                      f'inside23={bool(labels[cell])}')
        else: print(f'PROXIMITY {kind}: none')
    print(f'Runtime: {time.perf_counter()-start:.1f} seconds')
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f'Peak resident memory: {peak/(1024**3 if sys.platform=="darwin" else 1024**2):.3f} GiB')
    except ImportError:
        print('Peak resident memory unavailable on this platform')
    print('No rasters saved; no accumulation, gauge snapping or watershed extraction.')


if __name__=='__main__':
    main()
