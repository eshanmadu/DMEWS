# Data inventory and preparation plan

Planning date: 17 October 2026. Study: DMEWS Cascade Disaster Prediction System.

## Scope and status conventions

Proposed area: Kalu River Basin, Sri Lanka, initially an upper-catchment area
around Ratnapura and its downstream connections. This is not yet a delineated
study boundary. Select an outlet and hydrologically connected subcatchments;
do not substitute the Ratnapura administrative boundary for a watershed.
Confirm gauge locations, downstream extent, mapping scale, and common study
period before acquisition. No bounding box, station coverage, or event count
has been established.

- **NOT DOWNLOADED**: an official public product is documented; no files have
  been acquired and local coverage, quality, and suitability remain unchecked.
- **AVAILABILITY NOT VERIFIED**: the required research records, resolution,
  coverage, access conditions, or machine-readable delivery are not confirmed.

Official documentation was checked for this plan. Links below are source or
agency pages, not claims that particular files or event records are available.
Nothing has been downloaded, installed, trained, or connected to DMEWS.

## Planned sources

### 1. NASA GPM IMERG rainfall

- Official sources: [IMERG overview](https://gpm.nasa.gov/data/imerg),
  [precipitation directory](https://gpm.nasa.gov/data/directory), and
  [IMERG technical documentation](https://gpm.nasa.gov/sites/default/files/2023-07/IMERG_TechnicalDocumentation_final_230713.pdf).
- Public product confirmed; **status: NOT DOWNLOADED**.
- Intended variables: precipitation rate, timestamps, grid coordinates, and
  available quality metadata; derive catchment rainfall totals and antecedent
  accumulations after checking units and interval conventions.
- Intended use: LSTM rainfall sequences, rainfall covariates for landslide
  experiments, and common storm context for cascade analysis.
- Documented forms include half-hourly HDF5 and product/service-dependent
  NetCDF or GeoTIFF. Select one run, version, resolution, and variable schema;
  do not assume field names are identical across versions.
- Access: NASA Earthdata registration for GES DISC; PPS has registration
  requirements. No credentials or downloads tested.
- Planning limitation: satellite rainfall is not a flood label. Validate local
  bias against gauges if obtained. Final Run retrospective analysis must be
  distinguished from operational testing using data available at issue time.

### 2. Copernicus DEM elevation

- Official source: [Copernicus DEM collection and access conditions](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM).
- Public GLO-30/GLO-90 products confirmed; **status: NOT DOWNLOADED**.
- Intended variables: elevation and quality masks where supplied; derive slope,
  aspect, relief, and carefully validated drainage-related terrain features.
- Intended use: Random Forest susceptibility predictors, catchment checks,
  river-context features, and cascade routing support.
- Expected format: GeoTIFF for the selected DGED delivery; confirm release,
  vertical reference, nodata handling, and tile metadata before processing.
- Access: registered users, including the general public, can access GLO-30
  and GLO-90 through the documented Copernicus route; registration and license
  conditions apply. No account access tested.
- Planning limitation: this is a surface model; hydrological conditioning may
  be needed. A nominal 30 m grid does not establish local vertical accuracy
  or resolve all drainage features. It is not an observed flood extent.

### 3. HydroSHEDS river networks and catchments

- Official sources: [HydroRIVERS](https://www.hydrosheds.org/products/hydrorivers)
  and [HydroBASINS](https://www.hydrosheds.org/products/hydrobasins).
- Public products confirmed; **status: NOT DOWNLOADED**.
- Intended variables: river reach IDs, downstream links, river geometry,
  subbasin IDs, nested boundaries, and relevant area/distance attributes.
- Intended use: assign events to connected catchments, identify upstream and
  downstream pairs, aggregate rainfall, and build a directed connectivity graph.
- Expected format: zipped vector shapefile distributions; confirm chosen Asian
  release, HydroBASINS level, attribute definitions, and identifiers.
- Access: public product download links are documented; no login requirement
  is stated on the inspected product pages. Product license and attribution
  conditions apply; no download tested.
- Planning limitation: connectivity is not evidence of causal triggering or
  measured travel time. Validate small tributaries and outlet placement against
  appropriate local information before defining the study area.

### 4. Sri Lanka DMC historical flood records

- Official sources: [DMC](https://www.dmc.gov.lk/),
  [Sri Lanka disaster information system](https://www.desinventar.lk/), and
  [government historical-disaster source listing](https://data.gov.lk/dataset/past-disasters-and-hazard-maps/resource/a3cde13a-2375-4524-b400-9d079779786c).
- Public reporting and a historical disaster information system are documented.
  Required research inventory **status: AVAILABILITY NOT VERIFIED**.
- Intended variables: flood event ID, onset/peak/end or uncertainty intervals,
  location and geometry, affected administrative units, inundation or severity
  evidence, source report ID, and observation/report dates.
- Intended use: verify flood episodes, associate impacts with gauge records,
  create defensible labels where possible, and corroborate cascade pairs.
- Expected format: public situation reports include PDF. A complete event-level
  CSV, database export, or geospatial inventory for this area is not confirmed.
- Access: public pages/reports can be consulted; a structured historical export,
  precise locations, and reuse permissions may require an academic DMC request.
  Request procedure, fees, completeness, and delivery format remain unverified.
- Limitation: damage totals or district-level reports alone do not supply an
  hourly hydrograph, exact inundation boundary, or complete negative labels.

### 5. NBRO historical landslide records and hazard maps

- Official sources: [NBRO](https://www.nbro.gov.lk/) and
  [landslide hazard zonation mapping](https://www.nbro.gov.lk/index.php?Itemid=117&id=48&lang=si&option=com_content&view=article).
- Public hazard mapping is documented, including Ratnapura; selected map files
  are **NOT DOWNLOADED**. Event-level inventory **AVAILABILITY NOT VERIFIED**.
- Intended variables: verified landslide ID, initiation location/polygon,
  occurrence time or interval, type, source, positional accuracy, survey date,
  and mapped hazard class with map scale/version.
- Intended use: observed occurrences for Random Forest labels and cascade
  timing; hazard zones for context or a separately defined map-comparison task.
- Expected format: public map images/downloads are advertised. Do not assume
  georeferenced rasters, GIS vectors, or dated inventory tables are available;
  their formats and coverage require confirmation.
- Access: public map pages exist; a precise historical inventory and analysis-
  ready hazard layers may require an academic NBRO request. Permissions, fees,
  delivery format, and current local coverage remain unverified.
- Limitation: hazard zones are not observed event labels. Avoid training on a
  hazard map and presenting agreement with that same map as independent skill.

### 6. ESA WorldCover land cover

- Official source: [WorldCover data access](https://esa-worldcover.org/en/data-access).
- Public 2020 and 2021 products confirmed; **status: NOT DOWNLOADED**.
- Intended variables: categorical land-cover class; derive catchment or slope-
  unit class proportions and distances/context where scientifically justified.
- Intended use: Random Forest predictors and land-surface context for rainfall
  response and cascade interpretation.
- Documented format: 3-by-3-degree Cloud Optimized GeoTIFF tiles, EPSG:4326;
  land-cover mapping is at 10 m with 11 classes.
- Access: public download routes are documented; account requirements vary by
  route (for example, a hosted platform may require registration). No route or
  credentials tested; verify license and attribution before acquisition.
- Limitation: 2020/2021 use different algorithms, so differences cannot simply
  be treated as land-cover change. These maps do not establish historical land
  cover for older events or provide annual observations throughout the study.

## Agency records that may need academic requests

These requests are proposals only; none has been sent. Public products above
do not replace the following observational requirements.

| Agency / official entry point | Records to ask about | Current status |
| --- | --- | --- |
| DMC: https://www.dmc.gov.lk/ | Structured flood inventory, report provenance, spatial precision, completeness and survey coverage | AVAILABILITY NOT VERIFIED |
| NBRO: https://www.nbro.gov.lk/ | Dated and geolocated landslide inventory, survey footprints, GIS hazard layers, uncertainty and reuse terms | AVAILABILITY NOT VERIFIED |
| Department of Irrigation: https://irrigation.gov.lk/web/index.php?lang=en | Continuous river stage/discharge, station coordinates, gauge datum, rating-curve history, flood thresholds, gaps and quality flags | AVAILABILITY NOT VERIFIED |
| Department of Meteorology: https://meteo.gov.lk/ | Historical gauge rainfall, station history, sampling intervals, units, missingness and quality controls | AVAILABILITY NOT VERIFIED |

For each agency, confirm temporal/spatial coverage, export format, permitted
research use and redistribution, costs, and any approval process. Website or
portal existence does not demonstrate access to the required historical series.
No station names, periods, or data quantities are assumed here.

## Required event-level and supporting data

The fields below are a proposed acquisition specification, not records already
obtained. Keep unknown values explicit and preserve source-specific precision.

### LSTM flood modelling

- Continuous input series, including flood and non-flood periods: station/grid
  ID, interval start/end, rainfall value/unit, sampling interval, quality flags,
  missing-data flags, location, and catchment/reach assignment.
- Observed target series: gauge ID, observation time, stage and datum and/or
  discharge with units, rating-curve version where relevant, quality flags,
  station relocations, and gap history. Choose stage, discharge, or a justified
  flood classification target before building sequences.
- Flood episode table: event ID, observed onset/peak/recession times, peak
  stage/discharge, documented threshold and its validity dates, inundation
  evidence where available, source ID, and timing/location uncertainty.
- Forecast specification: issue time, input lookback, lead time, target interval,
  and actual data publication/arrival time. Obtain enough continuous overlap to
  assess feasibility; no minimum event count or successful training is assumed.

### Random Forest landslide modelling

- Positive inventory: unique event ID, initiation coordinates or polygon, CRS,
  positional uncertainty, occurrence time/interval, landslide type, verification
  method, source ID, and inventory/survey date. Distinguish source from runout.
- Sampling frame: survey footprint and period, detection effort, mapping limits,
  deduplication rules, and mapping unit (pixel, slope unit, or site).
- Negative/background sample table: sample ID, geometry, observation window,
  survey evidence, sampling method and exclusion buffer. Unreported locations
  are unknown unless non-occurrence is defensible; distinguish pseudo-absence.
- Predictor snapshot: elevation, slope, aspect, land cover and river context,
  with source/version/date and spatial resolution. Seek geology/soil layers if
  needed; their sources and availability are not established by this inventory.
- If using rainfall, attach pre-event accumulation windows and issue times;
  distinguish static susceptibility mapping from time-dependent occurrence
  prediction, and avoid post-event predictors.

### Flood–landslide cascade analysis

- Separate verified flood and landslide IDs with onset intervals, locations,
  confidence, provenance, and independent hazard verification.
- Pair table: pair ID, linked event IDs, hypothesized mechanism and direction,
  source/receiving reach and subbasin IDs, directed upstream/downstream path,
  network distance, estimated lag with uncertainty, and basis for that estimate.
- Supporting observations: intervening rainfall history, hydrographs, blockage/
  release evidence or field reports where relevant, and timestamps of evidence.
- Labels must distinguish supported cascade, common-rainfall co-occurrence,
  unrelated pair, and uncertain relationship. Timing and connectivity alone do
  not prove causation. Evaluate both directions only where the mechanism fits.
- Include connected pairs without a second event, unconnected controls, and
  observation coverage; do not infer non-events from silence in reports.

### Independent evaluation and historical backtesting

- Holdout event IDs, dates, locations, verified outcomes, source provenance,
  observation uncertainty, survey coverage, and non-event observation windows.
- Chronological train/validation/test boundaries and spatial group IDs; keep
  the same storm, duplicate incident, and cascade-linked events in one split.
  Record exclusions and preserve an untouched final test period/area.
- Archived issue-time inputs, product run/version, publication latency, model
  version, forecast issue time/lead, probability or predicted value, and outcome
  time. Revised retrospective products must be identified separately.
- Independently verified labels or adjudication where possible; a second copy
  of the same agency report is not independent evidence. Retain provenance to
  trace duplicate records across sources.
- Evaluate against defined baselines: flood continuous-target errors and/or
  event detection, lead time and false alarms; landslide discrimination and
  calibration with spatial validation; cascade pair precision/recall and lag
  error only where relationship labels support them. Fix definitions and
  thresholds using training/validation data, not the final test set.

## Preparation checks and feasibility gate

Before acquisition, agree the watershed outlet, connected downstream extent,
observation period, modelling units, targets, and forecast horizons. When access
is approved, log source URL, product/version, license, retrieval date, spatial
extent, temporal coverage, units, CRS/vertical datum, missingness and checksum.
Keep original data separate from processed derivatives; credentials and
restricted records must not be placed in shared configuration or public Git.

Normalize timestamps while retaining originals and time zones (Sri Lanka is
UTC+05:30); distinguish event occurrence, observation, report, and publication
times. Record date-only events as intervals, not fabricated exact times. Check
CRS alignment, watershed topology, duplicates, sampling bias and temporal
coverage. Do not upsample coarse rainfall and describe it as new fine-scale
information. Establish consistent interval totals and rate conversions.

Training feasibility is **not established**. First inspect labelled flood and
landslide records, gauge continuity, temporal overlap, spatial accuracy, negative
sampling evidence, and enough independent events for evaluation. If labels or
access are inadequate, revise scope or target with research approval; simulated
sensor values and existing seeded DMEWS predictions are not ground truth.

This document is planning only. Existing DMEWS pages, routes, database schemas,
dependencies and shared configuration remain outside this work. Dataset
acquisition, implementation, installation and integration require approval.
