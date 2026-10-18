# Copernicus GLO-30 DEM acquisition metadata

- Acquisition time (Asia/Colombo, UTC+05:30): 2026-10-18T01:22:36.194409+05:30
- Dataset: Copernicus DEM GLO-30, public AWS Cloud Optimized GeoTIFF distribution.
- Filename: Copernicus_DSM_COG_10_N06_00_E080_00_DEM.tif
- Source URL: https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N06_00_E080_00_DEM/Copernicus_DSM_COG_10_N06_00_E080_00_DEM.tif
- Distribution: https://registry.opendata.aws/copernicus-dem/
- Distribution documentation: https://copernicus-dem-30m.s3.amazonaws.com/readme.html
- Official product documentation: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM
- HTTP verification before download: 200 OK; Content-Type image/tiff.
- Expected and actual size: 47,653,237 bytes (45.4457 MiB).
- Server Last-Modified: 2022-05-09 14:01:39 GMT. This is object modification time, not terrain acquisition time.
- Server ETag and matching local MD5: 6219cfd62c64080583790e9d11632422.
- Local SHA-256: bfa222f4daa21161409146061c752439eefdb3c6b16264799a25dae9f8f8655f

## Raster metadata read directly from the file

- Classic TIFF, GeoTIFF geographic model; horizontal CRS WGS 84, EPSG:4326.
- Dimensions: 3600 columns x 3600 rows, one band.
- Sample type: 32-bit floating point; DEFLATE compression; floating-point predictor.
- Grid spacing: 0.0002777777777778 degrees longitude x 0.0002777777777778 degrees latitude (1 arc-second, nominal approximately 30 m).
- Pixel convention: RasterPixelIsPoint (GeoKey 1025 = 2).
- Top-left sample coordinate: longitude 80, latitude 7.
- Pixel-center limits: longitude 80 to 80.999722222222; latitude 6.000277777778 to 7.
- Outer pixel-footprint bounds (west, south, east, north; degrees): (79.99986111111112, 6.000138888888889, 80.99986111111112, 7.0001388888888885).
- Nominal tile region: 80-81 degrees E, 6-7 degrees N. Point-grid edge handling causes the small half-cell offsets above.
- No GDAL nodata tag (42113) was present; do not assume a nodata value.
- Elevation units: metres, according to official product documentation; not explicitly encoded as a band-unit tag in this file.
- Vertical reference: EGM2008 (EPSG:3855), according to official product documentation; not explicitly encoded in this file's GeoKey directory.

## Validation

- File byte count matches HTTP Content-Length.
- Local MD5 matches the server ETag for this object.
- Parsed TIFF directories and GeoTIFF tags; referenced data offsets remain within file bounds.
- All 22 compressed raster blocks across 4 image directories (base raster and overviews) decompressed successfully and match expected uncompressed byte counts.
- Validation used Python standard-library struct, zlib and hashlib; no packages installed.
- GDAL/rasterio were unavailable. No independent GIS-reader check, full floating-point predictor reconstruction, elevation statistics, hydrological validation or watershed delineation was performed.

## Verified location coverage

Source: Sri Lanka Irrigation Department, Hydrological Annual 2019/20, station table (printed page 7):
https://irrigation.gov.lk/web/images/Downloads/Publications/HydrologyAnnual_2019-20.pdf

These are published gauge locations, not city centres or newly surveyed positions.

- Ratnapura gauge: latitude 6.678333333, longitude 80.394166667; inside tile: yes.
- Ellagawa gauge: latitude 6.731944444, longitude 80.210000000; inside tile: yes.

Original published coordinates: Ratnapura 6°40′42″N, 80°23′39″E; Ellagawa 6°43′55″N, 80°12′36″E.

## Limitations and handling

- Complete contributing-catchment coverage is unknown; containing both gauges does not establish this. No additional tiles acquired.
- This is a digital surface model including vegetation/buildings, not bare-earth terrain or channel bathymetry. Conditioning and drainage validation will be needed later.
- Exact terrain acquisition dates and local accuracy have not been established from this tile. Do not infer them from object Last-Modified.
- Preserve this original file; no reprojection, cropping or terrain processing performed.
- Licence/attribution conditions apply; see official product/distribution documentation.
- Existing ML-Service/.gitignore excludes data/raw/, including this DEM and this metadata file. Nothing was staged or committed.
