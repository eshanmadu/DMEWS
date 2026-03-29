const { authMiddleware } = require("./authMiddleware");

/**
 * Admin access is granted when the authenticated user's email is listed in
 * process.env.ADMIN_EMAILS (comma-separated, case-insensitive).
 */
function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    // Dev-only: any logged-in user can access admin volunteer routes (do NOT use in production).
    if (process.env.ALLOW_VOLUNTEER_ADMIN_ANY_USER === "true") {
      return next();
    }

    const raw = process.env.ADMIN_EMAILS || "";
    const emails = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (!emails.length) {
      return res.status(503).json({
        message:
          "Admin access is not configured. Set ADMIN_EMAILS in the backend .env (or ALLOW_VOLUNTEER_ADMIN_ANY_USER=true for local dev only).",
      });
    }

    const email = String(req.authEmail || "").toLowerCase();
    if (!email || !emails.includes(email)) {
      return res.status(403).json({
        message:
          "Admin access denied. Add your login email to ADMIN_EMAILS in Backend/.env and restart the server.",
      });
    }

    next();
  });
}

module.exports = { adminMiddleware };
