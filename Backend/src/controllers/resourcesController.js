const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { ResourceProgram } = require("../models/ResourceProgram");
const { ResourceParticipation } = require("../models/ResourceParticipation");

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function tenDigits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 12 && digits.startsWith("94")) return true;
  return false;
}

function dateOnlyPast(isoDateLike) {
  const raw = String(isoDateLike || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const input = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(input.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return input < today;
}

function dateOutsideNext30Days(isoDateLike) {
  const raw = String(isoDateLike || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const input = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(input.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setDate(max.getDate() + 30);
  return input > max;
}

function normalizeProgram(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name || "",
    target: doc.target || "",
    date: doc.date || "",
    location: doc.location || "",
    resourceFocus: Array.isArray(doc.resourceFocus) ? doc.resourceFocus : [],
    status: doc.status || "active",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normalizeParticipation(doc) {
  return {
    id: doc._id.toString(),
    userId: String(doc.userId || ""),
    name: doc.name || "",
    email: doc.email || "",
    phone: doc.phone || "",
    district: doc.district || "",
    resourceType: doc.resourceType || "",
    quantity: Number(doc.quantity || 0),
    availableDate: doc.availableDate,
    canTransport: Boolean(doc.canTransport),
    deliveryMode: doc.deliveryMode || "self-drop",
    pickupAddress: doc.pickupAddress || "",
    notes: doc.notes || "",
    status: doc.status || "pending",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function listPrograms(_req, res) {
  try {
    await connectDb();
    const rows = await ResourceProgram.find({ status: "active" })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return res.json(rows.map(normalizeProgram));
  } catch (error) {
    console.error("List resource programs error", error);
    return res.status(500).json({ message: "Failed to load resource programs." });
  }
}

async function adminListPrograms(_req, res) {
  try {
    await connectDb();
    const rows = await ResourceProgram.find({})
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return res.json(rows.map(normalizeProgram));
  } catch (error) {
    console.error("Admin list resource programs error", error);
    return res.status(500).json({ message: "Failed to load resource programs." });
  }
}

async function adminCreateProgram(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    const target = String(req.body?.target || "").trim();
    const date = String(req.body?.date || "").trim();
    const location = String(req.body?.location || "").trim();
    const resourceFocus = Array.isArray(req.body?.resourceFocus)
      ? req.body.resourceFocus.map((s) => String(s || "").trim()).filter(Boolean)
      : [];

    if (name.length < 3) {
      return res.status(400).json({ message: "Program name must be at least 3 characters." });
    }
    if (!date) return res.status(400).json({ message: "Program date is required." });
    const isPast = dateOnlyPast(date);
    if (isPast == null) {
      return res.status(400).json({ message: "Program date must be in YYYY-MM-DD format." });
    }
    if (isPast) {
      return res.status(400).json({ message: "Program date cannot be in the past." });
    }
    if (!location) return res.status(400).json({ message: "Program location is required." });

    await connectDb();
    const created = await ResourceProgram.create({
      name,
      target,
      date,
      location,
      resourceFocus,
      status: "active",
      createdBy: String(req.authEmail || "").trim(),
    });
    return res.status(201).json(normalizeProgram(created));
  } catch (error) {
    console.error("Admin create resource program error", error);
    return res.status(500).json({ message: "Failed to create resource program." });
  }
}

async function adminDeleteProgram(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid resource program id." });
    }
    await connectDb();
    const existing = await ResourceProgram.findById(id).exec();
    if (!existing) return res.status(404).json({ message: "Resource program not found." });
    await existing.deleteOne();
    return res.json({ ok: true });
  } catch (error) {
    console.error("Admin delete resource program error", error);
    return res.status(500).json({ message: "Failed to delete resource program." });
  }
}

async function submitParticipation(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    const district = String(req.body?.district || "").trim();
    const resourceType = String(req.body?.resourceType || "").trim();
    const quantity = Number(req.body?.quantity || 0);
    const availableDate = String(req.body?.availableDate || "").trim();
    const canTransport = Boolean(req.body?.canTransport);
    const deliveryMode =
      String(req.body?.deliveryMode || "self-drop") === "pickup"
        ? "pickup"
        : "self-drop";
    const pickupAddress = String(req.body?.pickupAddress || "").trim();
    const notes = String(req.body?.notes || "").trim();

    if (!name) return res.status(400).json({ message: "Name is required." });
    if (!validEmail(email))
      return res.status(400).json({ message: "Valid email is required." });
    if (!tenDigits(phone))
      return res.status(400).json({ message: "Phone number must have exactly 10 digits." });
    if (!district) return res.status(400).json({ message: "District is required." });
    if (!resourceType) return res.status(400).json({ message: "Resource type is required." });
    if (!Number.isFinite(quantity) || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1." });
    }
    const parsedDate = new Date(availableDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Valid available date is required." });
    }
    const isPastAvailable = dateOnlyPast(availableDate);
    if (isPastAvailable == null) {
      return res
        .status(400)
        .json({ message: "Available date must be in YYYY-MM-DD format." });
    }
    if (isPastAvailable) {
      return res.status(400).json({ message: "Available date cannot be in the past." });
    }
    const outsideWindow = dateOutsideNext30Days(availableDate);
    if (outsideWindow == null) {
      return res
        .status(400)
        .json({ message: "Available date must be in YYYY-MM-DD format." });
    }
    if (outsideWindow) {
      return res
        .status(400)
        .json({ message: "Available date must be within the next 30 days." });
    }
    if (deliveryMode === "pickup" && !pickupAddress) {
      return res
        .status(400)
        .json({ message: "Pickup address is required when pickup is selected." });
    }

    await connectDb();
    const created = await ResourceParticipation.create({
      userId: req.userId,
      name,
      email,
      phone,
      district,
      resourceType,
      quantity,
      availableDate: parsedDate,
      canTransport,
      deliveryMode,
      pickupAddress: deliveryMode === "pickup" ? pickupAddress : "",
      notes,
      status: "pending",
    });
    return res.status(201).json(normalizeParticipation(created));
  } catch (error) {
    console.error("Submit resource participation error", error);
    return res.status(500).json({ message: "Failed to submit participation." });
  }
}

async function adminListParticipations(_req, res) {
  try {
    await connectDb();
    const rows = await ResourceParticipation.find({})
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return res.json(rows.map(normalizeParticipation));
  } catch (error) {
    console.error("Admin list resource participations error", error);
    return res.status(500).json({ message: "Failed to load submissions." });
  }
}

module.exports = {
  listPrograms,
  adminListPrograms,
  adminCreateProgram,
  adminDeleteProgram,
  submitParticipation,
  adminListParticipations,
};

