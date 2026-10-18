# Cascade Disaster Prediction System development boundaries

These instructions apply to work within `ML-Service/`. Explicit user instructions
take precedence. This research component belongs to a shared DMEWS repository.

## Git and shared application boundaries

- Stay on the current `main` branch. Do not create or switch branches unless the
  user explicitly changes this instruction.
- Do not stage, commit, push, pull, merge, reset, clean, or stash without explicit
  user approval.
- Preserve all pre-existing uncommitted changes, including untracked files.
  Never assume an existing change belongs to this research component.
- Do not modify, delete, replace, or refactor existing frontend pages, backend
  functionality, routes, controllers, database schemas, or mobile application code.
- Keep machine learning research implementation inside `ML-Service/`.
- Future frontend work must use separate cascade pages and components. Future
  backend integration should use separate new files and APIs. If a shared-file
  modification is unavoidable, explain its exact scope and obtain approval first.
- Do not write research predictions to existing MongoDB collections or connect
  experimental results to public alerts, district risk updates, SMS, or email flows.
- Preserve existing DMEWS functionality.

## Authorization and verification

- Before each implementation step, state exactly which files will be created or
  modified. Follow the user's authorized scope; this document grants no new scope.
- After each implementation step, report exact changed paths and verify that
  unrelated existing files and pre-existing changes remain untouched.
- Do not install dependencies, download datasets, or execute scripts that modify
  shared data without approval. Do not run seed or migration scripts for inspection.
- Do not start model implementation merely because workspace setup is complete.

## Research integrity and local artifacts

- Never treat simulated sensor readings or seeded risk predictions as real
  training data, observed outcomes, or independent validation evidence.
- Separate verified observations, derived data, scenarios, and synthetic examples.
- Record dataset provenance, permissions, units, CRS, time conventions, quality
  flags, uncertainty, and processing versions. Preserve original data separately.
- Keep credentials, restricted records, personal data, raw/processed datasets,
  trained artifacts, and generated outputs out of Git by default.
- Git ignore rules do not protect already tracked files, encrypt data, or provide
  backups. Do not automatically untrack or delete files; request approval when needed.
- Refer to `data/DATA_INVENTORY.md` for acquisition planning and
  `docs/MILESTONE_01.md` for the initial milestone and feasibility gate.
