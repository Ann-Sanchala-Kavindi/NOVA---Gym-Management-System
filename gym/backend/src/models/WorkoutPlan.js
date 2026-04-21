const mongoose = require("mongoose");

const workoutPlanExerciseSchema = new mongoose.Schema(
  {
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    equipment: {
      type: String,
      default: "",
    },
    muscleGroup: {
      type: String,
      default: "",
    },
    difficulty: {
      type: String,
      default: "Beginner",
    },
    planExerciseId: {
      type: String,
      required: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    equipmentType: {
      type: String,
      enum: ['Cardio', 'Strength', 'Weights', 'Flexibility', 'Other'],
      default: 'Strength',
    },
    metricProfile: {
      type: String,
      enum: ['Strength', 'Cardio', 'Flexibility', 'Mixed'],
      default: 'Strength',
    },
    sets: {
      type: Number,
      default: 3,
      min: 1,
    },
    reps: {
      type: String,
      default: "8-10",
    },
    restSeconds: {
      type: Number,
      default: 60,
      min: 0,
    },
    instructions: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    targetMetrics: {
      durationMinutes: { type: Number, default: null, min: 0 },
      sets: { type: Number, default: null, min: 0 },
      reps: { type: Number, default: null, min: 0 },
      weight: { type: Number, default: null, min: 0 },
      distance: { type: Number, default: null, min: 0 },
      calories: { type: Number, default: null, min: 0 },
      avgSpeed: { type: Number, default: null, min: 0 },
    },
    scheduledDay: {
      type: String,
      enum: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday","Anytime"],
      default: "Anytime",
    },
    progress: {
      status: {
        type: String,
        enum: ["not_started","in_progress","completed","skipped"],
        default: "not_started",
      },
      firstStartedAt: { type: Date, default: null },
      lastStartedAt: { type: Date, default: null },
      lastCompletedAt: { type: Date, default: null },
      completionCount: { type: Number, default: 0, min: 0 },
      adherenceScore: { type: Number, default: 0, min: 0 },
      lastCompletionQuality: {
        type: String,
        enum: ["as_prescribed","partial","skipped","pain_stop"],
        default: null,
      },
      lastDifficultyRating: { type: Number, default: null, min: 1, max: 5 },
      lastDiscomfortLevel: { type: Number, default: null, min: 0, max: 5 },
      lastPainNote: { type: String, default: "", trim: true, maxlength: 200 },
      bestPerformance: {
        weight: { type: Number, default: 0 },
        reps: { type: Number, default: 0 },
        sets: { type: Number, default: 0 },
        distance: { type: Number, default: 0 },
        calories: { type: Number, default: 0 },
        avgSpeed: { type: Number, default: 0 },
        durationMinutes: { type: Number, default: 0 },
        volume: { type: Number, default: 0 },
      },
    },
  },
  { _id: false }
);

const workoutPlanSchema = new mongoose.Schema(
  {
    planCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    goal: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      required: true,
    },
    durationWeeks: {
      type: Number,
      required: true,
      min: 3,
    },
    exercises: {
      type: [workoutPlanExerciseSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("WorkoutPlan", workoutPlanSchema);
//x