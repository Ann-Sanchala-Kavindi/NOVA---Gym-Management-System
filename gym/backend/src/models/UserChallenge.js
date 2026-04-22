const mongoose = require('mongoose');

const userChallengeSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'pending-approval', 'completed', 'expired', 'rejected'],
      default: 'active',
      index: true,
    },
    progressValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    progressDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    progressDateKeys: {
      type: [String],
      default: [],
    },
    proofUrl: {
      type: String,
      default: '',
      trim: true,
    },
    proofNote: {
      type: String,
      default: '',
      trim: true,
     },
    pointsAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    lastProgressAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userChallengeSchema.index({ memberId: 1, challengeId: 1 }, { unique: true });

module.exports = mongoose.model('UserChallenge', userChallengeSchema);
