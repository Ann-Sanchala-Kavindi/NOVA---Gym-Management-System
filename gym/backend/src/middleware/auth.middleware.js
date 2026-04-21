const jwt = require("jsonwebtoken");
const User = require("../models/User");

const DEV_FALLBACK_JWT_SECRET = "dev_jwt_secret_change_me";

function getJwtSecret() {
  return process.env.JWT_SECRET || DEV_FALLBACK_JWT_SECRET;
}

/**
 * Verifies Bearer token and attaches req.userId + req.user
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Not authorized, token missing." });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.sub || decoded.id).select("-passwordHash -password");

    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    req.userId = user._id.toString();
    req.user = user;
    req.authToken = token;
    next();
  } catch (error) {
    const message = error?.name === "TokenExpiredError" ? "Session expired. Please log in again." : "Not authorized, invalid token.";
    return res.status(401).json({ message });
  }
};


const optionalProtect = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.sub || decoded.id).select("-passwordHash -password");

    if (user) {
      req.userId = user._id.toString();
      req.user = user;
      req.authToken = token;
    }
  } catch {}

  next();
};

/**
 * Must be used after protect. Allows only admins.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
};

/**
 * Must be used after protect. Allows admins and trainers.
 */
const requireTrainer = (req, res, next) => {
  if (!req.user || !["admin", "trainer"].includes(req.user.role)) {
    return res.status(403).json({ message: "Trainer or admin access required." });
  }
  next();
};

module.exports = { protect, optionalProtect, requireAdmin, requireTrainer };
