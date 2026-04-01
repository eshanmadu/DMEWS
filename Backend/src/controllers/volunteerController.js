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

const ALLOWED_SKILLS = [
  "First Aid / Medical",
  "Search & Rescue",
  "Disaster Relief Distribution",
  "Technical Support / IT",
  "Drone Operation",
  "Communication / Coordination",
  "Logistics",
  "Counseling / Psychological Support",
  "General Volunteer",
];

function normalizeSkills(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const s = String(raw || "").trim();
    if (!s || !ALLOWED_SKILLS.includes(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function volunteerPayload(v) {
  return {
    id: v._id.toString(),
    status: v.status,
    message: v.message || "",
    fullName: v.fullName || "",
    dateOfBirth: v.dateOfBirth || null,
    gender: v.gender || "",
    nicIdNumber: v.nicIdNumber || "",
    phoneNumber: v.phoneNumber || "",
    emailAddress: v.emailAddress || "",
    districtCity: v.districtCity || "",
    currentLocation: v.currentLocation || "",
    canTravelOtherDistricts: Boolean(v.canTravelOtherDistricts),
    skills: Array.isArray(v.skills) ? v.skills : [],
    medicalConditions: v.medicalConditions || "",
    emergencyContactPerson: v.emergencyContactPerson || "",
    emergencyContactNumber: v.emergencyContactNumber || "",
    agreeSafetyGuidelines: Boolean(v.agreeSafetyGuidelines),
    agreeEmergencyContact: Boolean(v.agreeEmergencyContact),
    availability: v.availability || "",
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
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

    const b = req.body || {};
    const fullName = String(b.fullName || "").trim();
    const dateOfBirthRaw = String(b.dateOfBirth || "").trim();
    const gender = String(b.gender || "").trim();
    const nicIdNumber = String(b.nicIdNumber || "").trim();
    const phoneNumber = String(b.phoneNumber || "").trim();
    const emailAddress = String(b.emailAddress || "").trim();
    const districtCity = String(b.districtCity || "").trim();
    const currentLocation = String(b.currentLocation || "").trim();
    const canTravelOtherDistricts =
      b.canTravelOtherDistricts === true || String(b.canTravelOtherDistricts) === "true";
    const skills = normalizeSkills(b.skills);
    const medicalConditions = String(b.medicalConditions || "").trim();
    const emergencyContactPerson = String(b.emergencyContactPerson || "").trim();
    const emergencyContactNumber = String(b.emergencyContactNumber || "").trim();
    const agreeSafetyGuidelines =
      b.agreeSafetyGuidelines === true || String(b.agreeSafetyGuidelines) === "true";
    const agreeEmergencyContact =
      b.agreeEmergencyContact === true || String(b.agreeEmergencyContact) === "true";

    if (
      !fullName ||
      !dateOfBirthRaw ||
      !gender ||
      !phoneNumber ||
      !emailAddress ||
      !districtCity ||
      !currentLocation ||
      !emergencyContactPerson ||
      !emergencyContactNumber
    ) {
      return res.status(400).json({ message: "Please fill all required volunteer fields." });
    }
    if (!skills.length) {
      return res.status(400).json({ message: "Please select at least one skill." });
    }
    if (!agreeSafetyGuidelines || !agreeEmergencyContact) {
      return res.status(400).json({
        message: "You must agree to safety guidelines and emergency contact terms.",
      });
    }

    const dateOfBirth = new Date(`${dateOfBirthRaw}T00:00:00.000Z`);
    if (Number.isNaN(dateOfBirth.getTime()) || dateOfBirth > new Date()) {
      return res.status(400).json({ message: "Invalid date of birth." });
    }

    const msg =
      String(b.message || "").trim() ||
      `Volunteer profile submitted by ${fullName}`;
    const availability = String(b.availability || "").trim();

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
        existing.fullName = fullName;
        existing.dateOfBirth = dateOfBirth;
        existing.gender = gender;
        existing.nicIdNumber = nicIdNumber;
        existing.phoneNumber = phoneNumber;
        existing.emailAddress = emailAddress;
        existing.districtCity = districtCity;
        existing.currentLocation = currentLocation;
        existing.canTravelOtherDistricts = canTravelOtherDistricts;
        existing.skills = skills;
        existing.medicalConditions = medicalConditions;
        existing.emergencyContactPerson = emergencyContactPerson;
        existing.emergencyContactNumber = emergencyContactNumber;
        existing.agreeSafetyGuidelines = agreeSafetyGuidelines;
        existing.agreeEmergencyContact = agreeEmergencyContact;
        existing.availability = availability;
        await existing.save();
        const status = await getVolunteerStatusForUser(req.userId);
        const user = await User.findById(req.userId).exec();
        return res.json({
          volunteer: volunteerPayload(existing),
          user: userPayload(user, status),
        });
      }
      // rejected — allow resubmit as pending
      existing.status = "pending";
      existing.message = msg;
      existing.fullName = fullName;
      existing.dateOfBirth = dateOfBirth;
      existing.gender = gender;
      existing.nicIdNumber = nicIdNumber;
      existing.phoneNumber = phoneNumber;
      existing.emailAddress = emailAddress;
      existing.districtCity = districtCity;
      existing.currentLocation = currentLocation;
      existing.canTravelOtherDistricts = canTravelOtherDistricts;
      existing.skills = skills;
      existing.medicalConditions = medicalConditions;
      existing.emergencyContactPerson = emergencyContactPerson;
      existing.emergencyContactNumber = emergencyContactNumber;
      existing.agreeSafetyGuidelines = agreeSafetyGuidelines;
      existing.agreeEmergencyContact = agreeEmergencyContact;
      existing.availability = availability;
      existing.reviewedAt = undefined;
      existing.reviewedBy = "";
      await existing.save();
      const status = await getVolunteerStatusForUser(req.userId);
      const user = await User.findById(req.userId).exec();
      return res.status(201).json({
        volunteer: volunteerPayload(existing),
        user: userPayload(user, status),
      });
    }

    const created = await Volunteer.create({
      userId: req.userId,
      status: "pending",
      message: msg,
      fullName,
      dateOfBirth,
      gender,
      nicIdNumber,
      phoneNumber,
      emailAddress,
      districtCity,
      currentLocation,
      canTravelOtherDistricts,
      skills,
      medicalConditions,
      emergencyContactPerson,
      emergencyContactNumber,
      agreeSafetyGuidelines,
      agreeEmergencyContact,
      availability,
    });

    const status = await getVolunteerStatusForUser(req.userId);
    const user = await User.findById(req.userId).exec();

    return res.status(201).json({
      volunteer: volunteerPayload(created),
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
      volunteer: volunteerPayload(v),
    });
  } catch (error) {
    console.error("Volunteer me error", error);
    return res.status(500).json({ message: "Failed to load volunteer status." });
  }
}

async function leave(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message: "Dev admin shortcut cannot leave volunteer program.",
      });
    }

    await connectDb();
    const existing = await Volunteer.findOne({ userId: req.userId }).exec();
    if (!existing) {
      return res.status(404).json({ message: "No volunteer application found." });
    }

    await existing.deleteOne();

    const user = await User.findById(req.userId).exec();
    return res.json({
      message: "You have left the volunteer program.",
      user: user ? userPayload(user, null) : null,
    });
  } catch (error) {
    console.error("Volunteer leave error", error);
    return res.status(500).json({ message: "Failed to leave volunteer program." });
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
          skills: Array.isArray(row.skills) ? row.skills : [],
          availability: row.availability || "",
          fullName: row.fullName || "",
          dateOfBirth: row.dateOfBirth || null,
          gender: row.gender || "",
          nicIdNumber: row.nicIdNumber || "",
          phoneNumber: row.phoneNumber || "",
          emailAddress: row.emailAddress || "",
          districtCity: row.districtCity || "",
          currentLocation: row.currentLocation || "",
          canTravelOtherDistricts: Boolean(row.canTravelOtherDistricts),
          medicalConditions: row.medicalConditions || "",
          emergencyContactPerson: row.emergencyContactPerson || "",
          emergencyContactNumber: row.emergencyContactNumber || "",
          agreeSafetyGuidelines: Boolean(row.agreeSafetyGuidelines),
          agreeEmergencyContact: Boolean(row.agreeEmergencyContact),
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
  leave,
  adminList,
  adminSetStatus,
};
