const { authMiddleware } = require("./authMiddleware");
const { connectDb } = require("../db");
const { VictimAccessRequest } = require("../models/VictimAccessRequest");

function isConfiguredAdmin(req) {
  if (req.isDevAdmin) return true;
  const emails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return emails.includes(String(req.authEmail || "").toLowerCase());
}

function victimIdentificationMiddleware(req, res, next) {
  authMiddleware(req, res, async () => {
    try {
      if (isConfiguredAdmin(req)) return next();
      await connectDb();
      const request = await VictimAccessRequest.findOne({ userId: req.userId, status: "approved" }).lean().exec();
      if (!request) {
        return res.status(403).json({ message: "Approved victim identification access is required." });
      }
      req.victimAccessRequest = request;
      return next();
    } catch (error) {
      console.error("Victim identification access check error", error);
      return res.status(500).json({ message: "Could not verify victim identification access." });
    }
  });
}

module.exports = { victimIdentificationMiddleware };