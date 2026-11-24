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

## Victim face-analysis service

`face_recognition/service.py` is an isolated HTTP service used by the protected
DMEWS victim-identification feature. It turns a photo into face encodings; the
backend stores them and does all comparison. Results are ranked **potential**
matches for officer review only. Nothing confirms identity.

Install its separate dependencies and run it from the repository root:

```powershell
python -m pip install -r ML-Service/face_recognition/requirements.txt
python -m uvicorn service:app --app-dir ML-Service/face_recognition --host 127.0.0.1 --port 8010
```

Set `FACE_RECOGNITION_URL=http://127.0.0.1:8010` in `Backend/.env`.

The service uses InsightFace (`buffalo_l`: SCRFD detection, 5-point alignment,
ArcFace 512-dimensional embeddings) on CPU through ONNX Runtime. On first start
it downloads the model pack (about 280 MB) to `~/.insightface/models`. The
InsightFace pretrained models are licensed for non-commercial research use
only; a production deployment needs a commercially licensed model.

| Endpoint | Purpose |
|---|---|
| `GET /health` | Model status |
| `POST /embed` | `{imageBase64}` -> every detected face with bounding box, quality checks, estimated age/sex, and its 512-d embedding |

### How a victim scan works

1. `POST /victim-access/scans` (up to 4 photos): the face service encodes the
   best face photo, and a vision model describes scars, tattoos, clothing and
   other features. By default the vision model is Qwen2.5-VL 7B running locally
   in Ollama; Claude can be used instead with an `ANTHROPIC_API_KEY` (see
   `Backend/.env.example`). The result is saved as a draft. Photos are not stored.
2. The officer corrects the details.
3. `POST /victim-access/scans/:id/submit`: `Backend/src/services/matching.js`
   compares the scan with every missing-person record and returns up to 10
   suggestions, each with an evidence list (points and a reason per item):
   face similarity, tattoos/scars/birthmarks/clothing compared by meaning with
   the report description, exact readable text, sex, age, distance between the
   found and last-seen locations. Records reported missing after the found
   date are excluded.

4. Admin review (`/admin/victim-identification/<scan id>`): the scan photo
   and the report photo side by side, a details comparison, the evidence,
   and a decision per suggestion (confirm identity — requires a note on how
   it was verified — / needs verification / not this person). Every action,
   including each photo view, is written to an audit log (`VictimScanAudit`).
   "Delete case permanently" removes the scan, its photos, details,
   suggestions, decisions and audit entries, keeping only one deletion entry
   (who, when, reason).

5. Reverse matching (`Backend/src/services/reverseMatching.js`): when a
   missing-person report is created or edited, it is checked in the
   background against every open scan. A report that would have been
   suggested is added to that scan ("From a later report") and the scan is
   flagged with a new-suggestion count until an admin opens its review.

Scan photos are stored encrypted (AES-256-GCM) on the backend disk, never on
a public host, viewable only by admins and the scanning officer. They are
deleted with the case; abandoned drafts are deleted completely after a day,
and photos of other scans after `SCAN_PHOTO_RETENTION_DAYS` (default 90). See `Backend/.env.example`.

Free local models used (Ollama, `ollama serve`):

```bash
ollama pull qwen2.5vl:7b      # reads details from photos (~6 GB)
ollama pull nomic-embed-text  # compares descriptions by meaning (~270 MB)
```

Public missing-person reports can include structured identifying features
(tattoos, scars, birthmarks, piercings, other marks, clothing, jewellery,
personal items, readable text), entered by the reporter or suggested from the
photo by the same local vision model (`POST /missing-persons/suggest-features`).
Missing-person records get their face encoding and a text index of their
description and features when they are created or edited. For older records, or ones saved while a
service was down, run from `Backend/`:

```bash
npm run backfill:matching              # missing, failed or out-of-date data
npm run backfill:matching -- --all     # recompute everything
npm run backfill:matching -- --dry-run # list what would be processed
```

Thresholds (backend env, starting values to calibrate on real test data):
`FACE_SIMILARITY_THRESHOLD` (0.35) and `FACE_STRONG_SIMILARITY` (0.50) for
faces; `TEXT_MATCH_THRESHOLD` (0.70) and `TEXT_STRONG_THRESHOLD` (0.76) for
marks and clothing.

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
