const jwt = require("jsonwebtoken");

const OTP_TTL_MINUTES = 10;
const DEV_FALLBACK_JWT_SECRET = "dev_jwt_secret_change_me";

let hasWarnedMissingJwtSecret = false;

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (!hasWarnedMissingJwtSecret) {
    console.warn("JWT_SECRET is missing. Falling back to development secret.");
    hasWarnedMissingJwtSecret = true;
  }

  return DEV_FALLBACK_JWT_SECRET;
}

function generateOtp(length = 4) {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  return String(Math.floor(Math.random() * (max - min)) + min);
}

function getOtpExpiryDate() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role || "member",
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

function signResetToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      purpose: "password_reset",
    },
    getJwtSecret(),
    { expiresIn: "10m" }
  );
}

function parseBearerToken(header = "") {
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function getSafeUser(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role || "member",
    memberType: user.memberType || "normal",
    onboardingCompleted: !!user.onboardingCompleted,
    mobile: user.mobile || "",
    whatsapp: user.whatsapp || "",
    authProvider: user.authProvider,
    isEmailVerified: user.isEmailVerified,
  };
}

// Middleware to verify JWT token and attach user to request
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = parseBearerToken(authHeader);

    if (!token) {
      return res.status(401).json({ message: "Missing authorization token" });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    req.user = {
      _id: decoded.sub,
      email: decoded.email,
      role: decoded.role || "member",
    };
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Middleware factory to check user role
function hasRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userRole = req.user.role || "member";
    
    if (userRole !== requiredRole && requiredRole !== "any") {
      return res.status(403).json({ message: `Access denied. Required role: ${requiredRole}` });
    }

    next();
  };
}

module.exports = {
  generateOtp,
  getOtpExpiryDate,
  signAuthToken,
  signResetToken,
  parseBearerToken,
  getSafeUser,
  getJwtSecret,
  authMiddleware,
  hasRole,
};
