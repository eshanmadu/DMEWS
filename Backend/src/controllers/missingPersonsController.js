const { connectDb } = require("../db");
const mongoose = require("mongoose");
const { MissingPerson } = require("../models/MissingPerson");
const { FoundPerson } = require("../models/FoundPerson");
const {
  uploadBuffer,
  isCloudinaryConfigured,
  destroyPublicId,
} = require("../services/cloudinaryUpload");

function todayYMD() {
  return new Date().toISOString().slice(0, 10);
}

function parseYMD(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const parsed = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function optionalSubmitterObjectId(req) {
  if (!req.userId || req.isDevAdmin || req.userId === "dev-admin-session") {
    return null;
  }
  if (!mongoose.Types.ObjectId.isValid(req.userId)) return null;
  return new mongoose.Types.ObjectId(req.userId);
}

function normalizeMissing(o) {
  return {
    id: o._id ? String(o._id) : "",
    fullName: o.fullName || "",
    age: o.age,
    gender: o.gender || "",
    lastSeenLocation: o.lastSeenLocation || "",
    dateMissing: o.dateMissing,
    description: o.description || "",
    contactInfo: o.contactInfo || "",
    photoUrl: o.photoUrl || "",
    submittedByUserId: o.submittedByUserId ? String(o.submittedByUserId) : null,
    createdAt: o.createdAt,
  };
}

function normalizeFound(o) {
  return {
    id: o._id ? String(o._id) : "",
    name: o.name || "Unknown",
    age: o.age != null ? o.age : null,
    locationFound: o.locationFound || "",
    dateFound: o.dateFound,
    description: o.description || "",
    contactInfo: o.contactInfo || "",
    photoUrl: o.photoUrl || "",
    submittedByUserId: o.submittedByUserId ? String(o.submittedByUserId) : null,
    createdAt: o.createdAt,
  };
}

async function listPersonReports(_req, res) {
  try {
    await connectDb();
    const [missing, found] = await Promise.all([
      MissingPerson.find().sort({ createdAt: -1 }).limit(500).lean().exec(),
      FoundPerson.find().sort({ createdAt: -1 }).limit(500).lean().exec(),
    ]);
    return res.json({
      missing: missing.map(normalizeMissing),
      found: found.map(normalizeFound),
    });
  } catch (error) {
    console.error("Missing persons list error", error);
    return res.status(500).json({ message: "Failed to load reports." });
  }
}

async function uploadPhotoIfPresent(req, folder) {
  if (!req.file) {
    return { photoUrl: "", photoPublicId: "" };
  }
  if (!String(req.file.mimetype || "").toLowerCase().startsWith("image/")) {
    const err = new Error("INVALID_IMAGE");
    err.statusCode = 400;
    throw err;
  }
  if (!isCloudinaryConfigured()) {
    const err = new Error("CLOUDINARY_NOT_CONFIGURED");
    err.statusCode = 503;
    throw err;
  }
  const uploaded = await uploadBuffer(req.file.buffer, req.file.mimetype, {
    folder,
  });
  return { photoUrl: uploaded.url || "", photoPublicId: uploaded.publicId || "" };
}

async function createMissingReport(req, res) {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const ageRaw = String(req.body?.age ?? "").trim();
    const gender = String(req.body?.gender || "").trim();
    const lastSeenLocation = String(req.body?.lastSeenLocation || "").trim();
    const dateMissingRaw = String(req.body?.dateMissing || "").trim();
    const description = String(req.body?.description || "").trim();
    const contactInfo = String(req.body?.contactInfo || "").trim();

    if (!fullName) {
      return res.status(400).json({ message: "fullName is required." });
    }
    const age = parseInt(ageRaw, 10);
    if (!Number.isFinite(age) || age < 0 || age > 120) {
      return res.status(400).json({ message: "age must be 0–120." });
    }
    if (!lastSeenLocation) {
      return res.status(400).json({ message: "lastSeenLocation is required." });
    }
    if (!dateMissingRaw) {
      return res.status(400).json({ message: "dateMissing is required." });
    }
    const dateMissing = parseYMD(dateMissingRaw);
    if (!dateMissing) {
      return res.status(400).json({ message: "Invalid dateMissing format." });
    }
    if (dateMissingRaw > todayYMD()) {
      return res.status(400).json({ message: "dateMissing cannot be in the future." });
    }
    if (!description) {
      return res.status(400).json({ message: "description is required." });
    }

    let photoUrl = "";
    let photoPublicId = "";
    try {
      const up = await uploadPhotoIfPresent(req, "dmews/missing-persons");
      photoUrl = up.photoUrl;
      photoPublicId = up.photoPublicId;
    } catch (e) {
      if (e?.statusCode === 503) {
        return res.status(503).json({
          message:
            "Photo upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET on the backend.",
        });
      }
      if (e?.statusCode === 400) {
        return res.status(400).json({ message: "Only image uploads are allowed." });
      }
      throw e;
    }

    await connectDb();
    const doc = await MissingPerson.create({
      fullName: fullName.slice(0, 200),
      age,
      gender: gender.slice(0, 40),
      lastSeenLocation: lastSeenLocation.slice(0, 500),
      dateMissing,
      description: description.slice(0, 4000),
      contactInfo: contactInfo.slice(0, 500),
      photoUrl,
      photoPublicId,
      submittedByUserId: optionalSubmitterObjectId(req),
    });

    return res.status(201).json({ person: normalizeMissing(doc.toObject()) });
  } catch (error) {
    console.error("Create missing person error", error);
    return res.status(500).json({ message: "Failed to submit report." });
  }
}

async function createFoundReport(req, res) {
  try {
    const nameRaw = String(req.body?.name || "").trim();
    const name = nameRaw || "Unknown";
    const ageRaw = String(req.body?.age ?? "").trim();
    const locationFound = String(req.body?.locationFound || "").trim();
    const dateFoundRaw = String(req.body?.dateFound || "").trim();
    const description = String(req.body?.description || "").trim();
    const contactInfo = String(req.body?.contactInfo || "").trim();

    let age = null;
    if (ageRaw) {
      const n = parseInt(ageRaw, 10);
      if (!Number.isFinite(n) || n < 0 || n > 120) {
        return res.status(400).json({ message: "age must be 0–120." });
      }
      age = n;
    }

    if (!locationFound) {
      return res.status(400).json({ message: "locationFound is required." });
    }
    if (!dateFoundRaw) {
      return res.status(400).json({ message: "dateFound is required." });
    }
    const dateFound = parseYMD(dateFoundRaw);
    if (!dateFound) {
      return res.status(400).json({ message: "Invalid dateFound format." });
    }
    if (dateFoundRaw > todayYMD()) {
      return res.status(400).json({ message: "dateFound cannot be in the future." });
    }
    if (!description) {
      return res.status(400).json({ message: "description is required." });
    }

    let photoUrl = "";
    let photoPublicId = "";
    try {
      const up = await uploadPhotoIfPresent(req, "dmews/found-persons");
      photoUrl = up.photoUrl;
      photoPublicId = up.photoPublicId;
    } catch (e) {
      if (e?.statusCode === 503) {
        return res.status(503).json({
          message:
            "Photo upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET on the backend.",
        });
      }
      if (e?.statusCode === 400) {
        return res.status(400).json({ message: "Only image uploads are allowed." });
      }
      throw e;
    }

    await connectDb();
    const doc = await FoundPerson.create({
      name: name.slice(0, 200),
      age,
      locationFound: locationFound.slice(0, 500),
      dateFound,
      description: description.slice(0, 4000),
      contactInfo: contactInfo.slice(0, 500),
      photoUrl,
      photoPublicId,
      submittedByUserId: optionalSubmitterObjectId(req),
    });

    return res.status(201).json({ person: normalizeFound(doc.toObject()) });
  } catch (error) {
    console.error("Create found person error", error);
    return res.status(500).json({ message: "Failed to submit report." });
  }
}

async function deleteMissingReport(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message: "Dev admin shortcut cannot delete person reports.",
      });
    }

    const { id } = req.params || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id." });
    }

    await connectDb();
    const doc = await MissingPerson.findById(id).exec();
    if (!doc) {
      return res.status(404).json({ message: "Report not found." });
    }
    if (!doc.submittedByUserId || String(doc.submittedByUserId) !== String(req.userId)) {
      return res.status(403).json({
        message: "You can only delete reports you submitted while signed in.",
      });
    }

    const publicId = doc.photoPublicId;
    await doc.deleteOne();
    await destroyPublicId(publicId);

    return res.json({ message: "Report deleted." });
  } catch (error) {
    console.error("Delete missing person error", error);
    return res.status(500).json({ message: "Failed to delete report." });
  }
}

async function deleteFoundReport(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message: "Dev admin shortcut cannot delete person reports.",
      });
    }

    const { id } = req.params || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id." });
    }

    await connectDb();
    const doc = await FoundPerson.findById(id).exec();
    if (!doc) {
      return res.status(404).json({ message: "Report not found." });
    }
    if (!doc.submittedByUserId || String(doc.submittedByUserId) !== String(req.userId)) {
      return res.status(403).json({
        message: "You can only delete reports you submitted while signed in.",
      });
    }

    const publicId = doc.photoPublicId;
    await doc.deleteOne();
    await destroyPublicId(publicId);

    return res.json({ message: "Report deleted." });
  } catch (error) {
    console.error("Delete found person error", error);
    return res.status(500).json({ message: "Failed to delete report." });
  }
}

module.exports = {
  listPersonReports,
  createMissingReport,
  createFoundReport,
  deleteMissingReport,
  deleteFoundReport,
};
