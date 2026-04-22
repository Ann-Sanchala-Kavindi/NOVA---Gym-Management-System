const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User.js');
const MealPlan = require('../models/MealPlan.js');
const LeaveRequest = require('../models/LeaveRequest.js');
const Session = require('../models/Session.js');
const TrainerSchedule = require('../models/TrainerSchedule.js');
const Equipment = require('../models/Equipment.js');
const Notification = require('../models/Notification.js');
const Challenge = require('../models/Challenge.js');
const UserChallenge = require('../models/UserChallenge.js');
const { getJwtSecret } = require('../utils/auth.js');

const router = express.Router();

// Middleware to check authentication
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Token required.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.userId = decoded.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Middleware to check trainer role
async function requireTrainerRole(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user || (user.role || 'member') !== 'trainer') {
      return res.status(403).json({ error: 'Trainer access required.' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Access denied.' });
  }
}

async function getAssignedMember(memberId, trainerId) {
  return User.findOne({
    _id: memberId,
    role: 'member',
    assignedTrainerId: trainerId,
  });
}

function normalizeDate(dateString) {
  if (!dateString) return null;
  const asDate = new Date(dateString);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString().slice(0, 10);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SEQUENCE = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function toMinutes(timeValue) {
  const [h, m] = String(timeValue || '').split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function normalizeScheduleDocument(scheduleDoc, trainerId) {
  const dayMap = new Map((scheduleDoc?.days || []).map((d) => [d.day, d]));
  const days = DAY_SEQUENCE.map((day) => {
    const existing = dayMap.get(day);
    return {
      day,
      isAvailable: Boolean(existing ? existing.isAvailable : day !== 'Sunday'),
      startTime: (existing && existing.startTime) || '06:00',
      endTime: (existing && existing.endTime) || '20:00',
      ptStartTime: (existing && existing.ptStartTime) || (existing && existing.startTime) || '06:00',
      ptEndTime: (existing && existing.ptEndTime) || (existing && existing.endTime) || '20:00',
      maxMemberMinutesPerDay: Number(existing?.maxMemberMinutesPerDay || 60),
    };
  });

  return {
    trainerId: trainerId ? trainerId.toString() : scheduleDoc?.trainerId?.toString(),
    sameTimeAllDays: scheduleDoc?.sameTimeAllDays !== undefined ? Boolean(scheduleDoc.sameTimeAllDays) : true,
    days,
    updatedAt: scheduleDoc?.updatedAt || null,
  };
}

async function getOrCreateSchedule(trainerId) {
  let schedule = await TrainerSchedule.findOne({ trainerId });
  if (!schedule) {
    schedule = await TrainerSchedule.create({ trainerId });
  }
  return schedule;
}

function mapSession(session) {
  return {
    id: session._id.toString(),
    trainerId: session.trainerId,
    name: session.name,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    memberIds: (session.memberIds || []).map((id) => id.toString()),
    selectedMemberIds: (session.selectedMemberIds || []).map((id) => id.toString()),
    singleMemberId: session.singleMemberId ? session.singleMemberId.toString() : null,
    sessionType: session.sessionType,
    type: session.type,
    notes: session.notes || '',
    status: session.status,
    cancellationReason: session.cancellationReason || '',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

// Get trainer profile
router.get('/profile', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const trainer = await User.findById(req.userId).select('-passwordHash');
    if (!trainer) {
      return res.status(404).json({ error: 'Trainer not found' });
    }
    res.json(trainer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all members assigned to trainer
router.get('/members', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const members = await User.find({ 
      role: 'member',
      assignedTrainerId: req.userId 
    }).select('-passwordHash');
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/equipment', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const equipment = await Equipment.find({})
      .sort({ name: 1 })
      .lean();

    return res.json({
      equipment: equipment.map((item) => ({
        id: item._id,
        name: item.name,
        category: item.category,
        location: item.location || '',
        maintenanceStatus: item.maintenanceStatus,
        isAvailable: Boolean(item.isAvailable),
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get specific member details
router.get('/members/:memberId', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const member = await getAssignedMember(req.params.memberId, req.userId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create session/schedule
router.post('/sessions', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { name, date, startTime, endTime, memberIds, singleMemberId, type, sessionType, notes } = req.body;
    
    if (!name || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const sessionStartMinutes = toMinutes(startTime);
    const sessionEndMinutes = toMinutes(endTime);
    if (sessionStartMinutes === null || sessionEndMinutes === null || sessionEndMinutes <= sessionStartMinutes) {
      return res.status(400).json({ error: 'Invalid session time range' });
    }

    const schedule = await getOrCreateSchedule(req.userId);
    const dayName = DAY_NAMES[new Date(`${normalizedDate}T00:00:00`).getDay()];
    const dayAvailability = (schedule.days || []).find((d) => d.day === dayName);

    if (!dayAvailability || !dayAvailability.isAvailable) {
      return res.status(400).json({ error: `You are not available on ${dayName}` });
    }

    const dayStartMinutes = toMinutes(dayAvailability.startTime);
    const dayEndMinutes = toMinutes(dayAvailability.endTime);
    const ptStartMinutes = toMinutes(dayAvailability.ptStartTime || dayAvailability.startTime);
    const ptEndMinutes = toMinutes(dayAvailability.ptEndTime || dayAvailability.endTime);
    if (
      dayStartMinutes === null ||
      dayEndMinutes === null ||
      ptStartMinutes === null ||
      ptEndMinutes === null ||
      sessionStartMinutes < dayStartMinutes ||
      sessionEndMinutes > dayEndMinutes
    ) {
      return res.status(400).json({
        error: `Session must be within your availability on ${dayName} (${dayAvailability.startTime} - ${dayAvailability.endTime}).`,
      });
    }

    if (sessionStartMinutes < ptStartMinutes || sessionEndMinutes > ptEndMinutes) {
      return res.status(400).json({ error: `Session must be within PT hours on ${dayName} (${dayAvailability.ptStartTime || dayAvailability.startTime} - ${dayAvailability.ptEndTime || dayAvailability.endTime}).` });
    }

    // Check for overlapping sessions on the same date
    const existingSessions = await Session.find({
      trainerId: req.userId,
      date: normalizedDate,
      status: { $in: ['pending', 'scheduled', 'completed'] }, // Don't count cancelled sessions
    });

    const hasOverlap = existingSessions.some((existingSession) => {
      const existingStart = toMinutes(existingSession.startTime);
      const existingEnd = toMinutes(existingSession.endTime);
      
      if (existingStart === null || existingEnd === null) return false; // Skip invalid times
      
      // Check if sessions overlap:
      // New session ends after existing session starts AND
      // New session starts before existing session ends
      return sessionEndMinutes > existingStart && sessionStartMinutes < existingEnd;
    });

    if (hasOverlap) {
      return res.status(400).json({ error: 'This time slot overlaps with an existing session.' });
    }

    // Determine sessionType (new field, required for model validation)
    // Accept both 'sessionType' (new) and 'type' (old) for backward compatibility
    const finalSessionType = sessionType || (type === 'personal' ? '1v1' : 'group');

    // Prepare session data
    const sessionData = {
      trainerId: req.userId,
      name,
      date: normalizedDate,
      startTime,
      endTime,
      sessionType: finalSessionType,
      type: type || 'session',
      notes: notes || '',
      status: 'pending', // Set to pending for trainer-created sessions (need member approval)
    };

    // Handle 1v1 sessions - set singleMemberId for visibility to specific member
    if (finalSessionType === '1v1') {
      if (singleMemberId) {
        sessionData.singleMemberId = singleMemberId;
      } else if (memberIds && memberIds.length > 0) {
        // If memberIds provided for 1v1, use the first one as singleMemberId
        sessionData.singleMemberId = memberIds[0];
        sessionData.memberIds = []; // Clear memberIds for 1v1 (use singleMemberId instead)
      } else {
        return res.status(400).json({ error: '1v1 sessions require either singleMemberId or memberIds' });
      }

      // Do not enforce member self-booking daily cap for trainer-created 1v1 sessions.
      // The cap is enforced in member booking flows, while trainers must be able to schedule manually.
    } else {
      // For group sessions, keep members as invitations first.
      // They move to memberIds only after member books/joins.
      sessionData.memberIds = [];
      sessionData.selectedMemberIds = memberIds || [];
    }

    const session = await Session.create(sessionData);

    // Send invitation notifications for invited group members.
    if (finalSessionType === 'group' && Array.isArray(memberIds) && memberIds.length > 0) {
      await Notification.insertMany(
        memberIds.map((memberId) => ({
          recipientId: memberId,
          senderId: req.userId,
          type: 'session-invitation',
          title: 'New Group Session Available',
          message: `You've been invited to "${name}" on ${normalizedDate} from ${startTime} to ${endTime}.`,
          relatedEntityId: session._id,
          relatedEntityType: 'Session',
          priority: 'high',
          data: { sessionId: session._id },
        }))
      );
    }

    res.json(mapSession(session));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trainer's sessions/bookings
router.get('/sessions', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const includeAll = String(req.query.all || '').toLowerCase() === 'true';
    const requestedDate = normalizeDate(req.query.date);
    const filter = { trainerId: req.userId };

    if (!includeAll) {
      const today = new Date().toISOString().slice(0, 10);
      filter.date = requestedDate || today;
    } else if (requestedDate) {
      filter.date = requestedDate;
    }

    const sessions = await Session.find(filter).sort({ startTime: 1, createdAt: -1 });

    res.json(sessions.map(mapSession));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get members booked to a specific session
router.get('/sessions/:sessionId/members', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify the session belongs to this trainer
    const session = await Session.findOne({
      _id: sessionId,
      trainerId: req.userId,
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found or unauthorized.' });
    }

    // Get all members booked to this session
    const memberIds = [
      ...new Set([
        ...(session.memberIds || []).map(id => String(id)),
        ...(session.singleMemberId ? [String(session.singleMemberId)] : [])
      ])
    ];

    const members = await User.find(
      { _id: { $in: memberIds } },
      'name email memberType onboardingCompleted'
    ).lean();

    return res.json({
      message: 'Session members retrieved successfully.',
      session: {
        id: session._id,
        name: session.name,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        sessionType: session.sessionType,
        status: session.status,
      },
      members: members.map(m => ({
        id: m._id,
        name: m.name,
        email: m.email,
        memberType: m.memberType || 'normal',
        onboardingCompleted: m.onboardingCompleted || false,
      })),
      memberCount: members.length,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch session members.', error: error.message });
  }
});

// Update upcoming session
router.patch('/sessions/:sessionId', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, date, startTime, endTime, status, cancellationReason } = req.body;

    const session = await Session.findOne({ _id: sessionId, trainerId: req.userId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (name !== undefined) session.name = String(name || '').trim();

    if (date !== undefined) {
      const normalizedDate = normalizeDate(date);
      if (!normalizedDate) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      session.date = normalizedDate;
    }

    if (startTime !== undefined) session.startTime = String(startTime || '').trim();
    if (endTime !== undefined) session.endTime = String(endTime || '').trim();

    if (status !== undefined) {
      const allowedStatus = ['scheduled', 'completed', 'cancelled'];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }
      session.status = status;

      if (status === 'cancelled') {
        const reason = String(cancellationReason || '').trim();
        if (!reason) {
          return res.status(400).json({ error: 'Cancellation reason is required when cancelling a session.' });
        }
        session.cancellationReason = reason;
      }

      if (status !== 'cancelled' && cancellationReason !== undefined) {
        session.cancellationReason = String(cancellationReason || '').trim();
      }
    }

    if (!session.name || !session.date || !session.startTime || !session.endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await session.save();

    res.json(mapSession(session));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Award points to member
router.post('/members/:memberId/award-points', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { points, reason } = req.body;
    
    if (!points || points <= 0) {
      return res.status(400).json({ error: 'Invalid points amount' });
    }

    const member = await getAssignedMember(req.params.memberId, req.userId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Award points
    member.points = (member.points || 0) + points;
    await member.save();

    res.json({
      message: 'Points awarded successfully',
      member: member,
      pointsAwarded: points,
      reason: reason || 'Achievement unlocked'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get member leaderboard
router.get('/leaderboard', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { period = 'daily' } = req.query; // daily, weekly, monthly
    
    const members = await User.find({ role: 'member', assignedTrainerId: req.userId })
      .sort({ points: -1 })
      .select('-passwordHash')
      .limit(50);

    res.json({
      period,
      leaderboard: members.map((m, index) => ({
        rank: index + 1,
        id: m._id,
        name: m.name,
        email: m.email,
        points: m.points || 0,
        avatar: m.avatar || null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Challenge endpoints
const CHALLENGE_CATEGORIES = ['workout', 'cardio', 'strength', 'consistency', 'other'];
const CHALLENGE_DIFFICULTIES = ['easy', 'medium', 'hard'];
const CHALLENGE_TYPES = ['daily', 'one-time', 'milestone-based'];
const CHALLENGE_COMPLETION_MODES = ['manual', 'progress', 'proof'];
const WORKOUT_GOAL_TYPES = ['none', 'duration-minutes', 'reps', 'sets'];

function mapChallenge(challenge, completionCount = 0) {
  return {
    id: challenge._id,
    title: challenge.title,
    description: challenge.description,
    category: challenge.category,
    difficulty: challenge.difficulty,
    challengeType: challenge.challengeType,
    completionMode: challenge.completionMode,
    pointsReward: challenge.pointsReward,
    equipmentId: challenge.equipmentId || null,
    equipmentName: challenge.equipmentNameSnapshot || '',
    workoutGoalType: challenge.workoutGoalType || 'none',
    targetValue: challenge.targetValue,
    targetUnit: challenge.targetUnit,
    requiresTrainerApproval: !!challenge.requiresTrainerApproval,
    isActive: challenge.isActive,
    startsAt: challenge.startsAt,
    endsAt: challenge.endsAt,
    completionCount,
    createdAt: challenge.createdAt,
    updatedAt: challenge.updatedAt,
  };
}

async function notifyAssignedMembersAboutChallenge(trainerId, challenge) {
  const members = await User.find({ role: 'member', assignedTrainerId: trainerId }).select('_id').lean();
  if (!members.length) return;

  await Notification.insertMany(
    members.map((member) => ({
      recipientId: member._id,
      senderId: trainerId,
      type: 'challenge-created',
      title: 'New Challenge Available',
      message: `${challenge.title} is now available. Reward: ${challenge.pointsReward} points.`,
      relatedEntityId: challenge._id,
      relatedEntityType: null,
      priority: 'normal',
      data: {
        challengeId: challenge._id,
        challengeType: challenge.challengeType,
        completionMode: challenge.completionMode,
      },
    }))
  );
}

router.get('/challenges', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const challenges = await Challenge.find({ trainerId: req.userId }).sort({ createdAt: -1 }).lean();
    if (!challenges.length) {
      return res.json({ challenges: [] });
    }

    const challengeIds = challenges.map((c) => c._id);
    const completionCounts = await UserChallenge.aggregate([
      { $match: { challengeId: { $in: challengeIds }, status: 'completed' } },
      { $group: { _id: '$challengeId', count: { $sum: 1 } } },
    ]);
    const completionMap = new Map(completionCounts.map((c) => [String(c._id), c.count]));

    return res.json({
      challenges: challenges.map((challenge) =>
        mapChallenge(challenge, completionMap.get(String(challenge._id)) || 0)
      ),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/challenges', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const category = String(req.body.category || 'workout').trim().toLowerCase();
    const difficulty = String(req.body.difficulty || 'medium').trim().toLowerCase();
    const challengeType = String(req.body.challengeType || 'one-time').trim().toLowerCase();
    const completionMode = String(req.body.completionMode || 'manual').trim().toLowerCase();
    const workoutGoalType = String(req.body.workoutGoalType || 'none').trim().toLowerCase();
    const equipmentId = req.body.equipmentId ? String(req.body.equipmentId).trim() : '';
    const pointsReward = Number(req.body.pointsReward);
    const targetValueRaw = Number(req.body.targetValue);
    const targetValue = Number.isFinite(targetValueRaw) && targetValueRaw > 0 ? targetValueRaw : 1;
    const targetUnit = String(req.body.targetUnit || 'steps').trim();
    const requiresTrainerApproval = Boolean(req.body.requiresTrainerApproval);
    const isActive = req.body.isActive === undefined ? true : Boolean(req.body.isActive);
    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
    const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;

    if (!title) return res.status(400).json({ error: 'Challenge title is required.' });
    if (!Number.isFinite(pointsReward) || pointsReward <= 0) {
      return res.status(400).json({ error: 'pointsReward must be a positive number.' });
    }
    if (!CHALLENGE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category.' });
    }
    if (!CHALLENGE_DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty.' });
    }
    if (!CHALLENGE_TYPES.includes(challengeType)) {
      return res.status(400).json({ error: 'Invalid challengeType.' });
    }
    if (!CHALLENGE_COMPLETION_MODES.includes(completionMode)) {
      return res.status(400).json({ error: 'Invalid completionMode.' });
    }
    if (!WORKOUT_GOAL_TYPES.includes(workoutGoalType)) {
      return res.status(400).json({ error: 'Invalid workoutGoalType.' });
    }
    if (workoutGoalType !== 'none' && !equipmentId) {
      return res.status(400).json({ error: 'equipmentId is required for workout-based challenges.' });
    }
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      return res.status(400).json({ error: 'Invalid startsAt date.' });
    }
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return res.status(400).json({ error: 'Invalid endsAt date.' });
    }
    if (startsAt && endsAt && endsAt < startsAt) {
      return res.status(400).json({ error: 'endsAt must be after startsAt.' });
    }

    let equipment = null;
    if (equipmentId) {
      equipment = await Equipment.findById(equipmentId).lean();
      if (!equipment) {
        return res.status(400).json({ error: 'Selected equipment was not found.' });
      }
    }

    if (workoutGoalType === 'duration-minutes' && !req.body.targetUnit) {
      req.body.targetUnit = 'minutes';
    }
    if (workoutGoalType === 'reps' && !req.body.targetUnit) {
      req.body.targetUnit = 'reps';
    }
    if (workoutGoalType === 'sets' && !req.body.targetUnit) {
      req.body.targetUnit = 'sets';
    }

    const challenge = await Challenge.create({
      trainerId: req.userId,
      title,
      description,
      category,
      difficulty,
      challengeType,
      completionMode,
      pointsReward,
      equipmentId: equipment ? equipment._id : null,
      equipmentNameSnapshot: equipment ? equipment.name : '',
      workoutGoalType,
      targetValue,
      targetUnit: String(req.body.targetUnit || targetUnit).trim(),
      requiresTrainerApproval,
      isActive,
      startsAt,
      endsAt,
    });

    await notifyAssignedMembersAboutChallenge(req.userId, challenge);

    return res.status(201).json({
      message: 'Challenge created successfully.',
      challenge: mapChallenge(challenge, 0),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/challenges/:challengeId', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const challenge = await Challenge.findOne({ _id: req.params.challengeId, trainerId: req.userId });
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found.' });
    }

    if (req.body.title !== undefined) {
      const title = String(req.body.title || '').trim();
      if (!title) return res.status(400).json({ error: 'Challenge title cannot be empty.' });
      challenge.title = title;
    }
    if (req.body.description !== undefined) challenge.description = String(req.body.description || '').trim();
    if (req.body.category !== undefined) {
      const category = String(req.body.category || '').trim().toLowerCase();
      if (!CHALLENGE_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category.' });
      challenge.category = category;
    }
    if (req.body.difficulty !== undefined) {
      const difficulty = String(req.body.difficulty || '').trim().toLowerCase();
      if (!CHALLENGE_DIFFICULTIES.includes(difficulty)) return res.status(400).json({ error: 'Invalid difficulty.' });
      challenge.difficulty = difficulty;
    }
    if (req.body.challengeType !== undefined) {
      const challengeType = String(req.body.challengeType || '').trim().toLowerCase();
      if (!CHALLENGE_TYPES.includes(challengeType)) return res.status(400).json({ error: 'Invalid challengeType.' });
      challenge.challengeType = challengeType;
    }
    if (req.body.completionMode !== undefined) {
      const completionMode = String(req.body.completionMode || '').trim().toLowerCase();
      if (!CHALLENGE_COMPLETION_MODES.includes(completionMode)) {
        return res.status(400).json({ error: 'Invalid completionMode.' });
      }
      challenge.completionMode = completionMode;
    }
    if (req.body.workoutGoalType !== undefined) {
      const workoutGoalType = String(req.body.workoutGoalType || '').trim().toLowerCase();
      if (!WORKOUT_GOAL_TYPES.includes(workoutGoalType)) {
        return res.status(400).json({ error: 'Invalid workoutGoalType.' });
      }
      challenge.workoutGoalType = workoutGoalType;
      if (workoutGoalType === 'none') {
        challenge.equipmentId = null;
        challenge.equipmentNameSnapshot = '';
      }
    }
    if (req.body.equipmentId !== undefined) {
      const equipmentId = req.body.equipmentId ? String(req.body.equipmentId).trim() : '';
      if (!equipmentId) {
        challenge.equipmentId = null;
        challenge.equipmentNameSnapshot = '';
      } else {
        const equipment = await Equipment.findById(equipmentId).lean();
        if (!equipment) {
          return res.status(400).json({ error: 'Selected equipment was not found.' });
        }
        challenge.equipmentId = equipment._id;
        challenge.equipmentNameSnapshot = equipment.name;
      }
    }
    if (req.body.pointsReward !== undefined) {
      const pointsReward = Number(req.body.pointsReward);
      if (!Number.isFinite(pointsReward) || pointsReward <= 0) {
        return res.status(400).json({ error: 'pointsReward must be a positive number.' });
      }
      challenge.pointsReward = pointsReward;
    }
    if (req.body.targetValue !== undefined) {
      const targetValue = Number(req.body.targetValue);
      if (!Number.isFinite(targetValue) || targetValue <= 0) {
        return res.status(400).json({ error: 'targetValue must be a positive number.' });
      }
      challenge.targetValue = targetValue;
    }
    if (req.body.targetUnit !== undefined) challenge.targetUnit = String(req.body.targetUnit || '').trim() || 'steps';
    if (req.body.requiresTrainerApproval !== undefined) {
      challenge.requiresTrainerApproval = Boolean(req.body.requiresTrainerApproval);
    }
    if (req.body.isActive !== undefined) challenge.isActive = Boolean(req.body.isActive);
    if (req.body.startsAt !== undefined) {
      const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
      if (startsAt && Number.isNaN(startsAt.getTime())) return res.status(400).json({ error: 'Invalid startsAt date.' });
      challenge.startsAt = startsAt;
    }
    if (req.body.endsAt !== undefined) {
      const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
      if (endsAt && Number.isNaN(endsAt.getTime())) return res.status(400).json({ error: 'Invalid endsAt date.' });
      challenge.endsAt = endsAt;
    }

    if (challenge.startsAt && challenge.endsAt && challenge.endsAt < challenge.startsAt) {
      return res.status(400).json({ error: 'endsAt must be after startsAt.' });
    }
    if (challenge.workoutGoalType !== 'none' && !challenge.equipmentId) {
      return res.status(400).json({ error: 'equipmentId is required for workout-based challenges.' });
    }
    if (challenge.workoutGoalType === 'duration-minutes' && !req.body.targetUnit) {
      challenge.targetUnit = 'minutes';
    }
    if (challenge.workoutGoalType === 'reps' && !req.body.targetUnit) {
      challenge.targetUnit = 'reps';
    }
    if (challenge.workoutGoalType === 'sets' && !req.body.targetUnit) {
      challenge.targetUnit = 'sets';
    }

    await challenge.save();
    return res.json({ message: 'Challenge updated successfully.', challenge: mapChallenge(challenge, 0) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/challenges/:challengeId', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const challenge = await Challenge.findOneAndDelete({ _id: req.params.challengeId, trainerId: req.userId });
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found.' });
    }

    await UserChallenge.deleteMany({ challengeId: challenge._id });
    return res.json({ message: 'Challenge deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/user-challenges/pending-approvals', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const pending = await UserChallenge.find({ trainerId: req.userId, status: 'pending-approval' })
      .populate('memberId', '_id name email')
      .populate('challengeId')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      pendingApprovals: pending.map((item) => ({
        id: item._id,
        member: item.memberId,
        challenge: item.challengeId,
        progressValue: item.progressValue,
        progressDays: item.progressDays,
        proofUrl: item.proofUrl,
        proofNote: item.proofNote,
        updatedAt: item.updatedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/user-challenges/:userChallengeId/approve', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const userChallenge = await UserChallenge.findOne({ _id: req.params.userChallengeId, trainerId: req.userId })
      .populate('challengeId')
      .populate('memberId');

    if (!userChallenge) return res.status(404).json({ error: 'User challenge not found.' });
    if (userChallenge.status !== 'pending-approval') {
      return res.status(400).json({ error: 'Only pending challenges can be approved.' });
    }

    const points = userChallenge.challengeId.pointsReward || 0;
    userChallenge.status = 'completed';
    userChallenge.pointsAwarded = points;
    userChallenge.completedAt = new Date();
    await userChallenge.save();

    const member = userChallenge.memberId;
    member.points = (member.points || 0) + points;
    await member.save();

    await Notification.create({
      recipientId: member._id,
      senderId: req.userId,
      type: 'challenge-approved',
      title: 'Challenge Approved',
      message: `${userChallenge.challengeId.title} has been approved. +${points} points added.`,
      relatedEntityId: userChallenge.challengeId._id,
      priority: 'normal',
    });

    return res.json({ message: 'Challenge approved and points awarded.', pointsAwarded: points });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/user-challenges/:userChallengeId/reject', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const userChallenge = await UserChallenge.findOne({ _id: req.params.userChallengeId, trainerId: req.userId })
      .populate('challengeId')
      .populate('memberId');

    if (!userChallenge) return res.status(404).json({ error: 'User challenge not found.' });
    if (userChallenge.status !== 'pending-approval') {
      return res.status(400).json({ error: 'Only pending challenges can be rejected.' });
    }

    userChallenge.status = 'rejected';
    await userChallenge.save();

    await Notification.create({
      recipientId: userChallenge.memberId._id,
      senderId: req.userId,
      type: 'challenge-rejected',
      title: 'Challenge Rejected',
      message: `${userChallenge.challengeId.title} was not approved. Please update proof/progress and try again.`,
      relatedEntityId: userChallenge.challengeId._id,
      priority: 'normal',
    });

    return res.json({ message: 'Challenge submission rejected.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Create/Update meal plan
router.post('/meal-plans/:memberId', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { phase, targetCalories, macros, meals, waterIntakeLiters, notes } = req.body;
    const member = await getAssignedMember(req.params.memberId, req.userId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const allowedPhases = ['Maintenance', 'Hypertrophy', 'Cutting', 'Strength'];
    const normalizedPhase = allowedPhases.includes(phase) ? phase : 'Maintenance';

    const safeCalories = Number(targetCalories);
    const safeMacros = {
      protein: Number(macros?.protein) || 200,
      carbs: Number(macros?.carbs) || 300,
      fats: Number(macros?.fats) || 80,
    };

    const normalizedWater = Number(waterIntakeLiters);
    const waterIntake = Number.isFinite(normalizedWater) && normalizedWater >= 0 ? normalizedWater : 0;

    const normalizedMeals = Array.isArray(meals)
      ? meals.map((meal) => {
          const itemList = Array.isArray(meal?.items) ? meal.items : [];
          const normalizedItems = itemList.map((item) => ({
            food: (item?.food || '').trim(),
            quantity: (item?.quantity || '').trim(),
            calories: Number(item?.calories) || 0,
            protein: Number(item?.protein) || 0,
            carbs: Number(item?.carbs) || 0,
            fat: Number(item?.fat) || 0,
          }));

          const totals = normalizedItems.reduce(
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
            name: (meal?.name || '').trim(),
            time: (meal?.time || '').trim(),
            items: normalizedItems,
            totals,
          };
        })
      : [];

    const mealPlan = await MealPlan.findOneAndUpdate(
      { memberId: member._id },
      {
        trainerId: req.userId,
        memberId: member._id,
        phase: normalizedPhase,
        targetCalories: Number.isFinite(safeCalories) ? safeCalories : 2500,
        macros: safeMacros,
        meals: normalizedMeals,
        waterIntakeLiters: waterIntake,
        notes: typeof notes === 'string' ? notes.trim() : '',
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(mealPlan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get member's meal plan
router.get('/meal-plans/:memberId', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const member = await getAssignedMember(req.params.memberId, req.userId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const mealPlan = await MealPlan.findOne({ memberId: member._id, trainerId: req.userId });
    if (!mealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    res.json(mealPlan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request leave
router.post('/leave-request', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { startDate, endDate, type, reason } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    if (end < start) {
      return res.status(400).json({ error: 'End date must be on or after start date' });
    }

    const allowedTypes = ['Personal', 'Medical', 'Vacation', 'Other'];
    const normalizedType = allowedTypes.includes(type) ? type : 'Personal';

    const leaveRequest = await LeaveRequest.create({
      trainerId: req.userId,
      startDate: start,
      endDate: end,
      type: normalizedType,
      reason: reason || '',
      status: 'pending',
    });

    res.json(leaveRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trainer leave requests
router.get('/leave-request', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const requests = await LeaveRequest.find({ trainerId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trainer notifications (admin decisions on leave requests)
router.get('/notifications', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const decisionFilter = {
      trainerId: req.userId,
      status: { $in: ['approved', 'rejected'] },
    };

    const notifications = await LeaveRequest.find(decisionFilter)
      .sort({ reviewedAt: -1, createdAt: -1 })
      .select('_id startDate endDate type status reviewedAt trainerSeenAt decisionNote createdAt')
      .lean();

    const unreadCount = notifications.filter((item) => !item.trainerSeenAt).length;

    res.json({
      unreadCount,
      notifications: notifications.map((item) => ({
        id: item._id,
        kind: 'leave-request-decision',
        title: `Leave request ${item.status}`,
        message: `${item.type} leave (${new Date(item.startDate).toLocaleDateString()} - ${new Date(item.endDate).toLocaleDateString()}) has been ${item.status}.`,
        status: item.status,
        decisionNote: item.decisionNote || '',
        startDate: item.startDate,
        endDate: item.endDate,
        reviewedAt: item.reviewedAt,
        createdAt: item.createdAt,
        read: Boolean(item.trainerSeenAt),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark single notification as read
router.patch('/notifications/:id/read', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findOne({
      _id: req.params.id,
      trainerId: req.userId,
      status: { $in: ['approved', 'rejected'] },
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (!leaveRequest.trainerSeenAt) {
      leaveRequest.trainerSeenAt = new Date();
      await leaveRequest.save();
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.patch('/notifications/read-all', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    await LeaveRequest.updateMany(
      {
        trainerId: req.userId,
        status: { $in: ['approved', 'rejected'] },
        trainerSeenAt: null,
      },
      { $set: { trainerSeenAt: new Date() } }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trainer schedules/availability
router.get('/schedules', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const schedule = await getOrCreateSchedule(req.userId);
    res.json(normalizeScheduleDocument(schedule, req.userId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update trainer availability
router.put('/schedules', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const sameTimeAllDays = req.body.sameTimeAllDays !== undefined ? Boolean(req.body.sameTimeAllDays) : true;
    const daysInput = Array.isArray(req.body.days) ? req.body.days : [];
    if (daysInput.length !== DAY_SEQUENCE.length) {
      return res.status(400).json({ error: 'days must include all seven days.' });
    }

    const normalizedDays = [];
    for (const dayName of DAY_SEQUENCE) {
      const dayInput = daysInput.find((d) => d?.day === dayName);
      if (!dayInput) {
        return res.status(400).json({ error: `Missing schedule for ${dayName}.` });
      }

      const startTime = String(dayInput.startTime || '').trim();
      const endTime = String(dayInput.endTime || '').trim();
      const isAvailable = Boolean(dayInput.isAvailable);

      const startMinutes = toMinutes(startTime);
      const endMinutes = toMinutes(endTime);
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        return res.status(400).json({ error: `Invalid time range for ${dayName}.` });
      }

      normalizedDays.push({
        day: dayName,
        isAvailable,
        startTime,
        endTime,
      });
    }

    const schedule = await TrainerSchedule.findOneAndUpdate(
      { trainerId: req.userId },
      {
        trainerId: req.userId,
        sameTimeAllDays,
        days: normalizedDays,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(normalizeScheduleDocument(schedule, req.userId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trainer leave balance
router.get('/leave-balance', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const trainer = await User.findById(req.userId).select('totalLeaveBalance usedLeaveBalance');
    if (!trainer) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    res.json({
      totalLeaveBalance: trainer.totalLeaveBalance || 0,
      usedLeaveBalance: trainer.usedLeaveBalance || 0,
      availableBalance: (trainer.totalLeaveBalance || 0) - (trainer.usedLeaveBalance || 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================== TEST ENDPOINTS ==============================

/**
 * GET /test/check-availability
 * TEST ENDPOINT - Check trainer's availability for session scheduling
 * Headers: Bearer token
 */
router.get('/test/check-availability', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const schedule = await getOrCreateSchedule(req.userId);
    const normalized = normalizeScheduleDocument(schedule, req.userId);
    
    const today = new Date();
    const dayName = DAY_NAMES[today.getDay()];
    const todayAvailability = normalized.days.find(d => d.day === dayName);
    
    res.json({
      message: 'Trainer availability check',
      trainer: {
        _id: req.userId,
      },
      schedule: normalized,
      today: {
        date: today.toISOString().split('T')[0],
        dayName: dayName,
        todayAvailability: todayAvailability,
      },
      debug: {
        daysLength: normalized.days.length,
        hasSchedule: !!schedule,
        DAY_NAMES: DAY_NAMES,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /test/schedule-session
 * TEST ENDPOINT - Create a session with detailed error feedback
 * Body: { name, date (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM), memberIds? }
 */
router.post('/test/schedule-session', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { name, date, startTime, endTime, memberIds } = req.body;
    
    // 1. Check required fields
    if (!name || !date || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Missing required fields',
        provided: { name: !!name, date: !!date, startTime: !!startTime, endTime: !!endTime },
      });
    }

    // 2. Validate date format
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
        provided: date,
      });
    }

    // 3. Validate time format and range
    const sessionStartMinutes = toMinutes(startTime);
    const sessionEndMinutes = toMinutes(endTime);
    if (sessionStartMinutes === null || sessionEndMinutes === null) {
      return res.status(400).json({
        error: 'Invalid time format. Use HH:MM (24-hour)',
        provided: { startTime, endTime },
      });
    }
    
    if (sessionEndMinutes <= sessionStartMinutes) {
      return res.status(400).json({
        error: 'End time must be after start time',
        provided: { startTime, endTime },
      });
    }

    // 4. Get and check schedule
    const schedule = await getOrCreateSchedule(req.userId);
    const dateObj = new Date(`${normalizedDate}T00:00:00`);
    const dayName = DAY_NAMES[dateObj.getDay()];
    const dayAvailability = (schedule.days || []).find((d) => d.day === dayName);

    if (!dayAvailability) {
      return res.status(400).json({
        error: `Day ${dayName} not found in schedule`,
        availableDays: (schedule.days || []).map(d => d.day),
      });
    }

    if (!dayAvailability.isAvailable) {
      return res.status(400).json({
        error: `You are not available on ${dayName}`,
        day: dayAvailability,
      });
    }

    // 5. Check time within availability window
    const dayStartMinutes = toMinutes(dayAvailability.startTime);
    const dayEndMinutes = toMinutes(dayAvailability.endTime);
    
    if (dayStartMinutes === null || dayEndMinutes === null) {
      return res.status(400).json({
        error: 'Invalid availability times in schedule',
        day: dayAvailability,
      });
    }

    if (sessionStartMinutes < dayStartMinutes || sessionEndMinutes > dayEndMinutes) {
      return res.status(400).json({
        error: `Session time must be within availability window`,
        requested: { startTime, endTime, startMinutes: sessionStartMinutes, endMinutes: sessionEndMinutes },
        available: { startTime: dayAvailability.startTime, endTime: dayAvailability.endTime, startMinutes: dayStartMinutes, endMinutes: dayEndMinutes },
      });
    }

    // 6. Try to create session
    const session = await Session.create({
      trainerId: req.userId,
      name,
      date: normalizedDate,
      startTime,
      endTime,
      memberIds: memberIds || [],
      type: 'session',
      status: 'scheduled',
    });

    res.json({
      message: 'Session created successfully',
      session: mapSession(session),
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Server error creating session',
      error: error.message 
    });
  }
});

module.exports = router;
