const express = require("express");
const router = express.Router();
const workoutPlanController = require("../controllers/workoutPlan.controller");
const uploadMedia = require("../middleware/upload-media");
const { protect, requireAdmin, requireTrainer } = require("../middleware/auth.middleware");

// Exercise library
router.get("/exercises", protect, workoutPlanController.getExerciseLibrary);
router.post(
  "/exercises/custom",
  protect,
  requireTrainer,
  uploadMedia.single("image"),
  workoutPlanController.createCustomExercise
);
router.put(
  "/exercises/custom/:exerciseId",
  protect,
  requireTrainer,
  uploadMedia.single("image"),
  workoutPlanController.updateCustomExercise
);

// Workout plans
router.post("/", protect, requireTrainer, workoutPlanController.createWorkoutPlan);
router.put("/:planId", protect, requireTrainer, workoutPlanController.updateWorkoutPlan);
router.get("/plans/count", protect, requireTrainer, workoutPlanController.getPlansCount);
router.get("/member/:memberId", protect, workoutPlanController.getWorkoutPlansForMember);
router.get("/:planId", protect, workoutPlanController.getWorkoutPlanById);
router.patch("/:planId/archive", protect, requireTrainer, workoutPlanController.archiveWorkoutPlan);
router.patch("/:planId/restore", protect, requireTrainer, workoutPlanController.restoreWorkoutPlan);

module.exports = router;
