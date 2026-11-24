const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { MissingPerson } = require("../models/MissingPerson");
const { geocodeToPointSriLanka } = require("./missingPersonsController");
const { VictimIdentificationScan } = require("../models/VictimIdentificationScan");
const { computeFace } = require("../services/faceService");
const { extractAttributes } = require("../services/attributeExtraction");
const { rankCandidates } = require("../services/matching");
const { cleanDetails, text } = require("../services/personDetails");
const { savePhotos, readPhoto, deletePhotos } = require("../services/scanPhotoStore");
const { VictimScanAudit, audit } = require("../models/VictimScanAudit");
const { isAdmin } = require("../middleware/adminMiddleware");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 4;

/** Summary of the matching inputs, kept on the scan for history views. */
function optionalInfoFromDetails(details) {
  const { estimatedAgeMin: min, estimatedAgeMax: max } = details;
  const midAge = min !== null && max !== null ? Math.round((min + max) / 2) : min ?? max ?? null;
  return {
    location: details.foundLocation,
    age: midAge,
    gender: details.sex === "unknown" ? "" : details.sex,
    notes: details.notes,
  };
}

/* ------------------------------------------------------------------ */
/* Response shape                                                      */
/* ------------------------------------------------------------------ */

function payload(row, peopleById = new Map()) {
  return {
    id: row._id.toString(),
    status: row.status,
    imageCount: row.imageCount || 0,
    photoIndexes: (row.photos || []).map((photo) => photo.index),
    photosDeletedAt: row.photosDeletedAt || null,
    caseStatus: row.caseStatus || "open",
    newMatchCount: row.newMatchCount || 0,
    identifiedPersonId: row.identifiedPersonId ? String(row.identifiedPersonId) : null,
    closedAt: row.closedAt || null,
    closeNote: row.closeNote || "",
    face: row.face
      ? {
          status: row.face.status,
          imageIndex: row.face.imageIndex ?? null,
          faceCount: row.face.faceCount,
          quality: row.face.quality,
          estimatedAge: row.face.estimatedAge,
          estimatedSex: row.face.estimatedSex,
          error: row.face.error,
        }
      : null,
    extraction: row.extraction
      ? { status: row.extraction.status, model: row.extraction.model, error: row.extraction.error }
      : null,
    aiDetails: row.extraction?.attributes || null,
    details: row.details || null,
    optionalInfo: row.optionalInfo,
    candidateCount: row.candidateCount,
    analysisStats: row.analysisStats || {},
    serviceMessage: row.serviceMessage,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    matches: (row.matches || []).map((match) => {
      const person = peopleById.get(String(match.personId));
      return {
        personId: String(match.personId),
        matchType: match.matchType || "metadata",
        score: match.score ?? match.metadataScore ?? 0,
        confidence: match.confidence,
        similarity: match.similarity ?? null,
        band: match.band ?? null,
        evidence: (match.evidence || []).map((e) => ({ type: e.type, label: e.label, detail: e.detail, points: e.points })),
        metadataScore: match.metadataScore,
        reason: match.reason,
        source: match.source || "scan",
        addedAt: match.addedAt || null,
        decision: {
          status: match.decision?.status || "pending",
          note: match.decision?.note || "",
          byEmail: match.decision?.byEmail || "",
          at: match.decision?.at || null,
        },
        person: person ? {
          id: person._id.toString(),
          fullName: person.fullName,
          age: person.age,
          gender: person.gender,
          lastSeenLocation: person.lastSeenLocation,
          dateMissing: person.dateMissing,
          description: person.description,
          identifyingFeatures: person.identifyingFeatures || null,
          contactInfo: person.contactInfo || "",
          reporterName: person.reporterName || "",
          ifYouSeePhone: person.ifYouSeePhone || "",
          photoUrl: person.photoUrl || "",
        } : null,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Step 1: photos -> AI details + face encoding (draft)                */
/* ------------------------------------------------------------------ */

/** Face encoding from the first photo that contains one clear face. */
async function bestFace(images) {
  let first = null;
  for (const [index, image] of images.entries()) {
    const face = await computeFace(image.buffer, image.mimetype, "");
    if (face.status === "ok") return { ...face, imageIndex: index };
    if (!first) first = { ...face, imageIndex: index };
    if (face.status === "error") break; // service problem: other photos would fail too
  }
  return first;
}

async function createScan(req, res) {
  const images = (req.files || []).slice(0, MAX_IMAGES);
  if (!images.length) {
    return res.status(400).json({ message: "At least one photo is required." });
  }
  if (images.some((f) => f.size > MAX_IMAGE_BYTES || !String(f.mimetype || "").toLowerCase().startsWith("image/"))) {
    return res.status(400).json({ message: `Photos must be images up to 10MB each (maximum ${MAX_IMAGES}).` });
  }

  try {
    const [face, extraction] = await Promise.all([bestFace(images), extractAttributes(images)]);
    const prefill = cleanDetails(extraction.status === "ok" ? extraction.attributes : {});
    if (!prefill.foundLocation) prefill.foundLocation = text(req.body?.foundLocation, 500);
    if (!prefill.foundDate) prefill.foundDate = cleanDetails({ foundDate: req.body?.foundDate }).foundDate;

    await connectDb();
    const scanId = new mongoose.Types.ObjectId();
    let photos = [];
    try {
      photos = await savePhotos(scanId, images);
    } catch (error) {
      console.error("Victim scan photo storage failed; continuing without stored photos", error?.message);
    }
    const scan = await VictimIdentificationScan.create({
      _id: scanId,
      officerUserId: req.userId,
      status: "draft",
      imageCount: images.length,
      photos,
      face: {
        status: face.status,
        embedding: face.embedding,
        imageIndex: face.imageIndex,
        faceCount: face.faceCount,
        quality: face.quality,
        estimatedAge: face.estimatedAge,
        estimatedSex: face.estimatedSex,
        model: face.model,
        error: face.error,
      },
      extraction: {
        status: extraction.status,
        model: extraction.model,
        error: extraction.error,
        attributes: extraction.attributes,
      },
      details: prefill,
    });
    await audit(req, scan._id, "scan_created", { note: `${images.length} photo(s), ${photos.length} stored` });
    return res.status(201).json({ scan: payload(scan.toObject()) });
  } catch (error) {
    console.error("Victim identification draft error", error);
    return res.status(500).json({ message: `Photo analysis failed: ${error?.message || "unknown error"}` });
  }
}

/* ------------------------------------------------------------------ */
/* Step 2: officer-confirmed details -> matching                       */
/* ------------------------------------------------------------------ */

async function submitScan(req, res) {
  const { id } = req.params || {};
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid scan id." });
  }
  const details = cleanDetails(req.body?.details || {});
  if (!details.foundLocation) {
    return res.status(400).json({ message: "Where the person was found is required." });
  }

  try {
    await connectDb();
    const scan = await VictimIdentificationScan.findOne({ _id: id, officerUserId: req.userId })
      .select("+face.embedding")
      .exec();
    if (!scan) return res.status(404).json({ message: "Scan not found." });
    if (scan.status !== "draft") return res.status(409).json({ message: "This scan has already been submitted." });

    const optionalInfo = optionalInfoFromDetails(details);
    // Every record is compared; only the fields matching needs are loaded.
    const candidates = await MissingPerson.find({})
      .select("fullName age gender lastSeenLocation location dateMissing description identifyingFeatures photoUrl face.status +face.embedding textIndex.status +textIndex.items")
      .lean()
      .exec();
    const foundPoint = details.foundLocation
      ? (await geocodeToPointSriLanka(details.foundLocation).catch(() => null))?.coordinates || null
      : null;
    const queryEmbedding = scan.face?.status === "ok" ? scan.face.embedding : null;
    const result = await rankCandidates({ faceEmbedding: queryEmbedding, details, foundPoint }, candidates);

    scan.details = details;
    scan.detailsConfirmedAt = new Date();
    scan.optionalInfo = optionalInfo;
    scan.foundPoint = foundPoint || undefined;
    scan.status = "completed";
    scan.candidateCount = candidates.length;
    scan.serviceMessage = result.message.slice(0, 500);
    scan.analysisStats = { ...result.stats, foundLocationGeocoded: Boolean(foundPoint) };
    scan.matches = result.matches.map((match) => ({
      ...match,
      evidence: match.evidence.map((e) => ({ ...e, label: e.label.slice(0, 200), detail: String(e.detail || "").slice(0, 500) })),
    }));
    scan.completedAt = new Date();
    await scan.save();
    await audit(req, scan._id, "details_confirmed", { note: `${scan.matches.length} suggestion(s)` });

    const peopleById = new Map(candidates.map((person) => [String(person._id), person]));
    return res.json({ scan: payload(scan.toObject(), peopleById) });
  } catch (error) {
    console.error("Victim identification scan error", error);
    return res.status(500).json({ message: `Victim identification matching failed: ${error?.message || "unknown error"}` });
  }
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

async function scansWithPeople(filter, limit, populateOfficer) {
  await connectDb();
  let query = VictimIdentificationScan.find({ ...filter, status: { $ne: "draft" } }).sort({ createdAt: -1 }).limit(limit);
  if (populateOfficer) query = query.populate("officerUserId", "name email district");
  const rows = await query.lean().exec();
  const ids = rows.flatMap((row) => (row.matches || []).map((match) => match.personId));
  const people = await MissingPerson.find({ _id: { $in: ids } }).lean().exec();
  return { rows, peopleById: new Map(people.map((person) => [String(person._id), person])) };
}

async function listMyScans(req, res) {
  try {
    const { rows, peopleById } = await scansWithPeople({ officerUserId: req.userId }, 100, false);
    return res.json({ scans: rows.map((row) => payload(row, peopleById)) });
  } catch (error) {
    console.error("Victim identification scan history error", error);
    return res.status(500).json({ message: "Failed to load identification history." });
  }
}

async function listAllScans(req, res) {
  try {
    const { rows, peopleById } = await scansWithPeople({}, 500, true);
    return res.json({
      scans: rows.map((row) => ({ ...payload(row, peopleById), officer: row.officerUserId ? {
        name: row.officerUserId.name || "",
        email: row.officerUserId.email || "",
        district: row.officerUserId.district || "",
      } : null })),
    });
  } catch (error) {
    console.error("Admin victim identification scan history error", error);
    return res.status(500).json({ message: "Failed to load identification analysis." });
  }
}

/* ------------------------------------------------------------------ */
/* Photos (encrypted on disk; admins and the scanning officer only)    */
/* ------------------------------------------------------------------ */

async function getScanPhoto(req, res) {
  const { id, index } = req.params || {};
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid scan id." });
  try {
    await connectDb();
    const scan = await VictimIdentificationScan.findById(id).select("officerUserId photos").lean().exec();
    if (!scan) return res.status(404).json({ message: "Scan not found." });
    if (!isAdmin(req) && String(scan.officerUserId) !== String(req.userId)) {
      return res.status(403).json({ message: "Only admins and the officer who made this scan can view its photos." });
    }
    if (!(scan.photos || []).some((photo) => photo.index === Number(index))) {
      return res.status(404).json({ message: "Photo not available (deleted or never stored)." });
    }
    const photo = await readPhoto(id, index);
    if (!photo) return res.status(404).json({ message: "Photo not available." });
    await audit(req, scan._id, "photo_viewed", { note: `photo ${Number(index) + 1}` });
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "Content-Length": photo.length });
    return res.send(photo);
  } catch (error) {
    console.error("Victim scan photo read error", error);
    return res.status(500).json({ message: "Could not read the photo." });
  }
}

/* ------------------------------------------------------------------ */
/* Admin review                                                        */
/* ------------------------------------------------------------------ */

async function loadReview(id) {
  const scan = await VictimIdentificationScan.findById(id).populate("officerUserId", "name email district").lean().exec();
  if (!scan) return null;
  const ids = (scan.matches || []).map((match) => match.personId);
  const people = await MissingPerson.find({ _id: { $in: ids } }).lean().exec();
  const auditLog = await VictimScanAudit.find({ scanId: scan._id }).sort({ createdAt: -1 }).limit(200).lean().exec();
  return {
    ...payload(scan, new Map(people.map((person) => [String(person._id), person]))),
    officer: scan.officerUserId ? {
      name: scan.officerUserId.name || "",
      email: scan.officerUserId.email || "",
      district: scan.officerUserId.district || "",
    } : null,
    auditLog: auditLog.map((entry) => ({
      action: entry.action,
      userEmail: entry.userEmail || entry.userId,
      personId: entry.personId ? String(entry.personId) : null,
      note: entry.note,
      at: entry.createdAt,
    })),
  };
}

async function getScanForReview(req, res) {
  const { id } = req.params || {};
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid scan id." });
  try {
    await connectDb();
    const scan = await loadReview(id);
    if (!scan) return res.status(404).json({ message: "Scan not found." });
    // Opening the review marks reverse-matching suggestions as seen.
    if (scan.newMatchCount) await VictimIdentificationScan.updateOne({ _id: id }, { $set: { newMatchCount: 0 } }).exec();
    return res.json({ scan });
  } catch (error) {
    console.error("Victim scan review load error", error);
    return res.status(500).json({ message: "Failed to load the scan." });
  }
}

const DECISION_ACTIONS = {
  confirmed: "match_confirmed",
  rejected: "match_rejected",
  needs_verification: "match_needs_verification",
  pending: "match_reset",
};

async function decideMatch(req, res) {
  const { id, personId } = req.params || {};
  const decision = String(req.body?.decision || "");
  const note = text(req.body?.note, 1000);
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(personId)) {
    return res.status(400).json({ message: "Invalid id." });
  }
  if (!DECISION_ACTIONS[decision]) {
    return res.status(400).json({ message: "Decision must be confirmed, rejected, needs_verification or pending." });
  }
  if (decision === "confirmed" && !note) {
    return res.status(400).json({ message: "Record how the identity was verified (for example DNA, fingerprints, family viewing) before confirming." });
  }
  try {
    await connectDb();
    const scan = await VictimIdentificationScan.findById(id).exec();
    if (!scan) return res.status(404).json({ message: "Scan not found." });
    if (scan.status !== "completed") return res.status(409).json({ message: "Only completed scans can be reviewed." });
    if (scan.caseStatus === "closed") return res.status(409).json({ message: "This case is closed." });
    const match = scan.matches.find((m) => String(m.personId) === String(personId));
    if (!match) return res.status(404).json({ message: "That record is not among this scan's suggestions." });
    const otherConfirmed = scan.matches.find((m) => m !== match && m.decision?.status === "confirmed");
    if (decision === "confirmed" && otherConfirmed) {
      return res.status(409).json({ message: "Another record is already confirmed for this scan. Change that decision first." });
    }

    const wasConfirmed = match.decision?.status === "confirmed";
    match.decision = { status: decision, note, byUserId: String(req.userId), byEmail: String(req.authEmail || ""), at: new Date() };
    if (decision === "confirmed") {
      scan.caseStatus = "identified";
      scan.identifiedPersonId = match.personId;
    } else if (wasConfirmed) {
      scan.caseStatus = "open";
      scan.identifiedPersonId = null;
    }
    await scan.save();
    await audit(req, scan._id, DECISION_ACTIONS[decision], { personId: match.personId, note });
    return res.json({ scan: await loadReview(id) });
  } catch (error) {
    console.error("Victim scan decision error", error);
    return res.status(500).json({ message: "Failed to save the decision." });
  }
}

async function removePhotos(scan, req, reason) {
  if (!(scan.photos || []).length) return;
  await deletePhotos(scan._id);
  scan.photos = [];
  scan.photosDeletedAt = new Date();
  await audit(req, scan._id, "photos_deleted", { note: reason });
}

/**
 * Permanently delete a scan: its record (details, face encoding, suggestions,
 * decisions), its encrypted photos and its activity log. One minimal entry is
 * kept so there is a trace that a case existed and who deleted it; it holds
 * no photos or personal details.
 */
async function deleteScanCompletely(scan, req, note) {
  await deletePhotos(scan._id);
  await VictimScanAudit.deleteMany({ scanId: scan._id }).exec();
  await VictimIdentificationScan.deleteOne({ _id: scan._id }).exec();
  await audit(req, scan._id, "case_deleted", { note });
}

async function deleteCase(req, res) {
  const { id } = req.params || {};
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid scan id." });
  try {
    await connectDb();
    const scan = await VictimIdentificationScan.findById(id).select("_id").exec();
    if (!scan) return res.status(404).json({ message: "Scan not found." });
    await deleteScanCompletely(scan, req, text(req.body?.note, 1000));
    return res.json({ deleted: true });
  } catch (error) {
    console.error("Victim scan delete error", error);
    return res.status(500).json({ message: "Failed to delete the case." });
  }
}

/* ------------------------------------------------------------------ */
/* Retention: delete photos that are no longer needed                  */
/* ------------------------------------------------------------------ */

const RETENTION_DAYS = Number(process.env.SCAN_PHOTO_RETENTION_DAYS) || 90;
const SYSTEM = { userId: "system", authEmail: "retention policy" };

/**
 * Drafts abandoned for over a day are deleted completely (never submitted).
 * Submitted scans past the retention period lose their photos; the record
 * stays until an admin deletes the case.
 */
async function purgeExpiredScanPhotos() {
  await connectDb();
  const now = Date.now();
  const drafts = await VictimIdentificationScan.find({ status: "draft", createdAt: { $lt: new Date(now - 24 * 3600 * 1000) } })
    .select("_id")
    .exec();
  for (const draft of drafts) await deleteScanCompletely(draft, SYSTEM, "draft abandoned for over a day");

  const expired = await VictimIdentificationScan.find({
    status: { $ne: "draft" },
    "photos.0": { $exists: true },
    createdAt: { $lt: new Date(now - RETENTION_DAYS * 24 * 3600 * 1000) },
  }).exec();
  for (const scan of expired) {
    await removePhotos(scan, SYSTEM, `older than ${RETENTION_DAYS} days`);
    await scan.save();
  }
  return drafts.length + expired.length;
}

module.exports = {
  createScan,
  submitScan,
  listMyScans,
  listAllScans,
  getScanPhoto,
  getScanForReview,
  decideMatch,
  deleteCase,
  purgeExpiredScanPhotos,
};
