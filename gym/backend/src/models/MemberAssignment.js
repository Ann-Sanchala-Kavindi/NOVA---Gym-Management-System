const mongoose = require('mongoose');

const MemberAssignmentSchema = new mongoose.Schema(
  {
    // Which trainer is assigned
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Which member is assigned
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Total PT hours trainer has allocated to this member
    // Decrements when member books 1v1 sessions
    allocatedPTHours: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    // How many PT hours have been used
    usedPTHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Remaining PT hours available
    remainingPTHours: {
      type: Number,
      default: function() {
        return this.allocatedPTHours - this.usedPTHours;
      },
    },
    // Status of assignment
    status: {
      type: String,
      enum: ['active', 'paused', 'inactive'],
      default: 'active',
    },
    // Notes about assignment
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    // Assignment start date
    startDate: {
      type: Date,
      default: Date.now,
    },
    // Assignment end date (if any)
    endDate: {
      type: Date,
      default: null,
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Unique constraint: one trainer can assign to one member only once (at a time with same active status)
MemberAssignmentSchema.index({ trainerId: 1, memberId: 1, status: 1 }, { unique: true });

module.exports = mongoose.model('MemberAssignment', MemberAssignmentSchema);
