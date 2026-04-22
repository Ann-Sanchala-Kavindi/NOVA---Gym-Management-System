const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const equipmentController = require("../controllers/equipment-feedback.controller");
const sessionController = require("../controllers/equipmentSession.controller");
const { protect, requireAdmin } = require("../middleware/auth.middleware");

// ── Multer setup ──────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = [".jpg", ".jpeg", ".png", ".webp"];
  if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
    return cb(new Error("Only image files are allowed."));
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const optionalUpload = (req, res, next) => {
  if (req.is("multipart/form-data")) {
    return upload.single("photo")(req, res, next);
  }
  return next();
};

// ── Equipment CRUD ─────────────────────────────────────────────────────────────
router.get("/", equipmentController.getAllEquipment);
router.get("/dashboard/stats", sessionController.getDashboardStats);
router.get("/:id", equipmentController.getEquipmentById);
router.get("/:equipmentId/stats", sessionController.getEquipmentStats);

router.post("/", protect, requireAdmin, optionalUpload, equipmentController.addEquipment);
router.put("/:id", protect, requireAdmin, optionalUpload, equipmentController.updateEquipment);
router.delete("/:id", protect, requireAdmin, equipmentController.deleteEquipment);

// ── Equipment session tracking ─────────────────────────────────────────────────
router.get("/my-stats", protect, sessionController.getMyEquipmentStats);
router.post("/sessions/start", protect, sessionController.startSession);
router.put("/sessions/:sessionId/end", protect, sessionController.endSession);

module.exports = router;
