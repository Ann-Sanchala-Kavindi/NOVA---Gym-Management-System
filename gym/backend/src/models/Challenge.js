const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    category: {
      type: String,
      enum: ['workout', 'cardio', 'strength', 'consistency', 'other'],
      default: 'workout',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    challengeType: {
      type: String,
      enum: ['daily', 'one-time', 'milestone-based'],
      default: 'one-time',
      index: true,
    },
    completionMode: {
      type: String,
      enum: ['manual', 'progress', 'proof'],
      default: 'manual',
      index: true,
    },
    pointsReward: {
      type: Number,
      required: true,
      min: 1,
      max: 10000,
    },
    equipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Equipment',
      default: null,
      index: true,
    },
    equipmentNameSnapshot: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    workoutGoalType: {
      type: String,
      enum: ['none', 'duration-minutes', 'reps', 'sets'],
      default: 'none',
      index: true,
    },
    targetValue: {
      type: Number,
      default: 1,
      min: 1,
    },
    targetUnit: {
      type: String,
      default: 'steps',
      trim: true,
      maxlength: 40,
    },
    requiresTrainerApproval: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Challenge', challengeSchema);
