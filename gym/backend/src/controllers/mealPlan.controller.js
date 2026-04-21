const MealPlan = require('../models/MealPlan');
const Food = require('../models/Food');
const User = require('../models/User');
const { generateMealPlanCode } = require('../utils/plan-helpers');

const buildUploadedPath = (file) => {
  if (!file) return '';
  return `/uploads/${file.filename}`;
};

const normalizeDateKey = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeMeals = (meals) =>
  Array.isArray(meals)
    ? meals.map((meal) => ({
        name: meal.name,
        timeLabel: meal.timeLabel,
        foods: Array.isArray(meal.foods)
          ? meal.foods.map((food) => ({
              foodId: food.foodId,
              name: food.name,
              servingText: food.servingText || '',
              category: food.category || '',
              calories: Number(food.calories || 0),
              protein: Number(food.protein || 0),
              carbs: Number(food.carbs || 0),
              fat: Number(food.fat || 0),
              imageUrl: food.imageUrl || '',
            }))
          : [],
      }))
    : [];

const buildProgressSummary = (plan, dateKey = null) => {
  const logs = Array.isArray(plan.dailyLogs) ? plan.dailyLogs : [];
  const sourceLogs = dateKey ? logs.filter((log) => log.dateKey === dateKey) : logs;
  const totalExpected = Math.max((plan.meals || []).length, 1);
  const completedCount = sourceLogs.reduce((sum, day) => sum + (day.slots || []).filter((slot) => slot.status === 'completed').length, 0);
  const partialCount = sourceLogs.reduce((sum, day) => sum + (day.slots || []).filter((slot) => slot.status === 'partial').length, 0);
  const skippedCount = sourceLogs.reduce((sum, day) => sum + (day.slots || []).filter((slot) => slot.status === 'skipped').length, 0);
  const adherenceScore = sourceLogs.length
    ? Math.round(sourceLogs.reduce((sum, day) => sum + Number(day.adherenceScore || 0), 0) / sourceLogs.length)
    : 0;

  return {
    dateKey,
    daysTracked: sourceLogs.length,
    totalExpectedMealsPerDay: totalExpected,
    completedCount,
    partialCount,
    skippedCount,
    adherenceScore,
    logs: sourceLogs,
  };
};


const getFoodSubstitutions = async (req, res) => {
  try {
    const { planId } = req.params;
    const { mealName = '', foodName = '', category = '', calories = 0, protein = 0, strategy = 'balanced' } = req.query;
    const plan = await MealPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Meal plan not found.' });
    }

    const numericCalories = Number(calories || 0);
    const numericProtein = Number(protein || 0);
    const normalizedMealName = String(mealName || '').trim();
    const normalizedFoodName = String(foodName || '').trim();
    const normalizedCategory = String(category || '').trim();
    const normalizedStrategy = String(strategy || 'balanced').trim().toLowerCase();

    let query = {};
    if (normalizedCategory) query.category = normalizedCategory;

    const foods = await Food.find(query).sort({ createdAt: -1 }).limit(80);
    const filtered = foods
      .filter((item) => String(item.name || '').toLowerCase() !== normalizedFoodName.toLowerCase())
      .map((item) => {
        const obj = item.toObject();
        const calorieGap = Math.abs(Number(item.calories || 0) - numericCalories);
        const proteinBoost = Number(item.protein || 0) - numericProtein;
        const tags = [];
        let score = calorieGap;
        let substitutionReason = 'Same category substitute';

        if (normalizedStrategy === 'high-protein') {
          score = calorieGap - proteinBoost * 6;
          substitutionReason = proteinBoost > 0 ? 'Higher protein alternative' : 'Close calorie match';
          if (proteinBoost > 0) tags.push('high protein');
        } else if (normalizedStrategy === 'budget') {
          score = calorieGap + (Number(item.protein || 0) < numericProtein ? 10 : 0) + (String(item.category || '').toLowerCase().includes('supplement') ? 25 : 0);
          substitutionReason = calorieGap <= 60 ? 'Budget-friendly swap' : 'Affordable same-category option';
          tags.push('budget');
        } else if (normalizedStrategy === 'local') {
          const localKeywords = ['rice', 'curry', 'egg', 'fish', 'fruit', 'vegetable'];
          const isLocalish = localKeywords.some((kw) => String(item.name || '').toLowerCase().includes(kw) || String(item.category || '').toLowerCase().includes(kw));
          score = calorieGap + (isLocalish ? -20 : 20);
          substitutionReason = isLocalish ? 'Local-food alternative' : 'Alternative with similar calories';
          if (isLocalish) tags.push('local');
        } else {
          score = calorieGap - proteinBoost * 4;
          substitutionReason = proteinBoost > 0 ? 'Higher protein alternative' : calorieGap <= 40 ? 'Very close calorie match' : 'Same category substitute';
          tags.push('balanced');
        }

        if (calorieGap <= 40) tags.push('close calories');
        if (Number(item.protein || 0) >= numericProtein + 5) tags.push('protein boost');

        return {
          ...obj,
          calorieGap,
          score,
          tags,
          substitutionReason,
          recommendedForMeal: normalizedMealName,
          strategy: normalizedStrategy,
        };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 6);

    res.status(200).json({ data: filtered });
  } catch (error) {
    console.log('Get food substitutions error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getFoodLibrary = async (req, res) => {
  try {
    const { search = '', category = 'all' } = req.query;
    const query = {};

    if (category !== 'all') {
      query.category = category;
    }

    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
        { servingText: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const foods = await Food.find(query).sort({ createdAt: -1 });
    res.status(200).json({ data: foods });
  } catch (error) {
    console.log('Get food library error:', error);
    res.status(500).json({ message: error.message });
  }
};

const createCustomFood = async (req, res) => {
  try {
    const { name, category, servingText, calories, protein, carbs, fat, imageUrl } = req.body;

    const food = await Food.create({
      name: (name || '').trim(),
      category: (category || 'General').trim(),
      servingText: (servingText || '').trim(),
      calories: Number(calories || 0),
      protein: Number(protein || 0),
      carbs: Number(carbs || 0),
      fat: Number(fat || 0),
      imageUrl: buildUploadedPath(req.file) || imageUrl || '',
      createdBy: req.user?._id || null,
      isCustom: true,
    });

    res.status(201).json({ message: 'Custom food created successfully.', data: food });
  } catch (error) {
    console.log('Create custom food error:', error);
    res.status(400).json({ message: error.message });
  }
};

const updateCustomFood = async (req, res) => {
  try {
    const { foodId } = req.params;
    const { name, category, servingText, calories, protein, carbs, fat, imageUrl } = req.body;

    const food = await Food.findById(foodId);
    if (!food) {
      return res.status(404).json({ message: 'Food not found.' });
    }

    food.name = (name || food.name).trim();
    food.category = (category || food.category).trim();
    food.servingText = (servingText || '').trim();
    food.calories = Number(calories ?? food.calories ?? 0);
    food.protein = Number(protein ?? food.protein ?? 0);
    food.carbs = Number(carbs ?? food.carbs ?? 0);
    food.fat = Number(fat ?? food.fat ?? 0);
    food.imageUrl = buildUploadedPath(req.file) || imageUrl || food.imageUrl || '';

    const updated = await food.save();
    res.status(200).json({ message: 'Custom food updated successfully.', data: updated });
  } catch (error) {
    console.log('Update custom food error:', error);
    res.status(400).json({ message: error.message });
  }
};

const getPlansCount = async (_req, res) => {
  try {
    const activePlansCount = await MealPlan.countDocuments({ status: 'active' });
    const archivedPlansCount = await MealPlan.countDocuments({ status: 'archived' });
    res.status(200).json({ activePlansCount, archivedPlansCount });
  } catch (error) {
    console.log('Get meal plans count error:', error);
    res.status(500).json({ message: error.message });
  }
};

const createMealPlan = async (req, res) => {
  try {
    const { memberId, planName, description, goal, difficulty, durationWeeks, meals } = req.body;
    const member = await User.findById(memberId);

    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    const plan = await MealPlan.create({
      planCode: generateMealPlanCode(),
      memberId,
      trainerId: req.user._id,
      planName: (planName || '').trim(),
      description: (description || '').trim(),
      goal: (goal || '').trim(),
      difficulty,
      durationWeeks: Number(durationWeeks || 4),
      meals: normalizeMeals(meals),
      status: 'active',
    });

    res.status(201).json({ message: 'Meal plan created successfully.', data: plan });
  } catch (error) {
    console.log('Create meal plan error:', error);
    res.status(400).json({ message: error.message });
  }
};

const updateMealPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { planName, description, goal, difficulty, durationWeeks, meals } = req.body;
    const plan = await MealPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: 'Meal plan not found.' });
    }

    plan.planName = (planName || plan.planName).trim();
    plan.description = (description || '').trim();
    plan.goal = (goal || plan.goal).trim();
    plan.difficulty = difficulty || plan.difficulty;
    plan.durationWeeks = Number(durationWeeks || plan.durationWeeks);
    plan.meals = normalizeMeals(meals);

    const updated = await plan.save();
    res.status(200).json({ message: 'Meal plan updated successfully.', data: updated });
  } catch (error) {
    console.log('Update meal plan error:', error);
    res.status(400).json({ message: error.message });
  }
};

const getMealPlansForMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { status = 'active' } = req.query;
    const query = { memberId };
    if (status !== 'all') query.status = status;
    const plans = await MealPlan.find(query).sort({ createdAt: -1 });
    res.status(200).json({ data: plans });
  } catch (error) {
    console.log('Get meal plans error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getMealPlanById = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await MealPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Meal plan not found.' });
    }
    res.status(200).json({ data: plan });
  } catch (error) {
    console.log('Get meal plan by id error:', error);
    res.status(500).json({ message: error.message });
  }
};

const archiveMealPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await MealPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Meal plan not found.' });
    }
    plan.status = 'archived';
    await plan.save();
    res.status(200).json({ message: 'Meal plan archived successfully.' });
  } catch (error) {
    console.log('Archive meal plan error:', error);
    res.status(500).json({ message: error.message });
  }
};

const restoreMealPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await MealPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Meal plan not found.' });
    }
    plan.status = 'active';
    await plan.save();
    res.status(200).json({ message: 'Meal plan restored successfully.' });
  } catch (error) {
    console.log('Restore meal plan error:', error);
    res.status(500).json({ message: error.message });
  }
};

const trackMealProgress = async (req, res) => {
  try {
    const { planId } = req.params;
    const { dateKey, mealName, status, note = '' } = req.body || {};

    if (!['completed', 'partial', 'skipped'].includes(status)) {
      return res.status(400).json({ message: 'Invalid meal completion status.' });
    }

    const normalizedDate = normalizeDateKey(dateKey);
    if (!normalizedDate) {
      return res.status(400).json({ message: 'Invalid date.' });
    }

    const plan = await MealPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Meal plan not found.' });
    }

    const isOwner = String(plan.memberId) === String(req.user._id);
    const isPrivileged = ['trainer', 'admin'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ message: 'Not allowed to update this meal plan.' });
    }

    let dayLog = (plan.dailyLogs || []).find((item) => item.dateKey === normalizedDate);
    if (!dayLog) {
      dayLog = { dateKey: normalizedDate, slots: [], adherenceScore: 0 };
      plan.dailyLogs.push(dayLog);
    }

    const existingSlot = (dayLog.slots || []).find((slot) => slot.mealName === mealName);
    if (existingSlot) {
      existingSlot.status = status;
      existingSlot.note = String(note || '').trim();
      existingSlot.completedAt = new Date();
    } else {
      dayLog.slots.push({
        mealName,
        status,
        note: String(note || '').trim(),
        completedAt: new Date(),
      });
    }

    const scoreMap = { completed: 1, partial: 0.5, skipped: 0 };
    const totalMeals = Math.max((plan.meals || []).length, 1);
    const earnedScore = dayLog.slots.reduce((sum, slot) => sum + (scoreMap[slot.status] || 0), 0);
    dayLog.adherenceScore = Math.round((earnedScore / totalMeals) * 100);

    await plan.save();
    res.status(200).json({
      message: 'Meal progress saved.',
      data: dayLog,
      summary: buildProgressSummary(plan, normalizedDate),
    });
  } catch (error) {
    console.log('Track meal progress error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getMealProgress = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await MealPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Meal plan not found.' });
    }

    const normalizedDate = req.query.dateKey ? normalizeDateKey(req.query.dateKey) : null;
    const isOwner = String(plan.memberId) === String(req.user._id);
    const isPrivileged = ['trainer', 'admin'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ message: 'Not allowed to view this meal plan progress.' });
    }

    res.status(200).json({ data: buildProgressSummary(plan, normalizedDate) });
  } catch (error) {
    console.log('Get meal progress error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getFoodSubstitutions,
  getFoodLibrary,
  createCustomFood,
  updateCustomFood,
  createMealPlan,
  updateMealPlan,
  getMealPlansForMember,
  getMealPlanById,
  archiveMealPlan,
  restoreMealPlan,
  getPlansCount,
  trackMealProgress,
  getMealProgress,
};
