const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { connectDb } = require("../db");
const { User } = require("../models/User");
const { LoginLog } = require("../models/LoginLog");
const { getVolunteerStatusForUser } = require("../services/volunteerStatus");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

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

    return res.json(
      await attachVolunteerStatus({
        _id: user._id,
        name: user.name,
        email: user.email,
        district: user.district,
        mobile: user.mobile,
        avatar: user.avatar,
      })
    );
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
  me,
  updateProfile,
  changePassword,
  devAdminToken,
};

