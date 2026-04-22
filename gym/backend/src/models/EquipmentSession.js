const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    equipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userLabel: {
      type: String,
      default: "guest",
      trim: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    reps: {
      type: Number,
      default: null,
      min: 0,
    },
    sets: {
      type: Number,
      default: null,
      min: 0,
    },
    weightKg: {
      type: Number,
      default: null,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("EquipmentSession", sessionSchema);