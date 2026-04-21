const express = require("express");
const router = express.Router();
const mealPlanController = require("../controllers/mealPlan.controller");
const uploadMedia = require("../middleware/upload-media");
const { protect, requireTrainer } = require("../middleware/auth.middleware");

// Food library
router.get('/:planId/substitutions', protect, mealPlanController.getFoodSubstitutions);
router.get("/foods", protect, mealPlanController.getFoodLibrary);
router.post(
  "/foods/custom",
  protect,
  requireTrainer,
  uploadMedia.single("image"),
  mealPlanController.createCustomFood
);
router.put(
  "/foods/custom/:foodId",
  protect,
  requireTrainer,
  uploadMedia.single("image"),
  mealPlanController.updateCustomFood
);

// Meal plans
router.post("/", protect, requireTrainer, mealPlanController.createMealPlan);
router.put("/:planId", protect, requireTrainer, mealPlanController.updateMealPlan);
router.get("/member/:memberId", protect, mealPlanController.getMealPlansForMember);
router.get("/:planId", protect, mealPlanController.getMealPlanById);
router.patch("/:planId/archive", protect, requireTrainer, mealPlanController.archiveMealPlan);
router.patch("/:planId/restore", protect, requireTrainer, mealPlanController.restoreMealPlan);
router.patch('/:planId/track', protect, mealPlanController.trackMealProgress);
router.get('/:planId/progress', protect, mealPlanController.getMealProgress);

module.exports = router;
