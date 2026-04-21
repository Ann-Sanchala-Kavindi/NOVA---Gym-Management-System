const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { sendVerificationCodeEmail, sendResetCodeEmail } = require("../utils/mailer");
const {
  generateOtp,
  getOtpExpiryDate,
  signAuthToken,
  signResetToken,
  getSafeUser,
  getJwtSecret,
} = require("../utils/auth");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || undefined);

function normalizeEmail(email = "") {
  return email.toLowerCase().trim();
}

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function validationError(res, message) {
  return res.status(400).json({ message });
}

const ALLOWED_ROLES = ["admin", "trainer", "member"];

function getAdminDefaults() {
  return {
    email: normalizeEmail(process.env.ADMIN_DEFAULT_EMAIL || "admin@gym.local"),
    password: process.env.ADMIN_DEFAULT_PASSWORD || "Admin@123",
  };
}

async function ensureAdminUser(defaultEmail, defaultPassword) {
  let adminUser = await User.findOne({ email: defaultEmail });

  if (!adminUser) {
    adminUser = await User.create({
      email: defaultEmail,
      passwordHash: await bcrypt.hash(defaultPassword, 10),
      name: "Admin",
      authProvider: "local",
      role: "admin",
      memberType: "normal",
      isEmailVerified: true,
      onboardingCompleted: true,
    });

    return adminUser;
  }

  let needsSave = false;

  if (adminUser.role !== "admin") {
    adminUser.role = "admin";
    needsSave = true;
  }

  if (adminUser.authProvider !== "local") {
    adminUser.authProvider = "local";
    needsSave = true;
  }

  if (!adminUser.passwordHash) {
    adminUser.passwordHash = await bcrypt.hash(defaultPassword, 10);
    needsSave = true;
  }

  if (!adminUser.isEmailVerified) {
    adminUser.isEmailVerified = true;
    needsSave = true;
  }

  if (needsSave) {
    await adminUser.save();
  }

  return adminUser;
}

router.post("/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";

    if (!email || !password) return validationError(res, "Email and password are required.");
    if (password.length < 6) return validationError(res, "Password must be at least 6 characters.");

    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isEmailVerified) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = generateOtp(4);
    const verificationCodeExpiresAt = getOtpExpiryDate();

    let user = existingUser;
    if (!user) {
      user = await User.create({
        email,
        passwordHash,
        authProvider: "local",
        role: "member",
        memberType: "normal",
        isEmailVerified: false,
        verificationCode,
        verificationCodeExpiresAt,
      });
    } else {
      user.passwordHash = passwordHash;
      user.authProvider = "local";
      user.role = user.role || "member";
      user.memberType = user.memberType || "normal";
      user.verificationCode = verificationCode;
      user.verificationCodeExpiresAt = verificationCodeExpiresAt;
      await user.save();
    }

    const payload = {
      message: "Verification code generated.",
      email: user.email,
    };

    const emailSent = await sendVerificationCodeEmail(user.email, verificationCode).catch((err) => {
      console.error("[register] Failed to send verification email:", err.message, err.stack);
      return false;
    });

    payload.emailSent = emailSent;
    payload.message = emailSent
      ? "Verification code sent to your email."
      : "Email delivery is not configured. Verification code generated.";

    if (isDev()) payload.verificationCode = verificationCode;

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Failed to register user.", error: error.message });
  }
});

router.post("/verify-email", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = (req.body.code || "").trim();

    if (!email || !code) return validationError(res, "Email and code are required.");

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const codeIsValid =
      user.verificationCode === code &&
      user.verificationCodeExpiresAt &&
      user.verificationCodeExpiresAt.getTime() > Date.now();

    if (!codeIsValid) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    user.isEmailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpiresAt = null;
    await user.save();

    const token = signAuthToken(user);

    return res.json({
      message: "Email verified successfully.",
      token,
      user: getSafeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify email.", error: error.message });
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return validationError(res, "Email is required.");

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    const verificationCode = generateOtp(4);
    user.verificationCode = verificationCode;
    user.verificationCodeExpiresAt = getOtpExpiryDate();
    await user.save();

    const payload = { message: "Verification code generated." };

    const emailSent = await sendVerificationCodeEmail(user.email, verificationCode).catch((err) => {
      console.error("[resend] Failed to resend verification email:", err.message, err.stack);
      return false;
    });

    payload.emailSent = emailSent;
    payload.message = emailSent
      ? "Verification code resent to your email."
      : "Email delivery is not configured. Verification code generated.";

    if (isDev()) payload.verificationCode = verificationCode;

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Failed to resend verification code.", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    const role = req.body.role;

    if (!email || !password) return validationError(res, "Email and password are required.");
    if (role && !ALLOWED_ROLES.includes(role)) {
      return validationError(res, "Invalid role selected.");
    }

    // Allow admin login with configured default credentials even if DB is empty.
    if (role === "admin") {
      const { email: adminDefaultEmail, password: adminDefaultPassword } = getAdminDefaults();
      if (email === adminDefaultEmail && password === adminDefaultPassword) {
        const adminUser = await ensureAdminUser(adminDefaultEmail, adminDefaultPassword);
        const token = signAuthToken(adminUser);
        return res.json({
          message: "Admin login successful.",
          token,
          user: getSafeUser(adminUser),
        });
      }
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password." });

    if (!user.passwordHash) {
      return res.status(400).json({ message: "Use Google Sign-In for this account." });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) return res.status(401).json({ message: "Invalid email or password." });

    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email first.",
        needsVerification: true,
        email: user.email,
      });
    }

    if (role && (user.role || "member") !== role) {
      return res.status(403).json({ message: `This account is not registered as ${role}.` });
    }

    const token = signAuthToken(user);
    return res.json({
      message: "Login successful.",
      token,
      user: getSafeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login.", error: error.message });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return validationError(res, "Email is required.");

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: "If that email exists, a reset code has been sent." });
    }

    const resetCode = generateOtp(4);
    user.resetCode = resetCode;
    user.resetCodeExpiresAt = getOtpExpiryDate();
    await user.save();

    const payload = { message: "If that email exists, a reset code has been generated." };

    const emailSent = await sendResetCodeEmail(user.email, resetCode).catch((err) => {
      console.error("[forgot] Failed to send reset code email:", err.message, err.stack);
      return false;
    });

    payload.emailSent = emailSent;
    payload.message = emailSent
      ? "If that email exists, a reset code has been sent."
      : "If that email exists, a reset code has been generated.";

    if (isDev()) payload.resetCode = resetCode;

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Failed to process forgot password.", error: error.message });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = (req.body.code || "").trim();
    const newPassword = req.body.newPassword || "";

    if (!email || !code || !newPassword) {
      return validationError(res, "Email, code and newPassword are required.");
    }
    if (newPassword.length < 6) {
      return validationError(res, "New password must be at least 6 characters.");
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const isValidResetCode =
      user.resetCode === code &&
      user.resetCodeExpiresAt &&
      user.resetCodeExpiresAt.getTime() > Date.now();

    if (!isValidResetCode) {
      return res.status(400).json({ message: "Invalid or expired reset code." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetCode = null;
    user.resetCodeExpiresAt = null;
    await user.save();

    return res.json({ message: "Password reset successful." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reset password.", error: error.message });
  }
});

router.post("/google", async (req, res) => {
  try {
    const { idToken, role } = req.body;
    if (!idToken) return validationError(res, "Google idToken is required.");
    if (role && !ALLOWED_ROLES.includes(role)) {
      return validationError(res, "Invalid role selected.");
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error("[google] Missing GOOGLE_CLIENT_ID in backend environment.");
      return res.status(500).json({ message: "Google sign-in is not configured on server." });
    }

    const verifyOptions = {
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    };

    const ticket = await googleClient.verifyIdToken(verifyOptions);
    const payload = ticket.getPayload();

    if (!payload?.email || !payload?.sub) {
      return res.status(400).json({ message: "Invalid Google token payload." });
    }

    const email = normalizeEmail(payload.email);
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        name: payload.name || "",
        googleId: payload.sub,
        authProvider: "google",
        role: "member",
        memberType: "normal",
        isEmailVerified: payload.email_verified !== false,
      });
    } else {
      user.googleId = payload.sub;
      user.authProvider = "google";
      user.role = user.role || "member";
      user.memberType = user.memberType || "normal";
      if (payload.name) user.name = payload.name;
      user.isEmailVerified = payload.email_verified !== false;
      await user.save();
    }

    if (role && (user.role || "member") !== role) {
      return res.status(403).json({ message: `This account is not registered as ${role}.` });
    }

    const token = signAuthToken(user);
    return res.json({
      message: "Google sign-in successful.",
      token,
      user: getSafeUser(user),
    });
  } catch (error) {
    console.error("[google] Authentication failed:", error.message);
    return res.status(401).json({ message: "Google authentication failed." });
  }
});

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized." });

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.sub);
    if (!user) return res.status(404).json({ message: "User not found." });

    return res.json({ user: getSafeUser(user) });
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
});

router.post("/member-onboarding", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized." });

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.sub);
    if (!user) return res.status(404).json({ message: "User not found." });
    if ((user.role || "member") !== "member") {
      return res.status(403).json({ message: "Only members can complete this onboarding." });
    }

    const {
      gender,
      age,
      height,
      weight,
      goals,
      activityLevel,
      name,
      mobile,
      whatsapp,
    } = req.body || {};

    const allowedGender = ["male", "female"];
    if (gender && !allowedGender.includes(gender)) {
      return validationError(res, "Invalid gender.");
    }

    const allowedLevels = ["Beginner", "Intermediate", "Advanced"];
    if (activityLevel && !allowedLevels.includes(activityLevel)) {
      return validationError(res, "Invalid activity level.");
    }

    if (typeof age === "number" && (age < 10 || age > 120)) {
      return validationError(res, "Age is out of range.");
    }
    if (typeof height === "number" && (height < 80 || height > 260)) {
      return validationError(res, "Height is out of range.");
    }
    if (typeof weight === "number" && (weight < 20 || weight > 350)) {
      return validationError(res, "Weight is out of range.");
    }

    const normalizedMobile = String(mobile || "").trim();
    if (!normalizedMobile) {
      return validationError(res, "Mobile number is required.");
    }

    const normalizedWhatsapp = String(whatsapp || "").trim();

    if (name && String(name).trim()) user.name = String(name).trim();
    if (gender) user.gender = gender;
    if (typeof age === "number") user.age = age;
    if (typeof height === "number") user.height = height;
    if (typeof weight === "number") user.weight = weight;
    if (Array.isArray(goals)) user.goals = goals.filter(Boolean).map((item) => String(item));
    if (activityLevel) user.activityLevel = activityLevel;
    user.mobile = normalizedMobile;
    if (whatsapp !== undefined) user.whatsapp = normalizedWhatsapp;

    user.onboardingCompleted = true;
    user.onboardingCompletedAt = new Date();
    await user.save();

    return res.json({
      message: "Member onboarding saved successfully.",
      user: getSafeUser(user),
    });
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
});

module.exports = router;
