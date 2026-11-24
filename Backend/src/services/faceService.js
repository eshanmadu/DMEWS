/**
 * Client for the Python face service (ML-Service/face_recognition).
 *
 * - computeFace(): turn one photo into the `face` fields stored on a record.
 * Comparison happens in services/matching.js.
 */

const EMBED_TIMEOUT_MS = 60_000;

function serviceUrl() {
  return String(process.env.FACE_RECOGNITION_URL || "").replace(/\/+$/, "");
}

function isFaceServiceConfigured() {
  return Boolean(serviceUrl());
}

async function postJson(path, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${serviceUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || data.message || `Face service returned ${response.status}.`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Compute the `face` sub-document for a photo.
 * Never throws: failures are recorded as status "error" so a report can still
 * be saved, and the backfill script can retry it later.
 */
async function computeFace(buffer, mimetype, photoUrl) {
  const base = { photoUrl: photoUrl || "", computedAt: new Date() };
  if (!isFaceServiceConfigured()) {
    return { ...base, status: "error", error: "FACE_RECOGNITION_URL is not set." };
  }
  try {
    const result = await postJson(
      "/embed",
      { imageBase64: Buffer.from(buffer).toString("base64"), imageMimeType: mimetype || "image/jpeg" },
      EMBED_TIMEOUT_MS
    );
    if (result.status !== "completed") {
      return { ...base, status: "error", error: String(result.message || "Face model unavailable.").slice(0, 300) };
    }
    const faceCount = Number(result.faceCount) || 0;
    const fields = { ...base, model: result.model, faceCount };
    if (result.primaryFaceIndex == null) {
      return { ...fields, status: faceCount === 0 ? "no_face" : "multiple_faces" };
    }
    const primary = result.faces[result.primaryFaceIndex];
    return {
      ...fields,
      status: "ok",
      embedding: primary.embedding,
      quality: primary.quality,
      estimatedAge: primary.estimatedAge ?? undefined,
      estimatedSex: primary.estimatedSex ?? undefined,
    };
  } catch (error) {
    const message = error?.name === "AbortError" ? "Face service timed out." : error?.message || "Face service error.";
    return { ...base, status: "error", error: String(message).slice(0, 300) };
  }
}

/** Download a stored photo (used by the backfill script). */
async function downloadImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Photo download returned ${response.status}.`);
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimetype: response.headers.get("content-type") || "image/jpeg",
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { isFaceServiceConfigured, computeFace, downloadImage };
