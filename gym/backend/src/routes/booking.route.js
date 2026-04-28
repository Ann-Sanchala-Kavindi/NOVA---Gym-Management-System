const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const BookingSlot = require('../models/BookingSlot');
const BookingRecord = require('../models/BookingRecord');
const TrainerSchedule = require('../models/TrainerSchedule');
const Session = require('../models/Session');
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

async function requireTrainerRole(req, res, next) {
  const user = await User.findById(req.userId);
  if (!user || (user.role || 'member') !== 'trainer') {
    return res.status(403).json({ message: 'Trainer access required.' });
  }
  req.user = user;
  next();
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

function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
  const [h, m] = timeStr.split(':').map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function hasOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function areConsecutiveSlots(sortedSlots) {
  if (!Array.isArray(sortedSlots) || sortedSlots.length <= 1) return true;
  for (let i = 1; i < sortedSlots.length; i += 1) {
    if (sortedSlots[i - 1].endTime !== sortedSlots[i].startTime) {
      return false;
    }
  }
  return true;
}

function buildUnavailableWindows(sessions, bookings) {
  return [
    ...sessions.map((session) => ({
      startTime: session.startTime,
      endTime: session.endTime,
      reason: 'trainer_session',
      label: 'Trainer scheduled session',
      start: timeToMinutes(session.startTime),
      end: timeToMinutes(session.endTime),
    })),
    ...bookings.map((booking) => ({
      startTime: booking.startTime,
      endTime: booking.endTime,
      reason: 'member_booking',
      label: 'Member booking',
      start: timeToMinutes(booking.startTime),
      end: timeToMinutes(booking.endTime),
    })),
  ]
    .filter((window) => window.start !== null && window.end !== null)
    .sort((a, b) => a.start - b.start)
    .map(({ start, end, ...rest }) => rest);
}

// Helper: generate slots for a trainer on a date, avoiding overlaps with sessions and existing slots
async function generateSlotsForTrainerDate(trainerId, date, durationMinutes, maxSlots, options = {}) {
  const parsedDuration = Number(durationMinutes);
  if (!Number.isInteger(parsedDuration) || parsedDuration <= 0) {
    return { created: 0, slots: [], reason: 'Invalid duration' };
  }

  const parsedMaxSlots = Number(maxSlots);
  const hasMaxSlots = Number.isInteger(parsedMaxSlots) && parsedMaxSlots > 0;

  const normalizedDate = normalizeDate(date);
  if (!normalizedDate) {
    return { created: 0, slots: [], reason: 'Invalid date' };
  }

  const schedule = await TrainerSchedule.findOne({ trainerId });
  if (!schedule) {
    return { created: 0, slots: [], reason: 'No trainer schedule' };
  }

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = DAY_NAMES[new Date(`${normalizedDate}T00:00:00`).getDay()];
  const day = (schedule.days || []).find((d) => d.day === dayName);

  if (!day || !day.isAvailable) {
    return { created: 0, slots: [], reason: `Trainer not available on ${dayName}` };
  }

  const scheduledDayStart = timeToMinutes(day.ptStartTime || day.startTime);
  const scheduledDayEnd = timeToMinutes(day.ptEndTime || day.endTime);

  if (scheduledDayStart === null || scheduledDayEnd === null || scheduledDayEnd <= scheduledDayStart) {
    return { created: 0, slots: [], reason: 'Invalid trainer schedule times' };
  }

  const requestedStart = options.windowStartTime ? timeToMinutes(options.windowStartTime) : null;
  const requestedEnd = options.windowEndTime ? timeToMinutes(options.windowEndTime) : null;

  if ((options.windowStartTime && requestedStart === null) || (options.windowEndTime && requestedEnd === null)) {
    return { created: 0, slots: [], reason: 'Invalid custom start/end time. Use HH:mm format.' };
  }

  let dayStart = scheduledDayStart;
  let dayEnd = scheduledDayEnd;

  if (requestedStart !== null) {
    dayStart = Math.max(dayStart, requestedStart);
  }
  if (requestedEnd !== null) {
    dayEnd = Math.min(dayEnd, requestedEnd);
  }

  if (dayStart === null || dayEnd === null || dayEnd <= dayStart) {
    return { created: 0, slots: [], reason: 'Requested range is outside trainer availability.' };
  }

  // Sessions (group or 1v1) block slot creation
  const sessions = await Session.find({
    trainerId,
    date: normalizedDate,
    status: { $nin: ['cancelled'] },
  }).select('startTime endTime');

  // Existing slots block duplicates and overlaps
  const existingSlots = await BookingSlot.find({ trainerId, date: normalizedDate });

  const busyWindows = [
    ...sessions.map((s) => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) })),
    ...existingSlots.map((s) => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) })),
  ].filter((w) => w.start !== null && w.end !== null);

  const toCreate = [];
  for (let start = dayStart; start + parsedDuration <= dayEnd; start += parsedDuration) {
    const end = start + parsedDuration;
    const overlaps = busyWindows.some((w) => hasOverlap(start, end, w.start, w.end));
    if (overlaps) continue;

    const startTimeStr = minutesToTime(start);
    const endTimeStr = minutesToTime(end);

    // Avoid exact duplicates
    const exists = existingSlots.some((s) => s.startTime === startTimeStr && s.endTime === endTimeStr);
    if (exists) continue;

    toCreate.push({ startTime: startTimeStr, endTime: endTimeStr, slotDurationMinutes: parsedDuration });

    if (hasMaxSlots && toCreate.length >= parsedMaxSlots) {
      break;
    }
  }

  if (toCreate.length === 0) {
    return { created: 0, slots: [], reason: 'No gaps available' };
  }

  const createdSlots = await BookingSlot.insertMany(
    toCreate.map((slot) => ({
      trainerId,
      date: normalizedDate,
      ...slot,
    }))
  );

  return { created: createdSlots.length, slots: createdSlots, reason: null };
}

// ============== TRAINER ROUTES ==============

// GET available slots for a trainer on a specific date
router.get('/trainer/slots/:date', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const date = normalizeDate(req.params.date);
    if (!date) {
      return res.status(400).json({ message: 'Valid date is required (YYYY-MM-DD).' });
    }

    const slots = await BookingSlot.find({
      trainerId: req.userId,
      date,
    }).sort({ startTime: 1 });

    const [trainerSessions, memberBookings] = await Promise.all([
      Session.find({
        trainerId: req.userId,
        date,
        status: { $nin: ['cancelled'] },
      }).select('startTime endTime'),
      BookingRecord.find({
        trainerId: req.userId,
        date,
        status: { $in: ['pending', 'confirmed'] },
      }).select('startTime endTime'),
    ]);

    const unavailableWindows = buildUnavailableWindows(trainerSessions, memberBookings);

    const busyWindows = unavailableWindows.map((window) => ({
      start: timeToMinutes(window.startTime),
      end: timeToMinutes(window.endTime),
      source: window.reason === 'trainer_session' ? 'session' : 'booking',
    }));

    const resolvedSlots = slots.map((slot) => {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      const overlap =
        slotStart !== null &&
        slotEnd !== null &&
        busyWindows.find((window) => hasOverlap(slotStart, slotEnd, window.start, window.end));

      const occupied = Boolean(slot.isBooked || slot.status === 'booked' || overlap);
      const blockedBy = overlap?.source || (slot.isBooked || slot.status === 'booked' ? 'booking' : null);

      return {
        ...slot.toObject(),
        isBooked: occupied,
        status: occupied ? 'booked' : slot.status,
        blockedBy,
        availabilityStatus: occupied ? 'occupied' : 'available',
      };
    });

    const summaryData = {
      totalSlots: resolvedSlots.length,
      bookedSlots: resolvedSlots.filter((s) => s.isBooked).length,
      availableSlots: resolvedSlots.filter((s) => !s.isBooked).length,
      completedSlots: resolvedSlots.filter((s) => s.status === 'completed').length,
      cancelledSlots: resolvedSlots.filter((s) => s.status === 'cancelled').length,
    };

    return res.json({
      message: 'Slots retrieved successfully.',
      date,
      summary: summaryData,
      unavailableWindows,
      slots: resolvedSlots,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch slots.', error: error.message });
  }
});

// POST create new booking slots (trainer)
router.post('/trainer/slots', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { date, slots } = req.body;

    if (!date || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ message: 'Date and slots array are required.' });
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({ message: 'Valid date is required.' });
    }

    const trainerSchedule = await TrainerSchedule.findOne({ trainerId: req.userId });
    if (!trainerSchedule) {
      return res.status(400).json({ message: 'Trainer schedule is required before creating slots.' });
    }

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = DAY_NAMES[new Date(`${normalizedDate}T00:00:00`).getDay()];
    const daySchedule = (trainerSchedule.days || []).find((d) => d.day === dayName && d.isAvailable);

    if (!daySchedule) {
      return res.status(400).json({ message: `Trainer is not available on ${dayName}.` });
    }

    const scheduleStart = timeToMinutes(daySchedule.ptStartTime || daySchedule.startTime);
    const scheduleEnd = timeToMinutes(daySchedule.ptEndTime || daySchedule.endTime);
    if (scheduleStart === null || scheduleEnd === null || scheduleEnd <= scheduleStart) {
      return res.status(400).json({ message: 'Trainer availability times are invalid for this day.' });
    }

    const [existingSlots, trainerSessions, memberBookings] = await Promise.all([
      BookingSlot.find({ trainerId: req.userId, date: normalizedDate }),
      Session.find({
        trainerId: req.userId,
        date: normalizedDate,
        status: { $nin: ['cancelled'] },
      }).select('startTime endTime'),
      BookingRecord.find({
        trainerId: req.userId,
        date: normalizedDate,
        status: { $in: ['pending', 'confirmed'] },
      }).select('startTime endTime'),
    ]);

    const blockingWindows = [
      ...buildUnavailableWindows(trainerSessions, memberBookings).map((window) => ({
        start: timeToMinutes(window.startTime),
        end: timeToMinutes(window.endTime),
      })),
      ...existingSlots.map((slot) => ({
        start: timeToMinutes(slot.startTime),
        end: timeToMinutes(slot.endTime),
      })),
    ].filter((window) => window.start !== null && window.end !== null);

    const normalizedSlots = [];
    for (const slot of slots) {
      const start = timeToMinutes(slot.startTime);
      const end = timeToMinutes(slot.endTime);

      if (start === null || end === null || end <= start) {
        return res.status(400).json({ message: 'Each slot must have valid start/end times in HH:mm format.' });
      }

      if (start < scheduleStart || end > scheduleEnd) {
        return res.status(400).json({ message: 'Slots must be within trainer available time range.' });
      }

      const overlapsBlocked = blockingWindows.some((window) => hasOverlap(start, end, window.start, window.end));
      if (overlapsBlocked) {
        return res.status(400).json({ message: `${slot.startTime}-${slot.endTime} overlaps with an unavailable window or existing slot.` });
      }

      const overlapsNew = normalizedSlots.some((candidate) => hasOverlap(start, end, candidate.start, candidate.end));
      if (overlapsNew) {
        return res.status(400).json({ message: 'Submitted slots cannot overlap with each other.' });
      }

      normalizedSlots.push({
        start,
        end,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotDurationMinutes: Number(slot.slotDurationMinutes) > 0
          ? Number(slot.slotDurationMinutes)
          : end - start,
        notes: slot.notes,
      });
    }

    const createdSlots = await Promise.all(
      normalizedSlots.map((slot) =>
        BookingSlot.create({
          trainerId: req.userId,
          date: normalizedDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotDurationMinutes: slot.slotDurationMinutes || 60,
          notes: slot.notes,
        })
      )
    );

    return res.status(201).json({
      message: 'Slots created successfully.',
      slots: createdSlots,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create slots.', error: error.message });
  }
});

// POST auto-generate booking slots for a day (trainer)
router.post('/trainer/slots/generate', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const {
      date,
      durationMinutes = 60,
      maxSlots,
      replaceExisting = false,
      windowStartTime,
      windowEndTime,
    } = req.body;

    if (!date) {
      return res.status(400).json({ message: 'Date is required.' });
    }

    if (
      maxSlots !== undefined &&
      (!Number.isInteger(Number(maxSlots)) || Number(maxSlots) <= 0)
    ) {
      return res.status(400).json({ message: 'maxSlots must be a positive integer.' });
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({ message: 'Valid date is required.' });
    }

    if ((windowStartTime && timeToMinutes(windowStartTime) === null) || (windowEndTime && timeToMinutes(windowEndTime) === null)) {
      return res.status(400).json({ message: 'windowStartTime and windowEndTime must use HH:mm format.' });
    }

    const requestedStart = windowStartTime ? timeToMinutes(windowStartTime) : null;
    const requestedEnd = windowEndTime ? timeToMinutes(windowEndTime) : null;
    if (requestedStart !== null && requestedEnd !== null && requestedEnd <= requestedStart) {
      return res.status(400).json({ message: 'windowEndTime must be greater than windowStartTime.' });
    }

    if (Boolean(replaceExisting)) {
      const replaceQuery = {
        trainerId: req.userId,
        date: normalizedDate,
        isBooked: false,
        status: 'available',
      };

      if (windowStartTime) {
        replaceQuery.endTime = { $gt: windowStartTime };
      }
      if (windowEndTime) {
        replaceQuery.startTime = {
          ...(replaceQuery.startTime || {}),
          $lt: windowEndTime,
        };
      }

      await BookingSlot.deleteMany(replaceQuery);
    }

    const result = await generateSlotsForTrainerDate(req.userId, date, durationMinutes, maxSlots, {
      windowStartTime,
      windowEndTime,
    });

    if (result.created === 0) {
      return res.status(200).json({ message: result.reason || 'No slots generated.', created: 0, slots: [] });
    }

    return res.status(201).json({
      message: `Generated ${result.created} slots of ${durationMinutes} minutes for ${normalizeDate(date)}.`,
      created: result.created,
      slots: result.slots,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate slots.', error: error.message });
  }
});

// PATCH update slot (trainer)
router.patch('/trainer/slots/:slotId', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { status, notes, startTime, endTime, slotDurationMinutes } = req.body;

    const slot = await BookingSlot.findById(req.params.slotId);
    if (!slot || String(slot.trainerId) !== String(req.userId)) {
      return res.status(404).json({ message: 'Slot not found or unauthorized.' });
    }

    const changingWindow = startTime !== undefined || endTime !== undefined || slotDurationMinutes !== undefined;

    if (changingWindow && (slot.isBooked || slot.status === 'booked' || slot.status === 'completed')) {
      return res.status(400).json({ message: 'Booked or completed slots cannot change time.' });
    }

    if (changingWindow) {
      const nextStartTime = startTime || slot.startTime;
      const nextEndTime = endTime || slot.endTime;
      const nextStart = timeToMinutes(nextStartTime);
      const nextEnd = timeToMinutes(nextEndTime);

      if (nextStart === null || nextEnd === null || nextEnd <= nextStart) {
        return res.status(400).json({ message: 'Valid startTime and endTime are required.' });
      }

      const [trainerSchedule, sameDaySlots, trainerSessions, memberBookings] = await Promise.all([
        TrainerSchedule.findOne({ trainerId: req.userId }),
        BookingSlot.find({
          trainerId: req.userId,
          date: slot.date,
          _id: { $ne: slot._id },
        }),
        Session.find({
          trainerId: req.userId,
          date: slot.date,
          status: { $nin: ['cancelled'] },
        }).select('startTime endTime'),
        BookingRecord.find({
          trainerId: req.userId,
          date: slot.date,
          status: { $in: ['pending', 'confirmed'] },
        }).select('startTime endTime'),
      ]);

      if (!trainerSchedule) {
        return res.status(400).json({ message: 'Trainer schedule is required before updating slot times.' });
      }

      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = DAY_NAMES[new Date(`${slot.date}T00:00:00`).getDay()];
      const daySchedule = (trainerSchedule.days || []).find((d) => d.day === dayName && d.isAvailable);
      if (!daySchedule) {
        return res.status(400).json({ message: `Trainer is not available on ${dayName}.` });
      }

      const scheduleStart = timeToMinutes(daySchedule.ptStartTime || daySchedule.startTime);
      const scheduleEnd = timeToMinutes(daySchedule.ptEndTime || daySchedule.endTime);
      if (scheduleStart === null || scheduleEnd === null || nextStart < scheduleStart || nextEnd > scheduleEnd) {
        return res.status(400).json({ message: 'Updated slot must remain within trainer available time range.' });
      }

      const blockingWindows = [
        ...sameDaySlots.map((item) => ({
          start: timeToMinutes(item.startTime),
          end: timeToMinutes(item.endTime),
        })),
        ...buildUnavailableWindows(trainerSessions, memberBookings).map((window) => ({
          start: timeToMinutes(window.startTime),
          end: timeToMinutes(window.endTime),
        })),
      ].filter((window) => window.start !== null && window.end !== null);

      const overlaps = blockingWindows.some((window) => hasOverlap(nextStart, nextEnd, window.start, window.end));
      if (overlaps) {
        return res.status(400).json({ message: 'Updated slot overlaps with unavailable time or another slot.' });
      }

      slot.startTime = nextStartTime;
      slot.endTime = nextEndTime;
      slot.slotDurationMinutes = Number(slotDurationMinutes) > 0 ? Number(slotDurationMinutes) : nextEnd - nextStart;
    }

    if (status) slot.status = status;
    if (notes !== undefined) slot.notes = notes;
    slot.updatedAt = new Date();

    await slot.save();

    return res.json({
      message: 'Slot updated successfully.',
      slot,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update slot.', error: error.message });
  }
});

// DELETE slot (trainer)
router.delete('/trainer/slots/:slotId', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const slot = await BookingSlot.findById(req.params.slotId);
    if (!slot || String(slot.trainerId) !== String(req.userId)) {
      return res.status(404).json({ message: 'Slot not found or unauthorized.' });
    }

    if (slot.isBooked) {
      return res.status(400).json({ message: 'Cannot delete booked slots.' });
    }

    await BookingSlot.findByIdAndDelete(req.params.slotId);

    return res.json({ message: 'Slot deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete slot.', error: error.message });
  }
});

// GET all bookings for a trainer
router.get('/trainer/bookings', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const startDate = req.query.startDate ? normalizeDate(req.query.startDate) : null;
    const endDate = req.query.endDate ? normalizeDate(req.query.endDate) : null;
    const status = req.query.status;

    // Query BookingRecord (old system) - slot-based bookings
    const bookingQuery = { trainerId: req.userId };
    if (startDate && endDate) {
      bookingQuery.date = { $gte: startDate, $lte: endDate };
    }
    if (status) {
      bookingQuery.status = status;
    }

    const bookingRecords = await BookingRecord.find(bookingQuery)
      .populate('memberId', '_id name email')
      .populate('slotId', 'date startTime endTime')
      .populate('slotIds', 'date startTime endTime')
      .sort({ date: -1, startTime: -1 });

    const allBookings = bookingRecords.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA !== dateB) return dateB - dateA;
      return b.startTime.localeCompare(a.startTime);
    });

    return res.json({
      message: 'Bookings retrieved successfully.',
      bookings: allBookings,
      count: allBookings.length,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch bookings.', error: error.message });
  }
});

// PATCH manage booking (trainer - update status or cancel) - handles both BookingRecord and Session
router.patch('/trainer/bookings/:bookingId', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { status, cancellationReason, newDate, newStartTime, newEndTime } = req.body;
    const Session = require('../models/Session');

    // Try BookingRecord first (old system)
    let booking = await BookingRecord.findById(req.params.bookingId);
    let isSessionModel = false;

    // If not found, try Session model (new 1v1 system)
    if (!booking) {
      booking = await Session.findById(req.params.bookingId);
      isSessionModel = true;
    }

    if (!booking || String(booking.trainerId) !== String(req.userId)) {
      return res.status(404).json({ message: 'Booking not found or unauthorized.' });
    }

    // Handle status update
    if (status) {
      // Map status names between systems for consistency
      let finalStatus = status;
      if (isSessionModel && status === 'confirmed') {
        finalStatus = 'scheduled'; // Session model uses 'scheduled'
      } else if (!isSessionModel && status === 'scheduled') {
        finalStatus = 'confirmed'; // BookingRecord uses 'confirmed'
      }

      booking.status = finalStatus;

      if (finalStatus === 'cancelled' || status === 'cancelled') {
        booking.cancelledBy = 'trainer';
        booking.cancelledAt = new Date();
        booking.cancellationReason = cancellationReason;

        // For BookingRecord, mark slot as available again
        if (!isSessionModel) {
          const bookingSlotIds = Array.isArray(booking.slotIds) && booking.slotIds.length > 0
            ? booking.slotIds
            : (booking.slotId ? [booking.slotId] : []);
          if (bookingSlotIds.length > 0) {
            await BookingSlot.updateMany(
              { _id: { $in: bookingSlotIds } },
              {
                isBooked: false,
                bookedBy: null,
                status: 'available',
              }
            );
          }
        }
      }
    }

    // Handle rescheduling for new date/time
    if (newDate && newStartTime && newEndTime) {
      booking.status = isSessionModel ? 'rescheduled' : 'confirmed';
      
      if (isSessionModel) {
        // For Session model, create a reschedule record
        const SessionReschedule = require('../models/SessionReschedule');
        const reschedule = new SessionReschedule({
          originalSessionId: booking._id,
          newDate: normalizeDate(newDate),
          newStartTime,
          newEndTime,
          requestedBy: 'trainer',
          status: 'approved',
        });
        await reschedule.save();
        booking.rescheduleId = reschedule._id;
      }
      booking.date = normalizeDate(newDate);
      booking.startTime = newStartTime;
      booking.endTime = newEndTime;
    }

    booking.updatedAt = new Date();
    await booking.save();

    return res.json({
      message: 'Booking updated successfully.',
      booking,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update booking.', error: error.message });
  }
});

// POST approve a pending booking (trainer)
router.post('/trainer/bookings/:bookingId/approve', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const Session = require('../models/Session');
    let booking = await BookingRecord.findById(req.params.bookingId);
    let isSessionModel = false;

    if (!booking) {
      booking = await Session.findById(req.params.bookingId);
      isSessionModel = true;
    }

    if (!booking || String(booking.trainerId) !== String(req.userId)) {
      return res.status(404).json({ message: 'Booking not found or unauthorized.' });
    }

    // For 1v1 sessions, change from pending -> scheduled.
    // For BookingRecord bookings, change from pending -> confirmed.
    if (isSessionModel && booking.status === 'pending') {
      booking.status = 'scheduled';
      booking.updatedAt = new Date();
      await booking.save();

      return res.json({
        message: 'Booking approved successfully.',
        booking,
      });
    } else if (!isSessionModel && booking.status === 'pending') {
      booking.status = 'confirmed';
      booking.updatedAt = new Date();
      await booking.save();

      return res.json({
        message: 'Booking approved successfully.',
        booking,
      });
    } else if (!isSessionModel && booking.status === 'confirmed') {
      return res.json({
        message: 'Booking is already confirmed.',
        booking,
      });
    } else {
      return res.status(400).json({ message: 'Cannot approve this booking. Invalid status.' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Failed to approve booking.', error: error.message });
  }
});

// POST reschedule a booking (trainer)
router.post('/trainer/bookings/:bookingId/reschedule', requireAuth, requireTrainerRole, async (req, res) => {
  try {
    const { newDate, newStartTime, newEndTime, reason } = req.body;
    const Session = require('../models/Session');

    if (!newDate || !newStartTime || !newEndTime) {
      return res.status(400).json({ message: 'newDate, newStartTime, and newEndTime are required.' });
    }

    const normalizedDate = normalizeDate(newDate);
    if (!normalizedDate) {
      return res.status(400).json({ message: 'Invalid date format.' });
    }

    let booking = await BookingRecord.findById(req.params.bookingId);
    let isSessionModel = false;

    if (!booking) {
      booking = await Session.findById(req.params.bookingId);
      isSessionModel = true;
    }

    if (!booking || String(booking.trainerId) !== String(req.userId)) {
      return res.status(404).json({ message: 'Booking not found or unauthorized.' });
    }

    // Update booking with new date/time
    booking.date = normalizedDate;
    booking.startTime = newStartTime;
    booking.endTime = newEndTime;

    if (isSessionModel) {
      booking.status = 'scheduled'; // Always move to scheduled when rescheduled
      booking.notes = reason || booking.notes;
    }

    booking.updatedAt = new Date();
    await booking.save();

    return res.json({
      message: 'Booking rescheduled successfully.',
      booking,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reschedule booking.', error: error.message });
  }
});

// ============== MEMBER ROUTES ==============

// GET available slots for a trainer on a specific date
router.get('/booking/slots/:trainerId/:date', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const { trainerId } = req.params;
    const date = normalizeDate(req.params.date);
    const durationMinutes = Number(req.query.durationMinutes) || 60;
    const autoGenerate = req.query.autoGenerate !== 'false';

    if (!date) {
      return res.status(400).json({ message: 'Valid date is required (YYYY-MM-DD).' });
    }

    const trainer = await User.findById(trainerId);
    if (!trainer || (trainer.role || 'member') !== 'trainer') {
      return res.status(404).json({ message: 'Trainer not found.' });
    }

    let slots = await BookingSlot.find({
      trainerId,
      date,
      status: 'available',
      isBooked: false,
    }).sort({ startTime: 1 });

    const sessions = await Session.find({
      trainerId,
      date,
      status: { $nin: ['cancelled'] },
    }).select('startTime endTime');

    const sessionWindows = sessions
      .map((session) => ({ start: timeToMinutes(session.startTime), end: timeToMinutes(session.endTime) }))
      .filter((window) => window.start !== null && window.end !== null);

    slots = slots.filter((slot) => {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      if (slotStart === null || slotEnd === null) return false;
      return !sessionWindows.some((window) => hasOverlap(slotStart, slotEnd, window.start, window.end));
    });

    // Auto-generate slots if none exist and allowed
    if (slots.length === 0 && autoGenerate) {
      const genResult = await generateSlotsForTrainerDate(trainerId, date, durationMinutes);
      if (genResult.created > 0) {
        slots = await BookingSlot.find({
          trainerId,
          date,
          status: 'available',
          isBooked: false,
        }).sort({ startTime: 1 });

        slots = slots.filter((slot) => {
          const slotStart = timeToMinutes(slot.startTime);
          const slotEnd = timeToMinutes(slot.endTime);
          if (slotStart === null || slotEnd === null) return false;
          return !sessionWindows.some((window) => hasOverlap(slotStart, slotEnd, window.start, window.end));
        });
      }
    }

    return res.json({
      message: 'Available slots retrieved successfully.',
      trainer: {
        id: trainer._id,
        name: trainer.name,
        email: trainer.email,
        specialization: trainer.specialization,
      },
      date,
      durationMinutes,
      slots,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch slots.', error: error.message });
  }
});

// POST book a slot (member)
router.post('/booking/book-slot', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const { slotId, slotIds, sessionName } = req.body;
    const requestedSlotIds = Array.isArray(slotIds)
      ? slotIds
      : (slotId ? [slotId] : []);

    const normalizedRequestedSlotIds = [...new Set(
      requestedSlotIds
        .filter(Boolean)
        .map((id) => String(id))
    )];

    if (normalizedRequestedSlotIds.length === 0) {
      return res.status(400).json({ message: 'At least one slot ID is required.' });
    }

    const slots = await BookingSlot.find({ _id: { $in: normalizedRequestedSlotIds } });

    if (slots.length !== normalizedRequestedSlotIds.length) {
      return res.status(400).json({ message: 'One or more selected slots were not found.' });
    }

    const firstSlot = slots[0];
    const sameTrainer = slots.every((s) => String(s.trainerId) === String(firstSlot.trainerId));
    const sameDate = slots.every((s) => String(s.date) === String(firstSlot.date));
    const allAvailable = slots.every((s) => !s.isBooked && s.status === 'available');

    if (!sameTrainer || !sameDate) {
      return res.status(400).json({ message: 'Selected slots must belong to the same trainer and date.' });
    }

    if (!allAvailable) {
      return res.status(400).json({ message: 'One or more selected slots are no longer available.' });
    }

    const sortedSlots = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!areConsecutiveSlots(sortedSlots)) {
      return res.status(400).json({ message: 'Please select consecutive time slots only.' });
    }

    // Create booking record
    const booking = await BookingRecord.create({
      slotId: sortedSlots[0]._id,
      slotIds: sortedSlots.map((s) => s._id),
      trainerId: sortedSlots[0].trainerId,
      memberId: req.userId,
      date: sortedSlots[0].date,
      startTime: sortedSlots[0].startTime,
      endTime: sortedSlots[sortedSlots.length - 1].endTime,
      sessionName: sessionName || 'Personal Training Session',
      status: 'pending',
    });

    await BookingSlot.updateMany(
      { _id: { $in: sortedSlots.map((s) => s._id) } },
      {
        isBooked: true,
        bookedBy: req.userId,
        status: 'booked',
      }
    );

    const populatedBooking = await BookingRecord.findById(booking._id)
      .populate('trainerId', '_id name email specialization')
      .populate('memberId', '_id name email')
      .populate('slotIds', 'date startTime endTime');

    return res.status(201).json({
      message: normalizedRequestedSlotIds.length > 1 ? 'Booking request submitted successfully.' : 'Booking request submitted successfully.',
      booking: populatedBooking,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to book slot.', error: error.message });
  }
});

// GET member's bookings
router.get('/booking/my-bookings', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const status = req.query.status;

    const query = { memberId: req.userId };
    if (status) {
      query.status = status;
    }

    const bookings = await BookingRecord.find(query)
      .populate('trainerId', '_id name email specialization')
      .populate('slotId', 'date startTime endTime')
      .populate('slotIds', 'date startTime endTime')
      .sort({ date: -1, startTime: -1 });

    return res.json({
      message: 'Member bookings retrieved successfully.',
      bookings,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch bookings.', error: error.message });
  }
});

// PATCH cancel booking (member)
router.patch('/booking/cancel/:bookingId', requireAuth, requireMemberRole, async (req, res) => {
  try {
    const { cancellationReason } = req.body;

    const booking = await BookingRecord.findById(req.params.bookingId);
    if (!booking || String(booking.memberId) !== String(req.userId)) {
      return res.status(404).json({ message: 'Booking not found or unauthorized.' });
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ message: 'Can only cancel pending or confirmed bookings.' });
    }

    booking.status = 'cancelled';
    booking.cancelledBy = 'member';
    booking.cancelledAt = new Date();
    booking.cancellationReason = cancellationReason;
    booking.updatedAt = new Date();
    await booking.save();

    // Mark slot as available again
    const bookingSlotIds = Array.isArray(booking.slotIds) && booking.slotIds.length > 0
      ? booking.slotIds
      : (booking.slotId ? [booking.slotId] : []);

    if (bookingSlotIds.length > 0) {
      await BookingSlot.updateMany(
        { _id: { $in: bookingSlotIds } },
        {
          isBooked: false,
          bookedBy: null,
          status: 'available',
        }
      );
    }

    return res.json({
      message: 'Booking cancelled successfully.',
      booking,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to cancel booking.', error: error.message });
  }
});

module.exports = router;
