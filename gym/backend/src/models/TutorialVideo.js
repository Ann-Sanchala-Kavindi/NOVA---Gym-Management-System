const mongoose = require("mongoose");

const tutorialVideoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TutorialCategory",
      required: true,
      index: true,
    },
    youtubeUrl: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailImageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("TutorialVideo", tutorialVideoSchema);
