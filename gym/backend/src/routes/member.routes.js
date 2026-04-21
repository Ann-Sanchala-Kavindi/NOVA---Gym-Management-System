const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const MealPlan = require('../models/MealPlan');
const TrainerSchedule = require('../models/TrainerSchedule');
const Equipment = require('../models/Equipment');
const WorkoutSession = require('../models/WorkoutSession');
const WorkoutPlan = require('../models/WorkoutPlan');
const Challenge = require('../models/Challenge');
const UserChallenge = require('../models/UserChallenge');
const MembershipUpgradeRequest = require('../models/MembershipUpgradeRequest');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Feedback = require('../models/Feedback');
const FeedbackReaction = require('../models/FeedbackReaction');
const Notification = require('../models/Notification');
const { classifyFeedback } = require('../utils/feedback-ai');
const { getJwtSecret } = require('../utils/auth');

const router = express.Router();

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized. Token required.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.userId = decoded.sub;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

async function requireMemberRole(req, res, next) {
  const user = await User.findById(req.userId);
  if (!user || (user.role || 'member') !== 'member') {
    return res.status(403).json({ message: 'Member access required.' });
  }
  req.user = user;
  next();
}

function normalizeDate(dateString) {
  if (!dateString) return null;
  const asDate = new Date(dateString);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString().slice(0, 10);
}

function toMinutes(timeValue) {
  const [h, m] = String(timeValue || '').split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  return h * 60 + m;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function buildMemberMealPlanResponse(mealPlan) {
  if (!mealPlan) return null;

  const meals = Array.isArray(mealPlan.meals)
    ? mealPlan.meals.map((meal) => {
        const items = Array.isArray(meal?.foods)
          ? meal.foods.map((food) => ({
              food: food?.name || '',
              quantity: food?.servingText || '',
              calories: Number(food?.calories) || 0,
              protein: Number(food?.protein) || 0,
              carbs: Number(food?.carbs) || 0,
              fat: Number(food?.fat) || 0,
              foodId: food?.foodId || null,
              category: food?.category || '',
              imageUrl: food?.imageUrl || '',
            }))
          : [];

        const totals = items.reduce(
          (acc, item) => {
            acc.calories += item.calories || 0;
            acc.protein += item.protein || 0;
            acc.carbs += item.carbs || 0;
            acc.fat += item.fat || 0;
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );

        return {
          name: meal?.name || '',
          time: meal?.timeLabel || '',
          items,
          totals,
        };
      })
    : [];

  const summary = meals.reduce(
    (acc, meal) => {
      acc.calories += meal.totals?.calories || 0;
      acc.protein += meal.totals?.protein || 0;
      acc.carbs += meal.totals?.carbs || 0;
      acc.fat += meal.totals?.fat || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    id: mealPlan._id,
    trainerId: mealPlan.trainerId?._id || null,
    trainerName: mealPlan.trainerId?.name || '',
    trainerEmail: mealPlan.trainerId?.email || '',
    phase: mealPlan.planName || mealPlan.goal || 'Custom',
    targetCalories: summary.calories,
    macros: {
      protein: summary.protein,
      carbs: summary.carbs,
      fat: summary.fat,
      fats: summary.fat,
    },
    waterIntakeLiters: 0,
    notes: mealPlan.description || '',
    meals,
    updatedAt: mealPlan.updatedAt,
  };
}


router.get('/profile', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const member = await User.findById(req.userId)
      .populate('assignedTrainerId', '_id name email specialization')
      .lean();

    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    return res.json({
      message: 'Member profile retrieved successfully.',
      profile: {
        id: member._id,
        name: member.name || '',
        email: member.email,
        role: member.role || 'member',
        memberType: member.memberType || 'normal',
        onboardingCompleted: !!member.onboardingCompleted,
        points: typeof member.points === 'number' ? member.points : 0,
        assignedTrainerId: member.assignedTrainerId?._id || null,
        assignedTrainerName: member.assignedTrainerId?.name || '',
        assignedTrainerEmail: member.assignedTrainerId?.email || '',
        assignedTrainerSpecialization: member.assignedTrainerId?.specialization || '',
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch member profile.', error: error.message });
  }
});

router.get('/sessions', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const requestedDate = normalizeDate(req.query.date);
    const today = new Date();
    const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;

    // Get member's assigned trainer
    const member = await User.findById(req.userId).select('assignedTrainerId');
    if (!member?.assignedTrainerId) {
      return res.json([]); // No assigned trainer, no sessions to show
    }

    // Build date filter
    // If a specific date is requested, use it; otherwise get all upcoming sessions
    const dateFilter = requestedDate ? { date: requestedDate } : { date: { $gte: todayLocal } };

    // Fetch sessions from the member's assigned trainer
    // Include sessions where:
    // 1. Member is explicitly added to memberIds (booked)
    // 2. Member is the singleMemberId (1v1 personal training)
    // 3. Member is in selectedMemberIds (pending invitations)
    const sessions = await Session.find({
      trainerId: member.assignedTrainerId,
      ...dateFilter,
      $or: [
        { memberIds: req.userId },                    // Member has booked group session
        { singleMemberId: req.userId },              // Member has 1v1 session
        { selectedMemberIds: req.userId }             // Member is invited to group session
      ],
    })
      .populate('trainerId', '_id name email')
      .sort({ date: 1, startTime: 1, createdAt: -1 })
      .lean();

    return res.json(
      sessions.map((session) => {
        const bookedGroup = Array.isArray(session.memberIds)
          ? session.memberIds.some((id) => String(id) === String(req.userId))
          : false;
        const bookedOneToOne = session.singleMemberId
          ? String(session.singleMemberId) === String(req.userId)
          : false;
        const invitedGroup = Array.isArray(session.selectedMemberIds)
          ? session.selectedMemberIds.some((id) => String(id) === String(req.userId))
          : false;
        const legacyPendingInvite =
          session.sessionType === 'group' &&
          session.status === 'pending' &&
          bookedGroup &&
          (!Array.isArray(session.selectedMemberIds) || session.selectedMemberIds.length === 0);

        const finalIsInvited = invitedGroup || legacyPendingInvite;
        const finalIsBooked = (bookedGroup && !legacyPendingInvite) || bookedOneToOne;

        return {
          id: session._id.toString(),
          name: session.name,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
          cancellationReason: session.cancellationReason || '',
          trainerId: session.trainerId?._id || null,
          trainerName: session.trainerId?.name || '',
          trainerEmail: session.trainerId?.email || '',
          sessionType: session.sessionType,
          memberCount: session.memberIds?.length || 0,
          isBooked: finalIsBooked,
          isInvited: finalIsInvited,
        };
      })
    );
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch member sessions.', error: error.message });
  }
});

// Workout & Equipment Endpoints

router.get('/equipment', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const equipment = await Equipment.find({
      isAvailable: true,
      maintenanceStatus: { $ne: 'OutOfOrder' },
    }).sort({ name: 1 });

    return res.json({
      message: 'Equipment retrieved successfully.',
      equipment: equipment.map((eq) => ({
        id: eq._id,
        name: eq.name,
        category: eq.category,
        description: eq.description,
        imageUrl: eq.imageUrl || '',
        location: eq.location,
        maintenanceStatus: eq.maintenanceStatus,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch equipment.', error: error.message });
  }
});

// Membership upgrade requests

router.get('/membership/upgrade-request', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const latest = await MembershipUpgradeRequest.findOne({ memberId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      message: 'Latest membership upgrade request status.',
      request: latest
        ? {
            id: latest._id,
            status: latest.status,
            reason: latest.reason,
            decisionNote: latest.decisionNote || '',
            reviewedBy: latest.reviewedBy || null,
            reviewedAt: latest.reviewedAt || null,
            createdAt: latest.createdAt,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch membership upgrade request.', error: error.message });
  }
});

router.post('/membership/upgrade-request', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const user = req.user;

    if ((user.memberType || 'normal') === 'premium') {
      return res.status(400).json({ message: 'You are already a premium member.' });
    }

    const existingPending = await MembershipUpgradeRequest.findOne({
      memberId: user._id,
      status: 'pending',
    }).lean();

    if (existingPending) {
      return res.status(400).json({ message: 'You already have a pending premium request.' });
    }

    const reason = String(req.body.reason || '').trim();

    const request = await MembershipUpgradeRequest.create({
      memberId: user._id,
      reason,
    });

    return res.status(201).json({
      message: 'Membership upgrade request submitted successfully.',
      request: {
        id: request._id,
        status: request.status,
        reason: request.reason,
        decisionNote: request.decisionNote || '',
        reviewedBy: request.reviewedBy || null,
        reviewedAt: request.reviewedAt || null,
        createdAt: request.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit membership upgrade request.', error: error.message });
  }
});

router.post('/workouts/start', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const { equipmentId, workoutPlanId, planExerciseId, linkedExerciseName, equipmentCategory } = req.body || {};

    let equipment = null;
    let linkedPlan = null;
    let linkedExercise = null;

    if (workoutPlanId && planExerciseId) {
      linkedPlan = await WorkoutPlan.findOne({ _id: workoutPlanId, memberId: req.userId, status: 'active' });
      if (!linkedPlan) {
        return res.status(404).json({ message: 'Assigned workout plan not found.' });
      }

      linkedExercise = (linkedPlan.exercises || []).find((item) => String(item.planExerciseId) === String(planExerciseId));
      if (!linkedExercise) {
        return res.status(404).json({ message: 'Assigned exercise not found in the workout plan.' });
      }
    } else {
      if (!equipmentId) {
        return res.status(400).json({ message: 'Equipment ID is required.' });
      }

      equipment = await Equipment.findById(equipmentId);
      if (!equipment) {
        return res.status(404).json({ message: 'Equipment not found.' });
      }

      if (!equipment.isAvailable || equipment.maintenanceStatus === 'OutOfOrder') {
        return res.status(400).json({ message: 'Equipment is not available for use.' });
      }
    }

    const workoutSession = new WorkoutSession({
      memberId: req.userId,
      equipmentId: equipment?._id || null,
      equipmentName: equipment?.name || linkedExercise?.name || linkedExerciseName || 'Assigned Exercise',
      equipmentCategory: equipment?.category || linkedExercise?.equipmentType || equipmentCategory || 'Other',
      workoutPlanId: linkedPlan?._id || null,
      planExerciseId: linkedExercise ? String(linkedExercise.planExerciseId) : null,
      linkedExerciseName: linkedExercise?.name || linkedExerciseName || '',
      startTime: new Date(),
      status: 'active',
    });

    await workoutSession.save();

    if (linkedPlan && linkedExercise) {
      linkedExercise.progress = linkedExercise.progress || {};
      linkedExercise.progress.status = 'in_progress';
      linkedExercise.progress.firstStartedAt = linkedExercise.progress.firstStartedAt || new Date();
      linkedExercise.progress.lastStartedAt = new Date();
      await linkedPlan.save();
    }

    return res.status(201).json({
      message: 'Workout session started.',
      workoutSession: {
        id: workoutSession._id,
        equipmentName: workoutSession.equipmentName,
        equipmentCategory: workoutSession.equipmentCategory,
        startTime: workoutSession.startTime,
        status: workoutSession.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to start workout session.', error: error.message });
  }
});

router.patch('/workouts/:id', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const { performanceMetrics, status, elapsedSeconds } = req.body;
    const workoutSession = await WorkoutSession.findById(req.params.id);

    if (!workoutSession) {
      return res.status(404).json({ message: 'Workout session not found.' });
    }

    if (workoutSession.memberId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized to update this workout session.' });
    }

    if (performanceMetrics) {
      workoutSession.performanceMetrics = {
        ...workoutSession.performanceMetrics,
        ...performanceMetrics,
      };
    }

    if (status && ['active', 'paused', 'completed'].includes(status)) {
      workoutSession.status = status;
    }

    // Store frontend-tracked elapsed seconds for accurate duration calculation
    if (typeof elapsedSeconds === 'number' && elapsedSeconds > 0) {
      workoutSession.frontendElapsedSeconds = elapsedSeconds;
      workoutSession.durationSeconds = Math.floor(elapsedSeconds);
    }

    await workoutSession.save();

    return res.json({
      message: 'Workout session updated.',
      workoutSession: {
        id: workoutSession._id,
        equipmentName: workoutSession.equipmentName,
        durationSeconds: workoutSession.durationSeconds || 0,
        status: workoutSession.status,
        performanceMetrics: workoutSession.performanceMetrics,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update workout session.', error: error.message });
  }
});

router.post('/workouts/:id/finish', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const workoutSession = await WorkoutSession.findById(req.params.id);

    if (!workoutSession) {
      return res.status(404).json({ message: 'Workout session not found.' });
    }

    if (workoutSession.memberId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized to finish this workout session.' });
    }

    workoutSession.endTime = new Date();
    workoutSession.status = 'completed';

    // Use frontend-tracked elapsed seconds if available, otherwise calculate from server timestamps.
    // Keep second precision and avoid saving non-zero sessions as 0 minutes.
    let durationSeconds = 0;
    if (workoutSession.frontendElapsedSeconds && workoutSession.frontendElapsedSeconds > 0) {
      durationSeconds = Math.floor(workoutSession.frontendElapsedSeconds);
    } else if (workoutSession.startTime && workoutSession.endTime) {
      const durationMs = workoutSession.endTime - workoutSession.startTime;
      durationSeconds = Math.max(0, Math.floor(durationMs / 1000));
    }

    workoutSession.durationSeconds = durationSeconds;
    workoutSession.durationMinutes = durationSeconds > 0
      ? Number((durationSeconds / 60).toFixed(4))
      : 0;

    const completionQuality = workoutSession.performanceMetrics?.completionQuality || 'as_prescribed';

    await workoutSession.save();

    if (workoutSession.workoutPlanId && workoutSession.planExerciseId) {
      const linkedPlan = await WorkoutPlan.findOne({ _id: workoutSession.workoutPlanId, memberId: req.userId });
      if (linkedPlan) {
        const linkedExercise = (linkedPlan.exercises || []).find((item) => String(item.planExerciseId) === String(workoutSession.planExerciseId));
        if (linkedExercise) {
          linkedExercise.progress = linkedExercise.progress || {};
          linkedExercise.progress.status = completionQuality === 'skipped' ? 'skipped' : (completionQuality === 'partial' ? 'in_progress' : 'completed');
          linkedExercise.progress.lastCompletedAt = new Date();
          linkedExercise.progress.lastStartedAt = linkedExercise.progress.lastStartedAt || workoutSession.startTime || new Date();
          linkedExercise.progress.firstStartedAt = linkedExercise.progress.firstStartedAt || workoutSession.startTime || new Date();
          linkedExercise.progress.completionCount = Number(linkedExercise.progress.completionCount || 0) + 1;

          const expectedSets = Number(linkedExercise.sets || linkedExercise.targetMetrics?.sets || 0);
          const completedSets = Number(workoutSession.performanceMetrics?.sets || 0);
          const qualityMultiplier = completionQuality === 'as_prescribed' ? 1 : completionQuality === 'partial' ? 0.65 : completionQuality === 'pain_stop' ? 0.3 : 0;
          const adherence = expectedSets > 0
            ? Math.min(100, Math.round((completedSets / expectedSets) * 100 * qualityMultiplier))
            : Math.round((durationSeconds > 0 ? 100 : 0) * qualityMultiplier);
          linkedExercise.progress.adherenceScore = Math.max(Number(linkedExercise.progress.adherenceScore || 0), adherence);
          linkedExercise.progress.lastCompletionQuality = completionQuality;
          linkedExercise.progress.lastDifficultyRating = workoutSession.performanceMetrics?.difficultyRating ?? null;
          linkedExercise.progress.lastDiscomfortLevel = workoutSession.performanceMetrics?.discomfortLevel ?? null;
          linkedExercise.progress.lastPainNote = String(workoutSession.performanceMetrics?.painNote || '').trim();

          const best = linkedExercise.progress.bestPerformance || {};
          const metrics = workoutSession.performanceMetrics || {};
          const nextWeight = Number(metrics.weight || 0);
          const nextReps = Number(metrics.reps || 0);
          const nextSets = Number(metrics.sets || 0);
          const nextDistance = Number(metrics.distance || 0);
          const nextCalories = Number(metrics.calories || 0);
          const nextAvgSpeed = Number(metrics.avgSpeed || 0);
          const nextDurationMinutes = Number(workoutSession.durationMinutes || 0);
          const nextVolume = nextWeight * nextReps * Math.max(nextSets, 1);

          linkedExercise.progress.bestPerformance = {
            weight: Math.max(Number(best.weight || 0), nextWeight),
            reps: Math.max(Number(best.reps || 0), nextReps),
            sets: Math.max(Number(best.sets || 0), nextSets),
            distance: Math.max(Number(best.distance || 0), nextDistance),
            calories: Math.max(Number(best.calories || 0), nextCalories),
            avgSpeed: Math.max(Number(best.avgSpeed || 0), nextAvgSpeed),
            durationMinutes: Math.max(Number(best.durationMinutes || 0), nextDurationMinutes),
            volume: Math.max(Number(best.volume || 0), nextVolume),
          };

          await linkedPlan.save();
        }
      }
    }

    const member = req.user || (await User.findById(req.userId));
    const challengeUpdates = member
      ? await applyWorkoutToChallenges({ member, workoutSession })
      : [];

    return res.json({
      message: 'Workout session completed.',
      workoutSession: {
        id: workoutSession._id,
        equipmentName: workoutSession.equipmentName,
        durationSeconds: workoutSession.durationSeconds || 0,
        durationMinutes: workoutSession.durationMinutes,
        status: workoutSession.status,
        performanceMetrics: workoutSession.performanceMetrics,
      },
      challengeUpdates,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to finish workout session.', error: error.message });
  }
});

router.get('/workouts', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const workouts = await WorkoutSession.find({
      memberId: req.userId,
      status: 'completed',
    })
      .sort({ endTime: -1 })
      .skip(skip)
      .limit(limit);

    const total = await WorkoutSession.countDocuments({
      memberId: req.userId,
      status: 'completed',
    });

    return res.json({
      message: 'Workout history retrieved.',
      workouts: workouts.map((w) => ({
        id: w._id,
        equipmentName: w.equipmentName,
        equipmentCategory: w.equipmentCategory,
        startTime: w.startTime,
        endTime: w.endTime,
        durationSeconds: w.durationSeconds || 0,
        durationMinutes: w.durationMinutes,
        performanceMetrics: w.performanceMetrics,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch workout history.', error: error.message });
  }
});

router.get('/workouts/stats', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const workouts = await WorkoutSession.find({
      memberId: req.userId,
      status: 'completed',
    });

    const totalMinutesRaw = workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
    const totalMinutes = Number(totalMinutesRaw.toFixed(4));
    const totalWorkouts = workouts.length;

    const statsByCategory = {};
    workouts.forEach((w) => {
      if (!statsByCategory[w.equipmentCategory]) {
        statsByCategory[w.equipmentCategory] = {
          count: 0,
          totalMinutes: 0,
        };
      }
      statsByCategory[w.equipmentCategory].count += 1;
      statsByCategory[w.equipmentCategory].totalMinutes += w.durationMinutes || 0;
    });

    Object.keys(statsByCategory).forEach((category) => {
      statsByCategory[category].totalMinutes = Number(statsByCategory[category].totalMinutes.toFixed(4));
    });

    return res.json({
      message: 'Workout stats retrieved.',
      stats: {
        totalWorkouts,
        totalMinutes,
        averageMinutesPerWorkout:
          totalWorkouts > 0 ? Number((totalMinutes / totalWorkouts).toFixed(4)) : 0,
        byCategory: statsByCategory,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch workout stats.', error: error.message });
  }
});

// Points leaderboard (for members)
router.get('/points/leaderboard', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const member = req.user || (await User.findById(req.userId));

    const query = { role: 'member' };
    if (member && member.assignedTrainerId) {
      query.assignedTrainerId = member.assignedTrainerId;
    }

    const members = await User.find(query)
      .sort({ points: -1, _id: 1 })
      .select('_id name email points avatar')
      .limit(50)
      .lean();

    let myRank = null;
    const leaderboard = members.map((m, index) => {
      const rank = index + 1;
      if (String(m._id) === String(req.userId)) {
        myRank = rank;
      }
      return {
        rank,
        id: m._id,
        name: m.name || '',
        email: m.email,
        points: typeof m.points === 'number' ? m.points : 0,
        avatar: m.avatar || null,
      };
    });

    return res.json({
      leaderboard,
      myRank,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch points leaderboard.', error: error.message });
  }
});

function getChallengeWindowStatus(challenge, now) {
  if (challenge.endsAt && new Date(challenge.endsAt) < now) return 'expired';
  if (challenge.startsAt && new Date(challenge.startsAt) > now) return 'upcoming';
  return 'active';
}

function challengeProgressPercent(challenge, userChallenge) {
  const target = Math.max(1, Number(challenge.targetValue || 1));
  if (!userChallenge) return 0;
  if (challenge.challengeType === 'daily') {
    return Math.min(100, Math.round(((userChallenge.progressDays || 0) / target) * 100));
  }
  return Math.min(100, Math.round(((userChallenge.progressValue || 0) / target) * 100));
}

function shouldAutoComplete(challenge, userChallenge) {
  if (!userChallenge) return false;
  if (challenge.completionMode !== 'progress') return false;
  const target = Math.max(1, Number(challenge.targetValue || 1));
  if (challenge.challengeType === 'daily') {
    return (userChallenge.progressDays || 0) >= target;
  }
  return (userChallenge.progressValue || 0) >= target;
}

function workoutContributionForChallenge(challenge, workoutSession) {
  const goalType = challenge.workoutGoalType || 'none';
  if (goalType === 'duration-minutes') {
    const seconds = Number(workoutSession.durationSeconds || 0);
    return seconds > 0 ? Number((seconds / 60).toFixed(2)) : 0;
  }
  if (goalType === 'reps') {
    return Number(workoutSession.performanceMetrics?.reps || 0);
  }
  if (goalType === 'sets') {
    return Number(workoutSession.performanceMetrics?.sets || 0);
  }
  return 0;
}

async function applyWorkoutToChallenges({ member, workoutSession }) {
  if (!member?.assignedTrainerId) return [];

  const now = new Date();
  const challenges = await Challenge.find({
    trainerId: member.assignedTrainerId,
    isActive: true,
    equipmentId: workoutSession.equipmentId,
    workoutGoalType: { $in: ['duration-minutes', 'reps', 'sets'] },
  });

  if (!challenges.length) return [];

  const challengeIds = challenges.map((c) => c._id);
  const userChallenges = await UserChallenge.find({
    memberId: member._id,
    challengeId: { $in: challengeIds },
  });

  const userChallengeByChallengeId = new Map(userChallenges.map((uc) => [String(uc.challengeId), uc]));
  const updates = [];
  let pointsAdded = 0;

  for (const challenge of challenges) {
    const inWindow = (!challenge.startsAt || challenge.startsAt <= now) && (!challenge.endsAt || challenge.endsAt >= now);
    if (!inWindow) continue;

    const userChallenge = userChallengeByChallengeId.get(String(challenge._id));
    if (!userChallenge) continue;
    if (!['active', 'pending-approval'].includes(userChallenge.status)) continue;

    const contribution = workoutContributionForChallenge(challenge, workoutSession);
    if (!Number.isFinite(contribution) || contribution <= 0) continue;

    userChallenge.progressValue = Number((Number(userChallenge.progressValue || 0) + contribution).toFixed(2));
    userChallenge.lastProgressAt = now;

    if (shouldAutoComplete(challenge, userChallenge)) {
      if (challenge.requiresTrainerApproval || challenge.completionMode === 'proof') {
        userChallenge.status = 'pending-approval';
      } else {
        userChallenge.status = 'completed';
        userChallenge.completedAt = now;
        if (!userChallenge.pointsAwarded) {
          userChallenge.pointsAwarded = challenge.pointsReward;
          pointsAdded += challenge.pointsReward;
        }
      }
    }

    await userChallenge.save();
    updates.push({
      challengeId: challenge._id,
      title: challenge.title,
      workoutGoalType: challenge.workoutGoalType || 'none',
      addedProgress: contribution,
      progressValue: userChallenge.progressValue || 0,
      targetValue: challenge.targetValue || 1,
      status: userChallenge.status,
    });
  }

  if (pointsAdded > 0) {
    member.points = (member.points || 0) + pointsAdded;
    await member.save();
  }

  return updates;
}

async function buildChallengeDashboard(memberId, trainerId) {
  const now = new Date();
  const challenges = await Challenge.find({ trainerId, isActive: true }).sort({ createdAt: -1 }).lean();
  const challengeIds = challenges.map((c) => c._id);
  const userChallenges = await UserChallenge.find({ memberId, challengeId: { $in: challengeIds } }).lean();
  const userChallengeMap = new Map(userChallenges.map((uc) => [String(uc.challengeId), uc]));

  const activeChallenges = [];
  const completedChallenges = [];
  const upcomingChallenges = [];
  const expiredChallenges = [];

  for (const challenge of challenges) {
    const uc = userChallengeMap.get(String(challenge._id));
    const windowStatus = getChallengeWindowStatus(challenge, now);
    const completed = uc?.status === 'completed';
    const expired = windowStatus === 'expired' && !completed;
    const effectiveStatus = completed
      ? 'completed'
      : uc?.status === 'pending-approval'
        ? 'pending-approval'
        : expired
          ? 'expired'
          : windowStatus;

    const item = {
      id: challenge._id,
      title: challenge.title,
      description: challenge.description,
      pointsReward: challenge.pointsReward,
      difficulty: challenge.difficulty,
      challengeType: challenge.challengeType,
      completionMode: challenge.completionMode,
      equipmentId: challenge.equipmentId || null,
      equipmentName: challenge.equipmentNameSnapshot || '',
      workoutGoalType: challenge.workoutGoalType || 'none',
      targetValue: challenge.targetValue,
      targetUnit: challenge.targetUnit,
      requiresTrainerApproval: !!challenge.requiresTrainerApproval,
      startsAt: challenge.startsAt,
      endsAt: challenge.endsAt,
      status: effectiveStatus,
      started: !!uc,
      progressValue: uc?.progressValue || 0,
      progressDays: uc?.progressDays || 0,
      progressPercent: challengeProgressPercent(challenge, uc),
      proofUrl: uc?.proofUrl || '',
      proofNote: uc?.proofNote || '',
      completedAt: uc?.completedAt || null,
    };

    if (effectiveStatus === 'completed') completedChallenges.push(item);
    else if (effectiveStatus === 'upcoming') upcomingChallenges.push(item);
    else if (effectiveStatus === 'expired') expiredChallenges.push(item);
    else activeChallenges.push(item);
  }

  const challengePointsEarned = userChallenges.reduce((sum, item) => sum + (item.pointsAwarded || 0), 0);
  const completedCount = userChallenges.filter((item) => item.status === 'completed').length;

  const member = await User.findById(memberId).select('_id points assignedTrainerId').lean();
  const leaderboardMembers = await User.find({
    role: 'member',
    assignedTrainerId: member?.assignedTrainerId || trainerId,
  })
    .sort({ points: -1, _id: 1 })
    .select('_id')
    .limit(200)
    .lean();
  const myRank = leaderboardMembers.findIndex((m) => String(m._id) === String(memberId)) + 1 || null;

  return {
    summary: {
      challengePointsEarned,
      completedChallenges: completedCount,
      currentLeaderboardRank: myRank || null,
    },
    activeChallenges,
    completedChallenges,
    upcomingChallenges,
    expiredChallenges,
  };
}

// Challenges dashboard for members
router.get('/challenges', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const member = req.user || (await User.findById(req.userId));
    if (!member?.assignedTrainerId) {
      return res.json({
        summary: { challengePointsEarned: 0, completedChallenges: 0, currentLeaderboardRank: null },
        activeChallenges: [],
        completedChallenges: [],
        upcomingChallenges: [],
        expiredChallenges: [],
      });
    }

    const dashboard = await buildChallengeDashboard(req.userId, member.assignedTrainerId);
    return res.json(dashboard);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch challenges.', error: error.message });
  }
});

router.post('/user-challenges/start', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const { challengeId } = req.body;
    if (!challengeId) return res.status(400).json({ message: 'challengeId is required.' });

    const member = req.user || (await User.findById(req.userId));
    if (!member?.assignedTrainerId) {
      return res.status(403).json({ message: 'No trainer assigned.' });
    }

    const challenge = await Challenge.findOne({
      _id: challengeId,
      trainerId: member.assignedTrainerId,
      isActive: true,
    });
    if (!challenge) return res.status(404).json({ message: 'Challenge not found.' });

    const now = new Date();
    if (challenge.startsAt && challenge.startsAt > now) {
      return res.status(400).json({ message: 'Challenge is not active yet.' });
    }
    if (challenge.endsAt && challenge.endsAt < now) {
      return res.status(400).json({ message: 'Challenge has expired.' });
    }

    const existing = await UserChallenge.findOne({ memberId: req.userId, challengeId: challenge._id });
    if (existing) {
      return res.json({ message: 'Challenge already started.', userChallenge: existing });
    }

    const userChallenge = await UserChallenge.create({
      memberId: req.userId,
      trainerId: member.assignedTrainerId,
      challengeId: challenge._id,
      status: 'active',
      startedAt: now,
      progressValue: 0,
      progressDays: 0,
      pointsAwarded: 0,
    });

    return res.status(201).json({ message: 'Challenge started.', userChallenge });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Challenge already started.' });
    }
    return res.status(500).json({ message: 'Failed to start challenge.', error: error.message });
  }
});

router.put('/user-challenges/progress', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const { challengeId, incrementValue = 0, markDay = false, proofUrl, proofNote } = req.body;
    if (!challengeId) return res.status(400).json({ message: 'challengeId is required.' });

    const member = req.user || (await User.findById(req.userId));
    if (!member?.assignedTrainerId) {
      return res.status(403).json({ message: 'No trainer assigned.' });
    }

    const challenge = await Challenge.findOne({
      _id: challengeId,
      trainerId: member.assignedTrainerId,
      isActive: true,
    });
    if (!challenge) return res.status(404).json({ message: 'Challenge not found.' });

    const now = new Date();
    let userChallenge = await UserChallenge.findOne({ memberId: req.userId, challengeId: challenge._id });
    if (!userChallenge) {
      userChallenge = await UserChallenge.create({
        memberId: req.userId,
        trainerId: member.assignedTrainerId,
        challengeId: challenge._id,
        status: 'active',
      });
    }

    if (['completed', 'expired'].includes(userChallenge.status)) {
      return res.status(409).json({ message: `Cannot update ${userChallenge.status} challenge.` });
    }

    const inc = Number(incrementValue);
    if (Number.isFinite(inc) && inc > 0) {
      userChallenge.progressValue += inc;
    }

    if (markDay) {
      const todayKey = now.toISOString().slice(0, 10);
      const set = new Set(userChallenge.progressDateKeys || []);
      set.add(todayKey);
      userChallenge.progressDateKeys = Array.from(set);
      userChallenge.progressDays = userChallenge.progressDateKeys.length;
    }

    if (typeof proofUrl === 'string') userChallenge.proofUrl = proofUrl.trim();
    if (typeof proofNote === 'string') userChallenge.proofNote = proofNote.trim();
    userChallenge.lastProgressAt = now;

    if (shouldAutoComplete(challenge, userChallenge)) {
      if (challenge.requiresTrainerApproval) {
        userChallenge.status = 'pending-approval';
      } else {
        userChallenge.status = 'completed';
        userChallenge.completedAt = now;
        if (!userChallenge.pointsAwarded) {
          userChallenge.pointsAwarded = challenge.pointsReward;
          member.points = (member.points || 0) + challenge.pointsReward;
          await member.save();
        }

        await Notification.create({
          recipientId: req.userId,
          senderId: challenge.trainerId,
          type: 'challenge-completed',
          title: 'Challenge Completed',
          message: `${challenge.title} completed. +${challenge.pointsReward} points added.`,
          relatedEntityId: challenge._id,
          priority: 'normal',
        });
      }
    }

    await userChallenge.save();
    return res.json({ message: 'Challenge progress updated.', userChallenge });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update challenge progress.', error: error.message });
  }
});

router.post('/user-challenges/complete', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const { challengeId, proofUrl, proofNote } = req.body;
    if (!challengeId) return res.status(400).json({ message: 'challengeId is required.' });

    const member = req.user || (await User.findById(req.userId));
    if (!member?.assignedTrainerId) {
      return res.status(403).json({ message: 'No trainer assigned.' });
    }

    const challenge = await Challenge.findOne({
      _id: challengeId,
      trainerId: member.assignedTrainerId,
      isActive: true,
    });
    if (!challenge) return res.status(404).json({ message: 'Challenge not found.' });

    const now = new Date();
    if (challenge.endsAt && challenge.endsAt < now) {
      return res.status(400).json({ message: 'Challenge has expired.' });
    }

    let userChallenge = await UserChallenge.findOne({ memberId: req.userId, challengeId: challenge._id });
    if (!userChallenge) {
      userChallenge = await UserChallenge.create({
        memberId: req.userId,
        trainerId: member.assignedTrainerId,
        challengeId: challenge._id,
        status: 'active',
      });
    }

    if (userChallenge.status === 'completed') {
      return res.status(409).json({ message: 'Challenge already completed.' });
    }

    if (typeof proofUrl === 'string') userChallenge.proofUrl = proofUrl.trim();
    if (typeof proofNote === 'string') userChallenge.proofNote = proofNote.trim();

    if (challenge.completionMode === 'proof' && !userChallenge.proofUrl) {
      return res.status(400).json({ message: 'Proof URL is required for proof-based challenge.' });
    }

    if (challenge.requiresTrainerApproval || challenge.completionMode === 'proof') {
      userChallenge.status = 'pending-approval';
      await userChallenge.save();

      await Notification.create({
        recipientId: challenge.trainerId,
        senderId: req.userId,
        type: 'general',
        title: 'Challenge Submission Pending Review',
        message: `${member.name || 'A member'} submitted ${challenge.title} for approval.`,
        relatedEntityId: challenge._id,
        priority: 'normal',
      });

      return res.json({ message: 'Challenge submitted for trainer approval.', status: 'pending-approval' });
    }

    userChallenge.status = 'completed';
    userChallenge.completedAt = now;
    if (!userChallenge.pointsAwarded) {
      userChallenge.pointsAwarded = challenge.pointsReward;
      member.points = (member.points || 0) + challenge.pointsReward;
      await member.save();
    }
    await userChallenge.save();

    await Notification.create({
      recipientId: req.userId,
      senderId: challenge.trainerId,
      type: 'challenge-completed',
      title: 'Challenge Completed',
      message: `${challenge.title} completed. +${challenge.pointsReward} points added.`,
      relatedEntityId: challenge._id,
      priority: 'normal',
    });

    return res.json({
      message: 'Challenge completed successfully.',
      pointsAwarded: challenge.pointsReward,
      totalPoints: member.points || 0,
      challengeId: challenge._id,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to complete challenge.', error: error.message });
  }
});

// Booking based on trainer availability
router.get('/booking/availability', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const requestedDate = normalizeDate(req.query.date);
    if (!requestedDate) {
      return res.status(400).json({ message: 'Valid date query is required (YYYY-MM-DD).' });
    }

    // Get member's assigned trainer
    const member = await User.findById(req.userId).select('assignedTrainerId');
    if (!member?.assignedTrainerId) {
      return res.json({ message: 'No assigned trainer found.', trainers: [] });
    }

    const dayName = DAY_NAMES[new Date(`${requestedDate}T00:00:00`).getDay()];
    
    // Get schedule for only the assigned trainer
    const schedule = await TrainerSchedule.findOne({ trainerId: member.assignedTrainerId });
    if (!schedule) {
      return res.json({ message: 'Assigned trainer schedule not found.', trainers: [] });
    }

    // Get trainer details
    const trainer = await User.findById(member.assignedTrainerId).select('_id name email');
    if (!trainer) {
      return res.json({ message: 'Assigned trainer not found.', trainers: [] });
    }

    const day = (schedule.days || []).find((d) => d.day === dayName);
    if (!day || !day.isAvailable) {
      return res.json({ 
        message: `Trainer is not available on ${dayName}.`, 
        trainers: [] 
      });
    }

    const dayStart = toMinutes(day.startTime);
    const dayEnd = toMinutes(day.endTime);
    if (dayStart === null || dayEnd === null || dayEnd <= dayStart) {
      return res.json({ message: 'Invalid trainer schedule times.', trainers: [] });
    }

    // Get sessions created by this trainer on this date
    const sessionsOnDate = await Session.find({ 
      trainerId: member.assignedTrainerId,
      date: requestedDate, 
      status: 'scheduled' 
    });

    const busySlots = sessionsOnDate.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    const result = {
      trainerId: trainer._id,
      trainerName: trainer.name || '',
      trainerEmail: trainer.email || '',
      availability: {
        day: dayName,
        startTime: day.startTime,
        endTime: day.endTime,
      },
      busySlots,
    };

    return res.json({ message: 'Availability retrieved successfully.', trainers: [result] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch availability.', error: error.message });
  }
});

router.post('/bookings', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const { trainerId, date, startTime, endTime, name, notes } = req.body;

    const normalizedDate = normalizeDate(date);
    if (!trainerId || !normalizedDate || !startTime || !endTime) {
      return res.status(400).json({ message: 'trainerId, date, startTime and endTime are required.' });
    }

    // Get member and verify they have an assigned trainer
    const member = await User.findById(req.userId).select('assignedTrainerId');
    if (!member?.assignedTrainerId) {
      return res.status(403).json({ message: 'You do not have an assigned trainer. Contact admin to assign one.' });
    }

    // Validate that member is only booking with their assigned trainer
    if (String(trainerId) !== String(member.assignedTrainerId)) {
      return res.status(403).json({ message: 'You can only book sessions with your assigned trainer.' });
    }

    const trainer = await User.findById(trainerId);
    if (!trainer || (trainer.role || 'member') !== 'trainer') {
      return res.status(404).json({ message: 'Trainer not found.' });
    }

    const schedule = await TrainerSchedule.findOne({ trainerId: trainer._id });
    if (!schedule) {
      return res.status(400).json({ message: 'Trainer has not configured availability.' });
    }

    const dayName = DAY_NAMES[new Date(`${normalizedDate}T00:00:00`).getDay()];
    const day = (schedule.days || []).find((d) => d.day === dayName);
    if (!day || !day.isAvailable) {
      return res.status(400).json({ message: 'Trainer is not available on selected date.' });
    }

    const requestedStart = toMinutes(startTime);
    const requestedEnd = toMinutes(endTime);
    const dayStart = toMinutes(day.startTime);
    const dayEnd = toMinutes(day.endTime);
    const ptStart = toMinutes(day.ptStartTime || day.startTime);
    const ptEnd = toMinutes(day.ptEndTime || day.endTime);
    if (
      requestedStart === null ||
      requestedEnd === null ||
      dayStart === null ||
      dayEnd === null ||
      requestedEnd <= requestedStart ||
      requestedStart < dayStart ||
      requestedEnd > dayEnd
    ) {
      return res.status(400).json({ message: 'Requested time is outside trainer availability.' });
    }

    if (ptStart === null || ptEnd === null || requestedStart < ptStart || requestedEnd > ptEnd) {
      return res.status(400).json({ message: 'Requested time is outside trainer PT hours.' });
    }

    // Check for overlapping sessions using proper time arithmetic
    const existingSessions = await Session.find({
      trainerId,
      date: normalizedDate,
      status: 'scheduled', // Only check scheduled sessions
    });

    const hasOverlap = existingSessions.some((existingSession) => {
      const existingStart = toMinutes(existingSession.startTime);
      const existingEnd = toMinutes(existingSession.endTime);
      
      if (existingStart === null || existingEnd === null) return false; // Skip invalid times
      
      // Check if sessions overlap:
      // Requested session ends after existing session starts AND
      // Requested session starts before existing session ends
      return requestedEnd > existingStart && requestedStart < existingEnd;
    });

    if (hasOverlap) {
      return res.status(400).json({ message: 'Selected slot overlaps with another session.' });
    }

    // Enforce per-member daily PT cap
    const durationMinutes = requestedEnd - requestedStart;
    const dayLimit = Number(day.maxMemberMinutesPerDay || 60);
    if (dayLimit > 0) {
      const memberSessionsSameDay = await Session.find({
        trainerId,
        date: normalizedDate,
        memberIds: req.userId,
        status: 'scheduled',
      });
      const usedMinutes = memberSessionsSameDay.reduce((sum, s) => {
        const sStart = toMinutes(s.startTime);
        const sEnd = toMinutes(s.endTime);
        if (sStart === null || sEnd === null) return sum;
        return sum + Math.max(0, sEnd - sStart);
      }, 0);
      if (usedMinutes + durationMinutes > dayLimit) {
        return res.status(400).json({ message: `Booking exceeds daily PT limit of ${dayLimit} minutes.` });
      }
    }

    const session = await Session.create({
      trainerId,
      name: String(name || 'Member Booking').trim() || 'Member Booking',
      date: normalizedDate,
      startTime,
      endTime,
      memberIds: [req.userId],
      type: 'personal',
      notes: notes || '',
      status: 'scheduled',
    });

    return res.status(201).json({ message: 'Booking created successfully.', booking: session });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create booking.', error: error.message });
  }
});

// Book a group session (move from selectedMemberIds to memberIds)
router.post('/sessions/:sessionId/join', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get member's assigned trainer
    const member = await User.findById(req.userId).select('assignedTrainerId');
    if (!member?.assignedTrainerId) {
      return res.status(403).json({ message: 'You do not have an assigned trainer.' });
    }

    // Find the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    // Verify session belongs to assigned trainer
    if (String(session.trainerId) !== String(member.assignedTrainerId)) {
      return res.status(403).json({ message: 'Can only join sessions from your assigned trainer.' });
    }

    // Verify it's a group session
    if (session.sessionType !== 'group') {
      return res.status(400).json({ message: 'Can only join group sessions.' });
    }

    // Backward compatibility: old pending sessions were saved with memberIds instead of selectedMemberIds.
    // In that case, booking should simply confirm status.
    const inBookedList =
      Array.isArray(session.memberIds) &&
      session.memberIds.some((id) => String(id) === String(req.userId));
    const hasSelectedInvites = Array.isArray(session.selectedMemberIds) && session.selectedMemberIds.length > 0;
    const isLegacyPendingInvite = session.sessionType === 'group' && session.status === 'pending' && inBookedList && !hasSelectedInvites;

    if (inBookedList && !isLegacyPendingInvite) {
      return res.status(400).json({ message: 'Already booked this session.' });
    }

    // Check if invited
    if (!isLegacyPendingInvite && (!Array.isArray(session.selectedMemberIds) || !session.selectedMemberIds.some((id) => String(id) === String(req.userId)))) {
      return res.status(403).json({ message: 'You were not invited to this session.' });
    }

    // Book the session: move from selectedMemberIds to memberIds
    session.memberIds = session.memberIds || [];
    if (!inBookedList) {
      session.memberIds.push(req.userId);
    }
    
    // Remove from selectedMemberIds
    session.selectedMemberIds = session.selectedMemberIds.filter((id) => String(id) !== String(req.userId));
    
    // If no more selected members and some have booked, update status to scheduled
    if (session.status === 'pending' && session.memberIds.length > 0) {
      session.status = 'scheduled';
    }
    
    await session.save();

    // Send confirmation notification
    await Notification.create({
      recipientId: req.userId,
      senderId: session.trainerId,
      type: 'session-booking-confirmed',
      title: 'Session Booked',
      message: `You've successfully booked "${session.name}" on ${session.date} from ${session.startTime} to ${session.endTime}.`,
      relatedEntityId: session._id,
      relatedEntityType: 'Session',
      data: { sessionId: session._id },
    });

    return res.json({
      message: 'Successfully booked the group session.',
      session: {
        id: session._id,
        name: session.name,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        sessionType: session.sessionType,
        memberCount: session.memberIds.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to join session.', error: error.message });
  }
});

// Personalized meal plan
router.get('/meal-plan', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const mealPlan = await MealPlan.findOne({ memberId: req.userId, status: 'active' })
      .populate('trainerId', '_id name email')
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    if (!mealPlan) {
      return res.status(404).json({ message: 'Meal plan not found.' });
    }

    return res.json({
      message: 'Meal plan retrieved successfully.',
      mealPlan: buildMemberMealPlanResponse(mealPlan),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch meal plan.', error: error.message });
  }
});

// Monthly progress analytics
router.get('/workouts/monthly-progress', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const workouts = await WorkoutSession.find({
      memberId: req.userId,
      status: 'completed',
      endTime: { $gte: start, $lt: end },
    }).sort({ endTime: 1 });

    const byDay = {};
    workouts.forEach((w) => {
      const day = new Date(w.endTime || w.startTime).toISOString().slice(0, 10);
      if (!byDay[day]) {
        byDay[day] = { count: 0, totalMinutes: 0 };
      }
      byDay[day].count += 1;
      byDay[day].totalMinutes += w.durationMinutes || 0;
    });

    Object.keys(byDay).forEach((day) => {
      byDay[day].totalMinutes = Number(byDay[day].totalMinutes.toFixed(4));
    });

    return res.json({
      message: 'Monthly progress retrieved successfully.',
      progress: {
        year,
        month,
        totalWorkouts: workouts.length,
        totalMinutes: Number(workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0).toFixed(4)),
        daily: byDay,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch monthly progress.', error: error.message });
  }
});

// Shop endpoints
router.get('/shop/products', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });
    return res.json({ message: 'Products retrieved successfully.', products });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch products.', error: error.message });
  }
});

router.post('/shop/orders', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ message: 'At least one product is required.' });
    }

    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds }, isActive: true });
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const normalizedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = productMap.get(String(item.productId));
      const quantity = Number(item.quantity) || 1;
      if (!product) {
        return res.status(400).json({ message: 'One or more products are invalid.' });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ message: `${product.name} has insufficient stock.` });
      }

      normalizedItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity,
      });

      totalAmount += product.price * quantity;
      product.stock -= quantity;
      await product.save();
    }

    const order = await Order.create({
      memberId: req.userId,
      items: normalizedItems,
      totalAmount,
      status: 'pending',
    });

    return res.status(201).json({ message: 'Order placed successfully.', order });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to place order.', error: error.message });
  }
});

router.get('/shop/orders', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const orders = await Order.find({ memberId: req.userId }).sort({ createdAt: -1 });
    return res.json({ message: 'Orders retrieved successfully.', orders });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch orders.', error: error.message });
  }
});

// Feedback endpoints
const sanitizeFeedbackForMember = (feedbackDoc) => ({
  _id: feedbackDoc?._id,
  message: feedbackDoc?.message || '',
  adminReply: feedbackDoc?.adminReply || '',
  createdAt: feedbackDoc?.createdAt,
  rating: typeof feedbackDoc?.rating === 'number' ? feedbackDoc.rating : 0,
  likeCount: typeof feedbackDoc?.likeCount === 'number' ? feedbackDoc.likeCount : 0,
  dislikeCount: typeof feedbackDoc?.dislikeCount === 'number' ? feedbackDoc.dislikeCount : 0,
  memberId: feedbackDoc?.memberId?._id || feedbackDoc?.memberId || null,
  memberName: feedbackDoc?.memberId?.name || '',
});

router.post('/feedback', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ message: 'Feedback message is required.' });
    }

    const ratingRaw = Number(req.body.rating || 0);
    const hasRating = !Number.isNaN(ratingRaw) && ratingRaw > 0;
    const rating = hasRating ? Math.max(1, Math.min(5, Math.round(ratingRaw))) : 0;

    const ai = classifyFeedback(message);
    const feedback = await Feedback.create({
      memberId: req.userId,
      message,
      category: ai.category,
      aiSummaryHint: ai.summaryHint,
      rating,
    });

    return res.status(201).json({ message: 'Feedback submitted successfully.', feedback: sanitizeFeedbackForMember(feedback) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit feedback.', error: error.message });
  }
});

router.get('/feedback', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const feedback = await Feedback.find()
      .populate('memberId', '_id name email')
      .sort({ createdAt: -1 });
    const cleaned = feedback.map((item) => sanitizeFeedbackForMember(item));
    return res.json({ message: 'Feedback retrieved successfully.', feedback: cleaned });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch feedback.', error: error.message });
  }
});

router.post('/feedback/:id/react', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const reaction = String(req.body.reaction || '').toLowerCase();
    if (!['like', 'dislike'].includes(reaction)) {
      return res.status(400).json({ message: 'Reaction must be like or dislike.' });
    }

    const feedback = await Feedback.findById(req.params.id).populate('memberId', '_id name email');
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found.' });
    }
    // Upsert this member's reaction for this feedback
    const existing = await FeedbackReaction.findOne({
      feedbackId: feedback._id,
      memberId: req.userId,
    });

    if (existing) {
      existing.reaction = reaction;
      await existing.save();
    } else {
      await FeedbackReaction.create({
        feedbackId: feedback._id,
        memberId: req.userId,
        reaction,
      });
    }

    // Recalculate aggregate counts
    const [likeCount, dislikeCount] = await Promise.all([
      FeedbackReaction.countDocuments({ feedbackId: feedback._id, reaction: 'like' }),
      FeedbackReaction.countDocuments({ feedbackId: feedback._id, reaction: 'dislike' }),
    ]);

    feedback.likeCount = likeCount;
    feedback.dislikeCount = dislikeCount;
    await feedback.save();

    return res.json({
      message: 'Reaction recorded.',
      feedback: sanitizeFeedbackForMember(feedback),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to record reaction.', error: error.message });
  }
});

// Get member notifications
router.get('/notifications', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipientId: req.userId,
    })
      .populate('senderId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return res.json({
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        priority: n.priority || 'normal',
        isRead: n.isRead,
        createdAt: n.createdAt,
        relatedEntityId: n.relatedEntityId?.toString(),
        relatedEntityType: n.relatedEntityType,
        senderName: n.senderId?.name,
        senderEmail: n.senderId?.email,
      })),
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch notifications.', error: error.message });
  }
});

// Mark notification as read
router.patch('/notifications/:notificationId/read', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    if (String(notification.recipientId) !== String(req.userId)) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark notification as read.', error: error.message });
  }
});

module.exports = router;
