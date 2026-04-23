const mongoose = require('mongoose');

const feedbackReactionSchema = new mongoose.Schema(
  {
    feedbackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Feedback',
      required: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reaction: {
      type: String,
      enum: ['like', 'dislike'],
      required: true,
    },
  },
  { timestamps: true }
);

feedbackReactionSchema.index({ feedbackId: 1, memberId: 1 }, { unique: true });

module.exports = mongoose.model('FeedbackReaction', feedbackReactionSchema);
