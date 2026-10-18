"""Synthetic compatibility checks only: this script never opens research DEMs.

macOS/Linux: ML-Service/.venv/bin/python ML-Service/src/test_pysheds.py
Windows PowerShell:
    & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\test_pysheds.py
"""

import sys
from importlib.metadata import version

import numpy as np
from affine import Affine
from pysheds.grid import Grid
from pysheds.sview import Raster, ViewFinder


def make_raster(values):
    # A 20 x 20 grid of 30 m cells, with a typed NoData value for NumPy 2.
    view = ViewFinder(
        affine=Affine(30, 0, 0, 0, -30, 600), shape=values.shape,
        nodata=np.float64(-9999), crs="EPSG:32644",
    )
    return Raster(values.astype("float64"), viewfinder=view)


def run_test():
    rows, columns = np.indices((20, 20))
    # Every step east or south loses 10 m. Interior D8 flow is southeast;
    # boundary flow continues east/south to the bottom-right outlet.
    values = 1000.0 - 10.0 * rows - 10.0 * columns
    dem = make_raster(values)
    grid = Grid(viewfinder=dem.viewfinder)

    # Check real conditioning changes, not just whether functions execute.
    pit_values = values.copy()
    pit_values[5, 5] = 0
    pit = make_raster(pit_values)
    pit_filled = grid.fill_pits(pit)
    assert pit_filled[5, 5] > pit[5, 5], "Single-cell pit was not raised"
    assert np.all(pit_filled >= pit), "Pit filling lowered elevations"
    print("PASS: single-cell pit filling")

    depression_values = values.copy()
    depression_values[8:10, 8:10] = 0
    depression = make_raster(depression_values)
    filled = grid.fill_depressions(grid.fill_pits(depression))
    assert np.all(filled[8:10, 8:10] > 0), "Multi-cell depression was not filled"
    assert np.all(filled >= depression), "Depression filling lowered elevations"
    resolved = grid.resolve_flats(filled)
    assert np.isfinite(resolved).all(), "Flat resolution produced invalid values"
    assert np.all(resolved >= filled), "Flat resolution lowered elevations"
    assert np.any(resolved > filled), "Artificial flat was not resolved"
    print("PASS: depression filling and flat resolution")

    # Use the unaltered plane for exact, easily understood drainage assertions.
    conditioned = grid.resolve_flats(grid.fill_depressions(grid.fill_pits(dem)))
    assert np.array_equal(conditioned, dem), "Conditioning changed the clean slope"
    dirmap = (64, 128, 1, 2, 4, 8, 16, 32)  # N, NE, E, SE, S, SW, W, NW
    direction = grid.flowdir(conditioned, dirmap=dirmap, routing="d8")
    accumulation = grid.accumulation(direction, dirmap=dirmap, routing="d8")
    assert direction[10, 10] == 2, "Interior flow should go southeast"
    assert direction[19, 10] == 1, "Bottom boundary should flow east"
    assert direction[10, 19] == 4, "Right boundary should flow south"
    assert direction[19, 19] <= 0, "Lowest corner should have no downslope neighbour"
    assert accumulation[0, 0] == 1, "Headwater accumulation should include itself"
    assert accumulation[19, 19] == 400, "Outlet should receive all 400 cells"
    print("PASS: D8 directions, headwater and outlet accumulation")

    # Pysheds clears the outermost routing cells during catchment extraction.
    # A zero-flow padding ring keeps our 400-cell example inside that rim.
    padded_view = ViewFinder(
        affine=Affine(30, 0, -30, 0, -30, 630), shape=(22, 22),
        nodata=np.int64(0), crs="EPSG:32644",
    )
    padded_direction = Raster(np.pad(np.asarray(direction), 1, constant_values=0),
                              viewfinder=padded_view)
    padded_grid = Grid(viewfinder=padded_view)
    catchment = padded_grid.catchment(
        x=20, y=20, fdir=padded_direction, dirmap=dirmap,
        routing="d8", xytype="index",
    )[1:-1, 1:-1]
    assert catchment.sum() == 400 and catchment[19, 19], "Full catchment is incorrect"
    # Only the NW-SE diagonal reaches this interior cell on the uniform plane.
    interior = padded_grid.catchment(
        x=11, y=11, fdir=padded_direction, dirmap=dirmap,
        routing="d8", xytype="index",
    )[1:-1, 1:-1]
    expected = np.zeros((20, 20), dtype=bool)
    expected[np.arange(11), np.arange(11)] = True
    assert np.array_equal(interior, expected), "Interior upstream cells are incorrect"
    assert accumulation[10, 10] == 11, "Interior accumulation should equal 11"
    print("PASS: exact catchment masks and contributing-cell counts")
    return np.asarray(direction).copy(), np.asarray(accumulation).copy(), np.asarray(catchment).copy()


def main():
    for package in ["pysheds", "numpy", "numba", "llvmlite", "scipy", "pandas", "pyproj", "scikit-image"]:
        print(f"{package}: {version(package)}")
    assert np.__version__ == "2.0.2", "Expected existing NumPy 2.0.2"
    first = run_test()
    print("PASS: first synthetic run")
    second = run_test()
    for a, b in zip(first, second):
        assert np.array_equal(a, b), "Repeated run produced different results"
    print("PASS: second synthetic run and identical results")
    print("PASS: all synthetic compatibility checks; no real DEM processed")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"FAIL: {type(error).__name__}: {error}", file=sys.stderr)
        raise
