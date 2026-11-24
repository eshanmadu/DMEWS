const { authMiddleware } = require("./authMiddleware");

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True when an authenticated request (req.authEmail set) belongs to an admin. */
function isAdmin(req) {
  if (process.env.ALLOW_VOLUNTEER_ADMIN_ANY_USER === "true") return true;
  const email = String(req.authEmail || "").toLowerCase();
  return Boolean(email) && adminEmails().includes(email);
}

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

    if (!adminEmails().length) {
      return res.status(503).json({
        message:
          "Admin access is not configured. Set ADMIN_EMAILS in the backend .env (or ALLOW_VOLUNTEER_ADMIN_ANY_USER=true for local dev only).",
      });
    }

    if (!isAdmin(req)) {
      return res.status(403).json({
        message:
          "Admin access denied. Add your login email to ADMIN_EMAILS in Backend/.env and restart the server.",
      });
    }

    next();
  });
}

module.exports = { adminMiddleware, isAdmin };
