const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { Volunteer } = require("../models/Volunteer");
const { User } = require("../models/User");
const { getVolunteerStatusForUser } = require("../services/volunteerStatus");

function userPayload(userDoc, volunteerStatus) {
  return {
    id: userDoc._id.toString(),
    name: userDoc.name || "",
    email: userDoc.email,
    district: userDoc.district || "",
    mobile: userDoc.mobile || "",
    avatar: userDoc.avatar || "",
    volunteerStatus: volunteerStatus ?? null,
  };
}

async function register(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message:
          "The dev admin shortcut cannot register as a volunteer. Use a normal account.",
      });
    }

    const { message, skills, availability } = req.body || {};
    const msg = message != null ? String(message).trim() : "";
    if (!msg || msg.length < 10) {
      return res.status(400).json({
        message: "Please describe how you can help (at least 10 characters).",
      });
    }

    await connectDb();

    const existing = await Volunteer.findOne({ userId: req.userId }).exec();

    if (existing) {
      if (existing.status === "approved") {
        return res.status(400).json({
          message: "You are already an approved volunteer.",
        });
      }
      if (existing.status === "pending") {
        existing.message = msg;
        existing.skills = skills != null ? String(skills).trim() : "";
        existing.availability =
          availability != null ? String(availability).trim() : "";
        await existing.save();
        const status = await getVolunteerStatusForUser(req.userId);
        const user = await User.findById(req.userId).exec();
        return res.json({
          volunteer: {
            id: existing._id.toString(),
            status: existing.status,
            message: existing.message,
            skills: existing.skills,
            availability: existing.availability,
            updatedAt: existing.updatedAt,
          },
          user: userPayload(user, status),
        });
      }
      // rejected — allow resubmit as pending
      existing.status = "pending";
      existing.message = msg;
      existing.skills = skills != null ? String(skills).trim() : "";
      existing.availability =
        availability != null ? String(availability).trim() : "";
      existing.reviewedAt = undefined;
      existing.reviewedBy = "";
      await existing.save();
      const status = await getVolunteerStatusForUser(req.userId);
      const user = await User.findById(req.userId).exec();
      return res.status(201).json({
        volunteer: {
          id: existing._id.toString(),
          status: existing.status,
          message: existing.message,
          skills: existing.skills,
          availability: existing.availability,
          createdAt: existing.createdAt,
        },
        user: userPayload(user, status),
      });
    }

    const created = await Volunteer.create({
      userId: req.userId,
      status: "pending",
      message: msg,
      skills: skills != null ? String(skills).trim() : "",
      availability: availability != null ? String(availability).trim() : "",
    });

    const status = await getVolunteerStatusForUser(req.userId);
    const user = await User.findById(req.userId).exec();

    return res.status(201).json({
      volunteer: {
        id: created._id.toString(),
        status: created.status,
        message: created.message,
        skills: created.skills,
        availability: created.availability,
        createdAt: created.createdAt,
      },
      user: userPayload(user, status),
    });
  } catch (error) {
    console.error("Volunteer register error", error);
    return res.status(500).json({ message: "Failed to submit volunteer request." });
  }
}

async function me(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.json({ volunteer: null });
    }

    await connectDb();
    const v = await Volunteer.findOne({ userId: req.userId }).lean().exec();
    if (!v) {
      return res.json({ volunteer: null });
    }
    return res.json({
      volunteer: {
        id: v._id.toString(),
        status: v.status,
        message: v.message || "",
        skills: v.skills || "",
        availability: v.availability || "",
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      },
    });
  } catch (error) {
    console.error("Volunteer me error", error);
    return res.status(500).json({ message: "Failed to load volunteer status." });
  }
}

async function adminList(req, res) {
  try {
    await connectDb();
    const list = await Volunteer.find({})
      .sort({ createdAt: -1 })
      .populate("userId", "name email district mobile")
      .lean()
      .exec();

    return res.json(
      list.map((row) => {
        const u = row.userId || {};
        return {
          id: row._id.toString(),
          status: row.status,
          message: row.message || "",
          skills: row.skills || "",
          availability: row.availability || "",
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt,
          reviewedBy: row.reviewedBy || "",
          user: {
            id: u._id ? u._id.toString() : "",
            name: u.name || "",
            email: u.email || "",
            district: u.district || "",
            mobile: u.mobile || "",
          },
        };
      })
    );
  } catch (error) {
    console.error("Volunteer admin list error", error);
    return res.status(500).json({ message: "Failed to load volunteers." });
  }
}

async function adminSetStatus(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid volunteer id." });
    }
    const { status } = req.body || {};
    const allowed = ["approved", "rejected", "pending"];
    if (!allowed.includes(String(status))) {
      return res.status(400).json({ message: "Invalid status." });
    }

    await connectDb();
    const v = await Volunteer.findById(id).exec();
    if (!v) {
      return res.status(404).json({ message: "Volunteer request not found." });
    }

    v.status = status;
    v.reviewedAt = new Date();
    v.reviewedBy = String(req.authEmail || "").trim();
    await v.save();

    return res.json({
      id: v._id.toString(),
      status: v.status,
      reviewedAt: v.reviewedAt,
      reviewedBy: v.reviewedBy,
    });
  } catch (error) {
    console.error("Volunteer admin set status error", error);
    return res.status(500).json({ message: "Failed to update volunteer status." });
  }
}

module.exports = {
  register,
  me,
  adminList,
  adminSetStatus,
};
