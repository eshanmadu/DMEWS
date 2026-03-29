const { connectDb } = require("../db");
const mongoose = require("mongoose");
const { MOCK_INCIDENTS } = require("../data");
const { User } = require("../models/User");
const { IncidentReport } = require("../models/IncidentReport");
const { uploadBuffer, isCloudinaryConfigured } = require("../services/cloudinaryUpload");

function normalizeUserIncident(doc) {
  const o = doc?.toObject ? doc.toObject() : doc;
  return {
    id: o._id ? String(o._id) : "",
    source: "user",
    type: "user_report",
    status: o.status || "reported",
    title: o.title || "",
    description: o.description || "",
    district: o.district || o.userSnapshot?.district || "",
    area: o.district || o.userSnapshot?.district || "",
    media: Array.isArray(o.media) ? o.media : [],
    reporter: {
      id: o.userId ? String(o.userId) : "",
      name: o.userSnapshot?.name || "",
      email: o.userSnapshot?.email || "",
      mobile: o.userSnapshot?.mobile || "",
      avatar: o.userSnapshot?.avatar || "",
    },
    reportedAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function getIncidents(req, res) {
  try {
    await connectDb();
    const district = req.query?.district ? String(req.query.district).trim() : "";

    const q = district ? { district } : {};
    const userIncidents = await IncidentReport.find(q)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec();

    const merged = [
      ...(Array.isArray(MOCK_INCIDENTS) ? MOCK_INCIDENTS : []),
      ...userIncidents.map((d) => normalizeUserIncident(d)),
    ].sort(
      (a, b) =>
        new Date(b?.updatedAt || b?.reportedAt || 0).getTime() -
        new Date(a?.updatedAt || a?.reportedAt || 0).getTime()
    );

    return res.json(merged);
  } catch (error) {
    console.error("Incidents list error", error);
    return res.status(500).json({ message: "Failed to load incidents." });
  }
}

async function createUserIncident(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message: "Dev admin shortcut cannot create incidents. Use a normal account.",
      });
    }

    const district = String(req.body?.district || "").trim();
    const title = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();

    if (!district || !title || !description) {
      return res.status(400).json({
        message: "district, title and description are required.",
      });
    }

    await connectDb();
    const user = await User.findById(req.userId).lean().exec();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    let media = [];
    if (req.file) {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          message:
            "Media upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET on the backend.",
        });
      }
      const uploaded = await uploadBuffer(req.file.buffer, req.file.mimetype);
      media = [uploaded];
    }

    const doc = await IncidentReport.create({
      userId: user._id,
      userSnapshot: {
        name: user.name || "",
        email: user.email || "",
        district: user.district || "",
        mobile: user.mobile || "",
        avatar: user.avatar || "",
      },
      district,
      title: title.slice(0, 120),
      description: description.slice(0, 2000),
      media,
      status: "reported",
    });

    return res.status(201).json({ incident: normalizeUserIncident(doc) });
  } catch (error) {
    console.error("Incidents create error", error);
    return res.status(500).json({ message: "Failed to report incident." });
  }
}

// In incident controller

async function updateUserIncident(req, res) {
  try {
    // Dev admin shortcut check
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message: "Dev admin shortcut cannot update incidents.",
      });
    }

    const { id } = req.params || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid incident id." });
    }

    await connectDb();

    const incident = await IncidentReport.findById(id).exec();
    if (!incident) {
      return res.status(404).json({ message: "Incident not found." });
    }

    // Check ownership
    if (String(incident.userId) !== String(req.userId)) {
      return res.status(403).json({ message: "You can only update your own incidents." });
    }

    // Validate and update fields
    const title = req.body?.title ? String(req.body.title).trim() : null;
    const description = req.body?.description ? String(req.body.description).trim() : null;

    if (title !== null && title.length === 0) {
      return res.status(400).json({ message: "Title cannot be empty." });
    }
    if (description !== null && description.length === 0) {
      return res.status(400).json({ message: "Description cannot be empty." });
    }

    if (title) incident.title = title.slice(0, 120);
    if (description) incident.description = description.slice(0, 2000);

    // Handle optional media replacement
    if (req.file) {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          message: "Media upload is not configured.",
        });
      }
      const uploaded = await uploadBuffer(req.file.buffer, req.file.mimetype);
      incident.media = [uploaded]; // Replace existing media
    }

    incident.updatedAt = new Date();
    await incident.save();

    return res.json({ incident: normalizeUserIncident(incident) });
  } catch (error) {
    console.error("Incidents update error", error);
    return res.status(500).json({ message: "Failed to update incident." });
  }
}

async function deleteUserIncident(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message: "Dev admin shortcut cannot delete incidents.",
      });
    }

    const { id } = req.params || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid incident id." });
    }

    await connectDb();
    const doc = await IncidentReport.findById(id).exec();
    if (!doc) {
      return res.status(404).json({ message: "Incident not found." });
    }

    if (String(doc.userId) !== String(req.userId)) {
      return res.status(403).json({ message: "You can only delete your own incidents." });
    }

    await doc.deleteOne();
    return res.json({ message: "Incident deleted." });
  } catch (error) {
    console.error("Incidents delete error", error);
    return res.status(500).json({ message: "Failed to delete incident." });
  }
}

module.exports = {
  getIncidents,
  createUserIncident,
  updateUserIncident,
  deleteUserIncident,
};

