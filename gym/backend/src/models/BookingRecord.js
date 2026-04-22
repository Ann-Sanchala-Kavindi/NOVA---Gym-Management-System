const mongoose = require('mongoose');

const bookingRecordSchema = new mongoose.Schema(
  {
    // Keep slotId for backward compatibility and existing screens; slotIds supports multi-slot bookings.
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingSlot', required: true },
    slotIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BookingSlot' }],
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true }, // HH:mm
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'],
      default: 'pending',
    },
    cancellationReason: { type: String },
    cancelledBy: { type: String, enum: ['trainer', 'member', 'admin'], default: null }, // Who cancelled
    cancelledAt: { type: Date },
    notes: { type: String },
    sessionName: { type: String, default: 'Personal Training Session' },
    bookedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for efficient queries
bookingRecordSchema.index({ memberId: 1, date: 1 });
bookingRecordSchema.index({ trainerId: 1, date: 1 });
bookingRecordSchema.index({ status: 1 });

module.exports = mongoose.model('BookingRecord', bookingRecordSchema);
