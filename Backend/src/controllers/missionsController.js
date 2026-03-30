const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { Mission } = require("../models/Mission");
const { MissionJoin } = require("../models/MissionJoin");
const { Volunteer } = require("../models/Volunteer");

async function joinedCountsForMissionIds(missionIds) {
  const ids = (missionIds || []).filter(Boolean).map(String);
  if (!ids.length) return new Map();

  const joins = await MissionJoin.find({ missionId: { $in: ids } })
    .select("missionId")
    .lean()
    .exec();

  const counts = new Map();
  for (const j of joins || []) {
    const key = String(j.missionId);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function missionOut(m, joinedCount = null) {
  return {
    id: m._id.toString(),
    title: m.title || "",
    category: m.category || "",
    district: m.district || "",
    description: m.description || "",
    volunteersNeeded: m.volunteersNeeded ?? 0,
    skills: m.skills || "",
    urgency: m.urgency || "medium",
    status: m.status || "open",
    joinedCount,
    closedAt: m.closedAt,
    closedBy: m.closedBy || "",
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

async function publicActive(_req, res) {
  try {
    await connectDb();
    const list = await Mission.find({ status: "open" })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const counts = await joinedCountsForMissionIds(list.map((m) => m._id));
    return res.json(
      list.map((m) => missionOut(m, counts.get(String(m._id)) || 0))
    );
  } catch (error) {
    console.error("Missions active error", error);
    return res.status(500).json({ message: "Failed to load missions." });
  }
}

async function adminList(req, res) {
  try {
    await connectDb();
    const list = await Mission.find({})
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const counts = await joinedCountsForMissionIds(list.map((m) => m._id));
    return res.json(
      list.map((m) => missionOut(m, counts.get(String(m._id)) || 0))
    );
  } catch (error) {
    console.error("Missions admin list error", error);
    return res.status(500).json({ message: "Failed to load missions." });
  }
}

async function adminCreate(req, res) {
  try {
    const {
      title,
      category,
      district,
      description,
      volunteersNeeded,
      skills,
      urgency,
    } = req.body || {};

    const t = title != null ? String(title).trim() : "";
    if (!t) return res.status(400).json({ message: "title is required." });

    const v = volunteersNeeded == null ? 0 : Number(volunteersNeeded);
    if (!Number.isFinite(v) || v < 0) {
      return res.status(400).json({ message: "volunteersNeeded must be >= 0." });
    }

    await connectDb();
    const created = await Mission.create({
      title: t,
      category: category != null ? String(category).trim() : "",
      district: district != null ? String(district).trim() : "",
      description: description != null ? String(description).trim() : "",
      volunteersNeeded: v,
      skills: skills != null ? String(skills).trim() : "",
      urgency: urgency && ["high", "medium", "low"].includes(String(urgency).toLowerCase())
        ? String(urgency).toLowerCase()
        : "medium",
      status: "open",
      closedAt: undefined,
      closedBy: "",
    });

    return res.status(201).json(missionOut(created));
  } catch (error) {
    console.error("Missions admin create error", error);
    return res.status(500).json({ message: "Failed to create mission." });
  }
}

async function adminClose(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid mission id." });
    }

    await connectDb();
    const m = await Mission.findById(id).exec();
    if (!m) return res.status(404).json({ message: "Mission not found." });

    m.status = "closed";
    m.closedAt = new Date();
    m.closedBy = String(req.authEmail || "").trim();
    await m.save();

    return res.json(missionOut(m));
  } catch (error) {
    console.error("Missions admin close error", error);
    return res.status(500).json({ message: "Failed to close mission." });
  }
}

async function adminOpen(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid mission id." });
    }

    await connectDb();
    const m = await Mission.findById(id).exec();
    if (!m) return res.status(404).json({ message: "Mission not found." });

    m.status = "open";
    m.closedAt = undefined;
    m.closedBy = "";
    await m.save();

    return res.json(missionOut(m));
  } catch (error) {
    console.error("Missions admin open error", error);
    return res.status(500).json({ message: "Failed to reopen mission." });
  }
}

async function joinMission(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid mission id." });
    }

    await connectDb();

    const mission = await Mission.findById(id).exec();
    if (!mission) {
      return res.status(404).json({ message: "Mission not found." });
    }

    if (String(mission.status) !== "open") {
      return res.status(400).json({ message: "Mission is not open." });
    }

    // Require user to have a volunteer record (pending/approved). Keep "rejected" out.
    const volunteer = await Volunteer.findOne({ userId: req.userId }).lean().exec();
    if (!volunteer || String(volunteer.status) === "rejected") {
      return res.status(403).json({ message: "Volunteer application required." });
    }

    const existing = await MissionJoin.findOne({
      missionId: mission._id,
      userId: req.userId,
    }).lean().exec();

    if (existing) {
      return res.json({
        id: mission._id.toString(),
        status: "joined",
      });
    }

    const joinedCount = await MissionJoin.countDocuments({
      missionId: mission._id,
    });

    const capacity = Number(mission.volunteersNeeded ?? 0);
    if (capacity <= joinedCount) {
      return res.status(409).json({ message: "Mission is full." });
    }

    await MissionJoin.create({
      missionId: mission._id,
      userId: req.userId,
    });

    return res.json({
      id: mission._id.toString(),
      status: "joined",
      joinedCount: joinedCount + 1,
    });
  } catch (error) {
    console.error("Mission join error", error);
    return res.status(500).json({ message: "Failed to join mission." });
  }
}

async function myMissions(req, res) {
  try {
    await connectDb();
    const joins = await MissionJoin.find({ userId: req.userId })
      .select("missionId")
      .lean()
      .exec();

    const ids = (joins || []).map((j) => String(j.missionId));
    return res.json({ missionIds: ids });
  } catch (error) {
    console.error("My missions error", error);
    return res.status(500).json({ message: "Failed to load your missions." });
  }
}

module.exports = {
  publicActive,
  adminList,
  adminCreate,
  adminClose,
  adminOpen,
  joinMission,
  myMissions,
};

