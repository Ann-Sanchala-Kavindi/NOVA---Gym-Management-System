const mongoose = require('mongoose');

const bookingSlotSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true }, // HH:mm
    isBooked: { type: Boolean, default: false },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    slotDurationMinutes: { type: Number, default: 60 }, // 30, 60, 90 etc
    status: {
      type: String,
      enum: ['available', 'booked', 'completed', 'cancelled'],
      default: 'available',
    },
    notes: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for efficient queries
bookingSlotSchema.index({ trainerId: 1, date: 1 });
bookingSlotSchema.index({ trainerId: 1, isBooked: 1 });

module.exports = mongoose.model('BookingSlot', bookingSlotSchema);
