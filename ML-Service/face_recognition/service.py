"""DMEWS face matching service.

This service returns ranked potential matches only. It never makes an identity
claim. The face_recognition dependency is deliberately required at runtime so
an unconfigured deployment reports unavailable instead of returning fabricated
matches.
"""

from __future__ import annotations

import base64
import io
import os
from typing import Any
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    import face_recognition
except ImportError:  # pragma: no cover - exercised by deployment configuration
    face_recognition = None


app = FastAPI(title="DMEWS Face Recognition Service", version="1.0.0")


class Candidate(BaseModel):
    id: str
    fullName: str = ""
    age: int | None = None
    gender: str = ""
    lastSeenLocation: str = ""
    photoUrl: str = ""


class AnalysisRequest(BaseModel):
    imageBase64: str = Field(min_length=1)
    imageMimeType: str = "image/jpeg"
    optionalInfo: dict[str, Any] = {}
    candidates: list[Candidate] = []


def decode_image(value: str) -> Any:
    try:
        return base64.b64decode(value, validate=True)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid image data.")


def metadata_score(info: dict[str, Any], candidate: Candidate) -> int:
    score = 0
    location = str(info.get("location") or "").strip().lower()
    candidate_location = candidate.lastSeenLocation.strip().lower()
    if location and candidate_location and (location in candidate_location or candidate_location in location):
        score += 50
    age = info.get("age")
    if age is not None and candidate.age is not None:
        difference = abs(float(age) - candidate.age)
        score += 30 if difference <= 2 else 15 if difference <= 5 else 0
    gender = str(info.get("gender") or "").strip().lower()
    if gender and candidate.gender and gender == candidate.gender.strip().lower():
        score += 20
    return min(score, 100)


def image_from_url(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "DMEWS-face-matching/1.0"})
    with urlopen(request, timeout=8) as response:
        return response.read()


def compare(query_raw: bytes, candidate: Candidate) -> float | None:
    try:
        query_image = face_recognition.load_image_file(io.BytesIO(query_raw))
        query_faces = face_recognition.face_encodings(query_image)
        if len(query_faces) != 1 or not candidate.photoUrl:
            return None
        reference_raw = image_from_url(candidate.photoUrl)
        reference_image = face_recognition.load_image_file(io.BytesIO(reference_raw))
        reference_faces = face_recognition.face_encodings(reference_image)
        if len(reference_faces) != 1:
            return None
        distance = float(face_recognition.face_distance([reference_faces[0]], query_faces[0])[0])
        confidence = max(0.0, min(1.0, 1.0 - distance))
        return confidence if distance <= float(os.getenv("FACE_MATCH_THRESHOLD", "0.55")) else None
    except (OSError, ValueError, TimeoutError):
        return None


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "faceRecognitionConfigured": face_recognition is not None}


@app.post("/analyze")
def analyze(request: AnalysisRequest) -> dict[str, Any]:
    if face_recognition is None:
        return {
            "status": "unavailable",
            "matches": [],
            "message": "Face recognition dependencies are not installed on the analysis service.",
        }

    query_raw = decode_image(request.imageBase64)
    matches = []
    for candidate in request.candidates:
        confidence = compare(query_raw, candidate)
        if confidence is None:
            continue
        matches.append({
            "personId": candidate.id,
            "confidence": round(confidence, 4),
            "metadataScore": metadata_score(request.optionalInfo, candidate),
            "reason": "Potential face similarity; verify against official records.",
        })
    matches.sort(key=lambda item: (item["confidence"], item["metadataScore"]), reverse=True)
    return {
        "status": "completed",
        "matches": matches[:10],
        "message": "Potential matches ranked for officer review. No identity was confirmed.",
    }
