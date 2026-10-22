# Cascade Disaster Prediction System

This folder is an isolated research module within DMEWS (Disaster Management
and Early Warning System). It will investigate flood prediction, landslide
susceptibility, and relationships between these hazards.

## Planned components

- A Python LSTM model for flood prediction.
- A Python Random Forest model for landslide susceptibility prediction.
- A cascade analysis engine using event timing and watershed connectivity.
- Data preprocessing, model evaluation, and explainability.
- A future Python API for integration with DMEWS, subject to approval.

## Folder structure

```text
ML-Service/
├── data/
│   ├── raw/         # Original research datasets
│   └── processed/   # Prepared research data
├── notebooks/       # Exploratory research and experiments
├── models/          # Future trained model artifacts
├── src/             # DEM preprocessing, coverage checks, and synthetic compatibility checks
├── api/             # Future Python API
├── requirements.txt # Pinned existing research environment
└── README.md
```

The source directory contains DEM visualization, reference coverage checking,
UTM reprojection, and synthetic pysheds compatibility checks. Local datasets,
virtual environments, and generated outputs are excluded from version control.
The DEM acquisition record is retained in `data/raw/dem/METADATA.md`.

## Separation from the existing application

This research module must remain separate from the existing Frontend, Backend,
mobile application, database schemas, dependencies, and shared configuration
until integration is explicitly approved. Do not write predictions into the
application database or connect this module to existing alert flows without
that approval.

## Current research environment and reproduction

`requirements.txt` records the installed Python 3.9 macOS environment, including
transitive dependencies. Installation on Windows and other Python versions has
not been validated. Future model/API packages are not included until used.
No flood, landslide, or cascade prediction model has been trained here.

## Shelter risk training

`src/train_shelter_risk_model.py` trains a Random Forest shelter-readiness
classifier from an operational Excel or CSV shelter dataset and the river
observations stored in `Backend/data/river_water_level.json`. The trainer
accepts flexible column names for capacity, occupancy, latitude, and longitude.
If a reviewed `risk`/`risk_level` column is not present, it derives provisional
labels from occupancy and current river-level change; those labels should be
replaced before production decisions are made.

```powershell
python ML-Service/src/train_shelter_risk_model.py `
  --shelters "path\to\badulla-shelters.xlsx" `
  --river-levels Backend/data/river_water_level.json
```

The admin shelter page displays the same river observations alongside live
shelter capacity records, with Badulla selected by default.

From the repository root, create an environment and install the snapshot:

macOS/Linux:
```sh
python3.9 -m venv ML-Service/.venv
ML-Service/.venv/bin/python -m pip install -r ML-Service/requirements.txt
ML-Service/.venv/bin/python ML-Service/src/test_pysheds.py
```

Windows PowerShell (Python 3.9 installed):
```powershell
py -3.9 -m venv ML-Service/.venv
& .\ML-Service\.venv\Scripts\python.exe -m pip install -r ML-Service/requirements.txt
& .\ML-Service\.venv\Scripts\python.exe .\ML-Service\src\test_pysheds.py
```

The compatibility check uses synthetic arrays only. Other scripts require local
Copernicus DEM and/or HydroBASINS inputs at the paths specified in their source;
these inputs and generated figures/rasters are deliberately not committed.
`prepare_dem.py` preserves the source and refuses to replace existing outputs.
The data inventory and milestone document describe the initial planning state;
the acquisition metadata records the subsequent DEM download. Catchment
validation and the broader research feasibility decisions remain pending.
