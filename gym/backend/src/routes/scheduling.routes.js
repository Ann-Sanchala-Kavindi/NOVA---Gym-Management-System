const express = require('express');
const router = express.Router();
const { authMiddleware, hasRole } = require('../utils/auth');
const User = require('../models/User');
const TrainerSchedule = require('../models/TrainerSchedule');
const MemberAssignment = require('../models/MemberAssignment');
const Session = require('../models/Session');
const SessionReschedule = require('../models/SessionReschedule');
const Notification = require('../models/Notification');

function toMinutes(timeValue) {
  const [h, m] = String(timeValue || '').split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function getDayName(dateStr) {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { weekday: 'long' });
}

// ============================== TRAINER ROUTES ==============================

/**
 * GET /trainer/schedule
 * Get trainer's weekly schedule and date overrides
 */
router.get('/trainer/schedule', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    let schedule = await TrainerSchedule.findOne({ trainerId });

    if (!schedule) {
      // Create default schedule if doesn't exist
      schedule = new TrainerSchedule({
        trainerId,
        days: [
          { day: 'Monday', isAvailable: true, startTime: '06:00', endTime: '20:00', ptStartTime: '06:00', ptEndTime: '20:00', maxMemberMinutesPerDay: 60 },
          { day: 'Tuesday', isAvailable: true, startTime: '06:00', endTime: '20:00', ptStartTime: '06:00', ptEndTime: '20:00', maxMemberMinutesPerDay: 60 },
          { day: 'Wednesday', isAvailable: true, startTime: '06:00', endTime: '20:00', ptStartTime: '06:00', ptEndTime: '20:00', maxMemberMinutesPerDay: 60 },
          { day: 'Thursday', isAvailable: true, startTime: '06:00', endTime: '20:00', ptStartTime: '06:00', ptEndTime: '20:00', maxMemberMinutesPerDay: 60 },
          { day: 'Friday', isAvailable: true, startTime: '06:00', endTime: '20:00', ptStartTime: '06:00', ptEndTime: '20:00', maxMemberMinutesPerDay: 60 },
          { day: 'Saturday', isAvailable: false, startTime: '10:00', endTime: '18:00', ptStartTime: '10:00', ptEndTime: '18:00', maxMemberMinutesPerDay: 60 },
          { day: 'Sunday', isAvailable: false, startTime: '10:00', endTime: '18:00', ptStartTime: '10:00', ptEndTime: '18:00', maxMemberMinutesPerDay: 60 },
        ],
      });
      await schedule.save();
    }

    res.json({ message: 'Trainer schedule retrieved', schedule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /trainer/schedule
 * Update trainer's weekly availability
 */
router.put('/trainer/schedule', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const { days, dateOverrides } = req.body;

    let schedule = await TrainerSchedule.findOne({ trainerId });

    if (!schedule) {
      schedule = new TrainerSchedule({ trainerId });
    }

    if (days) schedule.days = days;
    if (dateOverrides) schedule.dateOverrides = dateOverrides;

    await schedule.save();
    
    // After changing PT hours, cancel future sessions outside new PT windows and notify members
    if (days && Array.isArray(days)) {
      const dayMap = new Map(days.map((d) => [d.day, d]));
      const now = new Date();
      const futureSessions = await Session.find({ trainerId, date: { $gte: now.toISOString().slice(0, 10) }, status: { $in: ['scheduled', 'pending'] } });

      const updates = [];
      for (const session of futureSessions) {
        const dayName = new Date(`${session.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
        const rules = dayMap.get(dayName);
        if (!rules) continue;

        const startMin = toMinutes(session.startTime);
        const endMin = toMinutes(session.endTime);
        const ptStart = toMinutes(rules.ptStartTime || rules.startTime);
        const ptEnd = toMinutes(rules.ptEndTime || rules.endTime);
        if (
          startMin === null || endMin === null || ptStart === null || ptEnd === null ||
          startMin < ptStart || endMin > ptEnd
        ) {
          session.status = 'cancelled';
          session.cancellationReason = 'Trainer updated PT hours';
          await session.save();
          const memberIds = session.memberIds && session.memberIds.length ? session.memberIds : session.singleMemberId ? [session.singleMemberId] : [];
          if (memberIds.length) {
            updates.push(
              Notification.insertMany(
                memberIds.map((memberId) => ({
                  recipientId: memberId,
                  senderId: trainerId,
                  type: 'session-cancelled',
                  title: 'Session cancelled',
                  message: `Your session on ${session.date} was cancelled because the trainer updated PT hours.`,
                  relatedEntityId: session._id,
                  relatedEntityType: 'Session',
                  data: { date: session.date, startTime: session.startTime, endTime: session.endTime },
                }))
              )
            );
          }
        }
      }
      await Promise.all(updates);
    }
    res.json({ message: 'Schedule updated successfully', schedule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /trainer/assignments
 * Get all members assigned to trainer with PT hours
 */
router.get('/trainer/assignments', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const assignments = await MemberAssignment.find({ trainerId, status: 'active' })
      .populate('memberId', 'name email googleId')
      .sort({ createdAt: -1 });

    const stats = {
      totalAssignments: assignments.length,
      totalAllocatedHours: assignments.reduce((sum, a) => sum + a.allocatedPTHours, 0),
      totalUsedHours: assignments.reduce((sum, a) => sum + a.usedPTHours, 0),
    };

    res.json({ message: 'Assignments retrieved', assignments, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /trainer/assignments/:memberId
 * Create or update PT hours allocation for a member
 * Body: { allocatedPTHours, notes? }
 */
router.post('/trainer/assignments/:memberId', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const { memberId } = req.params;
    const { allocatedPTHours, notes } = req.body;

    // Verify member is premium
    const member = await User.findById(memberId);
    if (!member || member.role !== 'member') {
      return res.status(400).json({ message: 'Invalid member' });
    }

    if (member.memberType !== 'premium') {
      return res.status(403).json({ message: 'Only premium members can be assigned' });
    }

    let assignment = await MemberAssignment.findOne({
      trainerId,
      memberId,
      status: 'active',
    });

    if (assignment) {
      // Update existing
      assignment.allocatedPTHours = allocatedPTHours;
      assignment.remainingPTHours = allocatedPTHours - assignment.usedPTHours;
      if (notes) assignment.notes = notes;
    } else {
      // Create new
      assignment = new MemberAssignment({
        trainerId,
        memberId,
        allocatedPTHours,
        remainingPTHours: allocatedPTHours,
        notes: notes || '',
      });
    }

    await assignment.save();

    // Notify member
    await Notification.create({
      recipientId: memberId,
      senderId: trainerId,
      type: 'pt-hours-updated',
      title: 'PT Hours Allocated',
      message: `Your trainer allocated ${allocatedPTHours} hours for personal training sessions.`,
      relatedEntityId: assignment._id,
      relatedEntityType: 'MemberAssignment',
      data: { allocatedHours: allocatedPTHours },
    });

    res.json({ message: 'Member assigned with PT hours', assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * PATCH /trainer/assignments/:memberId
 * Update PT hours for existing assignment
 */
router.patch('/trainer/assignments/:memberId', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const { memberId } = req.params;
    const { allocatedPTHours, notes } = req.body;

    const assignment = await MemberAssignment.findOne({
      trainerId,
      memberId,
      status: 'active',
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const oldHours = assignment.allocatedPTHours;
    assignment.allocatedPTHours = allocatedPTHours;
    assignment.remainingPTHours = allocatedPTHours - assignment.usedPTHours;
    if (notes) assignment.notes = notes;

    await assignment.save();

    // Notify member of change
    await Notification.create({
      recipientId: memberId,
      senderId: trainerId,
      type: 'pt-hours-updated',
      title: 'PT Hours Updated',
      message: `Your trainer updated your PT hours from ${oldHours} to ${allocatedPTHours} hours.`,
      relatedEntityId: assignment._id,
      relatedEntityType: 'MemberAssignment',
      data: { oldHours, newHours: allocatedPTHours },
    });

    res.json({ message: 'Assignment updated', assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /trainer/assignments/:memberId
 * Remove/pause member assignment
 */
router.delete('/trainer/assignments/:memberId', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const { memberId } = req.params;

    const assignment = await MemberAssignment.findOne({
      trainerId,
      memberId,
      status: 'active',
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    assignment.status = 'inactive';
    assignment.endDate = new Date();
    await assignment.save();

    // Notify member
    await Notification.create({
      recipientId: memberId,
      senderId: trainerId,
      type: 'membership-assigned',
      title: 'Assignment Ended',
      message: 'Your training assignment has been ended by your trainer.',
      relatedEntityId: assignment._id,
      relatedEntityType: 'MemberAssignment',
    });

    res.json({ message: 'Assignment removed', assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /trainer/sessions
 * Create a new session (1v1 or group) within available time
 * Body: { name, date, startTime, endTime, sessionType, singleMemberId?, ptHoursAllocated?, memberIds?, notes? }
 */
router.post('/trainer/sessions', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const {
      name,
      date,
      startTime,
      endTime,
      sessionType, // '1v1' or 'group'
      singleMemberId,
      ptHoursAllocated,
      memberIds,
      notes,
    } = req.body;

    // Validate sessionType
    if (!['1v1', 'group'].includes(sessionType)) {
      return res.status(400).json({ message: 'Invalid session type. Must be 1v1 or group.' });
    }

    // For 1v1: require singleMemberId and ptHoursAllocated
    if (sessionType === '1v1') {
      if (!singleMemberId || !ptHoursAllocated) {
        return res.status(400).json({
          message: '1v1 sessions require singleMemberId and ptHoursAllocated',
        });
      }

      // Verify member is assigned and has enough PT hours
      const assignment = await MemberAssignment.findOne({
        trainerId,
        memberId: singleMemberId,
        status: 'active',
      });

      if (!assignment) {
        return res.status(403).json({
          message:
            'Member is not assigned to you or assignment is inactive. Assign member with PT hours first.',
        });
      }

      if (assignment.remainingPTHours < ptHoursAllocated) {
        return res.status(403).json({
          message: `Insufficient PT hours. Member has ${assignment.remainingPTHours} hours remaining, but need ${ptHoursAllocated}`,
        });
      }

      // Verify member is premium
      const member = await User.findById(singleMemberId);
      if (member.memberType !== 'premium') {
        return res.status(403).json({ message: 'Only premium members can book 1v1 sessions' });
      }
    }

    // Create session
    const session = new Session({
      trainerId,
      name,
      date,
      startTime,
      endTime,
      sessionType,
      singleMemberId: sessionType === '1v1' ? singleMemberId : null,
      ptHoursAllocated,
      memberIds: [], // For group sessions, members are added when they book
      selectedMemberIds: sessionType === 'group' ? memberIds || [] : [], // Selected members = pending invitations
      notes: notes || '',
      status: sessionType === '1v1' ? 'scheduled' : 'pending', // Group sessions start as pending
      type: sessionType === '1v1' ? 'personal' : 'group',
    });

    await session.save();
    await session.populate(['trainerId', 'singleMemberId', 'memberIds', 'selectedMemberIds']);

    // If 1v1, update PT hours for member assignment
    if (sessionType === '1v1') {
      const assignment = await MemberAssignment.findOne({
        trainerId,
        memberId: singleMemberId,
        status: 'active',
      });
      assignment.usedPTHours += ptHoursAllocated;
      assignment.remainingPTHours = assignment.allocatedPTHours - assignment.usedPTHours;
      await assignment.save();

      // Notify member
      await Notification.create({
        recipientId: singleMemberId,
        senderId: trainerId,
        type: 'session-created',
        title: 'New Training Session Created',
        message: `${name} session scheduled on ${date} from ${startTime} to ${endTime}. ${ptHoursAllocated} PT hours allocated.`,
        relatedEntityId: session._id,
        relatedEntityType: 'Session',
        data: { sessionId: session._id, ptHours: ptHoursAllocated },
      });
    }

    // If group session, send notifications to selected members
    if (sessionType === 'group' && memberIds && memberIds.length > 0) {
      for (const memberId of memberIds) {
        await Notification.create({
          recipientId: memberId,
          senderId: trainerId,
          type: 'session-invitation',
          title: 'New Group Session Available',
          message: `You've been invited to "${name}" on ${date} from ${startTime} to ${endTime}. Click to book your spot!`,
          relatedEntityId: session._id,
          relatedEntityType: 'Session',
          priority: 'high',
          data: { sessionId: session._id },
        });
      }
    }

    res.json({ message: 'Session created successfully', session });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /trainer/sessions
 * Get all trainer's sessions with optional filters
 */
router.get('/trainer/sessions', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const { date, status, sessionType } = req.query;

    const filter = { trainerId };
    if (date) filter.date = date;
    if (status) filter.status = status;
    if (sessionType) filter.sessionType = sessionType;

    const sessions = await Session.find(filter)
      .populate('singleMemberId', 'name email googleId memberType')
      .populate('memberIds', 'name email googleId')
      .sort({ date: 1, startTime: 1 });

    res.json({ message: 'Sessions retrieved', sessions, count: sessions.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * PATCH /trainer/sessions/:sessionId
 * Update session details (name, time, notes, etc.)
 */
router.patch('/trainer/sessions/:sessionId', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const { sessionId } = req.params;
    const { name, startTime, endTime, notes, status } = req.body;

    const session = await Session.findById(sessionId);

    if (!session || session.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (name) session.name = name;
    if (startTime) session.startTime = startTime;
    if (endTime) session.endTime = endTime;
    if (notes !== undefined) session.notes = notes;
    if (status) session.status = status;

    await session.save();
    res.json({ message: 'Session updated', session });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /trainer/sessions/:sessionId/reschedule
 * Reschedule a session to a different time/date with reason
 * Body: { newDate, newStartTime, newEndTime, reason }
 */
router.post('/trainer/sessions/:sessionId/reschedule', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const { sessionId } = req.params;
    const { newDate, newStartTime, newEndTime, reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Reason for rescheduling is required' });
    }

    const originalSession = await Session.findById(sessionId);

    if (!originalSession || originalSession.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (originalSession.status === 'cancelled') {
      return res.status(400).json({ message: 'Cannot reschedule cancelled session' });
    }

    // Create reschedule record
    const reschedule = new SessionReschedule({
      originalSessionId: sessionId,
      initiatedBy: trainerId,
      initiatedByRole: 'trainer',
      originalDate: originalSession.date,
      originalStartTime: originalSession.startTime,
      originalEndTime: originalSession.endTime,
      newDate,
      newStartTime,
      newEndTime,
      reason,
      trainerId,
      memberId: originalSession.singleMemberId,
      status: 'pending',
    });

    await reschedule.save();

    // Mark original session as 'rescheduled'
    originalSession.status = 'rescheduled';
    originalSession.rescheduleId = reschedule._id;
    await originalSession.save();

    // Notify member if 1v1 session
    if (originalSession.singleMemberId) {
      await Notification.create({
        recipientId: originalSession.singleMemberId,
        senderId: trainerId,
        type: 'session-rescheduled',
        title: 'Training Session Rescheduled',
        message: `Your session on ${originalSession.date} has been rescheduled to ${newDate} from ${newStartTime}. Reason: ${reason}`,
        relatedEntityId: reschedule._id,
        relatedEntityType: 'SessionReschedule',
        data: {
          rescheduleId: reschedule._id,
          originalDate: originalSession.date,
          newDate,
          reason,
        },
        actions: [
          {
            label: 'Accept',
            actionType: 'accept-reschedule',
            actionData: { rescheduleId: reschedule._id },
          },
          {
            label: 'Decline',
            actionType: 'decline-reschedule',
            actionData: { rescheduleId: reschedule._id },
          },
        ],
      });
    }

    res.json({ message: 'Session reschedule initiated', reschedule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /trainer/reschedules
 * Get pending reschedule requests
 */
router.get('/trainer/reschedules', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const { status } = req.query;

    const filter = { trainerId };
    if (status) filter.status = status;

    const reschedules = await SessionReschedule.find(filter)
      .populate('originalSessionId')
      .populate('newSessionId')
      .populate('memberId', 'name email googleId')
      .sort({ createdAt: -1 });

    res.json({ message: 'Reschedules retrieved', reschedules });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * PATCH /trainer/reschedules/:rescheduleId/confirm
 * Confirm/finalize reschedule (create new session at new time)
 */
router.patch('/trainer/reschedules/:rescheduleId/confirm', authMiddleware, hasRole('trainer'), async (req, res) => {
  try {
    const trainerId = req.user._id;
    const { rescheduleId } = req.params;

    const reschedule = await SessionReschedule.findById(rescheduleId);

    if (!reschedule || reschedule.trainerId.toString() !== trainerId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (reschedule.status !== 'accepted') {
      return res.status(400).json({ message: 'Can only confirm accepted reschedules' });
    }

    // Get original session
    const originalSession = await Session.findById(reschedule.originalSessionId);

    // Create new session at new time
    const newSession = new Session({
      trainerId,
      name: originalSession.name,
      date: reschedule.newDate,
      startTime: reschedule.newStartTime,
      endTime: reschedule.newEndTime,
      sessionType: originalSession.sessionType,
      singleMemberId: originalSession.singleMemberId,
      ptHoursAllocated: originalSession.ptHoursAllocated,
      memberIds: originalSession.memberIds,
      notes: originalSession.notes,
      status: 'scheduled',
      type: originalSession.type,
      originalSessionId: originalSession._id,
    });

    await newSession.save();

    // Update reschedule
    reschedule.newSessionId = newSession._id;
    reschedule.status = 'confirmed';
    await reschedule.save();

    // Notify member
    if (reschedule.memberId) {
      await Notification.create({
        recipientId: reschedule.memberId,
        senderId: trainerId,
        type: 'session-created',
        title: 'Rescheduled Session Confirmed',
        message: `Your rescheduled session is confirmed on ${reschedule.newDate} from ${reschedule.newStartTime}.`,
        relatedEntityId: newSession._id,
        relatedEntityType: 'Session',
      });
    }

    res.json({ message: 'Reschedule confirmed, new session created', newSession });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================== MEMBER ROUTES ==============================

/**
 * GET /member/trainer
 * Get assigned trainer details
 */
router.get('/member/trainer', authMiddleware, hasRole('member'), async (req, res) => {
  try {
    const memberId = req.user._id;

    const assignment = await MemberAssignment.findOne({
      memberId,
      status: 'active',
    }).populate('trainerId', 'name email googleId');

    if (!assignment) {
      return res.json({ message: 'No trainer assigned', assignment: null });
    }

    res.json({
      message: 'Trainer retrieved',
      assignment,
      trainer: assignment.trainerId,
      ptHours: {
        allocated: assignment.allocatedPTHours,
        used: assignment.usedPTHours,
        remaining: assignment.remainingPTHours,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /member/pt-hours
 * Get available PT hours with assigned trainer
 */
router.get('/member/pt-hours', authMiddleware, hasRole('member'), async (req, res) => {
  try {
    const memberId = req.user._id;

    const assignment = await MemberAssignment.findOne({
      memberId,
      status: 'active',
    }).populate('trainerId', 'name email');

    if (!assignment) {
      return res.status(404).json({ message: 'No active trainer assignment' });
    }

    res.json({
      message: 'PT hours retrieved',
      trainerId: assignment.trainerId._id,
      trainerName: assignment.trainerId.name,
      allocatedPTHours: assignment.allocatedPTHours,
      usedPTHours: assignment.usedPTHours,
      remainingPTHours: assignment.remainingPTHours,
      notes: assignment.notes,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get trainer availability and booked sessions for a specific date (for members)
router.get('/member/trainer/availability', authMiddleware, hasRole('member'), async (req, res) => {
  try {
    const memberId = req.user._id;
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const dayName = getDayName(targetDate);

    if (!dayName) {
      return res.status(400).json({ message: 'Invalid date' });
    }

    const assignment = await MemberAssignment.findOne({ memberId, status: 'active' }).populate('trainerId', 'name email');
    if (!assignment) {
      return res.status(404).json({ message: 'No active trainer assignment' });
    }

    const schedule = await TrainerSchedule.findOne({ trainerId: assignment.trainerId });
    const day = (schedule?.days || []).find((d) => d.day === dayName) || null;

    const sessions = await Session.find({
      trainerId: assignment.trainerId._id || assignment.trainerId,
      date: targetDate,
      status: { $in: ['pending', 'scheduled', 'completed', 'rescheduled'] },
    })
      .select('startTime endTime sessionType status name memberIds singleMemberId')
      .sort({ startTime: 1 });

    res.json({
      message: 'Trainer availability retrieved',
      date: targetDate,
      day,
      sessions,
      trainer: assignment.trainerId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /member/sessions/1v1/book
 * Book a 1v1 personal training session with assigned trainer
 * Body: { date, startTime, endTime, sessionName, ptHoursAllocated }
 */
router.post('/member/sessions/1v1/book', authMiddleware, hasRole('member'), async (req, res) => {
  try {
    const memberId = req.user._id;
    const { date, startTime, endTime, sessionName, ptHoursAllocated } = req.body;

    // Get member and assignment
    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Get assignment
    const assignment = await MemberAssignment.findOne({
      memberId,
      status: 'active',
    }).populate('trainerId');

    if (!assignment) {
      return res.status(404).json({ message: 'You are not assigned to any trainer' });
    }

    // Verify sufficient PT hours
    if (assignment.remainingPTHours < ptHoursAllocated) {
      return res.status(403).json({
        message: `Insufficient PT hours. You have ${assignment.remainingPTHours} hours remaining`,
      });
    }

    // Validate times
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return res.status(400).json({ message: 'Invalid time range' });
    }

    // Pull trainer schedule and availability for the requested day
    const schedule = await TrainerSchedule.findOne({ trainerId: assignment.trainerId });
    const dayName = getDayName(date);
    if (!dayName) {
      return res.status(400).json({ message: 'Invalid date' });
    }

    const dayAvailability = (schedule?.days || []).find((d) => d.day === dayName);
    if (!dayAvailability || !dayAvailability.isAvailable) {
      return res.status(400).json({ message: `Trainer is not available on ${dayName}` });
    }

    const dayStart = toMinutes(dayAvailability.startTime);
    const dayEnd = toMinutes(dayAvailability.endTime);
    const ptStart = toMinutes(dayAvailability.ptStartTime || dayAvailability.startTime);
    const ptEnd = toMinutes(dayAvailability.ptEndTime || dayAvailability.endTime);

    if (
      dayStart === null ||
      dayEnd === null ||
      ptStart === null ||
      ptEnd === null ||
      startMinutes < dayStart ||
      endMinutes > dayEnd
    ) {
      return res.status(400).json({
        message: `Session must be inside trainer availability (${dayAvailability.startTime}-${dayAvailability.endTime})`,
      });
    }

    if (startMinutes < ptStart || endMinutes > ptEnd) {
      return res.status(400).json({
        message: `Session must be inside trainer PT hours (${dayAvailability.ptStartTime || dayAvailability.startTime}-${dayAvailability.ptEndTime || dayAvailability.endTime})`,
      });
    }

    // Prevent overlap with trainer's existing sessions on that date
    const existingSessions = await Session.find({
      trainerId: assignment.trainerId._id,
      date,
      status: { $in: ['pending', 'scheduled', 'completed', 'rescheduled'] },
    }).select('startTime endTime');

    const hasOverlap = existingSessions.some((s) => {
      const sStart = toMinutes(s.startTime);
      const sEnd = toMinutes(s.endTime);
      if (sStart === null || sEnd === null) return false;
      return endMinutes > sStart && startMinutes < sEnd;
    });

    if (hasOverlap) {
      return res.status(400).json({ message: 'This time overlaps another session for the trainer.' });
    }

    // Enforce per-member daily cap during PT hours
    const dayLimit = Number(dayAvailability.maxMemberMinutesPerDay || 0);
    if (dayLimit > 0) {
      const memberSameDaySessions = await Session.find({
        trainerId: assignment.trainerId._id,
        date,
        status: 'scheduled',
        $or: [{ memberIds: memberId }, { singleMemberId: memberId }],
      }).select('startTime endTime');

      const usedMinutes = memberSameDaySessions.reduce((sum, s) => {
        const sStart = toMinutes(s.startTime);
        const sEnd = toMinutes(s.endTime);
        if (sStart === null || sEnd === null) return sum;
        return sum + Math.max(0, sEnd - sStart);
      }, 0);

      const duration = endMinutes - startMinutes;
      if (usedMinutes + duration > dayLimit) {
        return res.status(400).json({
          message: `Booking exceeds daily PT limit of ${dayLimit} minutes for this member on ${dayName}.`,
        });
      }
    }

    // Create session
    const session = new Session({
      trainerId: assignment.trainerId._id,
      name: sessionName || '1v1 Personal Training',
      date,
      startTime,
      endTime,
      sessionType: '1v1',
      singleMemberId: memberId,
      ptHoursAllocated,
      status: 'scheduled',
      type: 'personal',
    });

    await session.save();

    // Update PT hours
    assignment.usedPTHours += ptHoursAllocated;
    assignment.remainingPTHours = assignment.allocatedPTHours - assignment.usedPTHours;
    await assignment.save();

    // Notify trainer
    await Notification.create({
      recipientId: assignment.trainerId._id,
      senderId: memberId,
      type: 'session-created',
      title: '1v1 Session Booked',
      message: `${member.name} booked a 1v1 session on ${date} from ${startTime} to ${endTime}. ${ptHoursAllocated} PT hours allocated.`,
      relatedEntityId: session._id,
      relatedEntityType: 'Session',
    });

    res.json({ message: '1v1 session booked successfully', session });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /member/sessions
 * Get member's sessions
 */
router.get('/member/sessions', authMiddleware, hasRole('member'), async (req, res) => {
  try {
    const memberId = req.user._id;

    const sessions = await Session.find({
      $or: [{ singleMemberId: memberId }, { memberIds: memberId }],
    })
      .populate('trainerId', 'name email googleId')
      .sort({ date: 1, startTime: 1 });

    res.json({ message: 'Sessions retrieved', sessions, count: sessions.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /member/sessions/:sessionId/cancel
 * Cancel a scheduled session
 */
router.post('/member/sessions/:sessionId/cancel', authMiddleware, hasRole('member'), async (req, res) => {
  try {
    const memberId = req.user._id;
    const { sessionId } = req.params;
    const { cancellationReason } = req.body;

    const session = await Session.findById(sessionId);

    if (!session || (session.singleMemberId && session.singleMemberId.toString() !== memberId.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (session.status === 'cancelled') {
      return res.status(400).json({ message: 'Session already cancelled' });
    }

    session.status = 'cancelled';
    session.cancellationReason = cancellationReason || 'Cancelled by member';
    await session.save();

    // If 1v1, refund PT hours
    if (session.sessionType === '1v1') {
      const assignment = await MemberAssignment.findOne({
        trainerId: session.trainerId,
        memberId,
        status: 'active',
      });

      if (assignment) {
        assignment.usedPTHours -= session.ptHoursAllocated;
        assignment.remainingPTHours = assignment.allocatedPTHours - assignment.usedPTHours;
        await assignment.save();
      }
    }

    // Notify trainer
    await Notification.create({
      recipientId: session.trainerId,
      senderId: memberId,
      type: 'session-cancelled',
      title: 'Session Cancelled',
      message: `${session.name} on ${session.date} has been cancelled. Reason: ${cancellationReason || 'No reason provided'}`,
      relatedEntityId: session._id,
      relatedEntityType: 'Session',
    });

    res.json({ message: 'Session cancelled', session });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /member/reschedules
 * Get reschedule notifications for member
 */
router.get('/member/reschedules', authMiddleware, hasRole('member'), async (req, res) => {
  try {
    const memberId = req.user._id;
    const { status } = req.query;

    const filter = { memberId };
    if (status) filter.status = status;

    const reschedules = await SessionReschedule.find(filter)
      .populate('originalSessionId')
      .populate('trainerId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ message: 'Reschedules retrieved', reschedules });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * PATCH /member/reschedules/:rescheduleId/accept
 * Accept a reschedule offer
 */
router.patch('/member/reschedules/:rescheduleId/accept', authMiddleware, hasRole('member'), async (req, res) => {
  try {
    const memberId = req.user._id;
    const { rescheduleId } = req.params;

    const reschedule = await SessionReschedule.findById(rescheduleId);

    if (!reschedule || reschedule.memberId.toString() !== memberId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (reschedule.status !== 'pending') {
      return res.status(400).json({ message: 'Reschedule is not pending' });
    }

    reschedule.status = 'accepted';
    await reschedule.save();

    // Notify trainer that member accepted
    await Notification.create({
      recipientId: reschedule.trainerId,
      senderId: memberId,
      type: 'session-rescheduled',
      title: 'Reschedule Accepted',
      message: `Member accepted rescheduling to ${reschedule.newDate} from ${reschedule.newStartTime}.`,
      relatedEntityId: rescheduleId,
      relatedEntityType: 'SessionReschedule',
      actions: [
        {
          label: 'Confirm',
          actionType: 'confirm-reschedule',
          actionData: { rescheduleId: rescheduleId },
        },
      ],
    });

    res.json({ message: 'Reschedule accepted', reschedule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * PATCH /member/reschedules/:rescheduleId/decline
 * Decline a reschedule offer
 */
router.patch('/member/reschedules/:rescheduleId/decline', authMiddleware, hasRole('member'), async (req, res) => {
  try {
    const memberId = req.user._id;
    const { rescheduleId } = req.params;
    const { declineReason } = req.body;

    const reschedule = await SessionReschedule.findById(rescheduleId);

    if (!reschedule || reschedule.memberId.toString() !== memberId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (reschedule.status !== 'pending') {
      return res.status(400).json({ message: 'Reschedule is not pending' });
    }

    reschedule.status = 'declined';
    reschedule.declineReason = declineReason || 'No reason provided';
    await reschedule.save();

    // Revert original session status
    const originalSession = await Session.findById(reschedule.originalSessionId);
    originalSession.status = 'scheduled';
    originalSession.rescheduleId = null;
    await originalSession.save();

    // Notify trainer
    await Notification.create({
      recipientId: reschedule.trainerId,
      senderId: memberId,
      type: 'session-rescheduled',
      title: 'Reschedule Declined',
      message: `Member declined rescheduling. Reason: ${declineReason || 'No reason provided'}. Original session remains on ${reschedule.originalDate}.`,
      relatedEntityId: rescheduleId,
      relatedEntityType: 'SessionReschedule',
    });

    res.json({ message: 'Reschedule declined', reschedule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================== ADMIN ROUTES ==============================

/**
 * PATCH /admin/members/:memberId/premium
 * Mark member as premium or update premium status
 */
router.patch('/admin/members/:memberId/premium', authMiddleware, hasRole('admin'), async (req, res) => {
  try {
    const { memberId } = req.params;
    const { isPremium, reason } = req.body;

    const member = await User.findById(memberId);

    if (!member || member.role !== 'member') {
      return res.status(404).json({ message: 'Member not found' });
    }

    const oldStatus = member.memberType;
    member.memberType = isPremium ? 'premium' : 'normal';
    await member.save();

    // Notify member
    await Notification.create({
      recipientId: memberId,
      senderId: req.user._id,
      type: 'membership-assigned',
      title: `Membership Updated to ${member.memberType.toUpperCase()}`,
      message: `Your membership status has been updated to ${member.memberType}. ${reason || ''}`,
      data: { memberType: member.memberType, reason },
    });

    res.json({
      message: `Member updated from ${oldStatus} to ${member.memberType}`,
      member: {
        id: member._id,
        name: member.name,
        email: member.email,
        memberType: member.memberType,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================== TEST ENDPOINTS ==============================

/**
 * POST /test/create-premium-member
 * TEST ENDPOINT - Create a premium member with trainer assignment for testing
 * Body: { email, name, trainerEmail }
 */
router.post('/test/create-premium-member', async (req, res) => {
  try {
    const { email, name, trainerEmail } = req.body;

    if (!email || !name) {
      return res.status(400).json({ message: 'Email and name are required' });
    }

    // Check if member exists
    let member = await User.findOne({ email: email.toLowerCase() });
    
    if (!member) {
      // Create new member
      member = new User({
        email: email.toLowerCase(),
        name,
        role: 'member',
        memberType: 'premium',
        googleId: `test-${Date.now()}`,
      });
      await member.save();
    } else {
      // Update existing member to premium
      member.memberType = 'premium';
      await member.save();
    }

    // Assign trainer if provided
    if (trainerEmail) {
      const trainer = await User.findOne({ email: trainerEmail.toLowerCase(), role: 'trainer' });
      
      if (trainer) {
        // Create or update assignment
        const MemberAssignment = require('../models/MemberAssignment');
        let assignment = await MemberAssignment.findOne({ memberId: member._id });
        
        if (!assignment) {
          assignment = new MemberAssignment({
            memberId: member._id,
            trainerId: trainer._id,
            allocatedPTHours: 10, // Default 10 hours for testing
            usedPTHours: 0,
            status: 'active',
            notes: 'Test assignment',
          });
        } else {
          assignment.trainerId = trainer._id;
          assignment.allocatedPTHours = 10;
          assignment.usedPTHours = 0;
          assignment.status = 'active';
        }
        
        await assignment.save();

        return res.json({
          message: 'Premium test member created with trainer assignment',
          member: {
            _id: member._id,
            email: member.email,
            name: member.name,
            memberType: member.memberType,
          },
          assignment: {
            trainerId: trainer._id,
            trainerName: trainer.name,
            allocatedPTHours: assignment.allocatedPTHours,
          },
        });
      }
    }

    res.json({
      message: 'Premium test member created (no trainer assigned)',
      member: {
        _id: member._id,
        email: member.email,
        name: member.name,
        memberType: member.memberType,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
