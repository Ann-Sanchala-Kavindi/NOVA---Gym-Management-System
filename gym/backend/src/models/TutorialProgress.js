const mongoose = require("mongoose");

const tutorialProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tutorialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TutorialVideo",
      required: true,
      index: true,
    },
    watchedSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastWatchedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one progress document per user/tutorial pair
// This creates a compound unique index on (userId, tutorialId)
tutorialProgressSchema.index({ userId: 1, tutorialId: 1 }, { unique: true });

module.exports = mongoose.model("TutorialProgress", tutorialProgressSchema);
