const { connectDb } = require("../db");
const { RiskLevel } = require("../models/RiskLevel");
const { sendHighRiskSmsForDistrict } = require("../services/notifyService");

async function getRiskLevels(_req, res) {
  try {
    await connectDb();
    const levels = await RiskLevel.find({}).lean().exec();
    return res.json(
      levels.map((l) => ({
        id: l._id.toString(),
        district: l.district,
        level: l.level,
      }))
    );
  } catch (error) {
    console.error("Risk levels fetch error", error);
    return res.status(500).json({ message: "Failed to load risk levels." });
  }
}

async function upsertRiskLevel(req, res) {
  try {
    const { district, level } = req.body || {};
    if (!district || !level) {
      return res
        .status(400)
        .json({ message: "District and level are required." });
    }

    const allowed = ["safe", "low", "medium", "high"];
    const normalizedLevel = String(level).toLowerCase();
    if (!allowed.includes(normalizedLevel)) {
      return res
        .status(400)
        .json({ message: "Level must be safe, low, medium or high." });
    }

    await connectDb();
    const trimmedDistrict = district.trim();

    const existing = await RiskLevel.findOne({
      district: trimmedDistrict,
    }).exec();

    const previousLevel = existing?.level || null;

    let updated;
    if (existing) {
      existing.level = normalizedLevel;
      updated = await existing.save();
    } else {
      updated = await RiskLevel.create({
        district: trimmedDistrict,
        level: normalizedLevel,
      });
    }

    // Fire-and-forget SMS sending when level transitions to high
    if (normalizedLevel === "high" && previousLevel !== "high") {
      sendHighRiskSmsForDistrict(trimmedDistrict);
    }

    return res.json({
      id: updated._id.toString(),
      district: updated.district,
      level: updated.level,
    });
  } catch (error) {
    console.error("Risk level upsert error", error);
    return res.status(500).json({ message: "Failed to update risk level." });
  }
}

module.exports = { getRiskLevels, upsertRiskLevel };

