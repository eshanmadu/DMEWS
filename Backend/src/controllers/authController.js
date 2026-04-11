const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const { connectDb } = require("../db");
const { User } = require("../models/User");
const { PasswordResetOtp } = require("../models/PasswordResetOtp");
const { LoginLog } = require("../models/LoginLog");
const { Volunteer } = require("../models/Volunteer");
const { MissionJoin } = require("../models/MissionJoin");
const { IncidentReport } = require("../models/IncidentReport");
const { SosAlert } = require("../models/SosAlert");
const { MissingPerson } = require("../models/MissingPerson");
const { FoundPerson } = require("../models/FoundPerson");
const { getVolunteerStatusForUser } = require("../services/volunteerStatus");
const { destroyPublicId, destroyMediaPublicId } = require("../services/cloudinaryUpload");
const {
  isSendGridConfigured,
  sendPasswordResetOtpEmail,
} = require("../services/sendGridMailer");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

const PASSWORD_RESET_OTP_TTL_MS = 15 * 60 * 1000;

function randomSixDigitOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function emailIsAdmin(email) {
  const raw = process.env.ADMIN_EMAILS || "";
  const emails = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const e = String(email || "").toLowerCase().trim();
  return Boolean(e && emails.includes(e));
}

async function attachVolunteerStatus(userDoc) {
  const status = await getVolunteerStatusForUser(userDoc._id.toString());
  return {
    id: userDoc._id.toString(),
    name: userDoc.name || "",
    district: userDoc.district || "",
    email: userDoc.email,
    mobile: userDoc.mobile || "",
    avatar: userDoc.avatar || "",
    volunteerStatus: status,
  };
}

async function signup(req, res) {
  try {
    const { name, district, email, mobile, password, avatar } = req.body || {};

    if (!district || !email || !password || !mobile) {
      return res
        .status(400)
        .json({ message: "District, email, password and mobile are required." });
    }

    if (!/^\d{10}$/.test(String(mobile).trim())) {
      return res
        .status(400)
        .json({ message: "Mobile number must be exactly 10 digits." });
    }

    await connectDb();

    const existing = await User.findOne({ email }).exec();
    if (existing) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name || "",
      district,
      email,
      mobile: (mobile && String(mobile).trim()) || "",
      avatar: (avatar && String(avatar).trim()) || "",
      passwordHash,
    });

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        district: user.district,
        name: user.name,
        mobile: user.mobile,
        avatar: user.avatar || "",
        avatar: user.avatar || "",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userOut = await attachVolunteerStatus(user);

    return res.status(201).json({
      token,
      user: userOut,
    });
  } catch (error) {
    console.error("Signup error", error);
    return res.status(500).json({ message: "Failed to sign up." });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    await connectDb();

    const user = await User.findOne({ email }).exec();
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        district: user.district,
        name: user.name,
        mobile: user.mobile,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Save a login log (best-effort)
    try {
      await LoginLog.create({
        userId: user._id,
        email: user.email,
        district: user.district,
        ip:
          req.headers["x-forwarded-for"]?.toString()?.split(",")?.[0]?.trim() ||
          req.socket?.remoteAddress ||
          "",
        userAgent: req.headers["user-agent"] || "",
      });
    } catch (e) {
      console.warn("Failed to write login log", e?.message || e);
    }

    return res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        district: user.district,
        email: user.email,
        mobile: user.mobile || "",
        avatar: user.avatar || "",
        isAdmin: emailIsAdmin(user.email),
      },
    });
  } catch (error) {
    console.error("Login error", error);
    return res.status(500).json({ message: "Failed to log in." });
  }
}

async function me(req, res) {
  try {
    if (req.isDevAdmin) {
      return res.json({
        id: "dev-admin-session",
        name: "Admin",
        email: req.authEmail || "admin@admin.com",
        district: "Colombo",
        mobile: "",
        avatar: "",
        volunteerStatus: null,
        isAdmin: true,
      });
    }

    await connectDb();
    const user = await User.findById(req.userId)
      .select("name email district mobile avatar")
      .lean()
      .exec();

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const profile = await attachVolunteerStatus({
      _id: user._id,
      name: user.name,
      email: user.email,
      district: user.district,
      mobile: user.mobile,
      avatar: user.avatar,
    });
    return res.json({
      ...profile,
      isAdmin: emailIsAdmin(user.email),
    });
  } catch (error) {
    console.error("Me error", error);
    return res.status(500).json({ message: "Failed to load profile." });
  }
}

async function updateProfile(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message: "Profile updates are not available for the dev admin shortcut.",
      });
    }

    const { name, email, mobile, district, avatar } = req.body || {};
    await connectDb();

    const user = await User.findById(req.userId).exec();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (email !== undefined) {
      const trimmed = String(email).toLowerCase().trim();
      if (!trimmed) {
        return res.status(400).json({ message: "Email is required." });
      }
      const existing = await User.findOne({
        email: trimmed,
        _id: { $ne: user._id },
      }).exec();
      if (existing) {
        return res.status(409).json({ message: "Email is already in use." });
      }
      user.email = trimmed;
    }

    if (mobile !== undefined) {
      const trimmedMobile = String(mobile).trim();
      if (trimmedMobile && !/^\d{10}$/.test(trimmedMobile)) {
        return res
          .status(400)
          .json({ message: "Mobile number must be exactly 10 digits." });
      }
      user.mobile = trimmedMobile;
    }

    if (name !== undefined) user.name = String(name).trim();
    if (avatar !== undefined) user.avatar = String(avatar).trim();

    await user.save();

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        district: user.district,
        name: user.name,
        mobile: user.mobile,
        avatar: user.avatar || "",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userOut = await attachVolunteerStatus(user);

    return res.json({
      token,
      user: userOut,
    });
  } catch (error) {
    console.error("Profile update error", error);
    return res.status(500).json({ message: "Failed to update profile." });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email: rawEmail } = req.body || {};
    const email = String(rawEmail || "").toLowerCase().trim();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    await connectDb();

    const genericMessage =
      "If an account exists for that email, we sent a verification code.";

    if (!isSendGridConfigured()) {
      return res.status(503).json({
        message:
          "Password reset email is not available. Configure SMTP in the server environment.",
      });
    }

    const user = await User.findOne({ email }).exec();
    if (!user) {
      return res.json({ message: genericMessage });
    }

    await PasswordResetOtp.deleteMany({ email }).exec();

    const otp = randomSixDigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS);

    await PasswordResetOtp.create({ email, otpHash, expiresAt });

    const sendResult = await sendPasswordResetOtpEmail({
      to: user.email,
      name: user.name || "",
      otp,
    });

    if (sendResult.skipped) {
      await PasswordResetOtp.deleteMany({ email }).exec();
      return res.status(503).json({
        message: "Could not send email. Try again later.",
      });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    console.error("Forgot password error", error);
    return res.status(500).json({ message: "Failed to process request." });
  }
}

async function resetPasswordWithOtp(req, res) {
  try {
    const { email: rawEmail, otp, password, confirmPassword } = req.body || {};
    const email = String(rawEmail || "").toLowerCase().trim();
    const code = String(otp || "").replace(/\D/g, "");

    if (!email || !password || confirmPassword === undefined) {
      return res.status(400).json({
        message:
          "Email, verification code, new password, and confirmation are required.",
      });
    }

    if (code.length !== 6) {
      return res
        .status(400)
        .json({ message: "Verification code must be 6 digits." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (String(password).length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });
    }

    await connectDb();

    const record = await PasswordResetOtp.findOne({
      email,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .exec();

    if (!record) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification code." });
    }

    const match = await bcrypt.compare(code, record.otpHash);
    if (!match) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification code." });
    }

    const user = await User.findOne({ email }).exec();
    if (!user) {
      await PasswordResetOtp.deleteMany({ email }).exec();
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
    await PasswordResetOtp.deleteMany({ email }).exec();

    return res.json({ message: "Password updated. You can log in with your new password." });
  } catch (error) {
    console.error("Reset password with OTP error", error);
    return res.status(500).json({ message: "Failed to reset password." });
  }
}

/**
 * Permanently delete the authenticated user, all DB rows they own, and best-effort Cloudinary assets.
 */
async function deleteAccount(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message: "The dev admin shortcut account cannot be deleted this way.",
      });
    }

    const { currentPassword } = req.body || {};
    if (!currentPassword) {
      return res.status(400).json({
        message: "Current password is required to delete your account.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.userId)) {
      return res.status(400).json({ message: "Invalid session." });
    }

    await connectDb();

    const user = await User.findById(req.userId).exec();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const uid = user._id;
    const uidStr = String(uid);
    const email = user.email;

    const incidents = await IncidentReport.find({ userId: uid }).lean().exec();
    for (const inc of incidents) {
      const media = Array.isArray(inc.media) ? inc.media : [];
      for (const m of media) {
        if (m?.publicId) {
          await destroyMediaPublicId(m.publicId, m.resourceType);
        }
      }
    }

    const [missingDocs, foundDocs] = await Promise.all([
      MissingPerson.find({ submittedByUserId: uid }).select("photoPublicId").lean().exec(),
      FoundPerson.find({ submittedByUserId: uid }).select("photoPublicId").lean().exec(),
    ]);
    for (const d of [...missingDocs, ...foundDocs]) {
      if (d.photoPublicId) {
        await destroyPublicId(d.photoPublicId);
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await LoginLog.deleteMany({ userId: uid }).session(session);
      await Volunteer.deleteMany({ userId: uid }).session(session);
      await MissionJoin.deleteMany({ userId: uidStr }).session(session);
      await IncidentReport.deleteMany({ userId: uid }).session(session);
      await SosAlert.deleteMany({ userId: uid }).session(session);
      await MissingPerson.deleteMany({ submittedByUserId: uid }).session(session);
      await FoundPerson.deleteMany({ submittedByUserId: uid }).session(session);
      await PasswordResetOtp.deleteMany({ email }).session(session);
      await User.deleteOne({ _id: uid }).session(session);
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }

    return res.json({
      message: "Your account and all data you added to DMEWS have been permanently removed.",
    });
  } catch (error) {
    console.error("Delete account error", error);
    return res.status(500).json({ message: "Failed to delete account." });
  }
}

async function changePassword(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message: "Password change is not available for the dev admin shortcut.",
      });
    }

    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({
          message: "Current password and new password are required.",
        });
    }

    if (String(newPassword).length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters." });
    }

    await connectDb();

    const user = await User.findById(req.userId).exec();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );
    if (!isValid) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: "Password updated." });
  } catch (error) {
    console.error("Change password error", error);
    return res.status(500).json({ message: "Failed to change password." });
  }
}

/**
 * Local dev only: mint a JWT for the UI "admin@admin.com" shortcut so admin APIs
 * (SOS, volunteers, etc.) receive Authorization: Bearer ...
 * Requires ALLOW_DEV_ADMIN_JWT=true in Backend/.env. Disabled in production.
 */
function devAdminToken(req, res) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ message: "Not found." });
  }
  if (process.env.ALLOW_DEV_ADMIN_JWT !== "true") {
    return res.status(403).json({
      message:
        "Dev admin JWT is off. Set ALLOW_DEV_ADMIN_JWT=true in Backend/.env and restart.",
    });
  }

  const raw = process.env.ADMIN_EMAILS || "";
  const first = raw.split(",")[0].trim().toLowerCase();
  const email = first || "admin@admin.com";

  const token = jwt.sign(
    {
      sub: "dev-admin-session",
      email,
      devAdmin: true,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({
    token,
    email,
    user: {
      id: "dev-admin-session",
      name: "Admin",
      email,
      district: "Colombo",
      mobile: "",
      avatar: "",
    },
  });
}

module.exports = {
  signup,
  login,
  forgotPassword,
  resetPasswordWithOtp,
  me,
  updateProfile,
  changePassword,
  deleteAccount,
  devAdminToken,
};

