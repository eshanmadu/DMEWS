const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { User } = require("../models/User");
const { VictimAccessRequest } = require("../models/VictimAccessRequest");
const { uploadDocumentBuffer } = require("../services/cloudinaryUpload");

function payload(row) {
  return {
    id: row._id.toString(),
    status: row.status,
    requestedRole: row.requestedRole,
    organization: row.organization,
    employeeId: row.employeeId,
    documentUrl: row.documentUrl,
    documentFormat: row.documentFormat || "",
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy || "",
  };
}

async function submit(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") return res.status(403).json({ message: "A normal user account is required." });
    const requestedRole = String(req.body?.requestedRole || "").trim();
    const organization = String(req.body?.organization || "").trim();
    const employeeId = String(req.body?.employeeId || "").trim();
    if (!requestedRole || !organization || !employeeId || !req.file) {
      return res.status(400).json({ message: "Role, organization, employee ID, and a verification document are required." });
    }
    await connectDb();
    const existing = await VictimAccessRequest.findOne({ userId: req.userId }).exec();
    if (existing?.status === "approved") return res.status(400).json({ message: "Victim identification access is already approved." });
    const uploaded = await uploadDocumentBuffer(req.file.buffer);
    const row = existing || new VictimAccessRequest({ userId: req.userId });
    row.requestedRole = requestedRole;
    row.organization = organization;
    row.employeeId = employeeId;
    row.documentUrl = uploaded.url;
    row.documentPublicId = uploaded.publicId;
    row.documentFormat = uploaded.format || req.file.mimetype;
    row.status = "pending";
    row.reviewedAt = undefined;
    row.reviewedBy = "";
    await row.save();
    return res.status(existing ? 200 : 201).json({ request: payload(row) });
  } catch (error) {
    console.error("Victim access request error", error);
    return res.status(500).json({ message: "Failed to submit victim identification request." });
  }
}

async function me(req, res) {
  try {
    await connectDb();
    const row = await VictimAccessRequest.findOne({ userId: req.userId }).lean().exec();
    return res.json({ request: row ? payload(row) : null });
  } catch (error) {
    console.error("Victim access request status error", error);
    return res.status(500).json({ message: "Failed to load access request." });
  }
}

async function adminList(req, res) {
  try {
    await connectDb();
    const rows = await VictimAccessRequest.find({}).sort({ createdAt: -1 }).populate("userId", "name email district mobile").lean().exec();
    return res.json(rows.map((row) => ({ ...payload(row), user: row.userId ? {
      id: row.userId._id.toString(), name: row.userId.name || "", email: row.userId.email || "", district: row.userId.district || "", mobile: row.userId.mobile || "",
    } : null })));
  } catch (error) {
    console.error("Victim access admin list error", error);
    return res.status(500).json({ message: "Failed to load victim identification requests." });
  }
}

async function adminSetStatus(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid request id." });
    const status = String(req.body?.status || "");
    if (!["pending", "approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status." });
    await connectDb();
    const row = await VictimAccessRequest.findById(req.params.id).exec();
    if (!row) return res.status(404).json({ message: "Access request not found." });
    row.status = status;
    row.reviewedAt = new Date();
    row.reviewedBy = String(req.authEmail || "").trim();
    await row.save();
    return res.json({ id: row._id.toString(), status: row.status, reviewedAt: row.reviewedAt, reviewedBy: row.reviewedBy });
  } catch (error) {
    console.error("Victim access admin status error", error);
    return res.status(500).json({ message: "Failed to update access request." });
  }
}

module.exports = { submit, me, adminList, adminSetStatus };