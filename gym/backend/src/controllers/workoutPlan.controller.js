const mongoose = require("mongoose");
const WorkoutPlan = require("../models/WorkoutPlan");
const Exercise = require("../models/Exercise");
const User = require("../models/User");
const { generateWorkoutPlanCode } = require("../utils/plan-helpers");


const buildProgressionSuggestion = (exercise = {}) => {
  const progress = exercise.progress || {};
  const target = exercise.targetMetrics || {};
  const best = progress.bestPerformance || {};
  const adherence = Number(progress.adherenceScore || 0);
  const difficulty = Number(progress.lastDifficultyRating || 0);
  const discomfort = Number(progress.lastDiscomfortLevel || 0);
  const completionQuality = String(progress.lastCompletionQuality || '');
  const painNote = String(progress.lastPainNote || '').trim();

  if (completionQuality === 'pain_stop' || discomfort >= 4) {
    return {
      type: 'recovery_review',
      label: 'Recovery check',
      message: painNote
        ? `Pain/discomfort was reported. Reduce load and review technique before the next session. Note: ${painNote}`
        : 'Pain/discomfort was reported. Reduce load and review technique before the next session.',
    };
  }
  if (completionQuality === 'partial' || (difficulty >= 4 && adherence < 75)) {
    return {
      type: 'hold_or_reduce',
      label: 'Keep load steady',
      message: 'Last session was difficult or partial. Repeat the same load or reduce it slightly next time.',
    };
  }
  if ((progress.status || '') === 'completed' && adherence >= 90 && difficulty > 0 && difficulty <= 3 && Number(best.weight || 0) > 0) {
    return {
      type: 'increase_weight',
      label: 'Progressive overload',
      message: 'You are consistently hitting targets with manageable difficulty. Increase weight by 2.5-5% next session.',
    };
  }
  if ((progress.status || '') === 'completed' && adherence >= 85 && difficulty <= 3 && Number(best.reps || 0) > 0) {
    return {
      type: 'increase_reps',
      label: 'Rep progression',
      message: 'Try adding 1-2 reps next session before increasing the load.',
    };
  }
  if (adherence > 0 && adherence < 60) {
    return {
      type: 'reduce_load',
      label: 'Trainer check-in',
      message: 'Adherence is low. Reduce load, shorten the session, or simplify this exercise next time.',
    };
  }
  if (Number(target.durationMinutes || 0) > 0 && Number(best.durationMinutes || 0) >= Number(target.durationMinutes || 0) && difficulty <= 3) {
    return {
      type: 'increase_duration',
      label: 'Endurance progression',
      message: 'You are meeting the duration target comfortably. Increase duration slightly next time.',
    };
  }
  return {
    type: 'maintain',
    label: 'Stay consistent',
    message: 'Keep building consistency on this exercise before changing the plan.',
  };
};

const attachWorkoutInsights = (plan) => {
  const raw = typeof plan.toObject === 'function' ? plan.toObject() : { ...plan };
  raw.exercises = (raw.exercises || []).map((exercise) => ({
    ...exercise,
    progressionSuggestion: buildProgressionSuggestion(exercise),
  }));
  return raw;
};

const buildUploadedPath = (file) => {
  if (!file) return "";
  return `/uploads/${file.filename}`;
};

const deriveMetricProfile = (equipmentType = '', metricProfile = '') => {
  const normalizedType = String(equipmentType || '').trim();
  if (metricProfile) return metricProfile;
  if (['Cardio', 'Strength', 'Flexibility'].includes(normalizedType)) return normalizedType;
  return 'Mixed';
};

const normalizeTargetMetrics = (targetMetrics = {}) => ({
  durationMinutes: targetMetrics.durationMinutes != null ? Number(targetMetrics.durationMinutes) : null,
  sets: targetMetrics.sets != null ? Number(targetMetrics.sets) : null,
  reps: targetMetrics.reps != null ? Number(targetMetrics.reps) : null,
  weight: targetMetrics.weight != null ? Number(targetMetrics.weight) : null,
  distance: targetMetrics.distance != null ? Number(targetMetrics.distance) : null,
  calories: targetMetrics.calories != null ? Number(targetMetrics.calories) : null,
  avgSpeed: targetMetrics.avgSpeed != null ? Number(targetMetrics.avgSpeed) : null,
});

const getExerciseLibrary = async (req, res) => {
  try {
    const { search = "", category = "all" } = req.query;

    const query = {};

    if (category !== "all") {
      query.muscleGroup = category;
    }

    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { equipment: { $regex: search.trim(), $options: "i" } },
        { muscleGroup: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const exercises = await Exercise.find(query).sort({ createdAt: -1 });

    res.status(200).json({ data: exercises });
  } catch (error) {
    console.log("Get exercise library error:", error);
    res.status(500).json({ message: error.message });
  }
};

const createCustomExercise = async (req, res) => {
  try {
    const {
      name,
      category,
      equipment,
      equipmentType,
      muscleGroup,
      difficulty,
      defaultSets,
      defaultReps,
      defaultRestSeconds,
      instructions,
      metricProfile,
      imageUrl,
    } = req.body;

    const exercise = await Exercise.create({
      name: (name || "").trim(),
      category: (category || "General").trim(),
      equipment: (equipment || "").trim(),
      equipmentType: equipmentType || 'Strength',
      muscleGroup: (muscleGroup || "Full Body").trim(),
      difficulty: difficulty || "Beginner",
      defaultSets: Math.max(1, Number(defaultSets || 1)),
      defaultReps: (defaultReps || "8-10").trim(),
      defaultRestSeconds: Number(defaultRestSeconds || 60),
      instructions: (instructions || "").trim(),
      metricProfile: deriveMetricProfile(equipmentType, metricProfile),
      imageUrl: buildUploadedPath(req.file) || imageUrl || "",
      createdBy: req.user?._id || null,
      isCustom: true,
    });

    res.status(201).json({
      message: "Custom exercise created successfully.",
      data: exercise,
    });
  } catch (error) {
    console.log("Create custom exercise error:", error);
    res.status(400).json({ message: error.message });
  }
};

const updateCustomExercise = async (req, res) => {
  try {
    const { exerciseId } = req.params;
    const {
      name,
      category,
      equipment,
      equipmentType,
      muscleGroup,
      difficulty,
      defaultSets,
      defaultReps,
      defaultRestSeconds,
      instructions,
      metricProfile,
      imageUrl,
    } = req.body;

    const exercise = await Exercise.findById(exerciseId);

    if (!exercise) {
      return res.status(404).json({ message: "Exercise not found." });
    }

    exercise.name = (name || exercise.name).trim();
    exercise.category = (category || exercise.category).trim();
    exercise.equipment = (equipment || "").trim();
    exercise.equipmentType = equipmentType || exercise.equipmentType || 'Strength';
    exercise.muscleGroup = (muscleGroup || exercise.muscleGroup).trim();
    exercise.difficulty = difficulty || exercise.difficulty;
    exercise.defaultSets = Math.max(1, Number(defaultSets || exercise.defaultSets || 1));
    exercise.defaultReps = (defaultReps || exercise.defaultReps || "8-10").trim();
    exercise.defaultRestSeconds = Number(
      defaultRestSeconds || exercise.defaultRestSeconds || 60
    );
    exercise.instructions = (instructions || "").trim();
    exercise.metricProfile = deriveMetricProfile(exercise.equipmentType, metricProfile || exercise.metricProfile || '');
    exercise.imageUrl = buildUploadedPath(req.file) || imageUrl || exercise.imageUrl || "";

    const updated = await exercise.save();

    res.status(200).json({
      message: "Custom exercise updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.log("Update custom exercise error:", error);
    res.status(400).json({ message: error.message });
  }
};

const normalizeExercises = async (exercises) => {
  if (!Array.isArray(exercises)) return [];

  const exerciseIds = exercises
    .map((item) => item.exerciseId)
    .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
    .map(String);

  const exerciseDocs = await Exercise.find({ _id: { $in: exerciseIds } });
  const exerciseMap = exerciseDocs.reduce((map, doc) => map.set(String(doc._id), doc), new Map());

  return exercises.map((item) => {
    const id = String(item.exerciseId || '');
    const exercise = exerciseMap.get(id);
    if (!id || !exercise) {
      throw new Error(`Exercise not found or invalid: ${item.exerciseId}`);
    }

    const equipmentType = item.equipmentType || exercise.equipmentType || 'Strength';
    const metricProfile = deriveMetricProfile(equipmentType, item.metricProfile || exercise.metricProfile || '');
    return {
      planExerciseId: item.planExerciseId || new mongoose.Types.ObjectId().toString(),
      exerciseId: id,
      name: item.name?.trim() || exercise.name,
      equipment: item.equipment?.trim() || exercise.equipment || "",
      equipmentType,
      metricProfile,
      muscleGroup: item.muscleGroup?.trim() || exercise.muscleGroup || "",
      difficulty: item.difficulty || exercise.difficulty || "Beginner",
      sets: Math.max(1, Number(item.sets || exercise.defaultSets || 1)),
      reps: item.reps || exercise.defaultReps || "8-10",
      restSeconds: Number(item.restSeconds || exercise.defaultRestSeconds || 60),
      instructions: item.instructions?.trim() || exercise.instructions || "",
      imageUrl: item.imageUrl || exercise.imageUrl || "",
      targetMetrics: normalizeTargetMetrics({
        durationMinutes: item.targetMetrics?.durationMinutes,
        sets: item.targetMetrics?.sets ?? item.sets ?? exercise.defaultSets,
        reps: item.targetMetrics?.reps,
        weight: item.targetMetrics?.weight,
        distance: item.targetMetrics?.distance,
        calories: item.targetMetrics?.calories,
        avgSpeed: item.targetMetrics?.avgSpeed,
      }),
      scheduledDay: item.scheduledDay || 'Anytime',
      progress: {
        status: item.progress?.status || 'not_started',
        firstStartedAt: item.progress?.firstStartedAt || null,
        lastStartedAt: item.progress?.lastStartedAt || null,
        lastCompletedAt: item.progress?.lastCompletedAt || null,
        completionCount: Number(item.progress?.completionCount || 0),
        adherenceScore: Number(item.progress?.adherenceScore || 0),
        bestPerformance: {
          weight: Number(item.progress?.bestPerformance?.weight || 0),
          reps: Number(item.progress?.bestPerformance?.reps || 0),
          sets: Number(item.progress?.bestPerformance?.sets || 0),
          distance: Number(item.progress?.bestPerformance?.distance || 0),
          calories: Number(item.progress?.bestPerformance?.calories || 0),
          avgSpeed: Number(item.progress?.bestPerformance?.avgSpeed || 0),
          durationMinutes: Number(item.progress?.bestPerformance?.durationMinutes || 0),
          volume: Number(item.progress?.bestPerformance?.volume || 0),
        },
      },
    };
  });
};

const createWorkoutPlan = async (req, res) => {
  try {
    const {
      memberId,
      planName,
      description,
      goal,
      difficulty,
      durationWeeks,
      exercises,
    } = req.body;

    const member = await User.findById(memberId);

    if (!member) {
      return res.status(404).json({ message: "Member not found." });
    }

    const plan = await WorkoutPlan.create({
      planCode: generateWorkoutPlanCode(),
      memberId,
      trainerId: req.user._id,
      planName: (planName || "").trim(),
      description: (description || "").trim(),
      goal: (goal || "").trim(),
      difficulty,
      durationWeeks: Number(durationWeeks || 4),
      exercises: await normalizeExercises(exercises),
      status: "active",
    });

    res.status(201).json({
      message: "Workout plan created successfully.",
      data: plan,
    });
  } catch (error) {
    console.log("Create workout plan error:", error);
    res.status(400).json({ message: error.message });
  }
};


const getPlansCount = async (req, res) => {
  try {
    const activePlansCount = await WorkoutPlan.countDocuments({ status: "active" });
    const archivedPlansCount = await WorkoutPlan.countDocuments({ status: "archived" });

    res.status(200).json({
      activePlansCount,
      archivedPlansCount,
    });
  } catch (error) {
    console.log("Get plans count error:", error);
    res.status(500).json({ message: error.message });
  }
};



const updateWorkoutPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const {
      planName,
      description,
      goal,
      difficulty,
      durationWeeks,
      exercises,
    } = req.body;

    const plan = await WorkoutPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: "Workout plan not found." });
    }

    plan.planName = (planName || plan.planName).trim();
    plan.description = (description || "").trim();
    plan.goal = (goal || plan.goal).trim();
    plan.difficulty = difficulty || plan.difficulty;
    plan.durationWeeks = Number(durationWeeks || plan.durationWeeks);
    if (Array.isArray(exercises)) {
      plan.exercises = await normalizeExercises(exercises);
    }

    const updated = await plan.save();

    res.status(200).json({
      message: "Workout plan updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.log("Update workout plan error:", error);
    res.status(400).json({ message: error.message });
  }
};

const getWorkoutPlansForMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { status = "active" } = req.query;

    const query = { memberId };

    if (status !== "all") {
      query.status = status;
    }

    const plans = await WorkoutPlan.find(query).sort({ createdAt: -1 });

    res.status(200).json({ data: plans.map(attachWorkoutInsights) });
  } catch (error) {
    console.log("Get workout plans error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getWorkoutPlanById = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await WorkoutPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: "Workout plan not found." });
    }

    res.status(200).json({ data: attachWorkoutInsights(plan) });
  } catch (error) {
    console.log("Get workout plan by id error:", error);
    res.status(500).json({ message: error.message });
  }
};

const archiveWorkoutPlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await WorkoutPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: "Workout plan not found." });
    }

    plan.status = "archived";
    await plan.save();

    res.status(200).json({
      message: "Workout plan archived successfully.",
    });
  } catch (error) {
    console.log("Archive workout plan error:", error);
    res.status(500).json({ message: error.message });
  }
};

const restoreWorkoutPlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await WorkoutPlan.findById(planId);

    if (!plan) {
      return res.status(404).json({ message: "Workout plan not found." });
    }

    plan.status = "active";
    await plan.save();

    res.status(200).json({
      message: "Workout plan restored successfully.",
    });
  } catch (error) {
    console.log("Restore workout plan error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getExerciseLibrary,
  createCustomExercise,
  updateCustomExercise,
  createWorkoutPlan,
  updateWorkoutPlan,
  getWorkoutPlansForMember,
  getWorkoutPlanById,
  archiveWorkoutPlan,
  restoreWorkoutPlan,
  getPlansCount,
};