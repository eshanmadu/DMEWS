"""Inspect the new terminal using full expanded-DEM conditioning; save no rasters.

macOS: ML-Service/.venv/bin/python ML-Service/src/diagnose_expanded_pit.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\diagnose_expanded_pit.py
Check available RAM before execution (previous full-context peak about 2.5 GiB).
"""
from pathlib import Path
import gc
import sys
import time

import numpy as np
import rasterio
from rasterio.warp import transform, transform_geom
from rasterio.windows import Window
from rasterio.features import rasterize
from scipy.ndimage import label, binary_dilation
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
import shapefile

DIRECTIONS = (64,128,1,2,4,8,16,32)
OFFSETS = [(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]


def inspect_adjacent_flat(array, valid, row, col):
    """Describe the original 2.5 m plateau beside the slightly higher cell."""
    level = float(array[row-1,col])
    labels,_ = label(valid & (array==level),np.ones((3,3)))
    connected = labels==labels[row-1,col]
    del labels
    border = binary_dilation(connected,np.ones((3,3))) & ~connected
    values = array[border & valid]
    rr,cc = np.nonzero(connected)
    print(f'ADJACENT ORIGINAL FLAT level={level}; cells={len(rr)}; '
          f'row range={rr.min()}..{rr.max()}; col range={cc.min()}..{cc.max()}; '
          f'adjacent invalid={np.count_nonzero(border & ~valid)}; '
          f'lower boundary cells={np.count_nonzero(values<level)}; '
          f'min boundary elevation={values.min() if values.size else None}',flush=True)
    print('Adjacent plateau touches array boundary:',bool(connected[0].any() or connected[-1].any()
                                                         or connected[:,0].any() or connected[:,-1].any()))


def main():
    started=time.perf_counter()
    root=Path(__file__).resolve().parents[1]
    lon,lat=80.053331639,6.591401893
    with rasterio.open(root/'data/processed/dem_kalu_mosaic_utm44n_30m.tif') as source:
        assert source.crs.to_epsg()==32644 and source.res==(30,30)
        terrain_values=source.read(1,out_dtype='float64')
        valid=source.read_masks(1)!=0
        affine,crs=source.transform,source.crs
        x,y=transform('EPSG:4326',crs,[lon],[lat])
        row,col=source.index(x[0],y[0])
        assert valid[row,col]
    print(f'Terminal row={row}, column={col}; float64 grid={terrain_values.nbytes/1024**2:.1f} MiB',flush=True)
    # Distances to invalid cell centres; no full-grid distance array required.
    rr,cc=np.nonzero(~valid)
    distance=np.hypot(rr-row,cc-col)*30
    print(f'Nearest invalid cell centre={distance.min():.1f} m; '
          f'nearest rectangular raster edge={min(row,col,valid.shape[0]-1-row,valid.shape[1]-1-col)*30:.1f} m')
    del rr,cc,distance
    snapshots={}
    original_local=terrain_values[row-50:row+51,col-50:col+51].copy()

    def inspect(stage, array, component=False):
        window=np.asarray(array[row-2:row+3,col-2:col+3]).copy()
        snapshots[stage]=window
        neighbours=np.array([window[2+dr,2+dc] for dr,dc in OFFSETS])
        slopes=(window[2,2]-neighbours)/np.array([30*np.hypot(dr,dc) for dr,dc in OFFSETS])
        best=int(np.argmax(slopes))
        expected=DIRECTIONS[best] if slopes[best]>0 else (-1 if slopes[best]==0 else -2)
        print(f'\nSTAGE {stage}: centre={window[2,2]:.15f} m; '
              f'centre-minus-min-neighbour={window[2,2]-neighbours.min():.15g} m; '
              f'lower neighbour count={np.count_nonzero(neighbours<window[2,2])}; independent D8={expected}',flush=True)
        print('3x3:\n',np.array2string(window[1:4,1:4],precision=15))
        print('5x5:\n',np.array2string(window,precision=15))
        print('Slopes N NE E SE S SW W NW:',np.array2string(slopes,precision=15))
        print('float64 spacing (m):',np.spacing(window[2,2]))
        if component:
            # Full-context equal-elevation component only: not a catchment.
            labels,_=label(valid & (np.asarray(array)==window[2,2]),np.ones((3,3)))
            connected=labels==labels[row,col]
            del labels
            border=binary_dilation(connected,np.ones((3,3))) & ~connected
            values=np.asarray(array)[border & valid]
            r,c=np.nonzero(connected)
            print(f'EXACT FLAT cells={len(r)}; row range={r.min()}..{r.max()}; col range={c.min()}..{c.max()}; '
                  f'adjacent invalid={np.count_nonzero(border & ~valid)}; '
                  f'lower valid boundary cells={np.count_nonzero(values<window[2,2])}; '
                  f'min valid boundary elevation={values.min() if values.size else None}')
            print('Component touches array boundary:',bool(connected[0].any() or connected[-1].any()
                                                          or connected[:,0].any() or connected[:,-1].any()))
        return expected

    inspect('original',terrain_values,True)
    inspect_adjacent_flat(terrain_values,valid,row,col)
    nodata=np.float64(-9999)
    terrain_values[~valid]=nodata
    view=ViewFinder(affine=affine,crs=crs,shape=valid.shape,nodata=nodata)
    terrain=Raster(terrain_values,viewfinder=view)
    del terrain_values
    grid=Grid(viewfinder=view)
    print('Filling pits...',flush=True)
    filled=grid.fill_pits(terrain)
    del terrain
    gc.collect()
    inspect('pit-filled',filled)
    print('Filling depressions...',flush=True)
    filled=grid.fill_depressions(filled)
    inspect('depression-filled',filled,True)
    changes=np.asarray(filled[row-50:row+51,col-50:col+51])-original_local
    print(f'Local 101x101 depression-fill changes from original: raised={np.count_nonzero(changes>0)}; '
          f'max_raise={changes.max():.12f} m; centre_raise={changes[50,50]:.12f} m')
    # Same temporary high NoData barrier as existing diagnostic; restore before D8.
    filled[~valid]=filled[valid].max()+100
    print('Resolving flats with eps=1e-7...',flush=True)
    conditioned=grid.resolve_flats(filled,eps=1e-7)
    del filled
    conditioned[~valid]=nodata
    assert conditioned.dtype==np.float64
    assert np.isfinite(conditioned[valid]).all()
    gc.collect()
    expected=inspect('flat-resolved',conditioned,True)
    increments=snapshots['flat-resolved']-snapshots['depression-filled']
    print('5x5 flat-resolution increments (metres):\n',np.array2string(increments,precision=15))
    direction=grid.flowdir(conditioned,routing='d8',dirmap=DIRECTIONS,nodata_out=0)
    del conditioned
    gc.collect()
    print('Final D8 5x5:\n',np.asarray(direction[row-2:row+3,col-2:col+3]))
    print(f'Final D8={int(direction[row,col])}; agrees with independent slopes={int(direction[row,col])==expected}')
    assert int(direction[row,col])==expected
    del direction
    gc.collect()

    # Inspect the geographic source mosaic around this location. This is a
    # different grid, so do not interpret nearest pixels as identical samples.
    with rasterio.open(root/'data/processed/dem_kalu_mosaic_wgs84.tif') as mosaic:
        r,c=mosaic.index(lon,lat)
        values=mosaic.read(1,window=Window(c-2,r-2,5,5),masked=True)
        print('Original WGS84 mosaic 5x5 nearest neighbourhood:\n',np.array2string(values.data,precision=9))
        print('Source mosaic local mask all valid:',not np.ma.getmaskarray(values).any())
        print('Distance in longitude from original 80E seam:',lon-79.99986111111112)

    reference=root/'data/raw/hydrobasins/hybas_as_lev12_v1c.shp'
    ref_crs=rasterio.crs.CRS.from_wkt(reference.with_suffix('.prj').read_text())
    records={}; containing=[]
    with shapefile.Reader(str(reference)) as reader:
        for record in reader.iterRecords():
            if int(record['MAIN_BAS'])!=4120049010: continue
            basin=int(record['HYBAS_ID']); records[basin]=record.as_dict()
            geometry=transform_geom(ref_crs,crs,reader.shape(record.oid).__geo_interface__)
            # Classify the actual DEM-cell centre with polygon holes respected.
            inside=rasterize([(geometry,1)],out_shape=(1,1),
                             transform=affine*rasterio.Affine.translation(col,row),dtype='uint8')[0,0]
            if inside: containing.append(basin)
    print('Reference polygon(s) at pit cell:',containing)
    for basin in containing:
        sequence=[]; seen=set()
        while basin and basin not in seen and basin in records:
            seen.add(basin); sequence.append(basin); basin=int(records[basin]['NEXT_DOWN'])
        print('NEXT_DOWN continuation:',sequence,'then',basin)
    print('HydroBASINS indicates coarse downstream topology, not exact channel elevations.')
    print(f'Runtime: {time.perf_counter()-started:.1f} seconds')
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f'Peak resident memory: {peak/(1024**3 if sys.platform=="darwin" else 1024**2):.3f} GiB')
    except ImportError:
        print('Peak memory unavailable on this platform')
    print('No correction, raster output, accumulation, snapping or watershed extraction.')


if __name__=='__main__':
    main()
