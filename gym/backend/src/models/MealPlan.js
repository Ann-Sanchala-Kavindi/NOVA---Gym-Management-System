const mongoose = require('mongoose');

const mealFoodSchema = new mongoose.Schema(
  {
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: false },
    name: { type: String, required: true },
    servingText: { type: String, default: '' },
    category: { type: String, default: '' },
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    imageUrl: { type: String, default: '' },
  },
  { _id: false }
);

const mealSlotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    timeLabel: { type: String, required: true },
    foods: { type: [mealFoodSchema], default: [] },
  },
  { _id: false }
);

const mealSlotLogSchema = new mongoose.Schema(
  {
    mealName: { type: String, required: true },
    status: { type: String, enum: ['completed', 'partial', 'skipped'], required: true },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const dailyLogSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true },
    slots: { type: [mealSlotLogSchema], default: [] },
    adherenceScore: { type: Number, default: 0 },
  },
  { _id: false }
);

const mealPlanSchema = new mongoose.Schema(
  {
    planCode: { type: String, required: true, unique: true, trim: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    planName: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    goal: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ['Beginner', 'Moderate', 'Advanced'], required: true },
    durationWeeks: { type: Number, required: true, min: 1 },
    meals: {
      type: [mealSlotSchema],
      default: [
        { name: 'Breakfast', timeLabel: '7:00 AM', foods: [] },
        { name: 'Lunch', timeLabel: '12:30 PM', foods: [] },
        { name: 'Dinner', timeLabel: '7:00 PM', foods: [] },
        { name: 'Snack', timeLabel: '4:00 PM', foods: [] },
      ],
    },
    dailyLogs: { type: [dailyLogSchema], default: [] },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MealPlan', mealPlanSchema);
