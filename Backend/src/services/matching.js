/**
 * Victim identification matching: ranks missing-person records against an
 * officer-confirmed scan. Every point a candidate gets is recorded as a piece
 * of evidence with a plain-language explanation, so officers can see why a
 * record was suggested. Results are suggestions for human verification only.
 */
const crypto = require("crypto");
const { embedTexts, dot, EMBED_MODEL } = require("./textEmbedding");
const { featureStatements, featureWords } = require("./personDetails");

/* ------------------------------------------------------------------ */
/* Tunable thresholds (starting values; calibrate with real test data)  */
/* ------------------------------------------------------------------ */

const FACE_POSSIBLE = Number(process.env.FACE_SIMILARITY_THRESHOLD) || 0.35;
const FACE_STRONG = Number(process.env.FACE_STRONG_SIMILARITY) || 0.5;
// nomic-embed-text: true mark matches scored 0.72-0.81, unrelated marks up to 0.66.
const TEXT_MATCH = Number(process.env.TEXT_MATCH_THRESHOLD) || 0.7;
const TEXT_STRONG = Number(process.env.TEXT_STRONG_THRESHOLD) || 0.76;
// Age + sex + location alone add up to 28: require at least one identifying match.
const MIN_SCORE = 30;
const MAX_RESULTS = 10;

// Points per matching mark, and the words a report statement must contain
// to count as describing the same kind of mark.
const MARK_RULES = {
  tattoos: { points: 25, strong: 30, pattern: /tatt?oo|inked|\bink\b/i },
  scars: { points: 18, strong: 22, pattern: /scar|stitch|wound|burn/i },
  birthmarks: { points: 18, strong: 22, pattern: /birth ?mark|mole|patch|\bmark/i },
  piercings: { points: 10, strong: 12, pattern: /pierc|ear ?ring|nose ?ring|stud/i },
  otherMarks: { points: 10, strong: 12, pattern: null },
};
const ITEM_POINTS = 8;
const CAPS = { face: 60, marks: 50, items: 16, text: 25 };

/* ------------------------------------------------------------------ */
/* Missing-person text index                                          */
/* ------------------------------------------------------------------ */

/** Split a free-text description into short statements worth comparing. */
function splitStatements(text) {
  const parts = String(text || "")
    .split(/[.;!?\n]+|,(?![^(]*\))/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const merged = [];
  for (const part of parts) {
    if (merged.length && part.length < 12) merged[merged.length - 1] += `, ${part}`;
    else merged.push(part);
  }
  return merged.filter((p) => p.length >= 4).slice(0, 40);
}

function indexSource(person) {
  return JSON.stringify([person.description || "", person.identifyingFeatures || {}]);
}

/** Statements to index for a report: its structured features, then its free text. */
function reportStatements(person) {
  const structured = featureStatements(person.identifyingFeatures).map((s) => s.text);
  return [...structured, ...splitStatements(person.description)].slice(0, 60);
}

function indexHash(person) {
  return crypto.createHash("sha1").update(indexSource(person)).digest("hex");
}

/**
 * Embeddings of a missing person's description statements. Never throws:
 * failures are recorded as status "error" for the backfill script to retry.
 */
async function buildTextIndex(person) {
  const base = { model: EMBED_MODEL, sourceHash: indexHash(person), computedAt: new Date() };
  try {
    const texts = reportStatements(person);
    const vectors = await embedTexts(texts, "document");
    return { ...base, status: "ok", items: texts.map((text, i) => ({ text, embedding: vectors[i] })) };
  } catch (error) {
    return { ...base, status: "error", error: String(error?.message || error).slice(0, 300), items: [] };
  }
}

/* ------------------------------------------------------------------ */
/* Scan evidence                                                       */
/* ------------------------------------------------------------------ */

function side(text) {
  const t = String(text).toLowerCase();
  const left = /\bleft\b/.test(t);
  const right = /\bright\b/.test(t);
  return left && !right ? "left" : right && !left ? "right" : null;
}

/** Statements describing the scanned person, to compare with reports. */
function scanQueries(details) {
  return featureStatements(details).map((statement) => ({ ...statement, rule: MARK_RULES[statement.key] || null }));
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

function distanceKm(a, b) {
  if (!a || !b) return null;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const rad = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function faceEvidence(queryFace, person) {
  const reference = person.face?.status === "ok" ? person.face.embedding : null;
  if (!queryFace || !reference || reference.length !== queryFace.length) return null;
  const similarity = dot(queryFace, reference);
  if (similarity < FACE_POSSIBLE) return { similarity, item: null };
  const band = similarity >= FACE_STRONG ? "strong" : "possible";
  // 0.35 -> 30 points, 0.60+ -> 60 points.
  const points = Math.round(Math.min(CAPS.face, 30 + ((similarity - FACE_POSSIBLE) / 0.25) * 30));
  return {
    similarity,
    band,
    item: { type: "face", label: `${band === "strong" ? "Strong" : "Possible"} face similarity`, detail: `cosine ${similarity.toFixed(2)}`, points },
  };
}

function textEvidence(queries, queryVectors, person) {
  const statements = person.textIndex?.status === "ok" ? person.textIndex.items || [] : [];
  const evidence = [];
  const totals = { marks: 0, items: 0 };
  const usedStatements = new Set();
  queries.forEach((query, qi) => {
    let best = null;
    for (const [si, statement] of statements.entries()) {
      if (!statement.embedding || usedStatements.has(si)) continue;
      if (query.rule?.pattern && !query.rule.pattern.test(statement.text)) continue;
      const qs = side(query.text);
      const ss = side(statement.text);
      if (qs && ss && qs !== ss) continue;
      const similarity = dot(queryVectors[qi], statement.embedding);
      if (similarity >= TEXT_MATCH && (!best || similarity > best.similarity)) best = { similarity, si, text: statement.text };
    }
    if (!best) return;
    usedStatements.add(best.si);
    const strong = best.similarity >= TEXT_STRONG;
    const points = query.group === "marks" ? (strong ? query.rule.strong : query.rule.points) : ITEM_POINTS;
    const room = CAPS[query.group] - totals[query.group];
    if (room <= 0) return;
    totals[query.group] += Math.min(points, room);
    evidence.push({
      type: query.group === "marks" ? "mark" : "item",
      label: `${query.label} matches the report`,
      detail: `"${best.text}" (${best.similarity.toFixed(2)})`,
      points: Math.min(points, room),
    });
  });
  return evidence;
}

function wordEvidence(words, person) {
  const reportWords = new Set([
    ...String(person.description || "").toLowerCase().split(/[^\p{L}\p{N}]+/u),
    ...featureWords(person.identifyingFeatures),
  ]);
  const found = words.filter((w) => reportWords.has(w));
  if (!found.length) return null;
  return { type: "text", label: "Same readable text in the report", detail: found.map((w) => `"${w}"`).join(", "), points: CAPS.text };
}

function demographicEvidence(details, person) {
  const evidence = [];
  const reportSex = String(person.gender || "").toLowerCase();
  if (details.sex && details.sex !== "unknown" && ["male", "female"].includes(reportSex)) {
    evidence.push(reportSex === details.sex
      ? { type: "sex", label: "Same sex", detail: details.sex, points: 8 }
      : { type: "sex", label: "Different sex", detail: `scan ${details.sex}, report ${reportSex}`, points: -40 });
  }
  let { estimatedAgeMin: min, estimatedAgeMax: max } = details;
  if (min == null && max != null) min = max - 5;
  if (max == null && min != null) max = min + 5;
  if (min != null && person.age != null) {
    const gap = person.age < min ? min - person.age : person.age > max ? person.age - max : 0;
    if (gap <= 3) evidence.push({ type: "age", label: "Age fits", detail: `report ${person.age}, scan ${min}-${max}`, points: 8 });
    else if (gap > 10) evidence.push({ type: "age", label: "Age far outside the estimate", detail: `report ${person.age}, scan ${min}-${max}`, points: -25 });
  }
  return evidence;
}

function locationEvidence(foundPoint, details, person) {
  const km = distanceKm(foundPoint, person.location?.coordinates);
  if (km !== null) {
    const points = km <= 10 ? 12 : km <= 30 ? 8 : km <= 80 ? 4 : 0;
    return points ? { type: "location", label: "Found near where last seen", detail: `${km.toFixed(km < 10 ? 1 : 0)} km apart`, points } : null;
  }
  const found = String(details.foundLocation || "").toLowerCase().trim();
  const seen = String(person.lastSeenLocation || "").toLowerCase().trim();
  if (found && seen && (found.includes(seen) || seen.includes(found))) {
    return { type: "location", label: "Same place name", detail: person.lastSeenLocation, points: 6 };
  }
  return null;
}

/** Missing reported after the body was found: cannot be the same person. */
function impossibleByDate(details, person) {
  if (!details.foundDate || !person.dateMissing) return false;
  const found = new Date(`${details.foundDate}T23:59:59Z`).getTime();
  return new Date(person.dateMissing).getTime() > found + 24 * 3600 * 1000;
}

/**
 * @param {{faceEmbedding: number[]|null, details: object, foundPoint: [number, number]|null}} scan
 * @param {object[]} candidates lean MissingPerson docs with +face.embedding and +textIndex.items
 */
async function rankCandidates(scan, candidates) {
  const { details } = scan;
  const queries = scanQueries(details);
  let queryVectors = [];
  let textMatching = queries.length ? "ok" : "no_marks";
  if (queries.length) {
    try {
      queryVectors = await embedTexts(queries.map((q) => q.text), "query");
    } catch (error) {
      textMatching = `unavailable: ${String(error?.message || error).slice(0, 120)}`;
    }
  }
  const words = featureWords(details);

  const stats = {
    candidates: candidates.length,
    queryHasFace: Boolean(scan.faceEmbedding),
    comparedFaces: 0,
    withFacePhoto: 0,
    withTextIndex: 0,
    excludedByDate: 0,
    markQueries: queries.length,
    textMatching,
  };

  const ranked = [];
  for (const person of candidates) {
    if (person.face?.status === "ok") stats.withFacePhoto += 1;
    if (person.textIndex?.status === "ok") stats.withTextIndex += 1;
    if (impossibleByDate(details, person)) {
      stats.excludedByDate += 1;
      continue;
    }
    const evidence = [];
    const face = faceEvidence(scan.faceEmbedding, person);
    if (face) stats.comparedFaces += 1;
    if (face?.item) evidence.push(face.item);
    if (queryVectors.length) evidence.push(...textEvidence(queries, queryVectors, person));
    const words_ = wordEvidence(words, person);
    if (words_) evidence.push(words_);
    evidence.push(...demographicEvidence(details, person));
    const near = locationEvidence(scan.foundPoint, details, person);
    if (near) evidence.push(near);

    const score = Math.max(0, Math.min(100, evidence.reduce((sum, e) => sum + e.points, 0)));
    const faceMatched = Boolean(face?.item);
    if (score < MIN_SCORE && !faceMatched) continue;
    ranked.push({
      personId: String(person._id),
      matchType: faceMatched ? "face" : "metadata",
      score,
      similarity: face ? Number(face.similarity.toFixed(4)) : null,
      confidence: faceMatched ? Number(Math.max(0, Math.min(1, face.similarity)).toFixed(4)) : null,
      band: face?.band || null,
      evidence: evidence.sort((a, b) => b.points - a.points),
      reason: faceMatched
        ? "Face and details are supporting signals only; verify against official records."
        : "Details-based potential match only; verify against official records.",
    });
  }
  ranked.sort((a, b) => b.score - a.score || (b.similarity ?? -1) - (a.similarity ?? -1));

  let message = "Potential matches ranked for officer review. Face and details are supporting signals only.";
  if (!scan.faceEmbedding) message = "No usable face in the scan photos; potential matches are ranked by details only.";
  if (textMatching.startsWith("unavailable")) message += " Body-mark comparison was unavailable (is Ollama running?).";
  return { matches: ranked.slice(0, MAX_RESULTS), stats, message };
}

module.exports = { rankCandidates, buildTextIndex, indexHash, splitStatements };
