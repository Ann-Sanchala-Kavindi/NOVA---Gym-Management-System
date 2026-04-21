const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    // Recipient of the notification
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Who triggered the notification
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Type of notification
    type: {
      type: String,
      enum: [
        'session-created',
        'session-invitation',
        'session-booking-confirmed',
        'session-cancelled',
        'session-rescheduled',
        'session-reminder',
        'pt-hours-updated',
        'membership-assigned',
        'challenge-created',
        'challenge-completed',
        'challenge-expiring',
        'challenge-approved',
        'challenge-rejected',
        'review-reply',
        'review-removed',
        'review-flagged',
        'general',
      ],
      required: true,
      index: true,
    },
    // Main title/subject
    title: {
      type: String,
      required: true,
    },
    // Detailed message
    message: {
      type: String,
      required: true,
    },
    // Related entity (e.g., session ID, reschedule ID)
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    // Type of related entity
    relatedEntityType: {
      type: String,
      enum: ['Session', 'SessionReschedule', 'MemberAssignment', 'TrainerSchedule', 'Review', null],
      default: null,
    },
    // Additional data to pass to frontend
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Has notification been read
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    // When notification was read
    readAt: {
      type: Date,
      default: null,
    },
    // Priority level
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    // Action buttons/links
    actions: [
      {
        label: String,
        actionType: String, // 'accept', 'decline', 'view', 'acknowledge', etc.
        actionData: mongoose.Schema.Types.Mixed,
      },
    ],

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for finding unread notifications
NotificationSchema.index({ recipientId: 1, isRead: 1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
