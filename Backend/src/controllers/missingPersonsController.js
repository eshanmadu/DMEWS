const { connectDb } = require("../db");
const mongoose = require("mongoose");
const { MissingPerson } = require("../models/MissingPerson");
const { FoundPerson } = require("../models/FoundPerson");
const { User } = require("../models/User");
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

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function coerceNumber(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function parsePointFromBody(body) {
  // Accept any of these (multipart/form-data sends strings):
  // - { locationLat, locationLng }
  // - { lat, lng }
  // - { location: '{"type":"Point","coordinates":[lng,lat]}' } (stringified JSON)
  // - { location: { type:"Point", coordinates:[lng,lat] } } (JSON)

  const b = body || {};

  const lat =
    coerceNumber(b.locationLat) ??
    coerceNumber(b.lat) ??
    (Array.isArray(b.location?.coordinates) ? coerceNumber(b.location.coordinates[1]) : null);

  const lng =
    coerceNumber(b.locationLng) ??
    coerceNumber(b.lng) ??
    (Array.isArray(b.location?.coordinates) ? coerceNumber(b.location.coordinates[0]) : null);

  if (lat != null && lng != null) {
    return { type: "Point", coordinates: [lng, lat] };
  }

  const rawLoc = b.location;
  if (typeof rawLoc === "string" && rawLoc.trim()) {
    try {
      const parsed = JSON.parse(rawLoc);
      if (
        parsed &&
        parsed.type === "Point" &&
        Array.isArray(parsed.coordinates) &&
        parsed.coordinates.length === 2
      ) {
        const plng = coerceNumber(parsed.coordinates[0]);
        const plat = coerceNumber(parsed.coordinates[1]);
        if (plng != null && plat != null) {
          return { type: "Point", coordinates: [plng, plat] };
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

const _geoCache = new Map(); // key -> { at:number, value: Point|null }
const GEO_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isValidPoint(p) {
  if (!p || p.type !== "Point" || !Array.isArray(p.coordinates) || p.coordinates.length !== 2) return false;
  const [lng, lat] = p.coordinates;
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

async function geocodeToPointSriLanka(query) {
  const q = String(query || "").trim();
  if (!q) return null;

  const key = q.toLowerCase();
  const cached = _geoCache.get(key);
  if (cached && Date.now() - cached.at < GEO_CACHE_TTL_MS) {
    return cached.value;
  }

  // Bias to Sri Lanka; Nominatim requires a valid User-Agent.
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: `${q}, Sri Lanka`,
      format: "jsonv2",
      limit: "1",
    }).toString();

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "DMEWS/1.0 (missing-persons matching)",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) throw new Error(`geocode_http_${res.status}`);
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    const lat = coerceNumber(first?.lat);
    const lon = coerceNumber(first?.lon);
    const point = lat != null && lon != null ? { type: "Point", coordinates: [lon, lat] } : null;
    const value = point && isValidPoint(point) ? point : null;
    _geoCache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    console.error("Geocode failed", { q, err: e?.message || e });
    _geoCache.set(key, { at: Date.now(), value: null });
    return null;
  }
}

function normalizeGenderKey(g) {
  const s = String(g || "")
    .trim()
    .toLowerCase();
  if (!s) return "";
  if (s === "m" || s.startsWith("male")) return "male";
  if (s === "f" || s.startsWith("female")) return "female";
  if (s.includes("non") && (s.includes("binary") || s.includes("bin"))) return "non-binary";
  return s;
}

/** Name similarity 0–maxPts when both sides have usable names */
function scoreNameMatch(fullName, foundName, maxPts) {
  const fn = String(fullName || "").trim().toLowerCase();
  const rn = String(foundName || "").trim().toLowerCase();
  if (!fn || !rn || rn === "unknown") {
    return { earned: 0, skipped: true, note: "Name not available on one or both reports" };
  }
  const a = fn.replace(/\s+/g, " ");
  const b = rn.replace(/\s+/g, " ");
  if (a === b) {
    return { earned: maxPts, skipped: false, note: "Exact name match" };
  }
  if (a.includes(b) || b.includes(a)) {
    return { earned: maxPts, skipped: false, note: "One name contains the other" };
  }
  const tokensA = a.split(" ").filter((t) => t.length >= 2);
  const tokensB = b.split(" ").filter((t) => t.length >= 2);
  const setB = new Set(tokensB);
  const overlap = tokensA.some((t) => setB.has(t));
  if (overlap) {
    return { earned: Math.round(maxPts * 0.67), skipped: false, note: "Shared name word(s)" };
  }
  if (tokensA[0] && tokensB[0] && tokensA[0] === tokensB[0]) {
    return { earned: Math.round(maxPts * 0.33), skipped: false, note: "Same first token" };
  }
  return { earned: 0, skipped: false, note: "No strong name overlap" };
}

/**
 * Score breakdown for missing vs found (higher = better).
 * Categories: location (40), age (30), date (20), gender (15 if both set), name (15 if usable).
 */
function calculateScoreBreakdown(missing, found) {
  const MAX = { location: 40, age: 30, date: 20, gender: 15, name: 15 };

  const locFound = String(found.locationFound || "").toLowerCase();
  const locMissing = String(missing.lastSeenLocation || "").toLowerCase();
  let locEarned = 0;
  let locNote = "No text overlap";
  if (locMissing && locFound.includes(locMissing)) {
    locEarned = MAX.location;
    locNote = "Found location text includes last-seen text";
  }

  const missedAge = missing.age;
  const foundAge = found.age;
  let ageEarned = 0;
  let ageNote = "Age missing on one or both reports";
  if (
    foundAge != null &&
    Number.isFinite(foundAge) &&
    missedAge != null &&
    Number.isFinite(missedAge)
  ) {
    const diff = Math.abs(foundAge - missedAge);
    if (diff <= 2) {
      ageEarned = 30;
      ageNote = "Within 2 years";
    } else if (diff <= 5) {
      ageEarned = 15;
      ageNote = "Within 5 years";
    } else {
      ageNote = `Age gap ${diff} years`;
    }
  }

  const dm =
    missing.dateMissing instanceof Date
      ? missing.dateMissing
      : new Date(missing.dateMissing);
  const df =
    found.dateFound instanceof Date ? found.dateFound : new Date(found.dateFound);
  const daysDiff = Math.abs(df.getTime() - dm.getTime()) / (1000 * 60 * 60 * 24);
  let dateEarned = 0;
  let dateNote = "";
  if (daysDiff <= 1) {
    dateEarned = 20;
    dateNote = "Within 1 day";
  } else if (daysDiff <= 3) {
    dateEarned = 10;
    dateNote = "Within 3 days";
  } else {
    dateNote = `${daysDiff.toFixed(1)} days apart`;
  }

  const mg = String(missing.gender || "").trim();
  const fg = String(found.gender || "").trim();
  let genderEarned = 0;
  let genderSkipped = true;
  let genderNote = "Not compared (gender missing on one or both)";
  if (mg && fg) {
    genderSkipped = false;
    const a = normalizeGenderKey(mg);
    const b = normalizeGenderKey(fg);
    if (a && b && a === b) {
      genderEarned = MAX.gender;
      genderNote = "Gender matches";
    } else {
      genderNote = "Gender differs or could not be aligned";
    }
  }

  const nameResult = scoreNameMatch(missing.fullName, found.name, MAX.name);
  const nameEarned = nameResult.skipped ? 0 : nameResult.earned;
  const nameSkipped = nameResult.skipped;
  const nameNote = nameResult.note;

  const categories = [
    {
      id: "location",
      label: "Location (text)",
      earned: locEarned,
      max: MAX.location,
      note: locNote,
    },
    {
      id: "age",
      label: "Age",
      earned: ageEarned,
      max: MAX.age,
      note: ageNote,
    },
    {
      id: "date",
      label: "Date proximity",
      earned: dateEarned,
      max: MAX.date,
      note: dateNote,
    },
    {
      id: "gender",
      label: "Gender",
      earned: genderEarned,
      max: MAX.gender,
      skipped: genderSkipped,
      note: genderNote,
    },
    {
      id: "name",
      label: "Name",
      earned: nameEarned,
      max: MAX.name,
      skipped: nameSkipped,
      note: nameNote,
    },
  ];

  const total = categories.reduce((sum, c) => sum + (c.earned || 0), 0);
  const maxTotal = 120; // 40+30+20+15+15 — used for overall %; optional rows may be skipped in UI

  return { total, maxTotal, categories };
}

function calculateScore(missing, found) {
  return calculateScoreBreakdown(missing, found).total;
}

async function findMissingMatchesForFound(foundDoc) {
  const found = foundDoc.toObject ? foundDoc.toObject() : foundDoc;
  const foundPoint = found.location;
  const useGeo = isValidPoint(foundPoint);
  const locPattern = escapeRegex(found.locationFound || "");
  if (!useGeo && !locPattern) return [];

  const dateFound =
    found.dateFound instanceof Date ? found.dateFound : new Date(found.dateFound);
  const from = new Date(dateFound.getTime() - 3 * 24 * 60 * 60 * 1000);
  const to = new Date(dateFound.getTime() + 3 * 24 * 60 * 60 * 1000);

  const baseFilters = {
    dateMissing: { $gte: from, $lte: to },
  };
  if (found.age != null && Number.isFinite(found.age)) {
    baseFilters.age = { $gte: found.age - 5, $lte: found.age + 5 };
  }

  // Important: many existing reports may not have `location` yet.
  // If we only run $near, those docs will never match. So we do:
  // 1) geo query (when possible) for fast/accurate proximity matches
  // 2) text fallback query, then merge + score + sort.
  const [geoMatches, textMatches] = await Promise.all([
    useGeo
      ? MissingPerson.find({
          ...baseFilters,
          location: {
            $near: {
              $geometry: foundPoint,
              $maxDistance: 20000, // 20km
            },
          },
        })
          .lean()
          .exec()
      : Promise.resolve([]),
    locPattern
      ? MissingPerson.find({
          ...baseFilters,
          lastSeenLocation: { $regex: locPattern, $options: "i" },
        })
          .lean()
          .exec()
      : Promise.resolve([]),
  ]);

  const byId = new Map();
  for (const m of [...geoMatches, ...textMatches]) {
    if (m && m._id) byId.set(String(m._id), m);
  }
  const merged = Array.from(byId.values());

  const withScores = merged.map((m) => {
    const bd = calculateScoreBreakdown(m, found);
    return {
      ...m,
      matchScore: bd.total,
      scoreBreakdown: bd,
    };
  });
  withScores.sort((a, b) => b.matchScore - a.matchScore);
  return withScores;
}

async function findFoundMatchesForMissing(missingDoc) {
  const missing = missingDoc.toObject ? missingDoc.toObject() : missingDoc;
  const missingPoint = missing.location;
  const useGeo = isValidPoint(missingPoint);
  const locPattern = escapeRegex(missing.lastSeenLocation || "");
  if (!useGeo && !locPattern) return [];

  const dateMissing =
    missing.dateMissing instanceof Date ? missing.dateMissing : new Date(missing.dateMissing);
  const from = new Date(dateMissing.getTime() - 3 * 24 * 60 * 60 * 1000);
  const to = new Date(dateMissing.getTime() + 3 * 24 * 60 * 60 * 1000);

  const baseFilters = {
    dateFound: { $gte: from, $lte: to },
  };
  if (missing.age != null && Number.isFinite(missing.age)) {
    baseFilters.age = { $gte: missing.age - 5, $lte: missing.age + 5 };
  }

  const [geoMatches, textMatches] = await Promise.all([
    useGeo
      ? FoundPerson.find({
          ...baseFilters,
          location: {
            $near: {
              $geometry: missingPoint,
              $maxDistance: 20000, // 20km
            },
          },
        })
          .lean()
          .exec()
      : Promise.resolve([]),
    locPattern
      ? FoundPerson.find({
          ...baseFilters,
          locationFound: { $regex: locPattern, $options: "i" },
        })
          .lean()
          .exec()
      : Promise.resolve([]),
  ]);

  const byId = new Map();
  for (const f of [...geoMatches, ...textMatches]) {
    if (f && f._id) byId.set(String(f._id), f);
  }
  const merged = Array.from(byId.values());

  const withScores = merged.map((f) => {
    const bd = calculateScoreBreakdown(missing, f);
    return {
      ...f,
      matchScore: bd.total,
      scoreBreakdown: bd,
    };
  });
  withScores.sort((a, b) => b.matchScore - a.matchScore);
  return withScores;
}

function optionalSubmitterObjectId(req) {
  if (!req.userId || req.isDevAdmin || req.userId === "dev-admin-session") {
    return null;
  }
  if (!mongoose.Types.ObjectId.isValid(req.userId)) return null;
  return new mongoose.Types.ObjectId(req.userId);
}

async function reporterFieldsFromLoggedInUser(req) {
  const empty = { reporterName: "", ifYouSeePhone: "" };
  if (!req.userId || req.isDevAdmin || req.userId === "dev-admin-session") {
    return empty;
  }
  if (!mongoose.Types.ObjectId.isValid(req.userId)) return empty;
  const u = await User.findById(req.userId).select("name mobile").lean().exec();
  if (!u) return empty;
  return {
    reporterName: String(u.name || "").trim().slice(0, 200),
    ifYouSeePhone: String(u.mobile || "").trim().slice(0, 50),
  };
}

function normalizeMissing(o) {
  return {
    id: o._id ? String(o._id) : "",
    fullName: o.fullName || "",
    age: o.age,
    gender: o.gender || "",
    lastSeenLocation: o.lastSeenLocation || "",
    location: o.location || null,
    dateMissing: o.dateMissing,
    description: o.description || "",
    contactInfo: o.contactInfo || "",
    photoUrl: o.photoUrl || "",
    submittedByUserId: o.submittedByUserId ? String(o.submittedByUserId) : null,
    reporterName: o.reporterName || "",
    ifYouSeePhone: o.ifYouSeePhone || "",
    createdAt: o.createdAt,
  };
}

function normalizeFound(o) {
  return {
    id: o._id ? String(o._id) : "",
    name: o.name || "Unknown",
    gender: o.gender || "",
    age: o.age != null ? o.age : null,
    locationFound: o.locationFound || "",
    location: o.location || null,
    dateFound: o.dateFound,
    description: o.description || "",
    contactInfo: o.contactInfo || "",
    photoUrl: o.photoUrl || "",
    submittedByUserId: o.submittedByUserId ? String(o.submittedByUserId) : null,
    reporterName: o.reporterName || "",
    ifYouSeePhone: o.ifYouSeePhone || "",
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

async function adminPersonOverview(_req, res) {
  try {
    await connectDb();
    const [missing, found] = await Promise.all([
      MissingPerson.find().sort({ createdAt: -1 }).limit(500).lean().exec(),
      FoundPerson.find().sort({ createdAt: -1 }).limit(500).lean().exec(),
    ]);

    const [missingWithMatches, foundWithMatches] = await Promise.all([
      Promise.all(
        missing.map(async (m) => {
          const matches = await findFoundMatchesForMissing(m);
          return {
            ...normalizeMissing(m),
            possibleMatches: matches.slice(0, 5).map((f) => ({
              ...normalizeFound(f),
              matchScore: f.matchScore ?? 0,
              scoreBreakdown: f.scoreBreakdown || null,
            })),
          };
        })
      ),
      Promise.all(
        found.map(async (f) => {
          const matches = await findMissingMatchesForFound(f);
          return {
            ...normalizeFound(f),
            possibleMatches: matches.slice(0, 5).map((m) => ({
              ...normalizeMissing(m),
              matchScore: m.matchScore ?? 0,
              scoreBreakdown: m.scoreBreakdown || null,
            })),
          };
        })
      ),
    ]);

    return res.json({
      missing: missingWithMatches,
      found: foundWithMatches,
    });
  } catch (error) {
    console.error("Admin person overview error", error);
    return res.status(500).json({ message: "Failed to load admin person overview." });
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

    // Prefer stored GeoJSON point from request (back-compat), otherwise geocode the typed location.
    const location =
      parsePointFromBody(req.body) || (await geocodeToPointSriLanka(lastSeenLocation));

    await connectDb();
    const reporter = await reporterFieldsFromLoggedInUser(req);
    const doc = await MissingPerson.create({
      fullName: fullName.slice(0, 200),
      age,
      gender: gender.slice(0, 40),
      lastSeenLocation: lastSeenLocation.slice(0, 500),
      location: location || undefined,
      dateMissing,
      description: description.slice(0, 4000),
      contactInfo: contactInfo.slice(0, 500),
      photoUrl,
      photoPublicId,
      submittedByUserId: optionalSubmitterObjectId(req),
      reporterName: reporter.reporterName,
      ifYouSeePhone: reporter.ifYouSeePhone,
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
    const gender = String(req.body?.gender || "").trim();
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

    const location =
      parsePointFromBody(req.body) || (await geocodeToPointSriLanka(locationFound));

    await connectDb();
    const reporter = await reporterFieldsFromLoggedInUser(req);
    const doc = await FoundPerson.create({
      name: name.slice(0, 200),
      gender: gender.slice(0, 40),
      age,
      locationFound: locationFound.slice(0, 500),
      location: location || undefined,
      dateFound,
      description: description.slice(0, 4000),
      contactInfo: contactInfo.slice(0, 500),
      photoUrl,
      photoPublicId,
      submittedByUserId: optionalSubmitterObjectId(req),
      reporterName: reporter.reporterName,
      ifYouSeePhone: reporter.ifYouSeePhone,
    });

    let missingMatches = [];
    try {
      missingMatches = await findMissingMatchesForFound(doc);
    } catch (matchErr) {
      console.error("Found-person match lookup error", matchErr);
    }

    return res.status(201).json({
      person: normalizeFound(doc.toObject()),
      missingMatches: missingMatches.map((m) => ({
        ...normalizeMissing(m),
        matchScore: m.matchScore ?? 0,
        scoreBreakdown: m.scoreBreakdown || null,
      })),
    });
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
  adminPersonOverview,
  createMissingReport,
  createFoundReport,
  deleteMissingReport,
  deleteFoundReport,
};
