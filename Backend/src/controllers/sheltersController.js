const { connectDb } = require("../db");
const { Shelter } = require("../models/Shelter");

function toApiShelter(s) {
  return {
    id: s._id.toString(),
    name: s.name,
    location: s.location,
    district: s.district,
    capacity: s.capacity,
    contact: s.contact || "",
    notes: s.notes || "",
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function validateShelterPayload(payload) {
  const { name, location, district, capacity, contact, notes } = payload || {};

  const cleanName = String(name || "").trim();
  const cleanLocation = String(location || "").trim();
  const cleanDistrict = String(district || "").trim();
  const cleanContact = String(contact || "").trim();
  const cleanNotes = String(notes || "").trim();

  if (!cleanName || !cleanLocation || !cleanDistrict || capacity == null) {
    return { error: "Name, location, district, and capacity are required." };
  }

  const cap = Number(capacity);
  if (!Number.isInteger(cap) || cap <= 0) {
    return { error: "Capacity must be a positive integer." };
  }

  if (cleanContact && !/^\d{10}$/.test(cleanContact)) {
    return { error: "Contact must be exactly 10 digits." };
  }

  return {
    value: {
      name: cleanName,
      location: cleanLocation,
      district: cleanDistrict,
      capacity: cap,
      contact: cleanContact,
      notes: cleanNotes,
    },
  };
}

async function getShelters(_req, res) {
  try {
    await connectDb();
    const shelters = await Shelter.find({})
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.json(shelters.map((s) => toApiShelter(s)));
  } catch (error) {
    console.error("Shelters fetch error", error);
    return res.status(500).json({ message: "Failed to load shelters." });
  }
}

async function createShelter(req, res) {
  try {
    const checked = validateShelterPayload(req.body);
    if (checked.error) {
      return res.status(400).json({ message: checked.error });
    }

    await connectDb();
    const shelter = await Shelter.create(checked.value);

    return res.status(201).json(toApiShelter(shelter));
  } catch (error) {
    console.error("Shelter create error", error);
    return res.status(500).json({ message: "Failed to create shelter." });
  }
}

async function updateShelter(req, res) {
  try {
    const checked = validateShelterPayload(req.body);
    if (checked.error) {
      return res.status(400).json({ message: checked.error });
    }

    await connectDb();
    const shelter = await Shelter.findByIdAndUpdate(req.params.id, checked.value, {
      new: true,
      runValidators: true,
    }).exec();

    if (!shelter) {
      return res.status(404).json({ message: "Shelter not found." });
    }

    return res.json(toApiShelter(shelter));
  } catch (error) {
    console.error("Shelter update error", error);
    return res.status(500).json({ message: "Failed to update shelter." });
  }
}

async function deleteShelter(req, res) {
  try {
    await connectDb();
    const shelter = await Shelter.findByIdAndDelete(req.params.id).exec();
    if (!shelter) {
      return res.status(404).json({ message: "Shelter not found." });
    }
    return res.json({ message: "Shelter deleted." });
  } catch (error) {
    console.error("Shelter delete error", error);
    return res.status(500).json({ message: "Failed to delete shelter." });
  }
}

module.exports = { getShelters, createShelter, updateShelter, deleteShelter };

