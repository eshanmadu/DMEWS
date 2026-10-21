"""Provisional fixed-cell watershed experiment; PNG only, no spatial exports.

macOS: ML-Service/.venv/bin/python ML-Service/src/compare_ratnapura_watersheds.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\compare_ratnapura_watersheds.py
Allow about 3-4 GiB available RAM; check memory before running.
Uses ONLY the expanded DEM and local HydroBASINS; never reads old flow rasters.
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
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.features import rasterize
from rasterio.warp import transform_geom
from rasterio.plot import plotting_extent
from pyproj import Transformer
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
from scipy.ndimage import binary_erosion
import shapefile

DIRECTIONS=(64,128,1,2,4,8,16,32)
OFFSETS=dict(zip(DIRECTIONS,[(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1)]))
OUTLETS={'V2':(1196,5160),'Candidate 1':(1194,5158)}
EXPECTED={'V2':715725,'Candidate 1':715763}


def main():
    started=time.perf_counter();root=Path(__file__).resolve().parents[1]
    path=root/'data/processed/dem_kalu_mosaic_utm44n_30m.tif'
    preview=root/'outputs/ratnapura_watershed_comparison.png'
    if preview.exists():raise FileExistsError(f'Preserving existing output: {preview}')
    with rasterio.open(path) as source:
        assert source.crs.to_epsg()==32644 and source.res==(30,30) and source.shape==(3701,7380)
        assert source.nodata==-9999
        affine,crs=source.transform,source.crs
        elevation=source.read(1,out_dtype='float64');valid=source.read_masks(1)!=0
        assert np.isfinite(elevation[valid]).all()
        for name,p in OUTLETS.items():assert valid[p] and source.index(*source.xy(*p))==p
    to_geo=Transformer.from_crs(crs,4326,always_xy=True)
    to_utm=Transformer.from_crs(4326,crs,always_xy=True)
    x,y=to_utm.transform(80.397036763,6.679858803)
    assert rasterio.transform.rowcol(affine,x,y)==OUTLETS['Candidate 1']
    nodata=np.float64(-9999);elevation[~valid]=nodata
    view=ViewFinder(affine=affine,crs=crs,shape=valid.shape,nodata=nodata)
    terrain=Raster(elevation,viewfinder=view);del elevation
    grid=Grid(viewfinder=view)
    print('Full DEM pit filling...',flush=True)
    filled=grid.fill_pits(terrain);del terrain;gc.collect()
    print('Depression filling...',flush=True)
    filled=grid.fill_depressions(filled)
    filled[~valid]=filled[valid].max()+100
    print('Resolving flats eps=1e-8, float64...',flush=True)
    conditioned=grid.resolve_flats(filled,eps=1e-8);del filled
    conditioned[~valid]=nodata
    assert conditioned.dtype==np.float64 and np.isfinite(conditioned[valid]).all()
    print('D8 directions N64 NE128 E1 SE2 S4 SW8 W16 NW32...',flush=True)
    direction=grid.flowdir(conditioned,routing='d8',dirmap=DIRECTIONS,nodata_out=0)
    assert direction.affine==affine and direction.crs.to_epsg()==32644
    assert (direction[~valid]==0).all()
    codes=np.asarray(direction).astype('int16')
    assert np.isin(codes[valid],list(DIRECTIONS)+[-1,-2]).all()
    masks={}
    for name,(r,c) in OUTLETS.items():
        print('Extracting independent fixed-index catchment:',name,flush=True)
        catch=grid.catchment(x=c,y=r,fdir=direction,dirmap=DIRECTIONS,
                             routing='d8',xytype='index',algorithm='iterative')
        assert catch.shape==valid.shape and catch.affine==affine and catch.crs.to_epsg()==32644
        mask=np.asarray(catch,dtype=bool);masks[name]=mask
        assert mask[r,c], 'Outlet must count itself'
        assert int(mask.sum())==EXPECTED[name], 'Catchment disagrees with previous accumulation; STOP'
        assert not (mask & ~valid).any(),'NoData included'
        assert not (mask[0].any() or mask[-1].any() or mask[:,0].any() or mask[:,-1].any()),'Catchment touches modified outer rim'
        print(f'PASS {name}: {mask.sum()} cells, outlet included, previous accumulation agrees',flush=True)
    del direction;gc.collect()
    a,b=masks['V2'],masks['Candidate 1']
    assert not (a & ~b).any(),'Watersheds are not nested; STOP'
    difference=b & ~a
    assert int(difference.sum())==38

    # A finite, strictly descending route from every non-outlet catchment cell
    # stays inside the mask. Therefore it cannot cycle or end disconnected.
    # Reverse closure also catches upstream cells lost by library rim handling.
    for name,mask in masks.items():
        outlet=OUTLETS[name];rr,cc=np.nonzero(mask)
        assert np.isin(codes[rr,cc],DIRECTIONS).all(),'Pit/flat/invalid direction in upstream mask'
        for code,(dr,dc) in OFFSETS.items():
            use=(codes[rr,cc]==code)&~((rr==outlet[0])&(cc==outlet[1]))
            r,c=rr[use],cc[use];tr,tc=r+dr,c+dc
            assert ((tr>=0)&(tr<valid.shape[0])&(tc>=0)&(tc<valid.shape[1])).all()
            assert valid[tr,tc].all() and mask[tr,tc].all(),'Disconnected downstream edge'
            assert (conditioned[r,c]>conditioned[tr,tc]).all(),'Non-descending edge; possible loop'
            # Incoming neighbours must all be included, including true rim cells.
            ir,ic=rr-dr,cc-dc
            inside=(ir>=0)&(ir<valid.shape[0])&(ic>=0)&(ic<valid.shape[1])
            ir,ic=ir[inside],ic[inside]
            incoming=valid[ir,ic]&(codes[ir,ic]==code)
            assert mask[ir[incoming],ic[incoming]].all(),'Omitted upstream neighbour'
        print(f'PASS {name}: strict downhill routes, reverse closure, no loops/disconnected cells or internal terminals',flush=True)
    del conditioned;gc.collect()
    extra_cells=[tuple(map(int,p)) for p in np.argwhere(difference)]
    for start in extra_cells:
        cell=start;seen=set()
        while cell!=OUTLETS['Candidate 1']:
            assert cell not in seen and difference[cell]
            seen.add(cell);dr,dc=OFFSETS[int(codes[cell])];cell=(cell[0]+dr,cell[1]+dc)
    print('PASS: all 38 additional cells connect to Candidate 1 without crossing V2 catchment')
    print('ADDITIONAL row/column cells:',extra_cells)
    del codes;gc.collect()

    def bounds(mask):
        rr,cc=np.nonzero(mask);r0,r1=int(rr.min()),int(rr.max());c0,c1=int(cc.min()),int(cc.max())
        win=Window(c0,r0,c1-c0+1,r1-r0+1)
        box=rasterio.windows.bounds(win,affine)
        # Transform boundary-cell corners for a geographic cell-footprint envelope.
        cut=mask[r0:r1+1,c0:c1+1]
        er,ec=np.nonzero(cut & ~binary_erosion(cut,np.ones((3,3)),border_value=0));er+=r0;ec+=c0
        lon_min,lat_min,lon_max,lat_max=np.inf,np.inf,-np.inf,-np.inf
        for dr,dc in ((0,0),(0,1),(1,0),(1,1)):
            x=affine.c+(ec+dc)*30;y=affine.f-(er+dr)*30
            lon,lat=to_geo.transform(x,y)
            lon_min=min(lon_min,float(lon.min()));lon_max=max(lon_max,float(lon.max()))
            lat_min=min(lat_min,float(lat.min()));lat_max=max(lat_max,float(lat.max()))
        return win,box,(lon_min,lat_min,lon_max,lat_max)
    stats={name:[0,0.,np.inf,-np.inf] for name in masks}
    with rasterio.open(path) as source:
        for _,win in source.block_windows(1):
            values=source.read(1,window=win);r,c=int(win.row_off),int(win.col_off)
            for name,mask in masks.items():
                selected=values[mask[r:r+values.shape[0],c:c+values.shape[1]]]
                if selected.size:
                    st=stats[name];st[0]+=selected.size;st[1]+=selected.sum(dtype='float64')
                    st[2]=min(st[2],float(selected.min()));st[3]=max(st[3],float(selected.max()))
    for name,mask in masks.items():
        win,box,geobox=bounds(mask);count=int(mask.sum());area=count*.0009
        x,y=rasterio.transform.xy(affine,*OUTLETS[name]);lon,lat=to_geo.transform(x,y)
        st=stats[name]
        print(f'SUMMARY {name}: cells={count}; km2={area:.6f}; valid_fraction=1; NoData=0; '
              f'original_min_mean_max={st[2]:.9f},{st[1]/st[0]:.9f},{st[3]:.9f}')
        print(f'OUTLET {name}: E/N={x:.3f},{y:.3f}; latlon={lat:.9f},{lon:.9f}')
        print(f'BOUNDS {name}: UTM W/S/E/N={box}; geographic W/S/E/N={geobox}')
        print(f'603_COMPARISON {name}: difference_km2={area-603:.6f}; percent={(area/603-1)*100:.6f}')
    print('DIFFERENCE bounds:',bounds(difference)[1:])
    print('DIFFERENCE area_km2:',int(difference.sum())*.0009)

    # Coarse six-polygon reference selected by reverse NEXT_DOWN links.
    reference=root/'data/raw/hydrobasins/hybas_as_lev12_v1c.shp'
    records={};upstream=defaultdict(list)
    with shapefile.Reader(str(reference)) as reader:
        for record in reader.iterRecords():
            bid=int(record['HYBAS_ID']);records[bid]=(record.oid,record.as_dict())
            if int(record['NEXT_DOWN']) and int(record['ENDO'])!=2:upstream[int(record['NEXT_DOWN'])].append(bid)
        selected=set();pending=[4121158930]
        while pending:
            bid=pending.pop()
            if bid not in selected:selected.add(bid);pending.extend(upstream[bid])
        assert len(selected)==6
        ref_crs=rasterio.crs.CRS.from_wkt(reference.with_suffix('.prj').read_text())
        geometries=[transform_geom(ref_crs,crs,reader.shape(records[i][0]).__geo_interface__) for i in selected]
        refmask=rasterize([(g,1) for g in geometries],out_shape=valid.shape,transform=affine,dtype='uint8')!=0
        print('REFERENCE six IDs:',sorted(selected),'SUB_AREA sum:',sum(records[i][1]['SUB_AREA'] for i in selected))
    for name,mask in masks.items():
        overlap=np.count_nonzero(mask & refmask)
        print(f'REFERENCE {name}: overlap_km2={overlap*.0009:.6f}; '
              f'watershed_outside_reference_km2={np.count_nonzero(mask & ~refmask)*.0009:.6f}; '
              f'reference_outside_watershed_km2={np.count_nonzero(refmask & ~mask)*.0009:.6f}')
    del records,upstream,refmask,valid;gc.collect()

    fig,axes=plt.subplots(1,2,figsize=(17,9),gridspec_kw={'width_ratios':[1.2,1]})
    win,_,_=bounds(b)
    overview=Window(int(win.col_off)-15,int(win.row_off)-15,int(win.width)+30,int(win.height)+30)
    zoom=Window(5140,1182,35,35)
    with rasterio.open(path) as source:
        for ax,window in zip(axes,(overview,zoom)):
            values=source.read(1,window=window,masked=True);tr=source.window_transform(window)
            r,c=int(window.row_off),int(window.col_off);h,w=values.shape
            aa=a[r:r+h,c:c+w];bb=b[r:r+h,c:c+w];dd=difference[r:r+h,c:c+w]
            ax.imshow(values,extent=plotting_extent(values,tr),origin='upper',cmap='Greys',alpha=.65)
            xs=tr.c+(np.arange(w)+.5)*30;ys=tr.f-(np.arange(h)+.5)*30
            ax.contour(xs,ys,bb.astype('uint8'),levels=[.5],colors=['#aa3377'],linewidths=2.5,linestyles='--')
            ax.contour(xs,ys,aa.astype('uint8'),levels=[.5],colors=['#0077bb'],linewidths=1)
            ax.imshow(np.ma.masked_where(~dd,dd),extent=plotting_extent(values,tr),origin='upper',
                      cmap=ListedColormap(['#ee7733']),vmin=0,vmax=1,interpolation='nearest',alpha=.85)
            for name,p in OUTLETS.items():
                xy=rasterio.transform.xy(affine,*p)
                ax.scatter(*xy,s=65,marker='o' if name=='V2' else 's',edgecolors='black',
                           color='#0077bb' if name=='V2' else '#aa3377',zorder=5)
                ax.annotate(name,xy,xytext=(8,8),textcoords='offset points',fontsize=9,
                            bbox={'facecolor':'white','alpha':.8,'edgecolor':'none'})
            ax.set_aspect('equal');ax.ticklabel_format(style='plain',useOffset=False);ax.grid(alpha=.2)
            ax.set_xlabel('UTM 44N easting (m)');ax.set_ylabel('Northing (m)')
        bridge=np.array([to_utm.transform(*p) for p in [(80.3971498,6.6790342),(80.3976967,6.6794494)]])
        axes[1].plot(bridge[:,0],bridge[:,1],color='black',lw=3,label='Mapped bridge endpoint chord (approx.)')
        for name,p in [('Annual 2019/20',(80.394166667,6.678333333)),('DMC 2021',(80.397166667,6.678666667))]:
            xy=to_utm.transform(*p);axes[1].scatter(*xy,marker='^',color='red',edgecolors='black',s=55)
            axes[1].annotate(name,xy,xytext=(5,-13),textcoords='offset points',fontsize=8)
        axes[1].set_xlim(affine.c+5140*30,affine.c+5175*30)
        axes[1].set_ylim(affine.f-1217*30,affine.f-1182*30)
    from matplotlib.lines import Line2D
    legend=[Line2D([0],[0],color='#0077bb',label='V2 provisional boundary'),
            Line2D([0],[0],color='#aa3377',ls='--',lw=2.5,label='Candidate 1 provisional boundary'),
            Line2D([0],[0],marker='s',color='#ee7733',lw=0,label='Additional 38 cells (0.0342 km²)')]
    axes[0].legend(handles=legend,loc='lower right',fontsize=8);axes[1].legend(loc='upper left',fontsize=8)
    axes[0].set_title('Full provisional catchments: almost identical outlines')
    axes[1].set_title('Bridge vicinity: orange = Candidate 1 minus V2')
    fig.suptitle('PROVISIONAL RATNAPURA WATERSHED COMPARISON — NOT A VERIFIED GAUGE DELINEATION',fontsize=12)
    fig.text(.05,.025,'Expanded DEM; EPSG:32644, 30 m; eps=1e-8; fixed cells, no snapping. No watershed datasets saved.\n'
             'Bridge chord: previously retrieved OSM way 160312926. Historical/current cross-section unverified. Areas are modeled terrain contributions.',fontsize=9)
    fig.tight_layout(rect=(0,.07,1,.94));preview.parent.mkdir(parents=True,exist_ok=True)
    fig.savefig(preview,dpi=160);plt.close(fig)
    print('Saved exploratory PNG:',preview)
    print(f'Runtime: {time.perf_counter()-started:.1f} seconds')
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print(f'Peak resident memory: {peak/(1024**3 if sys.platform=="darwin" else 1024**2):.3f} GiB')
    except ImportError:print('Peak resident memory unavailable on this platform')
    print('PASS: no old saved flow inputs; no accumulation rerun; no watershed spatial exports or final outlet selection')


if __name__=='__main__':main()
