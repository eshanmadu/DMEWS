const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { User } = require("../models/User");
const { LoginLog } = require("../models/LoginLog");
const { Volunteer } = require("../models/Volunteer");
const { IncidentReport } = require("../models/IncidentReport");
const { SosAlert } = require("../models/SosAlert");
const { MissionJoin } = require("../models/MissionJoin");
const { MissingPerson } = require("../models/MissingPerson");
const { FoundPerson } = require("../models/FoundPerson");
const { PasswordResetOtp } = require("../models/PasswordResetOtp");

function parseAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function emailIsAdmin(email) {
  const e = String(email || "").toLowerCase().trim();
  return Boolean(e && parseAdminEmails().includes(e));
}

function getInactiveThresholdDays() {
  const n = parseInt(process.env.ADMIN_INACTIVE_USER_DAYS || "90", 10);
  if (!Number.isFinite(n) || n < 30) return 90;
  if (n > 730) return 730;
  return n;
}

function msDays(d) {
  return d * 24 * 60 * 60 * 1000;
}

/**
 * Inactive = no successful login recorded in the last N days (LoginLog),
 * or no login logs at all and the account was created longer than N days ago.
 */
function computeIsInactive({ createdAt, lastLoginAt, inactiveDays }) {
  const thresholdMs = msDays(inactiveDays);
  const now = Date.now();
  if (lastLoginAt) {
    return now - new Date(lastLoginAt).getTime() > thresholdMs;
  }
  return now - new Date(createdAt).getTime() > thresholdMs;
}

function normalizeUserListRow(userLean, extras) {
  const id = userLean._id ? String(userLean._id) : "";
  const email = userLean.email || "";
  const createdAt = userLean.createdAt || null;
  const lastLoginAt = extras.lastLoginAt || null;
  const inactiveDays = extras.inactiveDays;
  const isInactive = computeIsInactive({ createdAt, lastLoginAt, inactiveDays });

  return {
    id,
    name: userLean.name || "",
    email,
    district: userLean.district || "",
    mobile: userLean.mobile || "",
    avatar: userLean.avatar || "",
    createdAt,
    updatedAt: userLean.updatedAt || null,
    lastLoginAt,
    isAdmin: emailIsAdmin(email),
    isInactive,
    inactiveDaysThreshold: inactiveDays,
    counts: {
      incidents: extras.incidentCount || 0,
      sos: extras.sosCount || 0,
      loginLogs: extras.loginLogCount || 0,
    },
    volunteerStatus: extras.volunteerStatus,
  };
}

async function adminListUsers(req, res) {
  try {
    await connectDb();
    const inactiveDays = getInactiveThresholdDays();

    const users = await User.find({})
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean()
      .exec();

    if (!users.length) {
      return res.json({ users: [], inactiveUserDays: inactiveDays });
    }

    const userIds = users.map((u) => u._id);

    const [lastLogins, loginCounts, volRows, incidentGroups, sosGroups] = await Promise.all([
      LoginLog.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: "$userId", lastAt: { $max: "$createdAt" } } },
      ]).exec(),
      LoginLog.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: "$userId", c: { $sum: 1 } } },
      ]).exec(),
      Volunteer.find({ userId: { $in: userIds } }).select("userId status").lean().exec(),
      IncidentReport.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: "$userId", c: { $sum: 1 } } },
      ]).exec(),
      SosAlert.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: "$userId", c: { $sum: 1 } } },
      ]).exec(),
    ]);

    const lastMap = new Map(lastLogins.map((x) => [String(x._id), x.lastAt]));
    const loginCountMap = new Map(loginCounts.map((x) => [String(x._id), x.c]));
    const volMap = new Map(volRows.map((v) => [String(v.userId), v.status]));
    const incMap = new Map(incidentGroups.map((x) => [String(x._id), x.c]));
    const sosMap = new Map(sosGroups.map((x) => [String(x._id), x.c]));

    const out = users.map((u) => {
      const id = String(u._id);
      return normalizeUserListRow(u, {
        lastLoginAt: lastMap.get(id) || null,
        loginLogCount: loginCountMap.get(id) || 0,
        volunteerStatus: volMap.get(id) || null,
        incidentCount: incMap.get(id) || 0,
        sosCount: sosMap.get(id) || 0,
        inactiveDays,
      });
    });

    return res.json({ users: out, inactiveUserDays: inactiveDays });
  } catch (error) {
    console.error("adminListUsers error", error);
    return res.status(500).json({ message: "Failed to load users." });
  }
}

async function adminGetUser(req, res) {
  try {
    const { id } = req.params || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    await connectDb();
    const inactiveDays = getInactiveThresholdDays();

    const user = await User.findById(id).select("-passwordHash").lean().exec();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const uid = user._id;

    const [
      lastLog,
      loginLogCount,
      volunteer,
      incidentCount,
      sosCount,
      missingCount,
      foundCount,
      recentLogs,
    ] = await Promise.all([
      LoginLog.findOne({ userId: uid }).sort({ createdAt: -1 }).select("createdAt").lean(),
      LoginLog.countDocuments({ userId: uid }),
      Volunteer.findOne({ userId: uid }).lean().exec(),
      IncidentReport.countDocuments({ userId: uid }),
      SosAlert.countDocuments({ userId: uid }),
      MissingPerson.countDocuments({ submittedByUserId: uid }),
      FoundPerson.countDocuments({ submittedByUserId: uid }),
      LoginLog.find({ userId: uid })
        .sort({ createdAt: -1 })
        .limit(25)
        .select("createdAt ip userAgent email district")
        .lean()
        .exec(),
    ]);

    const lastLoginAt = lastLog?.createdAt || null;
    const isInactive = computeIsInactive({
      createdAt: user.createdAt,
      lastLoginAt,
      inactiveDays,
    });

    const summary = normalizeUserListRow(user, {
      lastLoginAt,
      loginLogCount,
      volunteerStatus: volunteer?.status || null,
      incidentCount,
      sosCount,
      inactiveDays,
    });

    return res.json({
      user: summary,
      inactiveUserDays: inactiveDays,
      volunteerApplication: volunteer || null,
      recentLogins: recentLogs.map((l) => ({
        at: l.createdAt,
        ip: l.ip || "",
        userAgent: l.userAgent || "",
        email: l.email || "",
        district: l.district || "",
      })),
      counts: {
        ...summary.counts,
        missingPersonReports: missingCount,
        foundPersonReports: foundCount,
      },
    });
  } catch (error) {
    console.error("adminGetUser error", error);
    return res.status(500).json({ message: "Failed to load user." });
  }
}

async function adminDeleteInactiveUser(req, res) {
  try {
    const { id } = req.params || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message: "Dev admin shortcut cannot delete users.",
      });
    }

    if (String(id) === String(req.userId)) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    await connectDb();
    const inactiveDays = getInactiveThresholdDays();

    const user = await User.findById(id).exec();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (emailIsAdmin(user.email)) {
      return res.status(403).json({
        message: "Admin accounts cannot be removed from here.",
      });
    }

    const lastLog = await LoginLog.findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean()
      .exec();
    const lastLoginAt = lastLog?.createdAt || null;
    const isInactive = computeIsInactive({
      createdAt: user.createdAt,
      lastLoginAt,
      inactiveDays,
    });

    if (!isInactive) {
      return res.status(400).json({
        message: `Only inactive accounts can be deleted (no login in the last ${inactiveDays} days, or no logins and account older than ${inactiveDays} days).`,
      });
    }

    const uid = user._id;
    const uidStr = String(uid);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await LoginLog.deleteMany({ userId: uid }).session(session);
      await Volunteer.deleteMany({ userId: uid }).session(session);
      await MissionJoin.deleteMany({ userId: uidStr }).session(session);
      await IncidentReport.deleteMany({ userId: uid }).session(session);
      await SosAlert.deleteMany({ userId: uid }).session(session);
      await MissingPerson.updateMany(
        { submittedByUserId: uid },
        { $set: { submittedByUserId: null } }
      ).session(session);
      await FoundPerson.updateMany(
        { submittedByUserId: uid },
        { $set: { submittedByUserId: null } }
      ).session(session);
      await PasswordResetOtp.deleteMany({ email: user.email }).session(session);
      await User.deleteOne({ _id: uid }).session(session);
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }

    return res.json({ message: "Inactive user and related session data removed." });
  } catch (error) {
    console.error("adminDeleteInactiveUser error", error);
    return res.status(500).json({ message: "Failed to delete user." });
  }
}

module.exports = {
  adminListUsers,
  adminGetUser,
  adminDeleteInactiveUser,
};
