const mongoose = require('mongoose');

const SessionRescheduleSchema = new mongoose.Schema(
  {
    // Original session being rescheduled
    originalSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
    },
    // New session after rescheduling
    newSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    // Who initiated the reschedule
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    initiatedByRole: {
      type: String,
      enum: ['trainer', 'member', 'admin'],
      required: true,
    },
    // Original session details (snapshot)
    originalDate: {
      type: String,
      required: true,
    },
    originalStartTime: {
      type: String,
      required: true,
    },
    originalEndTime: {
      type: String,
      required: true,
    },
    // New session details
    newDate: {
      type: String,
      required: true,
    },
    newStartTime: {
      type: String,
      required: true,
    },
    newEndTime: {
      type: String,
      required: true,
    },
    // Why the session was rescheduled
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    // Status of reschedule
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'confirmed'],
      default: 'pending',
    },
    // If member declined, why
    declineReason: {
      type: String,
      default: '',
      trim: true,
    },
    // Trainer of the session
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // For 1v1 sessions, which member
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    rescheduleDate: {
      type: Date,
      default: Date.now,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes for quick lookups
SessionRescheduleSchema.index({ originalSessionId: 1 });
SessionRescheduleSchema.index({ trainerId: 1, status: 1 });
SessionRescheduleSchema.index({ memberId: 1, status: 1 });

module.exports = mongoose.model('SessionReschedule', SessionRescheduleSchema);
