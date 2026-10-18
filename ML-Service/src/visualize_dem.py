"""Plot the downloaded DEM without changing its elevation values.

Run from the repository root:
    ML-Service/.venv/bin/python ML-Service/src/visualize_dem.py
"""

from pathlib import Path

import matplotlib

# Save a PNG without requiring a desktop window.
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from rasterio.plot import plotting_extent


def main():
    # Resolve paths relative to this script, so the working directory can vary.
    research_dir = Path(__file__).resolve().parents[1]
    dem_path = research_dir / "data/raw/dem/Copernicus_DSM_COG_10_N06_00_E080_00_DEM.tif"
    output_path = research_dir / "outputs/dem_elevation_map.png"

    if not dem_path.is_file():
        raise FileNotFoundError(f"DEM not found: {dem_path}")

    with rasterio.open(dem_path) as dem:
        # Longitude/latitude markers below require this geographic CRS.
        if dem.crs is None or dem.crs.to_epsg() != 4326:
            raise ValueError("Expected WGS 84 (EPSG:4326) longitude/latitude DEM.")
        if dem.transform.b != 0 or dem.transform.d != 0 or dem.transform.e >= 0:
            raise ValueError("Expected an unrotated, north-up DEM.")

        # Respect the file mask and additionally hide NaN/infinite values.
        # Zero and negative elevations can be valid; do not mask them by sign.
        elevation = np.ma.masked_invalid(dem.read(1, masked=True))
        if elevation.count() == 0:
            raise ValueError("DEM contains no valid elevation values.")
        extent = plotting_extent(dem)
        bounds = dem.bounds
        print(f"CRS: {dem.crs}; size: {dem.width} x {dem.height}")
        print(f"Bounds: {bounds}; resolution (degrees): {dem.res}")
        print(f"Valid elevation range: {elevation.min():.2f} to {elevation.max():.2f} m")

    # Coordinates are published river-gauge locations, not city centres.
    # Each pair is (longitude, latitude), matching the map's x and y axes.
    locations = {
        "Ratnapura gauge": (80.394167, 6.678333),
        "Ellagawa gauge": (80.210000, 6.731944),
    }

    fig, ax = plt.subplots(figsize=(10, 9))
    terrain = plt.get_cmap("terrain").copy()
    terrain.set_bad("lightgray")
    image = ax.imshow(
        elevation, extent=extent, origin="upper", cmap=terrain,
        interpolation="nearest",
    )
    # Approximate local distance proportions for a small geographic map.
    middle_latitude = (bounds.bottom + bounds.top) / 2
    ax.set_aspect(1 / np.cos(np.deg2rad(middle_latitude)))

    for label, (longitude, latitude) in locations.items():
        if not (bounds.left <= longitude <= bounds.right
                and bounds.bottom <= latitude <= bounds.top):
            raise ValueError(f"{label} is outside the DEM.")
        ax.scatter(longitude, latitude, marker="o", s=65, color="red",
                   edgecolors="black", linewidths=0.8, zorder=3)
        ax.annotate(label, (longitude, latitude), xytext=(8, 8),
                    textcoords="offset points", fontsize=10,
                    bbox=dict(facecolor="white", alpha=0.85, edgecolor="none"))

    fig.colorbar(image, ax=ax, shrink=0.8, label="Elevation (metres, EGM2008)")
    ax.set_title("Copernicus GLO-30 elevation — Ratnapura–Ellagawa")
    ax.set_xlabel("Longitude (°E)")
    ax.set_ylabel("Latitude (°N)")
    ax.grid(alpha=0.2, linewidth=0.5)
    fig.text(0.5, 0.025,
             "Surface elevation, nominal 30 m grid. Gauge coverage does not imply full catchment coverage.",
             ha="center", fontsize=8)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=180)
    plt.close(fig)
    print(f"Saved map: {output_path}")


if __name__ == "__main__":
    main()
