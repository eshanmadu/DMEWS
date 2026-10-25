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
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from typing import Any
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    import face_recognition
except ImportError:  # pragma: no cover - exercised by deployment configuration
    face_recognition = None


app = FastAPI(title="DMEWS Face Recognition Service", version="1.0.0")
_reference_cache: dict[str, Any] = {}
_reference_cache_lock = Lock()


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
    with urlopen(request, timeout=4) as response:
        return response.read()


def reference_encoding(candidate: Candidate) -> Any:
    if not candidate.photoUrl:
        return None
    with _reference_cache_lock:
        if candidate.photoUrl in _reference_cache:
            return _reference_cache[candidate.photoUrl]
    reference_raw = image_from_url(candidate.photoUrl)
    reference_image = face_recognition.load_image_file(io.BytesIO(reference_raw))
    reference_faces = face_recognition.face_encodings(reference_image)
    encoding = reference_faces[0] if len(reference_faces) == 1 else None
    if encoding is not None:
        with _reference_cache_lock:
            _reference_cache[candidate.photoUrl] = encoding
    return encoding


def compare_with_stats(query_encoding: Any, candidate: Candidate) -> tuple[dict[str, Any] | None, str]:
    if not candidate.photoUrl:
        return None, "missing_url"
    try:
        reference = reference_encoding(candidate)
        if reference is None:
            return None, "no_face"
        distance = float(face_recognition.face_distance([reference], query_encoding)[0])
        confidence = max(0.0, min(1.0, 1.0 - distance))
        if distance > float(os.getenv("FACE_MATCH_THRESHOLD", "0.55")):
            return None, "below_threshold"
        return {
            "personId": candidate.id,
            "matchType": "face",
            "confidence": round(confidence, 4),
            "metadataScore": metadata_score({}, candidate),
            "reason": "Potential face similarity; verify against official records.",
        }, "matched"
    except (OSError, ValueError, TimeoutError):
        return None, "download_or_decode_error"


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
    query_faces = []
    try:
        query_image = face_recognition.load_image_file(io.BytesIO(query_raw))
        query_faces = face_recognition.face_encodings(query_image)
    except (OSError, ValueError):
        query_faces = []

    def score_candidate(candidate: Candidate) -> tuple[dict[str, Any] | None, str]:
        score = metadata_score(request.optionalInfo, candidate)
        face_match, face_status = (
            compare_with_stats(query_faces[0], candidate)
            if len(query_faces) == 1
            else (None, "no_query_face")
        )
        confidence = face_match["confidence"] if face_match else None
        if confidence is None and score == 0:
            return None, face_status
        return {
            "personId": candidate.id,
            "matchType": "face" if confidence is not None else "metadata",
            "confidence": round(confidence, 4) if confidence is not None else None,
            "metadataScore": score,
            "reason": (
                "Potential face similarity with supporting details; verify against official records."
                if confidence is not None
                else "Potential details-based match only; no face similarity passed the threshold."
            ),
        }, face_status

    with ThreadPoolExecutor(max_workers=min(8, max(1, len(request.candidates)))) as executor:
        scored = list(executor.map(score_candidate, request.candidates))
    matches = [match for match, _status in scored if match]
    reference_stats = {
        "candidates": len(request.candidates),
        "withPhotoUrl": sum(1 for candidate in request.candidates if candidate.photoUrl),
        "downloadOrDecodeErrors": sum(1 for _match, status in scored if status == "download_or_decode_error"),
        "processedReferences": sum(1 for _match, status in scored if status in {"matched", "below_threshold", "no_face"}),
    }
    matches.sort(
        key=lambda item: (
            item["matchType"] == "face",
            item["confidence"] or 0,
            item["metadataScore"],
        ),
        reverse=True,
    )
    return {
        "status": "completed",
        "matches": matches[:10],
        "message": (
            "Potential matches ranked for officer review. Face and details are supporting signals only."
            if len(query_faces) == 1
            else "No clear face was detected. Details-based potential matches are shown for officer review."
        ),
        "referenceStats": reference_stats,
    }
