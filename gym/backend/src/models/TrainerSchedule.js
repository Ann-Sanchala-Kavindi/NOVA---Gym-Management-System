const mongoose = require('mongoose');

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const dayScheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: DAY_NAMES,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    startTime: {
      type: String,
      default: '06:00',
      trim: true,
    },
    endTime: {
      type: String,
      default: '20:00',
      trim: true,
    },
    ptStartTime: {
      type: String,
      default: '06:00',
      trim: true,
    },
    ptEndTime: {
      type: String,
      default: '20:00',
      trim: true,
    },
    maxMemberMinutesPerDay: {
      type: Number,
      default: 60,
      min: 30,
      max: 480,
    },
  },
  { _id: false }
);

const trainerScheduleSchema = new mongoose.Schema(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    sameTimeAllDays: {
      type: Boolean,
      default: true,
    },
    days: {
      type: [dayScheduleSchema],
      default: () =>
        DAY_NAMES.map((day) => ({
          day,
          isAvailable: day !== 'Sunday',
          startTime: '06:00',
          endTime: '20:00',
          ptStartTime: '06:00',
          ptEndTime: '20:00',
          maxMemberMinutesPerDay: 60,
        })),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrainerSchedule', trainerScheduleSchema);
