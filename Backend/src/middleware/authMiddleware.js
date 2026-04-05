const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.authEmail = payload.email;
    /** Set by POST /auth/dev-admin-token — not a real DB user id */
    req.isDevAdmin = Boolean(payload.devAdmin);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

/** Sets req.userId when a valid Bearer token is present; otherwise continues without auth. */
function optionalAuthMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.authEmail = payload.email;
    req.isDevAdmin = Boolean(payload.devAdmin);
  } catch {
    // ignore invalid token for optional auth
  }
  next();
}

module.exports = { authMiddleware, optionalAuthMiddleware };

