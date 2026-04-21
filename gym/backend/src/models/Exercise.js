const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: "General",
    },
    equipment: {
      type: String,
      trim: true,
      default: "",
    },
    equipmentType: {
      type: String,
      enum: ['Cardio', 'Strength', 'Flexibility', 'Other'],
      default: 'Strength',
    },
    muscleGroup: {
      type: String,
      required: true,
      trim: true,
      default: "Full Body",
    },
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },
    defaultSets: {
      type: Number,
      default: 3,
      min: 1,
    },
    defaultReps: {
      type: String,
      trim: true,
      default: "8-10",
    },
    defaultRestSeconds: {
      type: Number,
      default: 60,
      min: 0,
    },
    instructions: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    metricProfile: {
      type: String,
      enum: ['Strength', 'Cardio', 'Flexibility', 'Mixed'],
      default: 'Strength',
    },
    imageUrl: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isCustom: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Exercise", exerciseSchema);