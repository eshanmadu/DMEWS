"""Synthetic depression/spill routing regression; no real datasets are opened.

macOS: ML-Service/.venv/bin/python ML-Service/src/test_flat_routing.py
Windows PowerShell:
    & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\test_flat_routing.py
"""

import sys

import numpy as np
from affine import Affine
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder


DIRECTIONS = (64, 128, 1, 2, 4, 8, 16, 32)
OFFSETS = dict(zip(DIRECTIONS, [(-1, 0), (-1, 1), (0, 1), (1, 1),
                                (1, 0), (1, -1), (0, -1), (-1, -1)]))
NODATA = np.float64(-9999)


def route(values):
    """Mirror calculate_flow.py, including its temporary high NoData barrier."""
    valid = np.isfinite(values) & (values != NODATA)
    view = ViewFinder(affine=Affine(30, 0, 0, 0, -30, 600),
                      shape=values.shape, crs="EPSG:32644", nodata=NODATA)
    terrain = Raster(values.copy(), viewfinder=view)
    grid = Grid(viewfinder=view)
    filled = grid.fill_pits(terrain)
    filled = grid.fill_depressions(filled)
    filled_before_flats = np.asarray(filled).copy()
    filled[~valid] = filled[valid].max() + 100
    resolved = grid.resolve_flats(filled)
    resolved[~valid] = NODATA
    # flowdir can edit its input, so keep a diagnostic copy first.
    resolved_copy = np.asarray(resolved).copy()
    direction = grid.flowdir(resolved, routing="d8", dirmap=DIRECTIONS, nodata_out=0)
    direction_copy = np.asarray(direction).copy()
    accumulation = grid.accumulation(direction, routing="d8", dirmap=DIRECTIONS)
    assert (direction_copy[~valid] == 0).all()
    assert (accumulation[~valid] == 0).all()
    assert np.isfinite(accumulation[valid]).all()
    assert (accumulation[valid] >= 1).all()
    return filled_before_flats, resolved_copy, direction_copy, np.asarray(accumulation)


def trace(direction, start):
    """Follow one existing D8 path; detect cycles and return its terminal."""
    path, seen = [], set()
    row, column = start
    while True:
        cell = (row, column)
        assert cell not in seen, f"Routing cycle at {cell}"
        seen.add(cell)
        path.append(cell)
        code = int(direction[cell])
        if code not in OFFSETS:
            return path
        dr, dc = OFFSETS[code]
        row, column = row + dr, column + dc
        assert 0 <= row < direction.shape[0] and 0 <= column < direction.shape[1]
        assert direction[row, column] != 0, "Path enters NoData"


def check_slope():
    rows, columns = np.indices((20, 20))
    values = (1000 - 10 * rows - 10 * columns).astype("float64")
    filled, resolved, direction, accumulation = route(values)
    assert np.array_equal(filled, values)
    assert np.array_equal(resolved, values)
    assert direction[10, 10] == 2, "Expected southeast flow"
    assert accumulation[19, 19] == 400
    for cell in [(0, 0), (0, 19), (10, 10), (19, 0)]:
        assert trace(direction, cell)[-1] == (19, 19)
    assert np.count_nonzero(direction < 0) == 1  # Only the final corner outlet.
    print("PASS: clean slope; 400 cells drain to the expected corner")


def check_depression(use_nodata):
    # A high rim surrounds a 5 x 5 depression. Its only low spill is on the
    # east side. A strictly descending channel leads to the raster's east edge.
    values = np.full((20, 20), 100.0)
    values[6:11, 6:11] = 10.0
    spill, outlet = (8, 11), (8, 19)
    values[spill] = 20.0
    values[8, 12:20] = np.arange(19.0, 11.0, -1)
    if use_nodata:
        # Irregular invalid margins, with the real channel outlet left valid.
        values[:2, :] = NODATA
        values[-2:, :] = NODATA
        values[:, :2] = NODATA
        values[:6, -2:] = NODATA
        values[11:, -2:] = NODATA

    filled, resolved, direction, accumulation = route(values)
    assert np.allclose(filled[6:11, 6:11], 20), "Unexpected depression spill level"
    assert np.any(resolved[6:11, 6:11] > filled[6:11, 6:11]), "Flat gradient missing"
    assert direction[spill] == 1, "Spill should drain east"
    assert direction[outlet] < 0, "Expected a terminal at the valid channel edge"
    assert (direction[6:11, 6:11] > 0).all(), "Unexpected depression terminal"

    upstream_cells = [(r, c) for r in range(6, 11) for c in range(6, 11)]
    for cell in upstream_cells:
        path = trace(direction, cell)
        assert spill in path and path[-1] == outlet, f"Wrong drainage from {cell}"
        heights = [resolved[p] for p in path]
        assert np.all(np.diff(heights) < 0), "Path is not strictly downhill"

    # Independently count all paths through each location, rather than assuming
    # the surrounding rim contributes a specific number of cells.
    valid = values != NODATA
    spill_count = outlet_count = 0
    for row, column in zip(*np.nonzero(valid)):
        path = trace(direction, (int(row), int(column)))
        spill_count += spill in path
        outlet_count += outlet in path
    assert accumulation[spill] == spill_count
    assert accumulation[outlet] == outlet_count
    assert spill_count >= 26, "Spill must receive 25 depression cells plus itself"
    assert accumulation[outlet] >= accumulation[spill] + 8
    print(f"PASS: depression with NoData={use_nodata}; all 25 depression cells "
          f"cross spill; spill={spill_count}, outlet={outlet_count} contributing cells")
    # Other terminals on the high rim/outer boundary are not depression failures.
    print(f"INFO: terminals in depression=0; all-grid terminals={np.count_nonzero(direction < 0)}")
    return direction, accumulation


def main():
    check_slope()
    for use_nodata in [False, True]:
        first = check_depression(use_nodata)
        second = check_depression(use_nodata)
        assert all(np.array_equal(a, b) for a, b in zip(first, second))
        print(f"PASS: repeated results identical, NoData={use_nodata}")
    print("PASS: synthetic regression complete. This does not validate the real DEM.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"FAIL: {type(error).__name__}: {error}", file=sys.stderr)
        raise
