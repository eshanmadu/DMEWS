# Milestone 01: isolated workspace and research specification

Status: workspace documentation only; research specification and data feasibility
remain unresolved. Model implementation is not authorized by this milestone.

## Objective

Prepare an isolated Cascade Disaster Prediction System workspace inside the
existing DMEWS repository, on `main`, while preserving teammate work. Define the
decisions and evidence needed before data acquisition and modelling begin.

## Authorized workspace setup

Create only these files; leave all existing files unchanged:

- `ML-Service/AGENTS.md`: development boundaries and verification rules.
- `ML-Service/.gitignore`: local data, credentials, environments and artifacts.
- `ML-Service/docs/MILESTONE_01.md`: this milestone specification.

Reuse `ML-Service/README.md`, `ML-Service/requirements.txt`, and
`ML-Service/data/DATA_INVENTORY.md` without modifying them. Reuse the existing
empty `api/`, `src/`, `notebooks/`, `models/`, `data/raw/`, and `data/processed/`
directories. Empty directories are not tracked by Git; placeholders are unnecessary.

## Research decisions to resolve

| Decision | Current position | Required evidence or decision |
| --- | --- | --- |
| Study area | Kalu River Basin/Ratnapura is proposed in the data inventory | Select outlet coordinates, connected upstream area and downstream extent; do not substitute a district boundary |
| Mapping units | Not selected | Define micro-watershed, reach and landslide sampling units, identifiers and spatial resolution |
| DEM workflow | Not implemented | Select DEM/version, CRS and vertical reference; define conditioning, outlet snapping, stream threshold and topology checks |
| Flood target | Not selected | Establish stage, discharge or defensible flood classification target, units, gauges and thresholds |
| Forecast timing | Not selected | Define sampling interval, lookback, issue time, lead times and input availability at issue time |
| Landslide labels | Availability unverified | Obtain verified locations/time intervals, survey coverage and defensible background or pseudo-absence strategy |
| Cascade mechanism | Not selected | Define direction and physical mechanism; distinguish causal evidence from common-rainfall co-occurrence |
| Downstream impact | Not selected | Define available exposure layers and an appropriately limited impact measure |
| Secondary-hazard timing | Evidence unverified | Identify observed lag evidence and represent timing uncertainty explicitly |
| Evaluation | Not implemented | Define spatial/chronological holdouts, storm grouping, baselines, metrics and leakage controls |
| Explainability | Not implemented | Choose model-appropriate explanations and distinguish feature attribution from causal explanation |

The data inventory is a plan, not evidence that files, permissions, adequate event
counts, or overlapping observational series have been obtained.

## Feasibility gate for subsequent work

Before requesting model implementation approval, establish:

1. A documented study boundary and connected watershed/reach representation.
2. Dataset access conditions, permitted use, coverage, quality and provenance.
3. A viable observed flood target and verified landslide label strategy.
4. Consistent units, spatial references and timestamp/interval conventions,
   retaining original timestamps and distinguishing occurrence/report/publication.
5. Independent evaluation splits that prevent storm, spatial and temporal leakage.
6. A scoped cascade hypothesis with explicit evidence limits and uncertainty.

If observations are insufficient, report the gap and propose a revised scope for
approval. Do not substitute seeded predictions or simulated sensors as ground truth.
Static susceptibility alone does not establish landslide onset time. Connectivity
alone does not establish triggering, travel time, flood footprint or damage.

## Acceptance criteria

Workspace setup is complete when:

- The three authorized files exist and no existing repository file has changed.
- The branch remains `main` and the index remains unchanged.
- Local research data/artifact paths are ignored while the three setup documents
  and existing research planning documents remain eligible for version control.
- No dependency installation, dataset download, model execution, database update,
  application integration, or Git history operation has occurred.

The broader specification milestone remains pending until the unresolved research
decisions and feasibility evidence are reviewed. Workspace creation is not a claim
that training or cascade prediction is feasible or implemented.

## Later integration boundary

Later work may propose separate cascade frontend pages/components and separate
backend routes/controllers/APIs. Existing dashboards, predictions, alerts, mobile
code and MongoDB schemas/collections remain untouched. Any unavoidable shared-file
change requires an exact explanation and approval before execution. Research
results must remain separate from operational warning and notification flows.
