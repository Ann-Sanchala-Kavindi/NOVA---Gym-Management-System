const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const authRoutes = require("./src/routes/auth.routes");
const adminRoutes = require("./src/routes/admin.routes");
const trainerRoutes = require("./src/routes/trainer.routes");
const memberRoutes = require("./src/routes/member.routes");
const bookingRoutes = require("./src/routes/booking.routes");
const schedulingRoutes = require("./src/routes/scheduling.routes");
const tutorialRoutes = require("./src/routes/tutorial.routes");
const reviewRoutes = require("./src/routes/review.routes");
const equipmentFeedbackRoutes = require("./src/routes/equipment-feedback.routes");
const workoutPlanRoutes = require("./src/routes/workout-plan.routes");
const mealPlanRoutes = require("./src/routes/meal-plan.routes");
const memberPlansRoutes = require("./src/routes/member-plans.routes");

const app = express();
let server;

const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get("/", (_req, res) => {
  res.send("API running...");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/trainer", trainerRoutes);
app.use("/api/member", memberRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/scheduling", schedulingRoutes);
app.use("/api/tutorials", tutorialRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/equipment-sessions", equipmentFeedbackRoutes);
app.use("/api/workout-plans", workoutPlanRoutes);
app.use("/api/meal-plans", mealPlanRoutes);
app.use("/api/member-plans", memberPlansRoutes);

if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is missing. Set it in .env before using auth endpoints.");
}

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

function formatMongoUri(uri) {
  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname.slice(1) : "(none)";
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || "default"}/${dbName}`;
  } catch {
    return "(invalid MongoDB URI format)";
  }
}

function logStartupError(error) {
  console.error("Failed to start server.");

  if (error?.name) {
    console.error(`Error type: ${error.name}`);
  }

  if (error?.message) {
    console.error(`Message: ${error.message}`);
  }

  if (error?.cause?.message) {
    console.error(`Cause: ${error.cause.message}`);
  }

  if (error?.code) {
    console.error(`Code: ${error.code}`);
  }

  if (error?.stack) {
    console.error(error.stack);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          return resolve();
        });
      });
    }

    await mongoose.connection.close();
    console.log("Shutdown complete.");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

async function startServer() {
  const mongoUri = process.env.MONGO_URI;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;

  if (!mongoUri) {
    throw new Error("MONGO_URI is missing. Set it in backend/.env before starting the server.");
  }

  if (!googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID is missing. Set it in backend/.env before starting the server.");
  }

  console.log(`Connecting to MongoDB at ${formatMongoUri(mongoUri)} ...`);

  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected.");
  });

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("MongoDB Connected");

  await new Promise((resolve, reject) => {
    server = app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
      resolve();
    });

    server.on("error", reject);
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

startServer().catch((error) => {
  logStartupError(error);
  process.exit(1);
});

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  if (error?.message === 'CORS origin not allowed') {
    return res.status(403).json({ message: error.message });
  }

  console.error('Unhandled Express error:', error);
  return res.status(500).json({ message: 'Internal server error.' });
});
