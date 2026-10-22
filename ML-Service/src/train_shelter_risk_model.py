"""Train a shelter risk classifier from the shelter workbook and river observations.

The workbook is intentionally supplied as a command-line input because it is an
operational dataset and is not committed to the repository. If it has no risk
label, labels are derived from occupancy and river-level thresholds so the
pipeline remains reproducible while a reviewed labelled dataset is prepared.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split


FEATURES = [
    "capacity",
    "occupied",
    "occupancy_ratio",
    "river_level_m",
    "river_change_m",
    "latitude",
    "longitude",
]
LABELS = ("safe", "watch", "evacuate")


def normalise_column(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


def find_column(columns: list[str], names: tuple[str, ...]) -> str | None:
    for name in names:
        if name in columns:
            return name
    return None


def load_latest_river_levels(path: Path) -> tuple[float, float]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    levels: list[tuple[str, float]] = []
    for station_days in payload.get("event_data", {}).values():
        for day, readings in station_days.items():
            for clock, value in readings.items():
                if isinstance(value, (int, float)):
                    levels.append((f"{day}{clock}", float(value)))
    if not levels:
        raise ValueError(f"No numeric river readings found in {path}")
    levels.sort()
    latest = levels[-1][1]
    previous = levels[-2][1] if len(levels) > 1 else latest
    return latest, latest - previous


def load_shelters(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path) if path.suffix.lower() == ".csv" else pd.read_excel(path)
    frame.columns = [normalise_column(column) for column in frame.columns]
    aliases = {
        "capacity": ("capacity", "max_capacity", "total_capacity", "beds"),
        "occupied": ("occupied", "occupancy", "current_occupancy", "people"),
        "latitude": ("latitude", "lat"),
        "longitude": ("longitude", "lon", "lng"),
        "label": ("risk", "risk_level", "target", "label"),
    }
    for target, names in aliases.items():
        source = find_column(list(frame.columns), names)
        if source and source != target:
            frame[target] = frame[source]
    required = {"capacity", "occupied"}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f"Shelter dataset is missing columns: {', '.join(sorted(missing))}")
    for column in FEATURES:
        if column not in frame:
            frame[column] = 0.0
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0.0)
    frame["occupancy_ratio"] = np.divide(
        frame["occupied"],
        frame["capacity"].clip(lower=1),
    ).clip(0, 1)
    return frame


def derive_labels(frame: pd.DataFrame) -> pd.Series:
    if "label" in frame:
        labels = frame["label"].astype(str).str.lower().str.strip()
        if labels.isin(LABELS).all():
            return labels
    score = (
        frame["occupancy_ratio"] * 0.65
        + (frame["river_level_m"] >= 2.0).astype(float) * 0.25
        + (frame["river_change_m"] > 0.2).astype(float) * 0.1
    )
    return pd.cut(score, bins=[-np.inf, 0.45, 0.7, np.inf], labels=LABELS)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shelters", required=True, type=Path, help="Shelter .xlsx/.xls/.csv dataset")
    parser.add_argument(
        "--river-levels",
        type=Path,
        default=Path("Backend/data/river_water_level.json"),
    )
    parser.add_argument("--output", type=Path, default=Path("ML-Service/models/shelter_risk.joblib"))
    args = parser.parse_args()

    latest, change = load_latest_river_levels(args.river_levels)
    frame = load_shelters(args.shelters)
    frame["river_level_m"] = latest
    frame["river_change_m"] = change
    labels = derive_labels(frame)

    if len(frame) < 6 or labels.nunique() < 2:
        raise ValueError("At least 6 shelters and 2 risk classes are required for training.")

    x_train, x_test, y_train, y_test = train_test_split(
        frame[FEATURES], labels, test_size=0.25, random_state=42, stratify=labels
    )
    model = RandomForestClassifier(
        n_estimators=250, class_weight="balanced", random_state=42, min_samples_leaf=1
    )
    model.fit(x_train, y_train)
    print(classification_report(y_test, model.predict(x_test), zero_division=0))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "features": FEATURES, "labels": LABELS}, args.output)
    print(f"Saved model to {args.output}")


if __name__ == "__main__":
    main()
