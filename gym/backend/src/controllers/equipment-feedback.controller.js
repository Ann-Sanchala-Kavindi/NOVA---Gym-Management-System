const Equipment = require("../models/Equipment");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const addEquipment = async (req, res) => {
  try {
    let { name, equipmentType, category, availability, isAvailable, description, location, maintenanceStatus, imageUrl } = req.body;

    name = (name || "").trim();
    equipmentType = (equipmentType || category || "").trim();
    const availableFlag = typeof isAvailable === "string" ? isAvailable === "true" : Boolean(isAvailable);
    availability = (availability || (availableFlag ? "Available" : "In Use") || "Available").trim();
    description = (description || "").trim();
    location = (location || "").trim();
    maintenanceStatus = (maintenanceStatus || "Good").trim();
    imageUrl = (imageUrl || "").trim();

    if (!name || !equipmentType) {
      return res.status(400).json({
        message: "Equipment name and type are required.",
      });
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const equipment = await Equipment.create({
      name,
      equipmentType,
      availability,
      description,
      location,
      maintenanceStatus,
      isAvailable: availableFlag,
      imageUrl: imageUrl || photoUrl || "",
      photoUrl,
      createdBy: req.user?._id || null,
    });

    res.status(201).json({
      message: "Equipment added successfully.",
      data: equipment,
    });
  } catch (error) {
    console.log("Add equipment error:", error);
    res.status(400).json({ message: error.message });
  }
};

const getAllEquipment = async (req, res) => {
  try {
    const { type = "All", search = "" } = req.query;

    const filter = {};

    if (type && type !== "All") {
      filter.equipmentType = type;
    }

    if (search.trim()) {
      filter.name = { $regex: search.trim(), $options: "i" };
    }

    const equipmentList = await Equipment.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      count: equipmentList.length,
      data: equipmentList,
    });
  } catch (error) {
    console.log("Get equipment error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getEquipmentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid equipment ID." });
    }

    const equipment = await Equipment.findById(id);

    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found." });
    }

    res.status(200).json({ data: equipment });
  } catch (error) {
    console.log("Get equipment by id error:", error);
    res.status(500).json({ message: error.message });
  }
};

const updateEquipment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid equipment ID." });
    }

    let { name, equipmentType, category, availability, isAvailable, description, location, maintenanceStatus, imageUrl } = req.body;

    name = (name || "").trim();
    equipmentType = (equipmentType || category || "").trim();
    const availableFlag = typeof isAvailable === "string" ? isAvailable === "true" : Boolean(isAvailable);
    availability = (availability || "").trim();
    description = (description || "").trim();
    location = (location || "").trim();
    maintenanceStatus = (maintenanceStatus || "").trim();
    imageUrl = (imageUrl || "").trim();

    const updateData = {};
    if (name) updateData.name = name;
    if (equipmentType) updateData.equipmentType = equipmentType;
    if (availability) updateData.availability = availability;
    if (description) updateData.description = description;
    if (location) updateData.location = location;
    if (maintenanceStatus) updateData.maintenanceStatus = maintenanceStatus;
    if (req.body.isAvailable != null) {
      updateData.isAvailable = availableFlag;
      if (!updateData.availability) {
        updateData.availability = availableFlag ? 'Available' : 'In Use';
      }
    }
    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }
    if (req.file) {
      updateData.photoUrl = `/uploads/${req.file.filename}`;
    }

    const equipment = await Equipment.findById(id);

    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found." });
    }

    const oldPhotoUrl = equipment.photoUrl;

    const updatedEquipment = await Equipment.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (req.file && oldPhotoUrl) {
      const oldPath = path.join(__dirname, "..", "..", oldPhotoUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    res.status(200).json({
      message: "Equipment updated successfully.",
      data: updatedEquipment,
    });
  } catch (error) {
    console.log("Update equipment error:", error);
    res.status(400).json({ message: error.message });
  }
};

const deleteEquipment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid equipment ID." });
    }

    const equipment = await Equipment.findByIdAndDelete(id);

    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found." });
    }

    if (equipment.photoUrl) {
      const filePath = path.join(__dirname, "..", "..", equipment.photoUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(200).json({
      message: "Equipment deleted successfully.",
    });
  } catch (error) {
    console.log("Delete equipment error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addEquipment,
  getAllEquipment,
  getEquipmentById,
  updateEquipment,
  deleteEquipment,
};