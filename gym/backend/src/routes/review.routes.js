const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review.controller");
const { protect, optionalProtect, requireAdmin } = require("../middleware/auth.middleware");

router.get("/", optionalProtect, reviewController.getReviews);
router.get("/summary", optionalProtect, reviewController.getReviewSummary);

router.post("/", protect, reviewController.createReview);
router.post("/:id/report", protect, reviewController.reportReview);
router.put("/:id/reply", protect, requireAdmin, reviewController.replyToReview);
router.put("/:id/status", protect, requireAdmin, reviewController.updateReviewStatus);
router.delete("/:id", protect, reviewController.deleteReview);

module.exports = router;
