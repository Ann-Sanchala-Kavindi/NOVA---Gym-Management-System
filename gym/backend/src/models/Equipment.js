const mongoose = require("mongoose");

const equipmentSchema = new mongoose.Schema(
  {
    // Core identity
    name: {
      type: String,
      required: [true, "Equipment name is required"],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    // ── From feedback app ──────────────────────────────────────────────────────
    equipmentType: {
      type: String,
      enum: ["Cardio", "Strength", "Weights", "Flexibility", "Other"],
      default: "Other",
    },
    // Real-time operational status
    availability: {
      type: String,
      enum: ["Available", "In Use", "Under Maintenance"],
      default: "Available",
    },
    photoUrl: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── From gym management ────────────────────────────────────────────────────
    category: {
      type: String,
      enum: ["Cardio", "Strength", "Flexibility", "Other"],
      default: "Other",
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    // imageUrl kept as alias of photoUrl for backward-compat with member.routes.js
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    // isAvailable kept for quick filtering (synced from availability)
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    maintenanceStatus: {
      type: String,
      enum: ["Good", "NeedsMaintenance", "OutOfOrder"],
      default: "Good",
    },
  },
  {
    timestamps: true,
  }
);

// Keep isAvailable in sync with availability field
equipmentSchema.pre("save", async function () {
  if (this.isModified("availability")) {
    this.isAvailable = this.availability === "Available";
  }
  // Mirror photoUrl <-> imageUrl
  if (this.isModified("photoUrl") && this.photoUrl) {
    this.imageUrl = this.photoUrl;
  } else if (this.isModified("imageUrl") && this.imageUrl) {
    this.photoUrl = this.imageUrl;
  }
});

module.exports = mongoose.model("Equipment", equipmentSchema);
