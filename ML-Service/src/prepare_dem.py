"""Create a 30 m UTM working DEM and preview; preserve the source DEM.

macOS/Linux (repository root):
    ML-Service/.venv/bin/python ML-Service/src/prepare_dem.py
Windows PowerShell (repository root):
    & .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\prepare_dem.py
"""

from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # Save images without requiring a desktop window.
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from rasterio.plot import plotting_extent
from rasterio.warp import calculate_default_transform, reproject, Resampling, transform


def main():
    root = Path(__file__).resolve().parents[1]
    source_path = root / "data/raw/dem/Copernicus_DSM_COG_10_N06_00_E080_00_DEM.tif"
    output_path = root / "data/processed/dem_kalu_utm44n_30m.tif"
    preview_path = root / "outputs/dem_projected_preview.png"
    target_crs = "EPSG:32644"
    nodata = -9999.0  # Outside the source elevation range; explicit border value.

    # Avoid accidentally replacing earlier research results on a repeat run.
    if output_path.exists() or preview_path.exists():
        raise FileExistsError("Output already exists; preserve or rename it before rerunning.")

    with rasterio.open(source_path) as source:
        if source.crs is None or source.crs.to_epsg() != 4326:
            raise ValueError("Expected source DEM in EPSG:4326.")
        elevation = np.ma.masked_invalid(source.read(1, masked=True))
        if elevation.count() == 0:
            raise ValueError("Source has no valid elevation values.")
        if np.any(elevation.compressed() == nodata):
            raise ValueError("Chosen NoData value conflicts with valid source elevations.")

        # Work on the complete tile. Reprojecting a rectangular geographic tile
        # creates a slightly rotated footprint with invalid border cells in UTM.
        affine, width, height = calculate_default_transform(
            source.crs, target_crs, source.width, source.height,
            *source.bounds, resolution=30,
        )
        projected = np.full((height, width), nodata, dtype="float32")
        reproject(
            source=elevation.filled(nodata).astype("float32"),
            destination=projected,
            src_transform=source.transform, src_crs=source.crs,
            src_nodata=nodata,
            dst_transform=affine, dst_crs=target_crs,
            dst_nodata=nodata, init_dest_nodata=True,
            resampling=Resampling.bilinear,
        )

        # Reproject the source mask separately, without interpolating mask values.
        # Also retain the elevation warp's own NoData decisions.
        source_valid = (~np.ma.getmaskarray(elevation)).astype("uint8")
        target_valid = np.zeros((height, width), dtype="uint8")
        reproject(
            source=source_valid, destination=target_valid,
            src_transform=source.transform, src_crs=source.crs,
            src_nodata=0, dst_transform=affine, dst_crs=target_crs,
            dst_nodata=0, resampling=Resampling.nearest,
        )
        valid = (target_valid == 1) & np.isfinite(projected) & (projected != nodata)
        projected[~valid] = nodata
        if not valid.any():
            raise ValueError("Reprojection produced no valid cells.")
        print(f"Source valid cells: {elevation.count():,}; source CRS: {source.crs}")

    # A single-band nodata value provides a portable mask without a sidecar file.
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        output_path, "w", driver="GTiff", height=height, width=width,
        count=1, dtype="float32", crs=target_crs, transform=affine,
        nodata=nodata, compress="deflate", predictor=3, tiled=True,
    ) as output:
        output.write(projected, 1)
        output.set_band_unit(1, "m")
        output.update_tags(
            source_file=source_path.name, resampling="bilinear",
            vertical_reference="EGM2008 (source product documentation)",
            purpose="Working DEM only; no hydrological conditioning performed",
        )

    # Reopen the saved file: verify persisted metadata, mask and actual values.
    with rasterio.open(output_path) as result:
        raster = result.read(1, masked=True)
        assert result.crs.to_epsg() == 32644
        assert result.res == (30.0, 30.0)
        assert result.nodata == nodata
        assert np.array_equal(~np.ma.getmaskarray(raster), valid)
        assert np.all(np.isfinite(raster.compressed()))
        assert np.all(result.read(1)[~valid] == nodata)
        print(f"Output CRS: {result.crs}; resolution: {result.res} metres")
        print(f"Dimensions: {result.width} columns x {result.height} rows")
        print(f"Bounds (metres): {result.bounds}")
        print(f"NoData: {result.nodata}; valid: {valid.sum():,}/{valid.size:,} "
              f"({valid.mean() * 100:.3f}%); invalid: {(~valid).sum():,}")
        print(f"Elevation min/mean/max: {raster.min():.2f} / "
              f"{raster.mean():.2f} / {raster.max():.2f} m")

        locations = {
            "Ratnapura gauge": (80.394167, 6.678333),
            "Ellagawa gauge": (80.210000, 6.731944),
        }
        points = {}
        for label, (longitude, latitude) in locations.items():
            eastings, northings = transform("EPSG:4326", result.crs,
                                             [longitude], [latitude])
            easting, northing = eastings[0], northings[0]
            row, column = result.index(easting, northing)
            if not (0 <= row < height and 0 <= column < width and valid[row, column]):
                raise ValueError(f"{label} is outside valid projected DEM coverage.")
            # Round-trip verification catches coordinate-order/CRS mistakes.
            lons, lats = transform(result.crs, "EPSG:4326", [easting], [northing])
            assert abs(lons[0] - longitude) < 1e-7
            assert abs(lats[0] - latitude) < 1e-7
            points[label] = (easting, northing)
            print(f"{label}: E={easting:.3f}, N={northing:.3f} m; "
                  f"valid cell ({row}, {column}); surface elevation={raster[row, column]:.2f} m")

        fig, ax = plt.subplots(figsize=(10, 9))
        terrain = plt.get_cmap("terrain").copy()
        terrain.set_bad("lightgray")
        image = ax.imshow(raster, extent=plotting_extent(result), origin="upper",
                          cmap=terrain, interpolation="nearest")
        for label, point in points.items():
            ax.scatter(*point, color="red", edgecolors="black", s=55, zorder=3)
            ax.annotate(label, point, xytext=(8, 8), textcoords="offset points",
                        bbox=dict(facecolor="white", alpha=0.85, edgecolor="none"))
        ax.set_aspect("equal")
        ax.ticklabel_format(style="plain", useOffset=False)
        ax.set_xlabel("Easting (m)")
        ax.set_ylabel("Northing (m)")
        ax.set_title("Kalu study area: projected working DEM\nWGS 84 / UTM zone 44N — 30 m pixels")
        fig.colorbar(image, ax=ax, shrink=0.8, label="Surface elevation (metres, EGM2008)")
        ax.grid(alpha=0.2)
        fig.text(0.5, 0.025,
                 "Gray = NoData. Gauge markers are not snapped outlets. No watershed delineation performed.",
                 ha="center", fontsize=8)
        fig.tight_layout(rect=(0, 0.04, 1, 1))
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(preview_path, dpi=180)
        plt.close(fig)

    print(f"Saved raster: {output_path}")
    print(f"Saved preview: {preview_path}")


if __name__ == "__main__":
    main()
