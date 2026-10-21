# Standalone watershed and reference map

This local research prototype displays HydroBASINS, HydroRIVERS, four markers
and the exact provisional V2 DEM-derived watershed. The browser/server never run
hydrology. The dedicated V2 exporter reproduces and validates the upstream mask.
603 km² is published station metadata; 644.1525 km² is the reproduced V2 result.

From the repository root, export once:

macOS:
```sh
ML-Service/.venv/bin/python ML-Service/src/export_visualization_layers.py
ML-Service/.venv/bin/python ML-Service/src/export_ratnapura_v2_watershed.py
ML-Service/.venv/bin/python ML-Service/visualization/serve.py
```

Windows PowerShell:
```powershell
& .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\export_visualization_layers.py
& .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\export_ratnapura_v2_watershed.py
& .\ML-Service\.venv\Scripts\python.exe .\ML-Service\visualization\serve.py
```

After exports exist, run only the server command. The reference exporter refuses
to overwrite its five outputs. The V2 exporter refuses to overwrite its GeoJSON,
and updates only V2 entries in the existing manifest after all validation passes.
Regeneration needs explicit approval to preserve/replace existing exports; neither
exporter deletes old files. Do not rerun costly conditioning just to reopen the map.
Open **http://127.0.0.1:8765/**. Stop with Ctrl+C. Use `--port 8766` if needed.
Do not open index.html using file://; GeoJSON is fetched from the local server.

No Node server or installation is required. The server finds Leaflet **1.9.4** in
the repository's hoisted `node_modules`, or `Frontend/node_modules`. It stops if
required assets are missing. It binds only to IPv4 localhost, serves an explicit
allowlist and has no directory listing or write endpoints. It does not expose the
repository root, Python files, raw shapefiles, DEMs or other outputs. No external
map tiles, imagery or API requests are made. Source links open only when clicked.

Controls: toggle five layers, zoom/pan, fit either reference extent, the V2
watershed or V2 marker, click a
feature for its popup and details. At basin scale nearby Ratnapura markers overlap;
use Fit V2 and zoom further to inspect them. A coordinate grid/basemap is not included.

## Reference meaning and licence

- 23 Kalu HydroBASINS polygons: `MAIN_BAS=4120049010`.
- Six Ratnapura polygons are coarse reference geography, **not V2's watershed**.
- The solid purple V2 layer is an unsimplified 30 m cell footprint, with all
  parts and holes retained. Its location is conditional on the provisional outlet.
- 403 HydroRIVERS reaches: `MAIN_RIV=41407423`; upstream area is at reach outlet.
- WGS84 GeoJSON uses longitude, latitude; Leaflet's point API uses latitude, longitude.
- V2 marker is derived from the expanded DEM transform at zero-based (1196, 5160).
- Station markers retain source uncertainty, including conflicting coordinate metadata.
- Exact gauging section, the 603 versus 644.1525 km² discrepancy and coastal routing
  remain unresolved. No live readings, risk scores or predictions are provided.

Generated exports and manifest are in `../outputs/visualization/`, already ignored
by the research Git rules. Original data and diagnostics remain unchanged. The
manifest records byte sizes, SHA-256, feature counts, selections and provenance.
Reference geometry checks cover types, rings, finite coordinates, region/order
and identity; they do not certify full topology of every source reference polygon.
The exported V2 geometry separately passes Shapely/GEOS topology validation.

The manifest and interface include the full required HydroSHEDS Exhibit B notice.
HydroSHEDS is used under its licence, **not CC0**. Licence, attribution and
distribution requirements: https://data.hydrosheds.org/file/technical-documentation/HydroSHEDS_TechDoc_v1_4.pdf
Do not redistribute exports as an unrestricted standalone dataset.
Provider: https://www.hydrosheds.org
Scientific citations: Lehner, Verdin & Jarvis (2008), Eos 89(10), 93–94;
Lehner & Grill (2013), Hydrological Processes 27(15), 2171–2186, doi:10.1002/hyp.9740.

## Initial verification

The initial export completed in 6.17 seconds with approximately 150.3 MiB peak
resident memory on the development Mac. JSON syntax, feature counts, geometry
types, coordinate order, checksums and marker positions passed. Exported basin
and river coordinates were compared exactly with source geometry, including
polygon parts and rings. V2 was independently checked against the DEM transform.
All 16 allowlisted URLs returned HTTP 200; tested raw-data, credential, repository,
directory and traversal paths returned 404. Local Leaflet assets were available.

JavaScript syntax and mocked interaction tests passed for initialization, four
layer toggles, three fit buttons, feature-detail handlers, attribution and status.
These tests do not verify Leaflet rendering. Browser automation timed out, so
visual appearance, popup display, actual zoom/pan and mouse/touch interactions,
responsive layout and keyboard accessibility still need a manual browser check.
No browser-rendered screenshot was produced.

## Exact V2 export: method, environment and validation

Use the existing Python 3.9 virtual environment: NumPy 2.0.2, rasterio 1.4.3,
pysheds 0.5, pyproj 3.6.1 and Shapely 2.0.7 (GEOS 3.11.4). Shapely was installed
from a binary wheel with `--no-deps`; no other package version changed. No Node
installation or server is needed. Paths and commands support macOS and Windows.

The exporter reads the full expanded EPSG:32644 DEM, preserves float64 conditioning,
uses the established temporary high NoData border during flat resolution, then
restores NoData. Sequence: fill pits → fill depressions → resolve flats eps=1e-8 →
D8 routing. V2 remains fixed at row 1196, column 5160. Old saved flow rasters are
never read. Accumulation is calculated in memory, not exported.

The initial approved run took **38.04 s** through hydrological validation,
**38.82 s** overall, peaking at **2570.97 MiB** resident memory. Timing varies by
machine and first-use compilation. Full float64 arrays are about 208 MiB each;
pysheds uses several intermediate arrays. The exporter checks for at least 4 GiB
available/reclaimable RAM before starting; close other large applications first.

Required checks passed: 715,725 cells = 644.1525 km²; independent accumulation
715,725; outlet included; no NoData/outer-rim cells; valid D8 codes, strict descent,
downstream closure and upstream closure. Strict descent on the finite closed
network excludes loops and unintended upstream terminals. Candidate 1 nesting is
historical evidence from the comparison diagnostic, not rerun by this exporter.

Four-neighbour rasterio polygonization preserves cell edges, followed by a full-grid
rasterization round-trip: **zero differing cells**, 715,725 recovered cells.
Projected area is **644,152,500 m²**, tolerance 0.01 m². Shapely validates the
projected, WGS84 and inverse-transformed geometries without repair.
Inverse-projection area error is approximately 1.19e-7 m² (tolerance 0.1 m²).

The valid MultiPolygon contains **two parts, three holes and 4,075 vertices**
(including ring-closing coordinates). The smaller part is one 900 m² raster cell
touching the main part at a single corner; it is connected in the validated D8
network. Both parts and all holes are retained. This is not a disconnected-flow
error. The exact GeoJSON is **155,186 bytes**; no simplification was applied.
Leaflet display simplification is disabled for this watershed layer.

Computed mask/topology validity does **not** verify the present-day gauge location,
every physical terrain connection, operational forecast readiness or coastal
routing. The 41.1525 km² / 6.82% discrepancy above published area remains unresolved;
it is not evidence of a confirmed DEM routing error. Review the separate station
and watershed evidence reports in `../outputs/`.

The full run emitted a Matplotlib cache-location warning through a transitive
library import; it used an OS temporary cache and did not affect the validations.

## Updated map verification

The updated server was tested at **http://127.0.0.1:8766/** using:

```sh
ML-Service/.venv/bin/python ML-Service/visualization/serve.py --port 8766
```

Windows PowerShell:
```powershell
& .\ML-Service\.venv\Scripts\python.exe .\ML-Service\visualization\serve.py --port 8766
```

Port 8766 leaves the earlier server undisturbed. Restart an older server before
using the updated default-port command, because its in-memory URL allowlist will
not automatically gain the V2 route when files change.

All **17** allowlisted resources returned HTTP 200, including exact V2 GeoJSON;
HEAD also returned its correct length. Tested raw DEM, credential, repository,
directory and traversal URLs returned 404. Reference export counts/checksums
remain unchanged. Independent inverse-transform rasterization recovered all
715,725 cells and the outlet. Package inventory comparison confirmed Shapely was
the only added distribution and every pre-existing version was preserved.

JavaScript syntax and mocked logic tests passed for all **five** default-visible
layer toggles, **four** fit controls, feature details, uncertainty labels and the
unsimplified watershed display option. These are not rendered-browser tests.
No browser-automation surface was available for the new map version; actual
appearance, popup display, mouse/touch behaviour, responsive layout and browser
performance need a manual review. The user-reported five manual checks passed
for the earlier reference-only version, not automatically for this update.

Next step: open the updated map, use Fit V2 Watershed, toggle it against the amber
reference, and inspect its details and holes. No further data processing is needed
for that review. Do not begin elevation layers, models or backend integration.


## Historical river-stage section

Use **Historical river stage ↓** in the header, or scroll below the map. The
**Historical River Stage** disclosure is open by default; click its heading
(or use Enter/Space with keyboard focus) to collapse it without hiding map controls.
This is a historical research panel, **not a forecast or live observation feed**.

The section displays the validated original SVG unchanged. All 723 reports for
11 September–10 October 2026 remain represented. Its 24 reporting gaps over
90 minutes are discontinuities; ten pairs within five minutes remain separately
flagged. The source-labelled stage range is 0.66–6.86 m. The chart legend and
limitations are also explained as normal page text. On small screens, scroll
inside the chart region; the page itself retains its normal width. Use the two
**Open full-resolution** links for the SVG or PNG in a new tab and browser zoom.
No chart library, data transformation, resampling or new data acquisition is used.

The server explicitly permits only these two chart routes:

- `/charts/ratnapura_stage_month_hydrograph.svg`
- `/charts/ratnapura_stage_month_hydrograph.png`

They map to the original files in `../outputs/visualization/`. It exposes neither
raw observations/manifests nor the rest of the outputs folder. Restart an older
server to load its updated allowlist. Launch as before, for example:

```sh
ML-Service/.venv/bin/python ML-Service/visualization/serve.py --port 8767
```

```powershell
& .\ML-Service\.venv\Scripts\python.exe .\ML-Service\visualization\serve.py --port 8767
```

Open http://127.0.0.1:8767/. Port 8767 can leave an earlier 8765/8766 session
undisturbed. No external service is required; existing source-information links
are optional and are never requested automatically. No new export or plotting
run is needed to reopen the dashboard.

Archive reporting/edit timestamps are not verified physical measurement times.
Station equivalence to 003HD007, gauge datum and revision semantics remain
unverified. Reporting gaps do not establish missing physical measurements;
large stage changes are not confirmed flood events. Public source:
`nuuuwan/lk_irrigation`, pinned at
`baffd0a5fea232d05de7bcb80f3405740f1a1851`. Repository licensing does not by
itself establish unrestricted redistribution of the underlying observations.
The existing provisional V2 geographic warning remains visible and unchanged.

Integration checks and any remaining manual browser checks are documented in
`../outputs/ratnapura_stage_dashboard_integration_validation.md`.
