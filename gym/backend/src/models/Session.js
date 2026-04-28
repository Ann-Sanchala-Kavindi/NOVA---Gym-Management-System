const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    // For group sessions
    memberIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    // Members selected by trainer but haven't confirmed booking yet (pending invitations)
    selectedMemberIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    // For 1v1 personal training sessions
    singleMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Session type: group or 1v1 (personal training)
    sessionType: {
      type: String,
      enum: ['1v1', 'group'],
      required: true,
      index: true,
    },
    // Old field for backward compatibility
    type: {
      type: String,
      enum: ['group', 'personal', 'session'],
      default: 'session',
    },
    // PT hours allocated for this 1v1 session
    // Only used for 1v1 sessions
    ptHoursAllocated: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'completed', 'cancelled', 'rescheduled', 'no-show'],
      default: 'pending',
      index: true,
    },
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
    },
    // If this is a rescheduled session, link to original
    originalSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    // If session was rescheduled, link to reschedule record
    rescheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SessionReschedule',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
