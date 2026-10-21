"""Reference-only J1/J5 topology diagnostic. Never processes a DEM.

macOS: ML-Service/.venv/bin/python ML-Service/src/diagnose_ratnapura_reference_topology.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\diagnose_ratnapura_reference_topology.py

Model numbers are transcribed from the earlier diagnose_ratnapura_boundary.py
execution output (not recalculated). Branch identities remain provisional because
that diagnostic saved no modeled branch geometry or incoming-cell coordinates.
Definitions verified against HydroRIVERS_TechDoc_v10.pdf, section 3.2:
NEXT_DOWN identifies the next reach; UPLAND_SKM is total upstream area at the
reach outlet; CATCH_SKM is incremental area contributing directly to that reach.
HydroRIVERS and HydroBASINS share HydroSHEDS provenance.
"""
from pathlib import Path
from collections import defaultdict
import sys
import time
import numpy as np
import shapefile
from pyproj import CRS, Transformer
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {'J1': (80.405184, 6.676341, (344.5155, 290.3751)),
           'J5': (80.435228, 6.748018, (65.6883, 55.971))}
# Connectivity-selected comparison branches, not selected by closest area.
PAIRS = {'J1': (41406941, 41406942), 'J5': (41406633, 41406634)}


def parts(shape):
    stops = list(shape.parts) + [len(shape.points)]
    return [np.array(shape.points[a:b]) for a,b in zip(stops[:-1],stops[1:])]


def distance(point, lines):
    best = float('inf')
    for line in lines:
        a = line[:-1]; v = np.diff(line,axis=0); square = (v*v).sum(axis=1)
        t = np.divide(((point-a)*v).sum(axis=1),square,
                      out=np.zeros_like(square),where=square>0)
        near = a+np.clip(t,0,1)[:,None]*v
        best = min(best,float(np.linalg.norm(near-point,axis=1).min()))
    return best


def main():
    started = time.perf_counter()
    path = ROOT/'data/raw/hydrorivers/HydroRIVERS_v10_as/HydroRIVERS_v10_as.shp'
    output = ROOT/'outputs/ratnapura_reference_topology.png'
    if output.exists(): raise FileExistsError(f'Preserving {output}')
    crs = CRS.from_wkt(path.with_suffix('.prj').read_text())
    assert crs.equals(CRS.from_epsg(4326),ignore_axis_order=True)
    project = Transformer.from_crs(crs,32644,always_xy=True)
    geographic = Transformer.from_crs(32644,4326,always_xy=True)
    reader = shapefile.Reader(str(path))
    # Only one numeric column is retained for all Asia; no continental geometry.
    ids = np.fromiter((r[0] for r in reader.iterRecords(fields=['HYRIV_ID'])),dtype=np.int64,count=len(reader))
    order = np.argsort(ids); sorted_ids = ids[order]
    assert np.all(sorted_ids[1:] > sorted_ids[:-1]), 'Duplicate HYRIV_ID'
    print('PASS: globally unique Asia HYRIV_ID:',len(ids),flush=True)
    data = {}; geometry = {}
    def load(oid):
        record = reader.record(int(oid)).as_dict(); key = record['HYRIV_ID']
        data[key] = record
        geometry[key] = [np.column_stack(project.transform(p[:,0],p[:,1]))
                         for p in parts(reader.shape(int(oid)))]
    # Entire connected Kalu network, unrestricted by the six basin polygons.
    for record in reader.iterRecords(fields=['MAIN_RIV']):
        if record[0] == 41407423: load(record.oid)
    expanded = 0
    while True:
        missing = {r['NEXT_DOWN'] for r in data.values() if r['NEXT_DOWN'] and r['NEXT_DOWN'] not in data}
        if not missing: break
        for key in missing:
            index = np.searchsorted(sorted_ids,key)
            assert index<len(ids) and sorted_ids[index]==key, f'Missing Asia reach {key}'
            load(order[index]); expanded += 1
    incoming = defaultdict(list)
    for key,r in data.items():
        if r['NEXT_DOWN']: incoming[r['NEXT_DOWN']].append(key)
    def trace(start):
        path=[]; seen=set(); current=start
        while current:
            assert current in data, f'Missing link {current}'
            assert current not in seen, f'Cycle at {current}'
            seen.add(current);path.append(current);current=data[current]['NEXT_DOWN']
        return path
    for key,r in data.items():
        route=trace(key)
        assert route[-1]==r['MAIN_RIV'],f'Inconsistent MAIN_RIV {key}'
    print('Network reaches:',len(data),'; downstream expansion:',expanded,
          '; missing links: 0; loops: 0; inconsistent MAIN_RIV: 0')
    # Find a shared endpoint, without assuming shapefile vertex order means flow.
    def junction(receiver):
        endpoints=[]
        for key in incoming[receiver]+[receiver]:
            endpoints.append(np.vstack([p[[0,-1]] for p in geometry[key]]))
        candidates = np.unique(np.vstack(endpoints),axis=0)
        costs = [max(np.linalg.norm(e-p,axis=1).min() for e in endpoints) for p in candidates]
        index=int(np.argmin(costs))
        assert costs[index]<.01, f'Noncoincident junction {receiver}: {costs[index]} m'
        return candidates[index]
    area_residuals=[]
    for key,r in data.items():
        upstream=incoming[key]
        if upstream:
            residual=r['UPLAND_SKM']-sum(data[k]['UPLAND_SKM'] for k in upstream)-r['CATCH_SKM']
            area_residuals.append((abs(residual),key,residual))
            assert all(data[k]['UPLAND_SKM']<=r['UPLAND_SKM']+.2 for k in upstream)
    print('Max absolute area-balance residual km2 (rounded attributes):',max(area_residuals))
    fig,axes=plt.subplots(1,2,figsize=(16,8))
    for ax,(name,(lon,lat,model)) in zip(axes,TARGETS.items()):
        point=np.asarray(project.transform(lon,lat)); pair=PAIRS[name]
        print('\nMODEL',name,'lat/lon',lat,lon,'branch areas km2',model)
        near=sorted((distance(point,lines),key) for key,lines in geometry.items())[:8]
        show=set(k for _,k in near)|set(pair)
        paths=[trace(k) for k in pair]
        common=next(k for k in paths[0] if k in set(paths[1]))
        assert data[pair[0]]['NEXT_DOWN']==data[pair[1]]['NEXT_DOWN']==common
        node=junction(common); nlon,nlat=geographic.transform(*node)
        print('VERIFIED CONFLUENCE receiver',common,'incoming',incoming[common],
              'lon/lat',(nlon,nlat),'offset_m',np.linalg.norm(node-point))
        print('DOWNSTREAM PATHS',paths)
        show.add(common)
        for key in sorted(show):
            r=data[key]
            print('REACH',key,'distance_m',round(distance(point,geometry[key]),1),
                  {k:r[k] for k in ('NEXT_DOWN','MAIN_RIV','HYBAS_L12','UPLAND_SKM','CATCH_SKM','ORD_STRA','ORD_CLAS','ORD_FLOW')})
            if key in pair:
                # Report upstream-end orientation relative to the common junction.
                ends=np.vstack([p[[0,-1]] for p in geometry[key]])
                far=ends[np.argmax(np.linalg.norm(ends-node,axis=1))]
                print('BRANCH ORIENTATION',key,'upstream-end lon/lat',geographic.transform(*far),
                      'delta_E_N_from_junction_m',far-node)
        for modeled,key in zip(model,pair):
            reference=data[key]['UPLAND_SKM'];delta=modeled-reference
            print('PROVISIONAL AREA COMPARISON',key,'modeled',modeled,'reference',reference,
                  'signed_difference_km2',delta,'absolute_difference_km2',abs(delta),
                  'percent_of_reference',100*delta/reference)
        # Other nearby junctions expose mismatches hidden by nearest-line selection.
        for receiver,children in incoming.items():
            if len(children)<2:continue
            p=junction(receiver);metres=np.linalg.norm(p-point)
            if metres<=1600:
                print('NEARBY JUNCTION',receiver,'offset_m',round(metres,1),
                      'lon/lat',geographic.transform(*p),'incoming',[(k,data[k]['UPLAND_SKM']) for k in children])
        ax.add_collection(LineCollection([p for v in geometry.values() for p in v],colors='lightgrey',linewidths=1))
        for key in sorted(show):
            color='tab:blue' if key==pair[0] else 'tab:orange' if key==pair[1] else 'purple' if key==common else 'slategrey'
            for line in geometry[key]:
                ax.plot(line[:,0],line[:,1],color=color,lw=2 if key in pair else 1)
                middle=line[len(line)//2];ax.text(*middle,str(key),fontsize=7,color=color)
                # Orient arrow toward geometry of the actual NEXT_DOWN reach.
                downstream=data[key]['NEXT_DOWN']
                if downstream:
                    forward=distance(line[-1],geometry[downstream])<=distance(line[0],geometry[downstream])
                    oriented=line if forward else line[::-1]
                    k=max(0,len(oriented)//2-1)
                    ax.annotate('',xy=oriented[k+1],xytext=oriented[k],arrowprops={'arrowstyle':'->','color':color})
        ax.scatter(*point,marker='*',s=150,color='red',zorder=5,label=f'Modeled {name}')
        ax.scatter(*node,marker='x',s=90,color='black',zorder=6,label=f'Reference junction → {common}')
        ax.set(xlim=(point[0]-3200,point[0]+3200),ylim=(point[1]-3200,point[1]+3200),
               xlabel='UTM 44N easting (m)',ylabel='Northing (m)',title=f'{name}: modeled branches {model[0]:.4f} / {model[1]:.4f} km²')
        ax.set_aspect('equal');ax.ticklabel_format(style='plain',useOffset=False);ax.grid(alpha=.2);ax.legend(fontsize=8)
    fig.suptitle('EXPLORATORY RATNAPURA TRIBUTARY TOPOLOGY COMPARISON — NOT INDEPENDENT GAUGE VALIDATION',fontsize=11)
    fig.text(.06,.025,'Blue/orange: proposed reference branch pair; purple: common downstream reach; arrows follow NEXT_DOWN.\n'
             'Model branch geometries were not retained: identities are provisional. Reference areas apply at reach outlets, not nearest points.\n'
             'HydroRIVERS v1.0 / HydroSHEDS (WWF), Lehner & Grill (2013). Shared provenance with HydroBASINS; see raw-data METADATA.md.',fontsize=8)
    fig.tight_layout(rect=(0,.09,1,.94));fig.savefig(output,dpi=160);plt.close(fig)
    print('Saved',output,'; runtime_seconds',round(time.perf_counter()-started,2))
    try:
        import resource
        peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        print('Peak resident MiB',round(peak/(1024**2 if sys.platform=='darwin' else 1024),1))
    except ImportError:print('Peak resident memory unavailable')


if __name__=='__main__':main()
