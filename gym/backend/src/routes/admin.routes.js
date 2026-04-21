const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const LeaveRequest = require("../models/LeaveRequest");
const TrainerSchedule = require("../models/TrainerSchedule");
const Equipment = require("../models/Equipment");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Feedback = require("../models/Feedback");
const WorkoutSession = require("../models/WorkoutSession");
const MembershipUpgradeRequest = require("../models/MembershipUpgradeRequest");
const { summarizeFeedback } = require("../utils/feedback-ai");
const { getJwtSecret } = require("../utils/auth");
const uploadMedia = require("../middleware/upload-media");

const buildUploadedPath = (file) => {
  if (!file) return "";
  return `/uploads/${file.filename}`;
};

const router = express.Router();

function normalizeEmail(email = "") {
  return email.toLowerCase().trim();
}

function validationError(res, message) {
  return res.status(400).json({ message });
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized. Token required." });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.userId = decoded.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

async function requireAdminRole(req, res, next) {
  const user = await User.findById(req.userId);
  if (!user || (user.role || "member") !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

router.get("/trainers", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const trainers = await User.find({ role: "trainer" })
      .select("_id name email specialization experienceLevel bio hourlyRate createdAt")
      .sort({ createdAt: -1 });

    return res.json({
      message: "Trainers retrieved successfully.",
      trainers: trainers.map((t) => ({
        id: t._id,
        name: t.name || "",
        email: t.email,
        specialization: t.specialization || "",
        experienceLevel: t.experienceLevel,
        bio: t.bio || "",
        hourlyRate: t.hourlyRate,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch trainers.", error: error.message });
  }
});

router.get("/members", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const members = await User.find({ role: "member" })
      .select("_id name email memberType assignedTrainerId createdAt")
      .populate("assignedTrainerId", "_id name email")
      .sort({ createdAt: -1 });

    return res.json({
      message: "Members retrieved successfully.",
      members: members.map((m) => ({
        id: m._id,
        name: m.name || "",
        email: m.email,
        memberType: m.memberType || "normal",
        createdAt: m.createdAt,
        assignedTrainerId: m.assignedTrainerId?._id || null,
        assignedTrainerName: m.assignedTrainerId?.name || null,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch members.", error: error.message });
  }
});

router.put("/members/:id/assign-trainer", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const memberId = req.params.id;
    const { trainerId } = req.body;

    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found." });
    }
    if ((member.role || "member") !== "member") {
      return res.status(400).json({ message: "User is not a member." });
    }

    if ((member.memberType || "normal") !== "premium" && trainerId) {
      return res.status(400).json({ message: "Only premium members can be assigned to trainers." });
    }

    if (!trainerId) {
      member.assignedTrainerId = null;
      await member.save();
      return res.json({
        message: "Trainer unassigned successfully.",
        member: {
          id: member._id,
          name: member.name || "",
          email: member.email,
          assignedTrainerId: null,
          assignedTrainerName: null,
        },
      });
    }

    const trainer = await User.findById(trainerId);
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found." });
    }
    if ((trainer.role || "member") !== "trainer") {
      return res.status(400).json({ message: "Selected user is not a trainer." });
    }

    member.assignedTrainerId = trainer._id;
    await member.save();

    return res.json({
      message: "Trainer assigned successfully.",
      member: {
        id: member._id,
        name: member.name || "",
        email: member.email,
        assignedTrainerId: trainer._id,
        assignedTrainerName: trainer.name || "",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to assign trainer.", error: error.message });
  }
});

router.put("/members/assign-trainer-bulk", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    const { trainerId } = req.body;

    if (memberIds.length === 0) {
      return validationError(res, "At least one member is required.");
    }

    let trainer = null;
    if (trainerId) {
      trainer = await User.findById(trainerId);
      if (!trainer) {
        return res.status(404).json({ message: "Trainer not found." });
      }
      if ((trainer.role || "member") !== "trainer") {
        return res.status(400).json({ message: "Selected user is not a trainer." });
      }
    }

    const validMembers = await User.find({
      _id: { $in: memberIds },
      role: "member",
      memberType: "premium",
    }).select("_id");

    if (validMembers.length === 0) {
      return res.status(404).json({ message: "No valid members found." });
    }

    const validMemberIds = validMembers.map((m) => m._id);

    await User.updateMany(
      { _id: { $in: validMemberIds }, role: "member" },
      { $set: { assignedTrainerId: trainer ? trainer._id : null } }
    );

    return res.json({
      message: trainer
        ? `Assigned ${validMembers.length} members to ${trainer.name || "trainer"}.`
        : `Unassigned trainer for ${validMembers.length} members.`,
      updatedCount: validMembers.length,
      assignedTrainerId: trainer ? trainer._id : null,
      assignedTrainerName: trainer ? trainer.name || "" : null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to bulk assign members.", error: error.message });
  }
});

router.patch("/members/:id/member-type", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const { memberType } = req.body;

    if (!memberType || !["normal", "premium"].includes(memberType)) {
      return validationError(res, "Member type must be 'normal' or 'premium'.");
    }

    const member = await User.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found." });
    }

    if ((member.role || "member") !== "member") {
      return res.status(400).json({ message: "User is not a member." });
    }

    member.memberType = memberType;
    await member.save();

    return res.json({
      message: `Member type updated to ${memberType} successfully.`,
      member: {
        id: member._id,
        name: member.name || "",
        email: member.email,
        memberType: member.memberType,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update member type.", error: error.message });
  }
});

// Membership upgrade requests from members

router.get("/membership-upgrade-requests", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const status = String(req.query.status || "").toLowerCase();
    const filter = {};
    if (["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const requests = await MembershipUpgradeRequest.find(filter)
      .populate("memberId", "_id name email memberType")
      .populate("reviewedBy", "_id name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      message: "Membership upgrade requests retrieved successfully.",
      requests: requests.map((r) => ({
        id: r._id,
        memberId: r.memberId?._id || null,
        memberName: r.memberId?.name || "",
        memberEmail: r.memberId?.email || "",
        currentMemberType: r.memberId?.memberType || "normal",
        status: r.status,
        reason: r.reason || "",
        decisionNote: r.decisionNote || "",
        reviewedBy: r.reviewedBy?._id || null,
        reviewedByName: r.reviewedBy?.name || "",
        reviewedAt: r.reviewedAt || null,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch membership upgrade requests.", error: error.message });
  }
});

router.patch("/membership-upgrade-requests/:id/status", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const requestId = req.params.id;
    const status = String(req.body.status || "").toLowerCase();
    const decisionNote = req.body.decisionNote || "";

    if (!["approved", "rejected"].includes(status)) {
      return validationError(res, "Status must be approved or rejected.");
    }

    const request = await MembershipUpgradeRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Membership upgrade request not found." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be updated." });
    }

    request.status = status;
    request.reviewedBy = req.userId;
    request.reviewedAt = new Date();
    request.decisionNote = String(decisionNote).trim();

    if (status === "approved") {
      const member = await User.findById(request.memberId);
      if (member && (member.role || "member") === "member") {
        member.memberType = "premium";
        await member.save();
      }
    }

    await request.save();

    await request.populate("memberId", "_id name email memberType");
    await request.populate("reviewedBy", "_id name email");

    return res.json({
      message: `Membership upgrade request ${status}.`,
      request: {
        id: request._id,
        memberId: request.memberId?._id || null,
        memberName: request.memberId?.name || "",
        memberEmail: request.memberId?.email || "",
        currentMemberType: request.memberId?.memberType || "normal",
        status: request.status,
        reason: request.reason || "",
        decisionNote: request.decisionNote || "",
        reviewedBy: request.reviewedBy?._id || null,
        reviewedByName: request.reviewedBy?.name || "",
        reviewedAt: request.reviewedAt || null,
        createdAt: request.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update membership upgrade request.", error: error.message });
  }
});

router.get("/leave-requests", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const status = String(req.query.status || "").toLowerCase();
    const filter = {};
    if (["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const requests = await LeaveRequest.find(filter)
      .populate("trainerId", "_id name email")
      .populate("reviewedBy", "_id name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      message: "Leave requests retrieved successfully.",
      leaveRequests: requests.map((r) => ({
        id: r._id,
        trainerId: r.trainerId?._id || null,
        trainerName: r.trainerId?.name || "",
        trainerEmail: r.trainerId?.email || "",
        startDate: r.startDate,
        endDate: r.endDate,
        type: r.type,
        reason: r.reason,
        status: r.status,
        decisionNote: r.decisionNote || "",
        reviewedBy: r.reviewedBy?._id || null,
        reviewedAt: r.reviewedAt || null,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch leave requests.", error: error.message });
  }
});

router.patch("/leave-requests/:id/status", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const requestId = req.params.id;
    const status = String(req.body.status || "").toLowerCase();
    const decisionNote = req.body.decisionNote || "";

    if (!["approved", "rejected"].includes(status)) {
      return validationError(res, "Status must be approved or rejected.");
    }

    const leaveRequest = await LeaveRequest.findById(requestId);
    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found." });
    }

    leaveRequest.status = status;
    leaveRequest.reviewedBy = req.userId;
    leaveRequest.reviewedAt = new Date();
    leaveRequest.decisionNote = String(decisionNote).trim();
    leaveRequest.trainerSeenAt = null;
    
    // If approving, deduct days from trainer's leave balance
    if (status === "approved") {
      const trainer = await User.findById(leaveRequest.trainerId);
      if (trainer) {
        // Calculate number of days (inclusive of both start and end date)
        const start = new Date(leaveRequest.startDate);
        const end = new Date(leaveRequest.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        trainer.usedLeaveBalance = (trainer.usedLeaveBalance || 0) + diffDays;
        await trainer.save();
      }
    }
    
    await leaveRequest.save();

    await leaveRequest.populate("trainerId", "_id name email");
    await leaveRequest.populate("reviewedBy", "_id name email");

    return res.json({
      message: `Leave request ${status}.`,
      leaveRequest: {
        id: leaveRequest._id,
        trainerId: leaveRequest.trainerId?._id || null,
        trainerName: leaveRequest.trainerId?.name || "",
        trainerEmail: leaveRequest.trainerId?.email || "",
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        type: leaveRequest.type,
        reason: leaveRequest.reason,
        status: leaveRequest.status,
        decisionNote: leaveRequest.decisionNote || "",
        reviewedBy: leaveRequest.reviewedBy?._id || null,
        reviewedAt: leaveRequest.reviewedAt || null,
        createdAt: leaveRequest.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update leave request.", error: error.message });
  }
});

router.post("/trainers", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = req.body.name || "";
    const password = req.body.password || "";
    const specialization = req.body.specialization || "";
    const experienceLevel = req.body.experienceLevel;
    const bio = req.body.bio || "";
    const hourlyRate = req.body.hourlyRate;
    const normalizedHourlyRate =
      typeof hourlyRate === "number" ? hourlyRate : hourlyRate === null ? null : Number(hourlyRate);

    if (!email || !name.trim()) {
      return validationError(res, "Email and name are required.");
    }
    if (!password) {
      return validationError(res, "Password is required.");
    }
    if (password.length < 6) {
      return validationError(res, "Password must be at least 6 characters.");
    }

    const experienceLevels = ["Beginner", "Intermediate", "Advanced"];
    if (experienceLevel && !experienceLevels.includes(experienceLevel)) {
      return validationError(res, "Invalid experience level.");
    }

    if (Number.isNaN(normalizedHourlyRate) || (normalizedHourlyRate !== null && normalizedHourlyRate < 0)) {
      return validationError(res, "Hourly rate cannot be negative.");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const trainer = await User.create({
      email,
      name: name.trim(),
      passwordHash,
      authProvider: "local",
      role: "trainer",
      specialization: specialization.trim(),
      experienceLevel: experienceLevel || null,
      bio: bio.trim(),
      hourlyRate: normalizedHourlyRate,
      isEmailVerified: true,
    });

    return res.status(201).json({
      message: "Trainer created successfully.",
      trainer: {
        id: trainer._id,
        name: trainer.name,
        email: trainer.email,
        specialization: trainer.specialization,
        experienceLevel: trainer.experienceLevel,
        bio: trainer.bio,
        hourlyRate: trainer.hourlyRate,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create trainer.", error: error.message });
  }
});

router.put("/trainers/:id", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const trainerId = req.params.id;
    const trainer = await User.findById(trainerId);

    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found." });
    }

    if ((trainer.role || "member") !== "trainer") {
      return res.status(400).json({ message: "User is not a trainer." });
    }

    const email = normalizeEmail(req.body.email || trainer.email);
    const name = req.body.name ?? trainer.name;
    const password = req.body.password || "";
    const specialization = req.body.specialization ?? trainer.specialization;
    const experienceLevel = req.body.experienceLevel ?? trainer.experienceLevel;
    const bio = req.body.bio ?? trainer.bio;
    const rawHourlyRate = req.body.hourlyRate;

    let normalizedHourlyRate = trainer.hourlyRate;
    if (rawHourlyRate === null) {
      normalizedHourlyRate = null;
    } else if (rawHourlyRate !== undefined) {
      normalizedHourlyRate = typeof rawHourlyRate === "number" ? rawHourlyRate : Number(rawHourlyRate);
    }

    if (!email || !String(name || "").trim()) {
      return validationError(res, "Email and name are required.");
    }

    const experienceLevels = ["Beginner", "Intermediate", "Advanced"];
    if (experienceLevel && !experienceLevels.includes(experienceLevel)) {
      return validationError(res, "Invalid experience level.");
    }

    if (
      normalizedHourlyRate !== null &&
      (Number.isNaN(normalizedHourlyRate) || normalizedHourlyRate < 0)
    ) {
      return validationError(res, "Hourly rate cannot be negative.");
    }

    if (password && password.length < 6) {
      return validationError(res, "Password must be at least 6 characters.");
    }

    const emailOwner = await User.findOne({ email });
    if (emailOwner && emailOwner._id.toString() !== trainerId) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    trainer.email = email;
    trainer.name = String(name || "").trim();
    trainer.specialization = String(specialization || "").trim();
    trainer.experienceLevel = experienceLevel || null;
    trainer.bio = String(bio || "").trim();
    trainer.hourlyRate = normalizedHourlyRate;
    if (password) {
      trainer.passwordHash = await bcrypt.hash(password, 10);
    }

    await trainer.save();

    return res.json({
      message: "Trainer updated successfully.",
      trainer: {
        id: trainer._id,
        name: trainer.name,
        email: trainer.email,
        specialization: trainer.specialization,
        experienceLevel: trainer.experienceLevel,
        bio: trainer.bio,
        hourlyRate: trainer.hourlyRate,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update trainer.", error: error.message });
  }
});

router.delete("/trainers/:id", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const trainerId = req.params.id;

    const trainer = await User.findById(trainerId);
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found." });
    }

    if ((trainer.role || "member") !== "trainer") {
      return res.status(400).json({ message: "User is not a trainer." });
    }

    await User.findByIdAndDelete(trainerId);

    return res.json({
      message: "Trainer deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete trainer.", error: error.message });
  }
});

// Set trainer leave balance
router.patch("/trainers/:id/leave-balance", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const trainerId = req.params.id;
    const totalLeaveBalance = req.body.totalLeaveBalance;

    if (totalLeaveBalance === undefined || totalLeaveBalance === null) {
      return validationError(res, "totalLeaveBalance is required.");
    }

    const balance = Number(totalLeaveBalance);
    if (!Number.isInteger(balance) || balance < 0) {
      return validationError(res, "totalLeaveBalance must be a non-negative integer.");
    }

    const trainer = await User.findById(trainerId);
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found." });
    }

    if ((trainer.role || "member") !== "trainer") {
      return res.status(400).json({ message: "User is not a trainer." });
    }

    trainer.totalLeaveBalance = balance;
    await trainer.save();

    return res.json({
      message: "Trainer leave balance updated successfully.",
      trainer: {
        id: trainer._id,
        name: trainer.name,
        email: trainer.email,
        totalLeaveBalance: trainer.totalLeaveBalance,
        usedLeaveBalance: trainer.usedLeaveBalance,
        availableBalance: trainer.totalLeaveBalance - trainer.usedLeaveBalance,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update leave balance.", error: error.message });
  }
});

router.get("/trainers/schedules", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const trainers = await User.find({ role: "trainer" })
      .select("_id name email")
      .sort({ createdAt: -1 })
      .lean();

    const trainerIds = trainers.map((t) => t._id);
    const schedules = await TrainerSchedule.find({ trainerId: { $in: trainerIds } }).lean();
    const scheduleMap = new Map(schedules.map((s) => [String(s.trainerId), s]));

    return res.json({
      message: "Trainer schedules retrieved successfully.",
      trainerSchedules: trainers.map((trainer) => {
        const schedule = scheduleMap.get(String(trainer._id));
        const days = Array.isArray(schedule?.days) ? schedule.days : [];
        const availableDaysCount = days.filter((d) => d?.isAvailable).length;

        return {
          trainerId: trainer._id,
          trainerName: trainer.name || "",
          trainerEmail: trainer.email || "",
          sameTimeAllDays: schedule?.sameTimeAllDays ?? true,
          days,
          availableDaysCount,
          updatedAt: schedule?.updatedAt || null,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch trainer schedules.", error: error.message });
  }
});

// Equipment Management Endpoints

router.post("/equipment", requireAdminAuth, requireAdminRole, uploadMedia.single("image"), async (req, res) => {
  try {
    const { name, category, description, imageUrl, location, maintenanceStatus, isAvailable } = req.body;

    if (!name || !name.trim()) {
      return validationError(res, "Equipment name is required.");
    }

    const equipment = new Equipment({
      name: name.trim(),
      category: category || "Other",
      description: description ? description.trim() : "",
      imageUrl: buildUploadedPath(req.file) || (imageUrl ? String(imageUrl).trim() : ""),
      location: location ? location.trim() : "",
      maintenanceStatus: maintenanceStatus || "Good",
      isAvailable: isAvailable !== undefined ? isAvailable : true,
    });

    await equipment.save();

    return res.status(201).json({
      message: "Equipment created successfully.",
      equipment: {
        id: equipment._id,
        name: equipment.name,
        category: equipment.category,
        description: equipment.description,
        imageUrl: equipment.imageUrl || "",
        location: equipment.location,
        maintenanceStatus: equipment.maintenanceStatus,
        isAvailable: equipment.isAvailable,
        createdAt: equipment.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create equipment.", error: error.message });
  }
});

router.get("/equipment", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const equipment = await Equipment.find()
      .sort({ createdAt: -1 });

    return res.json({
      message: "Equipment retrieved successfully.",
      equipment: equipment.map((eq) => ({
        id: eq._id,
        name: eq.name,
        category: eq.category,
        description: eq.description,
        imageUrl: eq.imageUrl || "",
        location: eq.location,
        maintenanceStatus: eq.maintenanceStatus,
        isAvailable: eq.isAvailable,
        createdAt: eq.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch equipment.", error: error.message });
  }
});

router.patch("/equipment/:id", requireAdminAuth, requireAdminRole, uploadMedia.single("image"), async (req, res) => {
  try {
    const { name, category, description, imageUrl, location, maintenanceStatus, isAvailable } = req.body;
    const equipment = await Equipment.findById(req.params.id);

    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found." });
    }

    if (name !== undefined) equipment.name = name.trim();
    if (category !== undefined) equipment.category = category;
    if (description !== undefined) equipment.description = description ? description.trim() : "";
    if (imageUrl !== undefined || req.file) equipment.imageUrl = buildUploadedPath(req.file) || (imageUrl ? String(imageUrl).trim() : "");
    if (location !== undefined) equipment.location = location ? location.trim() : "";
    if (maintenanceStatus !== undefined) equipment.maintenanceStatus = maintenanceStatus;
    if (isAvailable !== undefined) equipment.isAvailable = isAvailable;

    await equipment.save();

    return res.json({
      message: "Equipment updated successfully.",
      equipment: {
        id: equipment._id,
        name: equipment.name,
        category: equipment.category,
        description: equipment.description,
        imageUrl: equipment.imageUrl || "",
        location: equipment.location,
        maintenanceStatus: equipment.maintenanceStatus,
        isAvailable: equipment.isAvailable,
        createdAt: equipment.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update equipment.", error: error.message });
  }
});

router.delete("/equipment/:id", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const equipment = await Equipment.findByIdAndDelete(req.params.id);

    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found." });
    }

    return res.json({ message: "Equipment deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete equipment.", error: error.message });
  }
});

// Product Management Endpoints

router.post("/products", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const { name, description, price, imageUrl, stock, isActive } = req.body;

    if (!name || !name.trim()) {
      return validationError(res, "Product name is required.");
    }

    if (Number(price) < 0) {
      return validationError(res, "Price must be a non-negative number.");
    }

    const product = await Product.create({
      name: name.trim(),
      description: String(description || "").trim(),
      price: Number(price) || 0,
      imageUrl: String(imageUrl || "").trim(),
      stock: Number(stock) || 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    return res.status(201).json({
      message: "Product created successfully.",
      product,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create product.", error: error.message });
  }
});

router.get("/products", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return res.json({ message: "Products retrieved successfully.", products });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch products.", error: error.message });
  }
});

router.patch("/products/:id", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const { name, description, price, imageUrl, stock, isActive } = req.body;

    if (name !== undefined) product.name = String(name || "").trim();
    if (description !== undefined) product.description = String(description || "").trim();
    if (price !== undefined) product.price = Number(price) || 0;
    if (imageUrl !== undefined) product.imageUrl = String(imageUrl || "").trim();
    if (stock !== undefined) product.stock = Number(stock) || 0;
    if (isActive !== undefined) product.isActive = Boolean(isActive);

    await product.save();

    return res.json({ message: "Product updated successfully.", product });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update product.", error: error.message });
  }
});

router.delete("/products/:id", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }
    return res.json({ message: "Product deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete product.", error: error.message });
  }
});

router.get("/orders", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("memberId", "_id name email")
      .sort({ createdAt: -1 });

    return res.json({ message: "Orders retrieved successfully.", orders });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch orders.", error: error.message });
  }
});

router.patch("/orders/:id/status", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const status = String(req.body.status || "").toLowerCase();
    const allowed = ["pending", "confirmed", "packed", "delivered", "cancelled"];
    if (!allowed.includes(status)) {
      return validationError(res, "Invalid order status.");
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    order.status = status;
    await order.save();

    return res.json({ message: "Order status updated successfully.", order });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update order status.", error: error.message });
  }
});

// Feedback moderation endpoints

router.get("/feedback", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const feedback = await Feedback.find()
      .populate("memberId", "_id name email")
      .sort({ createdAt: -1 });

    const summary = summarizeFeedback(feedback);

    return res.json({
      message: "Feedback retrieved successfully.",
      feedback,
      summary,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch feedback.", error: error.message });
  }
});

router.patch("/feedback/:id/reply", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const reply = String(req.body.reply || "").trim();
    if (!reply) {
      return validationError(res, "Reply is required.");
    }

    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found." });
    }

    feedback.adminReply = reply;
    feedback.repliedAt = new Date();
    await feedback.save();

    return res.json({ message: "Feedback reply sent successfully.", feedback });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reply to feedback.", error: error.message });
  }
});

router.delete("/feedback/:id", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found." });
    }

    const remaining = await Feedback.find()
      .populate("memberId", "_id name email")
      .sort({ createdAt: -1 });
    const summary = summarizeFeedback(remaining);

    return res.json({ message: "Feedback deleted successfully.", feedback: remaining, summary });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete feedback.", error: error.message });
  }
});

router.get("/workouts/overview", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const recent = await WorkoutSession.find({ status: "completed" })
      .populate("memberId", "_id name email")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthly = recent.filter((item) => {
      const dt = item.endTime || item.updatedAt || item.createdAt;
      return dt && new Date(dt) >= monthStart;
    });

    const monthlySummary = {
      totalWorkouts: monthly.length,
      totalMinutes: monthly.reduce((sum, w) => sum + (w.durationMinutes || 0), 0),
    };

    return res.json({
      message: "Workout overview retrieved successfully.",
      monthlySummary,
      workouts: recent.map((w) => ({
        id: w._id,
        memberId: w.memberId?._id || null,
        memberName: w.memberId?.name || "",
        memberEmail: w.memberId?.email || "",
        equipmentName: w.equipmentName || "",
        equipmentCategory: w.equipmentCategory || "Other",
        durationMinutes: w.durationMinutes || 0,
        status: w.status,
        endTime: w.endTime || null,
        updatedAt: w.updatedAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch workout overview.", error: error.message });
  }
});

// ============================== PT HOURS MANAGEMENT ==============================

/**
 * GET /admin/member-assignments
 * Get all member-trainer assignments with PT hours
 */
router.get("/member-assignments", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const MemberAssignment = require("../models/MemberAssignment");
    const assignments = await MemberAssignment.find({ status: "active" })
      .populate("memberId", "_id name email memberType")
      .populate("trainerId", "_id name email")
      .sort({ createdAt: -1 });

    return res.json({
      message: "Member assignments retrieved successfully.",
      assignments: assignments.map((a) => ({
        id: a._id,
        memberId: a.memberId._id,
        memberName: a.memberId.name,
        memberEmail: a.memberId.email,
        trainerId: a.trainerId._id,
        trainerName: a.trainerId.name,
        allocatedPTHours: a.allocatedPTHours,
        usedPTHours: a.usedPTHours,
        remainingPTHours: a.remainingPTHours,
        status: a.status,
        notes: a.notes,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch assignments.", error: error.message });
  }
});

/**
 * POST /admin/member-assignments/:memberId/update-hours
 * Admin updates PT hours allocation for a member
 * Body: { allocatedPTHours, notes? }
 */
router.post("/member-assignments/:memberId/update-hours", requireAdminAuth, requireAdminRole, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { allocatedPTHours, notes } = req.body;

    if (!allocatedPTHours || allocatedPTHours < 0) {
      return validationError(res, "Valid allocatedPTHours is required and must be non-negative");
    }

    const MemberAssignment = require("../models/MemberAssignment");
    const assignment = await MemberAssignment.findOne({
      memberId,
      status: "active",
    }).populate("trainerId", "_id name email").populate("memberId", "_id name email");

    if (!assignment) {
      return res.status(404).json({ message: "Member assignment not found" });
    }

    const oldHours = assignment.allocatedPTHours;
    assignment.allocatedPTHours = allocatedPTHours;
    assignment.remainingPTHours = allocatedPTHours - assignment.usedPTHours;
    if (notes) assignment.notes = notes;

    await assignment.save();

    // Notify member and trainer
    const Notification = require("../models/Notification");
    await Notification.create({
      recipientId: memberId,
      senderId: req.userId,
      type: "pt-hours-updated",
      title: "PT Hours Updated",
      message: `Admin updated your PT hours allocation from ${oldHours}h to ${allocatedPTHours}h.`,
      relatedEntityId: assignment._id,
      relatedEntityType: "MemberAssignment",
    });

    await Notification.create({
      recipientId: assignment.trainerId._id,
      senderId: req.userId,
      type: "pt-hours-updated",
      title: "Member PT Hours Updated",
      message: `Admin updated PT hours for ${assignment.memberId.name} from ${oldHours}h to ${allocatedPTHours}h.`,
      relatedEntityId: assignment._id,
      relatedEntityType: "MemberAssignment",
    });

    return res.json({
      message: "PT hours updated successfully.",
      assignment: {
        id: assignment._id,
        memberId: assignment.memberId._id,
        memberName: assignment.memberId.name,
        trainerId: assignment.trainerId._id,
        trainerName: assignment.trainerId.name,
        allocatedPTHours: assignment.allocatedPTHours,
        usedPTHours: assignment.usedPTHours,
        remainingPTHours: assignment.remainingPTHours,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update PT hours.", error: error.message });
  }
});

module.exports = router;
