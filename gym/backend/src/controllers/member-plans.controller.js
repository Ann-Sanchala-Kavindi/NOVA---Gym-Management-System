const User = require("../models/User");
const WorkoutPlan = require("../models/WorkoutPlan");
const MealPlan = require("../models/MealPlan");
const WorkoutSession = require("../models/WorkoutSession");
const EquipmentSession = require("../models/EquipmentSession");
const Review = require("../models/Review");

const deriveExerciseStatus = (exercise = {}, now = new Date()) => {
  const progress = exercise?.progress || {};
  const scheduledDay = exercise?.scheduledDay || 'Anytime';
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  if (progress.status === 'skipped') return 'skipped';
  if (progress.status === 'in_progress') return 'in_progress';
  if (progress.status === 'completed') {
    if (scheduledDay === 'Anytime') return 'completed';
    const lastCompleted = progress.lastCompletedAt ? new Date(progress.lastCompletedAt) : null;
    const lastCompletedDay = lastCompleted ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][lastCompleted.getDay()] : null;
    return weekday === scheduledDay && lastCompletedDay !== scheduledDay ? 'overdue' : 'completed';
  }
  return scheduledDay !== 'Anytime' && weekday === scheduledDay ? 'overdue' : 'not_started';
};


const getMembers = async (req, res) => {
  try {
    const { status = "all", search = "" } = req.query;

    const query = {
      role: "member",
    };

    if (status !== "all") {
      query.membershipStatus = status;
    }

    if (search.trim()) {
      query.$or = [
        { fullName: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const members = await User.find(query).sort({ createdAt: -1 });

    const memberIds = members.map((m) => m._id);

    const [workoutPlans, mealPlans] = await Promise.all([
      WorkoutPlan.find({
        memberId: { $in: memberIds },
        status: "active",
      }),
      MealPlan.find({
        memberId: { $in: memberIds },
        status: "active",
      }),
    ]);

    const workoutCountMap = {};
    const mealCountMap = {};

    workoutPlans.forEach((plan) => {
      const key = String(plan.memberId);
      workoutCountMap[key] = (workoutCountMap[key] || 0) + 1;
    });

    mealPlans.forEach((plan) => {
      const key = String(plan.memberId);
      mealCountMap[key] = (mealCountMap[key] || 0) + 1;
    });

    const enrichedMembers = members.map((member) => ({
      _id: member._id,
      fullName: member.fullName || member.name || '' ,
      email: member.email,
      goal: member.goal || member.goals?.[0] || "Fitness",
      membershipStatus: member.membershipStatus || (member.memberType === 'premium' ? 'active' : 'active'),
      avatarEmoji: member.avatarEmoji || member.avatar || "🏃",
      joinedAt: member.createdAt,
      workoutPlanCount: workoutCountMap[String(member._id)] || 0,
      mealPlanCount: mealCountMap[String(member._id)] || 0,
    }));

    const activeCount = enrichedMembers.filter(
      (m) => m.membershipStatus === "active"
    ).length;
    const trialCount = enrichedMembers.filter(
      (m) => m.membershipStatus === "trial"
    ).length;
    const inactiveCount = enrichedMembers.filter(
      (m) => m.membershipStatus === "inactive"
    ).length;

    res.status(200).json({
      counts: {
        total: enrichedMembers.length,
        active: activeCount,
        trial: trialCount,
        inactive: inactiveCount,
      },
      data: enrichedMembers,
    });
  } catch (error) {
    console.log("Get members error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getMemberProfile = async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = await User.findById(memberId);

    if (!member) {
      return res.status(404).json({ message: "Member not found." });
    }

    const [workoutPlans, mealPlans] = await Promise.all([
      WorkoutPlan.find({ memberId, status: "active" }).sort({ createdAt: -1 }),
      MealPlan.find({ memberId, status: "active" }).sort({ createdAt: -1 }),
    ]);

    res.status(200).json({
      data: {
        _id: member._id,
        fullName: member.fullName || member.name || '' ,
        email: member.email,
        goal: member.goal || member.goals?.[0] || "Fitness",
        membershipStatus: member.membershipStatus || (member.memberType === 'premium' ? 'active' : 'active'),
        avatarEmoji: member.avatarEmoji || member.avatar || "🏃",
        joinedAt: member.createdAt,
        age: member.age || null,
        workoutPlanCount: workoutPlans.length,
        mealPlanCount: mealPlans.length,
        workoutPlans,
        mealPlans,
      },
    });
  } catch (error) {
    console.log("Get member profile error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getTrainerAnalytics = async (req, res) => {
  try {
    const trainerScopedQuery = {
      role: "member",
      isEmailVerified: true,
      ...(req.user?.role === 'trainer' ? { assignedTrainerId: req.user._id } : {}),
    };

    const members = await User.find(trainerScopedQuery);
    const memberIds = members.map((member) => member._id);
    const workoutPlans = await WorkoutPlan.find({ memberId: { $in: memberIds }, status: "active" });
    const mealPlans = await MealPlan.find({ memberId: { $in: memberIds }, status: "active" });
    const workoutSessions = await WorkoutSession.find({ memberId: { $in: memberIds }, status: 'completed' });
    const visibleReviews = await Review.find({ adminStatus: 'visible' });
    const Equipment = require("../models/Equipment");
    const [equipmentList, equipmentSessions] = await Promise.all([
      Equipment.find({}),
      EquipmentSession.find({ status: 'completed' }),
    ]);

    const totalMembers = members.length;
    const activeMembers = members.filter((m) => (m.membershipStatus || "active") === "active").length;
    const trialMembers = members.filter((m) => (m.membershipStatus || "active") === "trial").length;
    const inactiveMembers = members.filter((m) => (m.membershipStatus || "active") === "inactive").length;

    const uniqueMembersWithPlans = new Set([...workoutPlans.map((p) => String(p.memberId)), ...mealPlans.map((p) => String(p.memberId))]);
    const engagedPercent = totalMembers > 0 ? Math.round((uniqueMembersWithPlans.size / totalMembers) * 100) : 0;

    const goalMap = { "Weight Loss": 0, "Muscle Gain": 0, Fitness: 0 };
    members.forEach((member) => {
      const goal = member.goal || member.goals?.[0] || "Fitness";
      goalMap[goal] = (goalMap[goal] || 0) + 1;
    });

    const now = Date.now();
    const memberPlanCounts = members.map((member) => {
      const memberWorkoutPlans = workoutPlans.filter((p) => String(p.memberId) === String(member._id));
      const workoutCount = memberWorkoutPlans.length;
      const mealCount = mealPlans.filter((p) => String(p.memberId) === String(member._id)).length;
      const sessions = workoutSessions.filter((session) => String(session.memberId) === String(member._id));
      const allExercises = memberWorkoutPlans.flatMap((plan) => Array.isArray(plan.exercises) ? plan.exercises : []);
      const assignedExercises = allExercises.length;
      const statusBreakdown = { not_started: 0, in_progress: 0, completed: 0, overdue: 0, skipped: 0 };
      allExercises.forEach((exercise) => {
        const status = deriveExerciseStatus(exercise);
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });
      const activeDays = new Set(
        sessions
          .filter((session) => {
            const when = new Date(session.endTime || session.startTime).getTime();
            return now - when <= 30 * 24 * 60 * 60 * 1000;
          })
          .map((session) => new Date(session.endTime || session.startTime).toISOString().slice(0, 10))
      ).size;
      const completionRate = assignedExercises > 0 ? Math.round(((statusBreakdown.completed || 0) / assignedExercises) * 100) : 0;
      const activityRate = Math.round((activeDays / 30) * 100);
      const adherenceSamples = allExercises.map((exercise) => Number(exercise?.progress?.adherenceScore || 0)).filter((value) => value > 0);
      const avgAdherence = adherenceSamples.length ? Math.round(adherenceSamples.reduce((sum, value) => sum + value, 0) / adherenceSamples.length) : 0;
      const memberMealPlans = mealPlans.filter((p) => String(p.memberId) === String(member._id));
      const allMealLogs = memberMealPlans.flatMap((plan) => Array.isArray(plan.dailyLogs) ? plan.dailyLogs.map((log) => ({ ...(typeof log?.toObject === 'function' ? log.toObject() : log), planName: plan.planName || 'Meal Plan' })) : []);
      const mealAdherenceSamples = allMealLogs.map((log) => Number(log.adherenceScore || 0)).filter((value) => value > 0);
      const avgMealAdherence = mealAdherenceSamples.length ? Math.round(mealAdherenceSamples.reduce((sum, value) => sum + value, 0) / mealAdherenceSamples.length) : 0;
      const recentMealLogs = allMealLogs.filter((log) => {
        const date = log?.dateKey ? new Date(log.dateKey) : null;
        return date && !Number.isNaN(date.getTime()) && now - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
      });
      const last7DayMealAdherence = recentMealLogs.length ? Math.round(recentMealLogs.reduce((sum, log) => sum + Number(log.adherenceScore || 0), 0) / recentMealLogs.length) : avgMealAdherence;
      const latestMealLog = [...allMealLogs].sort((a, b) => String(b.dateKey || '').localeCompare(String(a.dateKey || '')))[0] || null;
      return {
        _id: member._id,
        fullName: member.fullName || member.name || '',
        avatarEmoji: member.avatarEmoji || member.avatar || "🏃",
        membershipStatus: member.membershipStatus || (member.memberType === 'premium' ? 'active' : 'active'),
        goal: member.goal || member.goals?.[0] || "Fitness",
        workoutCount,
        mealCount,
        completionRate,
        activityRate,
        avgAdherence,
        avgMealAdherence,
        last7DayMealAdherence,
        trackedMealDays: allMealLogs.length,
        recentTrackedMealDays: recentMealLogs.length,
        latestMealLogDate: latestMealLog?.dateKey || null,
        latestMealPlanName: latestMealLog?.planName || (memberMealPlans[0]?.planName || ''),
        exerciseStatusBreakdown: statusBreakdown,
        total: workoutCount + mealCount,
      };
    });

    const topMembers = [...memberPlanCounts].sort((a, b) => (b.completionRate || 0) - (a.completionRate || 0) || (b.avgAdherence || 0) - (a.avgAdherence || 0) || (b.activityRate || 0) - (a.activityRate || 0) || b.total - a.total).slice(0, 5);
    const needsAttention = memberPlanCounts.filter((m) => m.total === 0 || (m.activityRate || 0) < 10 || (m.exerciseStatusBreakdown?.overdue || 0) > 0 || ((m.recentTrackedMealDays || 0) >= 2 && (m.last7DayMealAdherence || 0) < 60));
    const memberMealInsights = [...memberPlanCounts]
      .filter((m) => (m.mealCount || 0) > 0)
      .sort((a, b) => (a.last7DayMealAdherence || 0) - (b.last7DayMealAdherence || 0) || (a.avgMealAdherence || 0) - (b.avgMealAdherence || 0) || a.fullName.localeCompare(b.fullName))
      .map((m) => ({
        _id: m._id,
        fullName: m.fullName,
        avatarEmoji: m.avatarEmoji,
        goal: m.goal,
        mealCount: m.mealCount,
        avgMealAdherence: m.avgMealAdherence || 0,
        last7DayMealAdherence: m.last7DayMealAdherence || 0,
        trackedMealDays: m.trackedMealDays || 0,
        recentTrackedMealDays: m.recentTrackedMealDays || 0,
        latestMealLogDate: m.latestMealLogDate || null,
        latestMealPlanName: m.latestMealPlanName || '',
        status: ((m.recentTrackedMealDays || 0) >= 2 && (m.last7DayMealAdherence || 0) < 60)
          ? 'needs_attention'
          : (m.last7DayMealAdherence || m.avgMealAdherence || 0) >= 85
            ? 'on_track'
            : 'watch',
      }));

    const trainerAlerts = [];
    memberPlanCounts.forEach((member) => {
      if ((member.total || 0) === 0) {
        trainerAlerts.push({ type: 'no_active_plans', severity: 'medium', memberId: String(member._id), memberName: member.fullName, avatarEmoji: member.avatarEmoji, title: 'No active plans', message: 'This member has no active workout or meal plans assigned.', metric: 0 });
      }
      if ((member.activityRate || 0) < 10 && (member.workoutCount || 0) > 0) {
        trainerAlerts.push({ type: 'low_workout_activity', severity: 'high', memberId: String(member._id), memberName: member.fullName, avatarEmoji: member.avatarEmoji, title: 'Low workout activity', message: `Workout activity is only ${member.activityRate || 0}% this month.`, metric: member.activityRate || 0 });
      }
      if ((member.recentTrackedMealDays || 0) >= 2 && (member.last7DayMealAdherence || 0) < 60) {
        trainerAlerts.push({ type: 'low_meal_adherence', severity: (member.last7DayMealAdherence || 0) < 40 ? 'high' : 'medium', memberId: String(member._id), memberName: member.fullName, avatarEmoji: member.avatarEmoji, title: 'Meal adherence dropped', message: `Last 7-day meal adherence is ${member.last7DayMealAdherence || 0}%.`, metric: member.last7DayMealAdherence || 0 });
      }
    });

    const painSessions = workoutSessions.filter((session) => {
      const discomfort = Number(session?.performanceMetrics?.discomfortLevel || 0);
      const quality = String(session?.performanceMetrics?.completionQuality || '');
      return discomfort >= 4 || quality === 'pain_stop';
    });
    const latestPainByMember = new Map();
    painSessions.sort((a, b) => new Date(b.endTime || b.updatedAt || 0) - new Date(a.endTime || a.updatedAt || 0)).forEach((session) => {
      const key = String(session.memberId);
      if (!latestPainByMember.has(key)) latestPainByMember.set(key, session);
    });
    latestPainByMember.forEach((session, memberId) => {
      const member = memberPlanCounts.find((m) => String(m._id) === memberId);
      if (member) {
        trainerAlerts.push({
          type: 'pain_or_discomfort',
          severity: 'high',
          memberId,
          memberName: member.fullName,
          avatarEmoji: member.avatarEmoji,
          title: 'Pain / discomfort reported',
          message: session?.performanceMetrics?.painNote ? `Recent session recorded discomfort. Note: ${session.performanceMetrics.painNote}` : 'Recent session recorded high discomfort or pain stop.',
          metric: Number(session?.performanceMetrics?.discomfortLevel || 0),
        });
      }
    });

    const sessionStatsByEquipment = new Map();
    equipmentSessions.forEach((session) => {
      const key = String(session.equipmentId);
      const existing = sessionStatsByEquipment.get(key) || { usageCount: 0, totalDurationHours: 0 };
      existing.usageCount += 1;
      existing.totalDurationHours += Number(session.durationSeconds || 0) / 3600;
      sessionStatsByEquipment.set(key, existing);
    });
    const maintenancePredictions = equipmentList.map((equipment) => {
      const sessionStats = sessionStatsByEquipment.get(String(equipment._id)) || { usageCount: 0, totalDurationHours: 0 };
      const maintenanceRiskScore = Math.min(100, Math.round(sessionStats.usageCount * 1.4 + sessionStats.totalDurationHours * 1.2));
      let recommendedAction = 'Monitor usage';
      if (maintenanceRiskScore >= 75) recommendedAction = 'Inspect immediately';
      else if (maintenanceRiskScore >= 50) recommendedAction = 'Check within 48 hours';
      else if (maintenanceRiskScore >= 30) recommendedAction = 'Schedule preventive maintenance';
      return {
        equipmentId: String(equipment._id),
        name: equipment.name || 'Equipment',
        location: equipment.location || '',
        maintenanceStatus: equipment.maintenanceStatus || 'Operational',
        usageCount: sessionStats.usageCount,
        totalDurationHours: Number(sessionStats.totalDurationHours.toFixed(1)),
        maintenanceRiskScore,
        recommendedAction,
      };
    }).sort((a, b) => b.maintenanceRiskScore - a.maintenanceRiskScore).slice(0, 8);

    const totalAssignedExercises = workoutPlans.reduce((sum, plan) => sum + (Array.isArray(plan.exercises) ? plan.exercises.length : 0), 0);
    const avgCompletionRate = memberPlanCounts.length ? Math.round(memberPlanCounts.reduce((sum, item) => sum + (item.completionRate || 0), 0) / memberPlanCounts.length) : 0;
    const avgActivityRate = memberPlanCounts.length ? Math.round(memberPlanCounts.reduce((sum, item) => sum + (item.activityRate || 0), 0) / memberPlanCounts.length) : 0;

    res.status(200).json({
      overview: { totalMembers, totalPlans: workoutPlans.length + mealPlans.length, engagedPercent, urgentAlerts: trainerAlerts.filter((item) => item.severity === 'high').length },
      membershipStatus: { active: activeMembers, trial: trialMembers, inactive: inactiveMembers },
      planAssignment: { workoutPlans: workoutPlans.length, mealPlans: mealPlans.length, engagedPercent },
      goalBreakdown: goalMap,
      activeRate: { activeMembers, totalMembers, percent: totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0 },
      workoutPerformance: {
        totalCompletedWorkouts: workoutSessions.length,
        avgCompletionRate,
        avgActivityRate,
        totalAssignedExercises,
        avgAdherence: memberPlanCounts.length ? Math.round(memberPlanCounts.reduce((sum, item) => sum + (item.avgAdherence || 0), 0) / memberPlanCounts.length) : 0,
        overdueExercises: memberPlanCounts.reduce((sum, item) => sum + (item.exerciseStatusBreakdown?.overdue || 0), 0),
        inProgressExercises: memberPlanCounts.reduce((sum, item) => sum + (item.exerciseStatusBreakdown?.in_progress || 0), 0),
      },
      mealPerformance: {
        avgAdherence: memberPlanCounts.length ? Math.round(memberPlanCounts.reduce((sum, item) => sum + (item.avgMealAdherence || 0), 0) / memberPlanCounts.length) : 0,
        trackedMembers: memberPlanCounts.filter((item) => (item.avgMealAdherence || 0) > 0).length,
        avgLast7DayAdherence: memberMealInsights.length ? Math.round(memberMealInsights.reduce((sum, item) => sum + (item.last7DayMealAdherence || 0), 0) / memberMealInsights.length) : 0,
      },
      reviewAnalytics: {
        totalVisible: visibleReviews.length,
        averageRating: visibleReviews.length ? Number((visibleReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / visibleReviews.length).toFixed(1)) : 0,
        topCategory: Object.entries(visibleReviews.reduce((acc, item) => { const key = item.category || 'General'; acc[key] = (acc[key] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General',
      },
      topMembers,
      needsAttention,
      memberMealInsights,
      trainerAlerts: trainerAlerts.sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.severity] - { high: 3, medium: 2, low: 1 }[a.severity])).slice(0, 10),
      maintenancePredictions,
    });
  } catch (error) {
    console.log("Trainer analytics error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMembers,
  getMemberProfile,
  getTrainerAnalytics,
};