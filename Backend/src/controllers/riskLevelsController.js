const { connectDb } = require("../db");
const { RiskLevel } = require("../models/RiskLevel");
const { NotificationSetting } = require("../models/NotificationSetting");
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

async function getSmsSetting(_req, res) {
  try {
    await connectDb();
    const setting = await NotificationSetting.findOne({ key: "risk-sms" }).lean().exec();
    return res.json({ enabled: setting?.smsEnabled !== false });
  } catch (error) {
    console.error("Risk SMS setting fetch error", error);
    return res.status(500).json({ message: "Failed to load SMS setting." });
  }
}

async function updateSmsSetting(req, res) {
  try {
    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ message: "enabled must be a boolean." });
    }
    await connectDb();
    const setting = await NotificationSetting.findOneAndUpdate(
      { key: "risk-sms" },
      { $set: { smsEnabled: req.body.enabled } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean().exec();
    return res.json({ enabled: setting.smsEnabled });
  } catch (error) {
    console.error("Risk SMS setting update error", error);
    return res.status(500).json({ message: "Failed to update SMS setting." });
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

module.exports = {
  getRiskLevels,
  upsertRiskLevel,
  getSmsSetting,
  updateSmsSetting,
};
