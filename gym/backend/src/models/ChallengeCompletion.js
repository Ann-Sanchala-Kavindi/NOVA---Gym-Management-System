const mongoose = require('mongoose');

const challengeCompletionSchema = new mongoose.Schema(
  {
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challenge',
      required: true,
      index: true,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pointsAwarded: {
      type: Number,
      required: true,
      min: 1,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

challengeCompletionSchema.index({ challengeId: 1, memberId: 1 }, { unique: true });

module.exports = mongoose.model('ChallengeCompletion', challengeCompletionSchema);
