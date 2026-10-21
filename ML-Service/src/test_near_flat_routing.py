"""Test flat inflation against tiny pre-existing downhill elevation differences.

macOS: ML-Service/.venv/bin/python ML-Service/src/test_near_flat_routing.py
Windows PowerShell:
    & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\test_near_flat_routing.py
Only synthetic arrays are used; no real datasets or existing scripts are edited.
"""

from pathlib import Path
import subprocess
import sys

import numpy as np
from affine import Affine
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder


DIRECTIONS = (64, 128, 1, 2, 4, 8, 16, 32)
OFFSETS = dict(zip(DIRECTIONS, [(-1, 0), (-1, 1), (0, 1), (1, 1),
                                (1, 0), (1, -1), (0, -1), (-1, -1)]))
CANDIDATES = (1e-5, 1e-6, 1e-7, 1e-8)


def trace(direction, start):
    path, seen = [], set()
    row, column = start
    while True:
        cell = (row, column)
        assert cell not in seen, f"Cycle at {cell}"
        seen.add(cell)
        path.append(cell)
        if int(direction[cell]) not in OFFSETS:
            return path
        dr, dc = OFFSETS[int(direction[cell])]
        row, column = row + dr, column + dc
        assert 0 <= row < direction.shape[0] and 0 <= column < direction.shape[1]
        assert direction[row, column] != 0, "Route enters NoData"


def check_case(base, difference, eps):
    # A long depression creates a nontrivial drainage gradient. Filling raises
    # its floor to 'base'. A tiny bump then retains a real downhill difference,
    # like the almost-flat centre cells found in the real-DEM diagnostic.
    values = np.full((24, 80), 100.0, dtype="float64")
    values[8:13, 5:65] = base - 5
    bump, spill, outlet = (10, 15), (10, 65), (10, 79)
    if difference is not None:
        values[bump] = base + difference
    values[spill] = base
    values[10, 66:80] = base - np.arange(1, 15)
    nodata = np.float64(-9999)
    values[:2, :] = nodata
    values[-2:, :] = nodata
    values[:, :2] = nodata
    valid = values != nodata
    view = ViewFinder(affine=Affine(30, 0, 0, 0, -30, 720),
                      shape=values.shape, nodata=nodata, crs="EPSG:32644")
    grid = Grid(viewfinder=view)
    terrain = Raster(values, viewfinder=view)
    filled = grid.fill_depressions(grid.fill_pits(terrain))
    assert filled.dtype == np.float64
    # The depression floor has become genuinely flat, not a sloping substitute.
    core = filled[8:13, 5:65]
    assert np.count_nonzero(core == base) >= 299
    if difference is not None:
        assert np.isclose(filled[bump] - base, difference, rtol=0, atol=1e-12)
    before = np.asarray(filled).copy()
    filled[~valid] = filled[valid].max() + 100  # Same as calculate_flow.py.
    resolved = grid.resolve_flats(filled, eps=eps)
    resolved[~valid] = nodata
    assert resolved.dtype == np.float64
    increments = np.asarray(resolved)[valid] - before[valid]
    assert np.isfinite(resolved[valid]).all()
    assert (increments >= 0).all() and increments.max() > 0
    print(f"INFO base={base}, delta={difference}, eps={eps:g}: "
          f"max increment={increments.max():.9g} m; dtype={resolved.dtype}")

    direction = grid.flowdir(resolved, dirmap=DIRECTIONS, routing="d8", nodata_out=0)
    codes = np.asarray(direction).copy()  # accumulation may alter terminal codes.
    accumulation = grid.accumulation(direction, dirmap=DIRECTIONS, routing="d8")
    assert np.isfinite(accumulation[valid]).all()
    assert (accumulation[valid] >= 1).all()
    assert (accumulation[~valid] == 0).all()
    terminals = int(np.count_nonzero(codes[8:13, 5:65] <= 0))
    print(f"INFO core terminals={terminals}; bump code={codes[bump]}; "
          f"bump accumulation={accumulation[bump]:.0f}")
    assert terminals == 0, "Artificial terminal inside filled depression"
    assert codes[spill] == 1, "Spill should flow east"
    for row in range(8, 13):
        for column in range(5, 65):
            path = trace(codes, (row, column))
            assert spill in path and path[-1] == outlet
    # Independent path counts check accumulation, including wall contributions.
    spill_count = outlet_count = 0
    for row, column in zip(*np.nonzero(valid)):
        path = trace(codes, (int(row), int(column)))
        spill_count += spill in path
        outlet_count += outlet in path
    assert accumulation[spill] == spill_count and spill_count >= 301
    assert accumulation[outlet] == outlet_count
    assert outlet_count >= spill_count + 14


def main():
    print("Installed implementation: resolved = DEM + eps * drainage_gradient")
    print("Current real workflow omits eps, so uses the pysheds default 1e-5.")
    for base in (17.0, 23.0):
        print(f"Float64 spacing at {base:g} m: {np.spacing(np.float64(base)):.3g} m; "
              f"float32 spacing: {np.spacing(np.float32(base)):.3g} m")
    results = {}
    for eps in CANDIDATES:
        passed = True
        # First ensure a genuinely flat depression still drains at this eps.
        cases = [(23.0, None), (23.0, 0.000131607), (17.0, 0.000156403)]
        for base, difference in cases:
            try:
                check_case(base, difference, eps)
                print(f"PASS: eps={eps:g}, base={base:g}, delta={difference}")
            except AssertionError as error:
                passed = False
                print(f"FAIL (candidate result): eps={eps:g}, base={base:g}, "
                      f"delta={difference}: {error}")
        results[eps] = passed
    passing = [eps for eps, passed in results.items() if passed]
    print("\nSUMMARY:", results)
    assert not results[1e-5], "This fixture did not reproduce the default problem"
    assert passing, "No tested increment fixed all synthetic cases"
    print(f"PASS: problem reproduced; largest passing tested increment={max(passing):g}")
    print("Candidate only: real-DEM corrections require separate approval and validation.")

    # Execute earlier scripts unchanged using this interpreter, on either OS.
    for filename in ("test_pysheds.py", "test_flat_routing.py"):
        print(f"\nRunning unchanged regression: {filename}", flush=True)
        subprocess.run([sys.executable, str(Path(__file__).with_name(filename))], check=True)
    print("PASS: existing synthetic regressions remain unchanged and pass")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"FAIL: {type(error).__name__}: {error}", file=sys.stderr)
        raise
