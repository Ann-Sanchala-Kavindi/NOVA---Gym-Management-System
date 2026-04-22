const mongoose = require("mongoose");
const Session = require("../models/EquipmentSession");
const Equipment = require("../models/Equipment");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const startSession = async (req, res) => {
  try {
    const { equipmentId } = req.body;

    if (!equipmentId || !isValidObjectId(equipmentId)) {
      return res.status(400).json({ message: "Valid equipmentId is required." });
    }

    const equipment = await Equipment.findById(equipmentId);

    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found." });
    }

    const session = await Session.create({
      equipmentId,
      userId: req.user?._id || null,
      userLabel: req.user?.email || "guest",
      startedAt: new Date(),
      status: "active",
    });

    await Equipment.findByIdAndUpdate(equipmentId, {
      availability: "In Use",
    });

    res.status(201).json({
      message: "Session started successfully.",
      data: session,
    });
  } catch (error) {
    console.log("Start session error:", error);
    res.status(500).json({ message: error.message });
  }
};

const endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reps = null, sets = null, weightKg = null, notes = "" } = req.body;

    if (!isValidObjectId(sessionId)) {
      return res.status(400).json({ message: "Invalid session ID." });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    if (session.status === "completed") {
      return res.status(400).json({ message: "Session already completed." });
    }

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000)
    );

    session.endedAt = endedAt;
    session.durationSeconds = durationSeconds;
    session.reps = reps ?? null;
    session.sets = sets ?? null;
    session.weightKg = weightKg ?? null;
    session.notes = (notes || "").trim();
    session.status = "completed";

    const updated = await session.save();

    await Equipment.findByIdAndUpdate(session.equipmentId, {
      availability: "Available",
    });

    res.status(200).json({
      message: "Session ended successfully.",
      data: updated,
    });
  } catch (error) {
    console.log("End session error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getEquipmentStats = async (req, res) => {
  try {
    const { equipmentId } = req.params;

    if (!isValidObjectId(equipmentId)) {
      return res.status(400).json({ message: "Invalid equipment ID." });
    }

    const sessions = await Session.find({
      equipmentId,
      status: "completed",
    }).sort({ createdAt: -1 });

    const totalSessions = sessions.length;
    const totalDurationSeconds = sessions.reduce(
      (sum, session) => sum + (session.durationSeconds || 0),
      0
    );

    const averageDurationSeconds =
      totalSessions > 0 ? Math.floor(totalDurationSeconds / totalSessions) : 0;

    const totalSets = sessions.reduce((sum, s) => sum + (s.sets || 0), 0);
    const totalReps = sessions.reduce((sum, s) => sum + (s.reps || 0), 0);
    const maxWeightKg = sessions.reduce(
      (max, s) => Math.max(max, s.weightKg || 0),
      0
    );

    res.status(200).json({
      totalSessions,
      totalDurationSeconds,
      averageDurationSeconds,
      totalSets,
      totalReps,
      maxWeightKg,
      recentSessions: sessions.slice(0, 10),
    });
  } catch (error) {
    console.log("Get equipment stats error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getMyEquipmentStats = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Login required." });
    }

    const sessions = await Session.find({
      userId: req.user._id,
      status: "completed",
    })
      .populate("equipmentId")
      .sort({ createdAt: -1 });

    const totalSessions = sessions.length;
    const totalDurationSeconds = sessions.reduce(
      (sum, session) => sum + (session.durationSeconds || 0),
      0
    );

    const equipmentUsageMap = {};
    const machinesUsedSet = new Set();

    sessions.forEach((session) => {
      if (!session.equipmentId) return;

      const eq = session.equipmentId;
      const id = String(eq._id);
      machinesUsedSet.add(id);

      if (!equipmentUsageMap[id]) {
        equipmentUsageMap[id] = {
          equipmentId: id,
          name: eq.name,
          equipmentType: eq.equipmentType,
          photoUrl: eq.photoUrl || null,
          totalDurationSeconds: 0,
          totalSessions: 0,
          totalReps: 0,
          maxWeightKg: 0,
          recentNotes: [],
        };
      }

      equipmentUsageMap[id].totalDurationSeconds += session.durationSeconds || 0;
      equipmentUsageMap[id].totalSessions += 1;
      equipmentUsageMap[id].totalReps += session.reps || 0;
      equipmentUsageMap[id].maxWeightKg = Math.max(
        equipmentUsageMap[id].maxWeightKg,
        session.weightKg || 0
      );

      if (session.notes) {
        equipmentUsageMap[id].recentNotes.push(session.notes);
      }
    });

    const equipmentUsage = Object.values(equipmentUsageMap).sort(
      (a, b) => b.totalDurationSeconds - a.totalDurationSeconds
    );

    const favouriteEquipment = equipmentUsage[0] || null;

    const recentSessions = sessions.slice(0, 10).map((session) => ({
      _id: session._id,
      createdAt: session.createdAt,
      durationSeconds: session.durationSeconds || 0,
      reps: session.reps || 0,
      sets: session.sets || 0,
      weightKg: session.weightKg || 0,
      notes: session.notes || "",
      equipment: session.equipmentId
        ? {
            _id: session.equipmentId._id,
            name: session.equipmentId.name,
            equipmentType: session.equipmentId.equipmentType,
            photoUrl: session.equipmentId.photoUrl || null,
          }
        : null,
    }));

    res.status(200).json({
      totalSessions,
      totalDurationSeconds,
      machinesUsed: machinesUsedSet.size,
      favouriteEquipment,
      equipmentUsage,
      recentSessions,
    });
  } catch (error) {
    console.log("Get my equipment stats error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const equipmentCount = await Equipment.countDocuments();
    const availableCount = await Equipment.countDocuments({
      availability: "Available",
    });
    const inUseCount = await Equipment.countDocuments({
      availability: "In Use",
    });
    const maintenanceCount = await Equipment.countDocuments({
      availability: "Under Maintenance",
    });
    const totalSessions = await Session.countDocuments({ status: "completed" });

    res.status(200).json({
      equipmentCount,
      availableCount,
      inUseCount,
      maintenanceCount,
      totalSessions,
    });
  } catch (error) {
    console.log("Get dashboard stats error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  startSession,
  endSession,
  getEquipmentStats,
  getMyEquipmentStats,
  getDashboardStats,
};