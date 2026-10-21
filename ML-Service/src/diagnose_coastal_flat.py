"""Diagnose the coastal terminal, without altering DEMs or saving raster outputs.

macOS: ML-Service/.venv/bin/python ML-Service/src/diagnose_coastal_flat.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\diagnose_coastal_flat.py
Check available RAM before running; full-context conditioning needs several GiB.
"""
from pathlib import Path
import gc
import sys
import time

import numpy as np
import rasterio
from rasterio.warp import transform, transform_bounds, transform_geom
from rasterio.features import rasterize
from rasterio.windows import Window
from scipy.ndimage import label, binary_dilation, binary_erosion
from scipy.spatial import cKDTree
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
import shapefile

DIRECTIONS=(64,128,1,2,4,8,16,32)
OFFSETS=[(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]
LON,LAT=79.970823553,6.600735495


def component_summary(name,array,valid,row,col,affine,crs,projected):
    """Exact equality, 8-connected cells; no tolerance merges distinct heights."""
    value=float(array[row,col])
    labels,_=label(valid & (np.asarray(array)==value),np.ones((3,3)))
    connected=labels==labels[row,col]
    del labels
    rows=np.flatnonzero(connected.any(axis=1)); cols=np.flatnonzero(connected.any(axis=0))
    count=int(connected.sum())
    border=binary_dilation(connected,np.ones((3,3))) & ~connected
    neighbouring=np.asarray(array)[border & valid]
    lower=border & valid & (np.asarray(array)<value)
    window=Window(int(cols[0]),int(rows[0]),int(cols[-1]-cols[0]+1),int(rows[-1]-rows[0]+1))
    bbox=rasterio.windows.bounds(window,affine)
    geographic=transform_bounds(crs,'EPSG:4326',*bbox,densify_pts=21)
    print(f'COMPONENT {name}: level={value:.15g}; cells={count:,}; '
          f'area_km2={count*abs(affine.a*affine.e)/1e6 if projected else "not calculated in degrees"}; '
          f'geographic bounding-window extent W/S/E/N={geographic}',flush=True)
    print(f'COMPONENT {name}: array edges N/S/W/E='
          f'{connected[0].any()}/{connected[-1].any()}/{connected[:,0].any()}/{connected[:,-1].any()}; '
          f'adjacent NoData cells={np.count_nonzero(border & ~valid)}; '
          f'lower valid neighbours={lower.sum()}; '
          f'valid neighbour range={neighbouring.min() if neighbouring.size else None}..'
          f'{neighbouring.max() if neighbouring.size else None}',flush=True)
    if projected:
        margin=min(rows[0],len(valid)-1-rows[-1],cols[0],valid.shape[1]-1-cols[-1])*30
        if (border & ~valid).any(): distance=30.0  # Refine diagonal-only contact below.
        # Query only component boundary against invalid cell centres.
        edge=connected & ~binary_erosion(connected,np.ones((3,3)),border_value=0)
        er,ec=np.nonzero(edge); ir,ic=np.nonzero(~valid)
        if len(ir):
            tree=cKDTree(np.column_stack((ir,ic))*30)
            distance=float(tree.query(np.column_stack((er,ec))*30)[0].min())
        else: distance=float('inf')
        print(f'COMPONENT {name}: nearest array-edge cell margin={margin:.1f} m; '
              f'nearest NoData cell-centre distance={distance:.3f} m')
    if lower.any():
        rr,cc=np.nonzero(lower); k=int(np.argmin(np.asarray(array)[lower]))
        x,y=rasterio.transform.xy(affine,int(rr[k]),int(cc[k]))
        lon,lat=transform(crs,'EPSG:4326',[x],[y])
        print(f'COMPONENT {name}: lowest adjacent sample={array[rr[k],cc[k]]:.12g} m '
              f'at {lat[0]:.9f},{lon[0]:.9f}; not a selected outlet')
    return connected


def main():
    started=time.perf_counter(); root=Path(__file__).resolve().parents[1]
    path=root/'data/processed/dem_kalu_mosaic_utm44n_30m.tif'
    with rasterio.open(path) as source:
        elevations=source.read(1,out_dtype='float64'); valid=source.read_masks(1)!=0
        affine,crs=source.transform,source.crs
        assert crs.to_epsg()==32644 and source.res==(30,30)
        x,y=transform('EPSG:4326',crs,[LON],[LAT]); row,col=source.index(x[0],y[0])
        assert valid[row,col]
    print(f'Terminal row={row}, col={col}; centre E/N={rasterio.transform.xy(affine,row,col)}',flush=True)
    snapshots={}
    def inspect(stage,array):
        w=np.asarray(array[row-2:row+3,col-2:col+3]).copy(); snapshots[stage]=w
        slopes=[(w[2,2]-w[2+dr,2+dc])/(30*np.hypot(dr,dc)) for dr,dc in OFFSETS]
        best=int(np.argmax(slopes)); expected=DIRECTIONS[best] if slopes[best]>0 else (-1 if slopes[best]==0 else -2)
        local=np.asarray(array[row-50:row+51,col-50:col+51])
        print(f'\nSTAGE {stage}: centre={w[2,2]:.15g}; independent D8={expected}; '
              f'lower immediate neighbours={np.count_nonzero(np.array(slopes)>0)}',flush=True)
        print('3x3:\n',np.array2string(w[1:4,1:4],precision=15))
        print('5x5:\n',np.array2string(w,precision=15))
        print(f'101x101 range={local.min():.12g}..{local.max():.12g}; '
              f'exact zeros={np.count_nonzero(local==0)}; '
              f'nonzero abs<=1e-6={np.count_nonzero((abs(local)<=1e-6)&(local!=0))}')
        print('Downhill slopes N NE E SE S SW W NW:',slopes)
        return expected
    inspect('original',elevations)
    original_component=component_summary('original projected',elevations,valid,row,col,affine,crs,True)
    nodata=np.float64(-9999); elevations[~valid]=nodata
    view=ViewFinder(affine=affine,crs=crs,shape=valid.shape,nodata=nodata)
    terrain=Raster(elevations,viewfinder=view); del elevations
    grid=Grid(viewfinder=view)
    print('Full-context pit filling...',flush=True)
    filled=grid.fill_pits(terrain); del terrain; gc.collect()
    inspect('pit-filled',filled)
    print('Full-context depression filling...',flush=True)
    filled=grid.fill_depressions(filled)
    inspect('depression-filled',filled)
    region=component_summary('depression-filled',filled,valid,row,col,affine,crs,True)
    print('Original component cells changed by depression filling:',
          np.count_nonzero(original_component & (filled!=0)))
    del region
    filled[~valid]=filled[valid].max()+100
    print('Full-context resolve_flats eps=1e-8...',flush=True)
    conditioned=grid.resolve_flats(filled,eps=1e-8); del filled
    conditioned[~valid]=nodata
    assert conditioned.dtype==np.float64 and np.isfinite(conditioned[valid]).all()
    gc.collect()
    expected=inspect('flat-resolved',conditioned)
    region=component_summary('flat-resolved',conditioned,valid,row,col,affine,crs,True)
    print('Original component cells adjusted during conditioning:',
          np.count_nonzero(original_component & (conditioned!=0)))
    print('Original component still in terminal exact-flat component:',np.count_nonzero(original_component & region))
    print('5x5 increments during flat resolution:\n',snapshots['flat-resolved']-snapshots['depression-filled'])
    del original_component,region
    direction=grid.flowdir(conditioned,routing='d8',dirmap=DIRECTIONS,nodata_out=0)
    del conditioned; gc.collect()
    print('Final D8 5x5:\n',np.asarray(direction[row-2:row+3,col-2:col+3]))
    print('Final centre D8:',int(direction[row,col]),'; independent agrees:',int(direction[row,col])==expected)
    assert int(direction[row,col])==expected
    del direction; gc.collect()

    # Compare the unconditioned geographic mosaic and the western source tile.
    for name,p in [('WGS84 mosaic',root/'data/processed/dem_kalu_mosaic_wgs84.tif'),
                   ('western source tile',root/'data/raw/dem/Copernicus_DSM_COG_10_N06_00_E079_00_DEM.tif')]:
        with rasterio.open(p) as source:
            r,c=source.index(LON,LAT); values=source.read(1); mask=source.read_masks(1)!=0
            print(f'\n{name} terminal-nearest elevation={values[r,c]}')
            print('5x5:\n',values[r-2:r+3,c-2:c+3])
            region=component_summary(name,values,mask,r,c,source.transform,source.crs,False)
            del values,mask,region
        gc.collect()
    reference=root/'data/raw/hydrobasins/hybas_as_lev12_v1c.shp'
    ref_crs=rasterio.crs.CRS.from_wkt(reference.with_suffix('.prj').read_text())
    with shapefile.Reader(str(reference)) as reader:
        for record in reader.iterRecords():
            if int(record['MAIN_BAS'])!=4120049010: continue
            geometry=transform_geom(ref_crs,crs,reader.shape(record.oid).__geo_interface__)
            inside=rasterize([(geometry,1)],out_shape=(1,1),
                             transform=affine*rasterio.Affine.translation(col,row),dtype='uint8')[0,0]
            if inside:
                print(f'REFERENCE terminal HYBAS_ID={record["HYBAS_ID"]}; NEXT_DOWN={record["NEXT_DOWN"]}; '
                      f'MAIN_BAS={record["MAIN_BAS"]}; COAST={record["COAST"]}')
    print(f'Runtime: {time.perf_counter()-started:.1f} seconds')
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f'Peak resident memory: {peak/(1024**3 if sys.platform=="darwin" else 1024**2):.3f} GiB')
    except ImportError: print('Peak resident memory unavailable on this platform')
    print('No corrections, rasters, accumulation, snapping or watershed extraction.')


if __name__=='__main__':
    main()
