"""Synthetic-only regression for a tiny bump beside a draining flat plateau.

macOS: ML-Service/.venv/bin/python ML-Service/src/test_tiny_gradient_routing.py
Windows: & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\test_tiny_gradient_routing.py
Expected candidate failures are reported; assertions verify the experiment itself.
No real DEMs are opened and no output data are written.
"""
from pathlib import Path
import subprocess
import sys

import numpy as np
from affine import Affine
from scipy.ndimage import binary_erosion
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder
from test_flat_routing import trace, DIRECTIONS

EPS_VALUES = (1e-7, 1e-8, 1e-9)
BASE = 2.5
DELTA = float(np.float32(BASE + 0.000002384)) - BASE
NODATA = np.float64(-9999)


def check(eps, depression):
    values = np.full((24,80),100.0,dtype='float64')
    # A long plateau gives the library a meaningful flat drainage gradient.
    # Compare an existing flat with one created by depression filling.
    values[8:13,5:65] = BASE-1 if depression else BASE
    bump, spill, outlet = (10,15),(10,65),(10,79)
    values[bump] = BASE+DELTA
    # Six neighbours are lower, matching the observed local arrangement.
    values[11,15] = BASE+0.01
    values[11,16] = BASE+1
    values[spill] = BASE
    values[10,66:80] = BASE - np.arange(1,15)*0.1
    values[:2,:] = values[-2:,:] = NODATA
    values[:,:2] = NODATA
    valid = values != NODATA
    view = ViewFinder(affine=Affine(30,0,0,0,-30,720),shape=values.shape,
                      crs='EPSG:32644',nodata=NODATA)
    grid = Grid(viewfinder=view)
    filled = grid.fill_depressions(grid.fill_pits(Raster(values,viewfinder=view)))
    assert filled[bump] == BASE+DELTA
    window = np.asarray(filled[9:12,14:17]).copy()
    assert np.count_nonzero(window < filled[bump]) == 6
    before = np.asarray(filled).copy()
    filled[~valid] = filled[valid].max()+100
    resolved = grid.resolve_flats(filled,eps=eps)
    resolved[~valid] = NODATA
    assert resolved.dtype == np.float64 and np.isfinite(resolved[valid]).all()
    increments = np.asarray(resolved)[valid] - before[valid]
    positive = increments[increments>0]
    assert len(positive) and positive.min()>np.spacing(np.float64(BASE))
    print(f'INFO eps={eps:g}, depression={depression}: smallest adjustment={positive.min():.9g} m; '
          f'max adjustment={positive.max():.9g} m; bump adjustment={resolved[bump]-before[bump]:.9g} m',flush=True)
    direction = grid.flowdir(resolved,dirmap=DIRECTIONS,routing='d8',nodata_out=0)
    codes = np.asarray(direction).copy()
    assert (codes[~valid]==0).all()
    assert np.isin(codes[valid],list(DIRECTIONS)+[-1,-2]).all()
    # trace() checks loops, raster exits and NoData entry for every valid cell.
    paths = {tuple(p):trace(codes,tuple(p)) for p in np.argwhere(valid)}
    accumulation = grid.accumulation(direction,dirmap=DIRECTIONS,routing='d8')
    assert np.isfinite(accumulation[valid]).all()
    assert (accumulation[valid]>=1).all() and (accumulation[~valid]==0).all()
    independent = sum(spill in path for path in paths.values())
    assert accumulation[spill] == independent
    assert accumulation[outlet] == sum(outlet in path for path in paths.values())
    core = [(r,c) for r in range(8,13) for c in range(5,65)]
    core_wrong = sum(spill not in paths[p] or paths[p][-1]!=outlet for p in core)
    preserved = int(codes[bump])>0 and spill in paths[bump] and paths[bump][-1]==outlet
    interior = binary_erosion(valid,np.ones((3,3)),border_value=0)
    pits = int(np.count_nonzero(interior & (codes==-2)))
    flats = int(np.count_nonzero(interior & (codes==-1)))
    core_pits = sum(codes[p]==-2 for p in core)
    core_flats = sum(codes[p]==-1 for p in core)
    passed = preserved and core_wrong==0 and pits==0 and flats==0
    print(f'{"PASS" if passed else "FAIL (candidate)"}: eps={eps:g}; depression={depression}; '
          f'bump code={codes[bump]}; tiny route preserved={preserved}; '
          f'wrong core paths={core_wrong}/300; core pits/flats={core_pits}/{core_flats}; '
          f'all-interior pits/flats={pits}/{flats}; loops=0; spill accumulation={independent}',flush=True)
    return passed


def main():
    print(f'Tiny downhill difference={DELTA:.15g} m')
    print(f'Float64 spacing at 2.5m={np.spacing(np.float64(BASE)):.9g} m; '
          f'float32 spacing={np.spacing(np.float32(BASE)):.9g} m')
    print('Installed resolve_flats: output = DEM + eps * drainage_gradient; '
          'no public adaptive-epsilon or non-elevation D8 flat router found.')
    results = {}
    for eps in EPS_VALUES:
        cases = [check(eps,depression) for depression in (False,True)]
        results[eps] = all(cases)
    assert not results[1e-7], 'Fixture did not reproduce the diagnosed failure'
    assert results[1e-8] and results[1e-9], 'Smaller candidate failed; investigate before real processing'
    print('PASS: experiment reproduced failure and verified smaller synthetic candidates:',results,flush=True)
    print('A fixed eps is not a global safety guarantee: eps * local gradient must '
          'remain below genuine downhill differences while staying representable.')
    # This existing script also runs test_pysheds.py and test_flat_routing.py.
    print('Running all three unchanged earlier synthetic regressions...',flush=True)
    subprocess.run([sys.executable,str(Path(__file__).with_name('test_near_flat_routing.py'))],check=True)
    print('PASS: tiny-gradient experiment and all existing synthetic regression scripts completed')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'FAIL: {type(error).__name__}: {error}',file=sys.stderr)
        raise
