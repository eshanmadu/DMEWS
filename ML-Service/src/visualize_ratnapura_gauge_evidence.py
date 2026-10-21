"""Exploratory historical gauge overlay; no outlet selection or hydrology.

macOS: ML-Service/.venv/bin/python ML-Service/src/visualize_ratnapura_gauge_evidence.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\visualize_ratnapura_gauge_evidence.py
Reads a small OSM reference extract into memory; saves only the exploratory PNG.
JICA: https://openjicareport.jica.go.jp/pdf/11931961_01.pdf
CS-5: PDF p14 / printed 1-10; benchmark forms: PDF p32 / printed 1-28.
The benchmark connector is NOT the cross-section: a bearing/endpoints have not
been reliably reconstructed from the scanned drawing's offsets and sketches.
"""
from pathlib import Path
import argparse
import time
import urllib.request
import xml.etree.ElementTree as ET

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Rectangle
import numpy as np
from pyproj import CRS, Transformer
from pyproj.transformer import TransformerGroup
import rasterio
from rasterio.features import rasterize
from rasterio.windows import from_bounds
from rasterio.plot import plotting_extent

URL='https://api.openstreetmap.org/api/0.6/map?bbox=80.390,6.676,80.400,6.685'


def main():
    started=time.perf_counter(); root=Path(__file__).resolve().parents[1]
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--replace-preview',action='store_true',help='Explicitly replace this exploratory PNG only')
    args=parser.parse_args()
    output=root/'outputs/ratnapura_gauge_evidence.png'
    if output.exists() and not args.replace_preview: raise FileExistsError(f'Preserving existing output: {output}')
    # Compare all documented projection parameters, not the generic grid name.
    national=CRS.from_epsg(5234)
    expected=[7+1.729/3600,80+46/60+18.160/3600,0.9999238418,200000,200000]
    assert np.allclose([p.value for p in national.coordinate_operation.params],expected,rtol=0,atol=1e-10)
    historic=TransformerGroup(national,4326,always_xy=True).transformers[0]
    assert 'Kandawala to WGS 84 (1)' in historic.description
    project=Transformer.from_crs(4326,32644,always_xy=True)
    print('CRS: documented parameters match EPSG:5234; datum interpretation remains a research assumption')
    print('Historical operation:',historic.description,'; stated accuracy metres:',historic.accuracy)
    marks={'5-LBP':(158357.000,164411.000),'5-RBP':(158448.088,164470.357)}
    points={}
    for name,en in marks.items():
        lon,lat=historic.transform(*en); points[name]=project.transform(lon,lat)
        print(f'MARK {name}: WGS84={lat:.9f},{lon:.9f}; UTM E/N={points[name]}')
    published={'Annual 2019/20':(80.394166667,6.678333333),
               'DMC 2021':(80.397166667,6.678666667)}
    candidates={'Candidate 1':(80.397036763,6.679858803),
                'Candidate 2':(80.395404925,6.682570480)}
    for name,p in {**published,**candidates}.items(): points[name]=project.transform(*p)
    print('Prior results only: Candidate 1 area=644.187km2 D8=64; Candidate 2 area=644.364km2 D8=32')

    request=urllib.request.Request(URL,headers={'User-Agent':'DMEWS-research-overlay/1.0'})
    with urllib.request.urlopen(request,timeout=40) as response:
        data=response.read(3000001)
    if len(data)>3000000: raise ValueError('Reference extract unexpectedly large; stop')
    tree=ET.fromstring(data)
    nodes={n.attrib['id']:(float(n.attrib['lon']),float(n.attrib['lat'])) for n in tree.findall('node')}
    references={}
    for w in tree.findall('way'):
        if w.attrib['id'] not in ('30465766','516233369','160312926'): continue
        coords=[project.transform(*nodes[n.attrib['ref']]) for n in w.findall('nd')]
        references[w.attrib['id']]=np.asarray(coords)
        print('OSM way',w.attrib['id'],'version',w.attrib.get('version'),'edited',w.attrib.get('timestamp'))
    assert len(references)==3,'Expected river centreline, water area and bridge unavailable'
    river=references['30465766']; water=references['516233369']; bridge=references['160312926']
    assert np.array_equal(water[0],water[-1]),'Expected closed water polygon'
    print('Reference URL:',URL,'; bytes:',len(data))
    p=np.array(list(points.values()))
    left,bottom=p.min(axis=0)-100; right,top=p.max(axis=0)+100
    with rasterio.open(root/'data/processed/dem_kalu_mosaic_utm44n_30m.tif') as dem:
        assert dem.crs.to_epsg()==32644 and dem.res==(30,30)
        window=from_bounds(left,bottom,right,top,dem.transform).round_offsets().round_lengths()
        terrain=dem.read(1,window=window,masked=True)
        affine=dem.window_transform(window); extent=plotting_extent(terrain,affine)
        bridge_mask=rasterize([({'type':'LineString','coordinates':bridge.tolist()},1)],
                              out_shape=terrain.shape,transform=affine,all_touched=True,dtype='uint8')
        water_mask=rasterize([({'type':'Polygon','coordinates':[water.tolist()]},1)],
                             out_shape=terrain.shape,transform=affine,dtype='uint8')
        cells=[]
        for n,(r,c) in enumerate(np.argwhere(bridge_mask!=0),1):
            assert not np.ma.getmaskarray(terrain)[r,c]
            x,y=rasterio.transform.xy(affine,int(r),int(c)); rr,cc=dem.index(x,y)
            distances={name:round(float(np.hypot(x-points[name][0],y-points[name][1])),2)
                       for name in ('5-LBP','5-RBP','DMC 2021','Candidate 1')}
            cells.append((f'V{n}',int(r),int(c),x,y))
            print(f'VICINITY V{n}: row={rr},col={cc}; E/N={x:.3f},{y:.3f}; '
                  f'original_m={float(terrain[r,c]):.6f}; mapped_water_at_centre={bool(water_mask[r,c])}; distances_m={distances}')
    fig,axes=plt.subplots(1,2,figsize=(17,10),gridspec_kw={'width_ratios':[1,1]})
    for ax in axes:
        im=ax.imshow(terrain,extent=extent,origin='upper',cmap='terrain',vmin=15,vmax=55,interpolation='nearest')
        ax.fill(water[:,0],water[:,1],color='#66ccee',alpha=.45,label='OSM river-water area')
        ax.plot(river[:,0],river[:,1],color='#0077bb',lw=1.7,label='OSM river centreline')
        ax.plot(bridge[:,0],bridge[:,1],color='black',lw=4,label='OSM Muwagama Bridge')
        a,b=points['5-LBP'],points['5-RBP']
        ax.plot([a[0],b[0]],[a[1],b[1]],color='purple',ls='--',lw=1.5,label='Benchmark connector — NOT CS-5')
        for name,xy in points.items():
            if name in marks:
                marker,color='o','purple'
                ax.add_patch(Circle(xy,35,facecolor='purple',edgecolor='purple',alpha=.13))
            elif name in published: marker,color='^','#cc3311'
            else: marker,color='s','#007733'
            ax.scatter(*xy,marker=marker,color=color,edgecolor='white',s=70,zorder=5)
            ax.annotate(name,xy,xytext=(6,8),textcoords='offset points',fontsize=9,
                        bbox={'facecolor':'white','alpha':.8,'edgecolor':'none'},zorder=6)
        ax.set_aspect('equal'); ax.ticklabel_format(style='plain',useOffset=False)
        ax.set_xlabel('UTM 44N easting (m)'); ax.set_ylabel('Northing (m)'); ax.grid(alpha=.2)
    axes[0].set_xlim(left,right); axes[0].set_ylim(bottom,top)
    axes[0].set_title('Overview: published coordinates and modeled cells')
    centre=np.mean(np.array([points['5-LBP'],points['5-RBP']]),axis=0)
    axes[1].set_xlim(centre[0]-120,centre[0]+120);axes[1].set_ylim(centre[1]-110,centre[1]+160)
    axes[1].set_title('Bridge vicinity: original 30 m DEM cells (V = vicinity only)')
    for name,r,c,x,y in cells:
        axes[1].add_patch(Rectangle((x-15,y-15),30,30,fill=False,edgecolor='#bb0099',lw=1.3))
        axes[1].text(x,y,name,ha='center',va='center',fontsize=8,color='#880066',zorder=7)
    axes[0].legend(loc='upper left',fontsize=8)
    fig.suptitle('Ratnapura gauge evidence — EXPLORATORY; station cross-section and outlet NOT verified',fontsize=14)
    colorbar_axis=fig.add_axes([.89,.25,.015,.5])
    fig.colorbar(im,cax=colorbar_axis,label='Original DEM surface elevation (m, EGM2008)')
    fig.text(.05,.075,'Purple circles: 35 m reported transformation accuracy shown as illustrative radii; not confidence bounds or total survey uncertainty.\n'
             'JICA CS-5 (2007; Data Book 2009, PDF pp14/32): section drawn between new and old bridges. Exact bearing/endpoints not reconstructed.\n'
             'Purple dashed line joins benchmarks only. OSM is volunteered context, not surveyed station evidence. No outlet selected.',fontsize=9)
    fig.text(.05,.018,'Sources: JICA 11931961_01.pdf; OSM ways 30465766, 516233369, 160312926 (read at runtime). EPSG:5234 → WGS84 → EPSG:32644.\n'
             'Markers: circles = transformed historical marks; red triangles = official published positions; green squares = prior DEM-derived cells.',fontsize=8)
    fig.subplots_adjust(left=.06,right=.86,bottom=.17,top=.91,wspace=.25)
    output.parent.mkdir(parents=True,exist_ok=True)
    fig.savefig(output,dpi=160);plt.close(fig)
    print('Saved:',output)
    print(f'Runtime: {time.perf_counter()-started:.2f} seconds; no hydrological processing, snapping or watershed extraction')


if __name__=='__main__':
    main()
