const { connectDb } = require("../db");
const { Shelter } = require("../models/Shelter");
const { User } = require("../models/User");

function toApiShelter(s) {
  return {
    id: s._id.toString(),
    name: s.name,
    location: s.location,
    district: s.district,
    city: s.city || "",
    cityLatitude: typeof s.cityLatitude === "number" ? s.cityLatitude : undefined,
    cityLongitude: typeof s.cityLongitude === "number" ? s.cityLongitude : undefined,
    capacity: s.capacity,
    occupied: s.occupied || 0,
    availableSpaces: Math.max(0, (s.capacity || 0) - (s.occupied || 0)),
    isFull: (s.occupied || 0) >= (s.capacity || 0),
    availability: s.availability || (s.status === "inactive" ? "closed" : "open"),
    condition: s.condition || "good",
    contact: s.contact || "",
    notes: s.notes || "",
    status: s.status || "active",
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function validateShelterPayload(payload) {
  const { name, location, district, capacity, contact, notes, city, cityLatitude, cityLongitude } =
    payload || {};

  const cleanName = String(name || "").trim();
  const cleanLocation = String(location || "").trim();
  const cleanDistrict = String(district || "").trim();
  const cleanContact = String(contact || "").trim();
  const cleanNotes = String(notes || "").trim();
  const cleanCity = String(city || "").trim();

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

  let lat;
  let lon;
  if (cityLatitude != null && cityLongitude != null) {
    lat = Number(cityLatitude);
    lon = Number(cityLongitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { error: "City coordinates must be valid numbers." };
    }
  }

  const value = {
    name: cleanName,
    location: cleanLocation,
    district: cleanDistrict,
    capacity: cap,
    contact: cleanContact,
    notes: cleanNotes,
    city: cleanCity,
  };

  if (!cleanCity) {
    value.cityLatitude = null;
    value.cityLongitude = null;
  } else if (lat != null && lon != null) {
    value.cityLatitude = lat;
    value.cityLongitude = lon;
  } else {
    return { error: "City coordinates are required when a city is set." };
  }

  return { value };
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

async function updateShelterStatus(req, res) {
  try {
    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Status must be active or inactive." });
    }

    await connectDb();
    const shelter = await Shelter.findById(req.params.id).exec();

    if (!shelter) {
      return res.status(404).json({ message: "Shelter not found." });
    }

    if (!req.isDevAdmin) {
      const user = await User.findById(req.userId).select("district").lean().exec();
      if (!user) return res.status(401).json({ message: "User account not found." });
      if (String(user.district || "").trim() !== String(shelter.district || "").trim()) {
        return res.status(403).json({ message: "You can only change shelters in your district." });
      }
    }

    shelter.status = status;
    shelter.availability = status === "active" ? "open" : "closed";
    await shelter.save();

    return res.json(toApiShelter(shelter));
  } catch (error) {
    console.error("Shelter status update error", error);
    return res.status(500).json({ message: "Failed to update shelter status." });
  }
}

async function updateShelterManagement(req, res) {
  try {
    await connectDb();
    const shelter = await Shelter.findById(req.params.id).exec();
    if (!shelter) return res.status(404).json({ message: "Shelter not found." });

    if (!req.isDevAdmin) {
      const user = await User.findById(req.userId).select("district").lean().exec();
      if (!user) return res.status(401).json({ message: "User account not found." });
      if (String(user.district || "").trim() !== String(shelter.district || "").trim()) {
        return res.status(403).json({ message: "You can only manage shelters in your district." });
      }
    }

    const { capacity, occupied, availability, condition } = req.body || {};
    if (capacity !== undefined) {
      const value = Number(capacity);
      if (!Number.isInteger(value) || value <= 0) {
        return res.status(400).json({ message: "Capacity must be a positive integer." });
      }
      shelter.capacity = value;
    }
    if (occupied !== undefined) {
      const value = Number(occupied);
      if (!Number.isInteger(value) || value < 0 || value > shelter.capacity) {
        return res.status(400).json({ message: "Occupied places must be between 0 and capacity." });
      }
      shelter.occupied = value;
    }
    if ((shelter.occupied || 0) > shelter.capacity) {
      return res.status(400).json({ message: "Capacity cannot be lower than occupied places." });
    }
    if (!["open", "closed"].includes(availability)) {
      return res.status(400).json({ message: "Availability must be open or closed." });
    }
    if (!["good", "fair", "needs-attention", "critical"].includes(condition)) {
      return res.status(400).json({ message: "Select a valid shelter condition." });
    }

    shelter.availability = availability;
    shelter.status = availability === "open" ? "active" : "inactive";
    shelter.condition = condition;
    await shelter.save();
    return res.json(toApiShelter(shelter));
  } catch (error) {
    console.error("Shelter management update error", error);
    return res.status(500).json({ message: "Failed to update shelter details." });
  }
}

module.exports = {
  getShelters,
  createShelter,
  updateShelter,
  updateShelterStatus,
  updateShelterManagement,
  deleteShelter,
};

