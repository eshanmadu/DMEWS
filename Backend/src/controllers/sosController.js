const { connectDb } = require("../db");
const { User } = require("../models/User");
const { SosAlert } = require("../models/SosAlert");
const { getVolunteerStatusForUser } = require("../services/volunteerStatus");

function formatSos(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id?.toString(),
    userId: o.userId?.toString?.() || String(o.userId),
    userSnapshot: o.userSnapshot || {},
    message: o.message || "",
    clientHint: o.clientHint || {},
    status: o.status || "open",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function submitSos(req, res) {
  try {
    if (req.isDevAdmin || req.userId === "dev-admin-session") {
      return res.status(403).json({
        message:
          "The dev admin shortcut cannot send SOS. Log in with a normal user account.",
      });
    }

    await connectDb();
    const user = await User.findById(req.userId).lean().exec();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const volunteerStatus = await getVolunteerStatusForUser(
      user._id.toString()
    );
    const message = String(req.body?.message || "")
      .trim()
      .slice(0, 1000);

    const doc = await SosAlert.create({
      userId: user._id,
      userSnapshot: {
        name: user.name || "",
        email: user.email || "",
        district: user.district || "",
        mobile: user.mobile || "",
        avatar: user.avatar || "",
        volunteerStatus: volunteerStatus || "none",
      },
      message,
      clientHint: {
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
        sentFrom: String(req.body?.sentFrom || "home").slice(0, 64),
      },
    });

    return res.status(201).json({
      message: "SOS sent. Help coordinators have been notified.",
      sos: formatSos(doc),
    });
  } catch (error) {
    console.error("SOS submit error", error);
    return res.status(500).json({ message: "Failed to send SOS." });
  }
}

async function adminListSos(req, res) {
  try {
    await connectDb();
    const rows = await SosAlert.find()
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec();

    return res.json(rows.map((r) => formatSos(r)));
  } catch (error) {
    console.error("SOS list error", error);
    return res.status(500).json({ message: "Failed to load SOS requests." });
  }
}

async function adminUpdateSos(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowed = ["open", "acknowledged", "resolved"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${allowed.join(", ")}`,
      });
    }

    await connectDb();
    const doc = await SosAlert.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    )
      .lean()
      .exec();

    if (!doc) {
      return res.status(404).json({ message: "SOS request not found." });
    }

    return res.json(formatSos(doc));
  } catch (error) {
    console.error("SOS update error", error);
    return res.status(500).json({ message: "Failed to update SOS request." });
  }
}

module.exports = {
  submitSos,
  adminListSos,
  adminUpdateSos,
};
