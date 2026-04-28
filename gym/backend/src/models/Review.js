const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    message: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 300,
    },
    repliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const flagReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Inappropriate Language",
        "Harassment / Abuse",
        "Hate / Discrimination",
        "Sexual / Explicit Content",
        "Spam / Misleading",
        "Other",
      ],
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    reportedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      default: "Anonymous User",
      maxlength: 50,
    },
    country: {
      type: String,
      trim: true,
      default: "Sri Lanka",
      maxlength: 50,
    },
    category: {
      type: String,
      enum: [
        'Equipment',
        'Cleanliness',
        'Trainer Support',
        'Meal Guidance',
        'Class Experience',
        'App Experience',
        'General',
      ],
      default: 'General',
      index: true,
    },
    relatedFeature: {
      type: String,
      enum: ['equipment', 'meal-plan', 'workout-plan', 'general'],
      default: 'general',
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 60,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 500,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      required: true,
    },
    recommended: {
      type: Boolean,
      default: true,
    },
    reply: replySchema,
    isFlaggedByUsers: {
      type: Boolean,
      default: false,
    },
    flagCount: {
      type: Number,
      default: 0,
    },
    flagReports: {
      type: [flagReportSchema],
      default: [],
    },
    adminStatus: {
      type: String,
      enum: ["visible", "flagged", "removed"],
      default: "visible",
      index: true,
    },
    removalReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    removedAt: {
      type: Date,
      default: null,
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Review", reviewSchema);
