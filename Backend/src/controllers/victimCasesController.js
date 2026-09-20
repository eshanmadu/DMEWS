const { connectDb } = require("../db");
const { VictimCase } = require("../models/VictimCase");
const { VictimCaseCounter } = require("../models/VictimCaseCounter");
const { uploadDocumentBuffer } = require("../services/cloudinaryUpload");

function casePayload(row) {
  return {
    id: row._id.toString(),
    caseId: row.caseId,
    location: row.location,
    date: row.caseDate,
    status: row.status,
    evidenceUrl: row.evidenceUrl,
    evidenceFormat: row.evidenceFormat || "",
    createdAt: row.createdAt,
  };
}

async function nextCaseId() {
  const counter = await VictimCaseCounter.findOneAndUpdate(
    { name: "victim-cases" },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();
  return `DMEWS-VIC-${String(counter.sequence).padStart(5, "0")}`;
}

async function createCase(req, res) {
  try {
    const location = String(req.body?.location || "").trim();
    const dateRaw = String(req.body?.date || "").trim();
    if (!location || !dateRaw || !req.file) {
      return res.status(400).json({ message: "Location, date, and evidence are required." });
    }
    const caseDate = new Date(`${dateRaw}T00:00:00.000Z`);
    if (Number.isNaN(caseDate.getTime()) || caseDate > new Date()) {
      return res.status(400).json({ message: "Please provide a valid case date that is not in the future." });
    }

    await connectDb();
    const uploaded = await require("../services/cloudinaryUpload").uploadDocumentBuffer(
      req.file.buffer,
      { folder: "dmews/victim-cases" }
    );
    const created = await VictimCase.create({
      caseId: await nextCaseId(),
      ownerUserId: req.userId,
      location,
      caseDate,
      status: "Under Investigation",
      evidenceUrl: uploaded.url,
      evidencePublicId: uploaded.publicId,
      evidenceFormat: uploaded.format || req.file.mimetype,
    });
    return res.status(201).json({ case: casePayload(created) });
  } catch (error) {
    console.error("Victim case create error", error);
    return res.status(500).json({ message: "Failed to upload victim case." });
  }
}

async function listMyCases(req, res) {
  try {
    await connectDb();
    const rows = await VictimCase.find({ ownerUserId: req.userId }).sort({ createdAt: -1 }).lean().exec();
    return res.json({ cases: rows.map(casePayload) });
  } catch (error) {
    console.error("Victim case list error", error);
    return res.status(500).json({ message: "Failed to load your victim cases." });
  }
}

module.exports = { createCase, listMyCases };