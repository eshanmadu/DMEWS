const { connectDb } = require("../db");
const { MissingPerson } = require("../models/MissingPerson");
const { VictimIdentificationScan } = require("../models/VictimIdentificationScan");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function payload(row, peopleById = new Map()) {
  return {
    id: row._id.toString(),
    status: row.status,
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
        confidence: match.confidence,
        metadataScore: match.metadataScore,
        reason: match.reason,
        person: person ? {
          id: person._id.toString(),
          fullName: person.fullName,
          age: person.age,
          gender: person.gender,
          lastSeenLocation: person.lastSeenLocation,
          dateMissing: person.dateMissing,
          description: person.description,
          photoUrl: person.photoUrl || "",
        } : null,
      };
    }),
  };
}

function cleanOptionalInfo(body) {
  const ageRaw = body?.age === undefined || body?.age === "" ? null : Number(body.age);
  return {
    location: String(body?.location || "").trim(),
    age: Number.isFinite(ageRaw) && ageRaw >= 0 && ageRaw <= 120 ? ageRaw : null,
    gender: String(body?.gender || "").trim(),
    notes: String(body?.notes || "").trim(),
  };
}

async function callRecognitionService(file, optionalInfo, candidates) {
  const serviceUrl = String(process.env.FACE_RECOGNITION_URL || "").replace(/\/+$/, "");
  if (!serviceUrl) {
    return { status: "unavailable", matches: [], message: "Facial recognition service is not configured." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${serviceUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        imageBase64: file.buffer.toString("base64"),
        imageMimeType: file.mimetype,
        optionalInfo,
        candidates: candidates.map((person) => ({
          id: person._id.toString(),
          fullName: person.fullName,
          age: person.age,
          gender: person.gender,
          lastSeenLocation: person.lastSeenLocation,
          photoUrl: person.photoUrl || "",
        })),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Recognition service returned ${response.status}.`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function createScan(req, res) {
  if (!req.file || req.file.size > MAX_IMAGE_BYTES || !String(req.file.mimetype || "").toLowerCase().startsWith("image/")) {
    return res.status(400).json({ message: "A face image up to 10MB is required." });
  }

  const optionalInfo = cleanOptionalInfo(req.body);
  try {
    await connectDb();
    const candidates = await MissingPerson.find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec();
    const result = await callRecognitionService(req.file, optionalInfo, candidates);
    const matches = Array.isArray(result.matches) ? result.matches.slice(0, 10) : [];
    const scan = await VictimIdentificationScan.create({
      officerUserId: req.userId,
      status: result.status === "completed" ? "completed" : "unavailable",
      optionalInfo,
      candidateCount: candidates.length,
      serviceMessage: String(result.message || "").slice(0, 500),
      analysisStats: result.referenceStats || {},
      matches: matches.map((match) => ({
        personId: match.personId,
        matchType: match.matchType === "face" ? "face" : "metadata",
        confidence: match.confidence == null ? null : Number(match.confidence),
        metadataScore: Number(match.metadataScore) || 0,
        reason: String(match.reason || "").slice(0, 500),
      })),
      completedAt: new Date(),
    });
    const peopleById = new Map(candidates.map((person) => [String(person._id), person]));
    return res.status(201).json({ scan: payload(scan, peopleById) });
  } catch (error) {
    console.error("Victim identification scan error", error);
    return res.status(502).json({
      message: error?.name === "AbortError"
        ? "Victim identification analysis timed out."
        : `Victim identification analysis failed: ${error?.message || "unknown service error"}`,
    });
  }
}

async function listMyScans(req, res) {
  try {
    await connectDb();
    const rows = await VictimIdentificationScan.find({ officerUserId: req.userId }).sort({ createdAt: -1 }).limit(100).lean().exec();
    const ids = rows.flatMap((row) => (row.matches || []).map((match) => match.personId));
    const people = await MissingPerson.find({ _id: { $in: ids } }).lean().exec();
    const peopleById = new Map(people.map((person) => [String(person._id), person]));
    return res.json({ scans: rows.map((row) => payload(row, peopleById)) });
  } catch (error) {
    console.error("Victim identification scan history error", error);
    return res.status(500).json({ message: "Failed to load identification history." });
  }
}

async function listAllScans(req, res) {
  try {
    await connectDb();
    const rows = await VictimIdentificationScan.find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .populate("officerUserId", "name email district")
      .lean()
      .exec();
    const ids = rows.flatMap((row) => (row.matches || []).map((match) => match.personId));
    const people = await MissingPerson.find({ _id: { $in: ids } }).lean().exec();
    const peopleById = new Map(people.map((person) => [String(person._id), person]));
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

module.exports = { createScan, listMyScans, listAllScans };
