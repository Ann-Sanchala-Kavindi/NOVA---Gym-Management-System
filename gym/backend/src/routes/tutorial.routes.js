const express = require("express");
const TutorialCategory = require("../models/TutorialCategory");
const TutorialVideo = require("../models/TutorialVideo");
const TutorialProgress = require("../models/TutorialProgress");
const { authMiddleware, hasRole } = require("../utils/auth");

const router = express.Router();

function validateYoutubeUrl(url = "") {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ["www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

// ===== Categories =====

// Get all tutorial categories with video counts
router.get("/categories", authMiddleware, async (req, res) => {
  try {
    const categories = await TutorialCategory.find({}).sort({ createdAt: -1 }).lean();
    const categoryIds = categories.map((c) => c._id);

    const videoCounts = await TutorialVideo.aggregate([
      { $match: { categoryId: { $in: categoryIds }, isActive: true } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(videoCounts.map((v) => [String(v._id), v.count]));

    return res.json({
      message: "Tutorial categories retrieved successfully.",
      categories: categories.map((c) => ({
        id: c._id,
        name: c.name,
        description: c.description || "",
        thumbnailImageUrl: c.thumbnailImageUrl || "",
        videoCount: countMap.get(String(c._id)) || 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tutorial categories.", error: error.message });
  }
});

// Create a new tutorial category (admin only)
router.post("/categories", authMiddleware, hasRole("admin"), async (req, res) => {
  try {
    const { name, description, thumbnailImageUrl } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required." });
    }

    const category = await TutorialCategory.create({
      name: name.trim(),
      description: (description || "").trim(),
      thumbnailImageUrl: (thumbnailImageUrl || "").trim(),
    });

    return res.status(201).json({
      message: "Tutorial category created successfully.",
      category: {
        id: category._id,
        name: category.name,
        description: category.description || "",
        thumbnailImageUrl: category.thumbnailImageUrl || "",
        videoCount: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create tutorial category.", error: error.message });
  }
});

// Update a tutorial category (admin only)
router.patch("/categories/:id", authMiddleware, hasRole("admin"), async (req, res) => {
  try {
    const { name, description, thumbnailImageUrl } = req.body;
    const category = await TutorialCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Tutorial category not found." });
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ message: "Category name is required." });
      }
      category.name = String(name).trim();
    }

    if (description !== undefined) {
      category.description = String(description || "").trim();
    }

    if (thumbnailImageUrl !== undefined) {
      category.thumbnailImageUrl = String(thumbnailImageUrl || "").trim();
    }

    await category.save();

    return res.json({
      message: "Tutorial category updated successfully.",
      category: {
        id: category._id,
        name: category.name,
        description: category.description || "",
        thumbnailImageUrl: category.thumbnailImageUrl || "",
        videoCount: await TutorialVideo.countDocuments({ categoryId: category._id, isActive: true }),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update tutorial category.", error: error.message });
  }
});

// Delete a tutorial category (admin only)
router.delete("/categories/:id", authMiddleware, hasRole("admin"), async (req, res) => {
  try {
    const category = await TutorialCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Tutorial category not found." });
    }

    const videos = await TutorialVideo.find({ categoryId: category._id }).select("_id").lean();
    const videoIds = videos.map((video) => video._id);

    if (videoIds.length > 0) {
      await TutorialProgress.deleteMany({ tutorialId: { $in: videoIds } });
      await TutorialVideo.deleteMany({ categoryId: category._id });
    }

    await category.deleteOne();

    return res.json({ message: "Tutorial category deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete tutorial category.", error: error.message });
  }
});

// ===== Videos =====

// List videos, optionally filtered by category, including current user's progress
router.get("/videos", authMiddleware, async (req, res) => {
  try {
    const { categoryId } = req.query;
    const filter = { isActive: true };
    if (categoryId) {
      filter.categoryId = categoryId;
    }

    const videos = await TutorialVideo.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const videoIds = videos.map((v) => v._id);

    let progressByVideo = new Map();
    if (videoIds.length > 0) {
      const progressDocs = await TutorialProgress.find({
        userId: req.user._id,
        tutorialId: { $in: videoIds },
      }).lean();

      progressByVideo = new Map(progressDocs.map((p) => [String(p.tutorialId), p]));
    }

    return res.json({
      message: "Tutorial videos retrieved successfully.",
      videos: videos.map((v) => {
        const progress = progressByVideo.get(String(v._id));
        const watchedSeconds = progress?.watchedSeconds || 0;
        const durationSeconds = v.durationSeconds || 0;
        const progressPercent = durationSeconds > 0 ? Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100)) : 0;

        return {
          id: v._id,
          title: v.title,
          description: v.description || "",
          categoryId: v.categoryId,
          youtubeUrl: v.youtubeUrl,
          thumbnailImageUrl: v.thumbnailImageUrl || "",
          durationSeconds,
          watchedSeconds,
          completed: !!progress?.completed,
          lastWatchedAt: progress?.lastWatchedAt || null,
          progressPercent,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tutorial videos.", error: error.message });
  }
});

// Get single video with current user's progress
router.get("/videos/:id", authMiddleware, async (req, res) => {
  try {
    const video = await TutorialVideo.findById(req.params.id).lean();
    if (!video || !video.isActive) {
      return res.status(404).json({ message: "Tutorial video not found." });
    }

    const progress = await TutorialProgress.findOne({
      userId: req.user._id,
      tutorialId: video._id,
    }).lean();

    const watchedSeconds = progress?.watchedSeconds || 0;
    const durationSeconds = video.durationSeconds || 0;
    const progressPercent = durationSeconds > 0 ? Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100)) : 0;

    return res.json({
      message: "Tutorial video retrieved successfully.",
      video: {
        id: video._id,
        title: video.title,
        description: video.description || "",
        categoryId: video.categoryId,
        youtubeUrl: video.youtubeUrl,
        thumbnailImageUrl: video.thumbnailImageUrl || "",
        durationSeconds,
      },
      progress: progress
        ? {
            watchedSeconds,
            completed: !!progress.completed,
            lastWatchedAt: progress.lastWatchedAt || null,
            progressPercent,
          }
        : {
            watchedSeconds: 0,
            completed: false,
            lastWatchedAt: null,
            progressPercent: 0,
          },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tutorial video.", error: error.message });
  }
});

// Create a new tutorial video (admin only)
router.post("/videos", authMiddleware, hasRole("admin"), async (req, res) => {
  try {
    const { title, description, categoryId, youtubeUrl, thumbnailImageUrl, durationSeconds } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Video title is required." });
    }

    if (!categoryId) {
      return res.status(400).json({ message: "Category is required." });
    }

    if (!youtubeUrl || !validateYoutubeUrl(youtubeUrl)) {
      return res.status(400).json({ message: "A valid YouTube URL is required." });
    }

    const category = await TutorialCategory.findById(categoryId);
    if (!category) {
      return res.status(400).json({ message: "Selected category does not exist." });
    }

    const video = await TutorialVideo.create({
      title: title.trim(),
      description: (description || "").trim(),
      categoryId: category._id,
      youtubeUrl: youtubeUrl.trim(),
      thumbnailImageUrl: (thumbnailImageUrl || "").trim(),
      durationSeconds: Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : 0,
    });

    return res.status(201).json({
      message: "Tutorial video created successfully.",
      video: {
        id: video._id,
        title: video.title,
        description: video.description || "",
        categoryId: video.categoryId,
        youtubeUrl: video.youtubeUrl,
        thumbnailImageUrl: video.thumbnailImageUrl || "",
        durationSeconds: video.durationSeconds || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create tutorial video.", error: error.message });
  }
});

// Update a tutorial video (admin only)
router.patch("/videos/:id", authMiddleware, hasRole("admin"), async (req, res) => {
  try {
    const { title, description, categoryId, youtubeUrl, thumbnailImageUrl, durationSeconds } = req.body;
    const video = await TutorialVideo.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ message: "Tutorial video not found." });
    }

    if (title !== undefined) {
      if (!String(title).trim()) {
        return res.status(400).json({ message: "Video title is required." });
      }
      video.title = String(title).trim();
    }

    if (description !== undefined) {
      video.description = String(description || "").trim();
    }

    if (categoryId !== undefined) {
      const category = await TutorialCategory.findById(categoryId);
      if (!category) {
        return res.status(400).json({ message: "Selected category does not exist." });
      }
      video.categoryId = category._id;
    }

    if (youtubeUrl !== undefined) {
      if (!youtubeUrl || !validateYoutubeUrl(youtubeUrl)) {
        return res.status(400).json({ message: "A valid YouTube URL is required." });
      }
      video.youtubeUrl = String(youtubeUrl).trim();
    }

    if (thumbnailImageUrl !== undefined) {
      video.thumbnailImageUrl = String(thumbnailImageUrl || "").trim();
    }

    if (durationSeconds !== undefined) {
      video.durationSeconds = Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : 0;
    }

    await video.save();

    return res.json({
      message: "Tutorial video updated successfully.",
      video: {
        id: video._id,
        title: video.title,
        description: video.description || "",
        categoryId: video.categoryId,
        youtubeUrl: video.youtubeUrl,
        thumbnailImageUrl: video.thumbnailImageUrl || "",
        durationSeconds: video.durationSeconds || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update tutorial video.", error: error.message });
  }
});

// Delete a tutorial video (admin only)
router.delete("/videos/:id", authMiddleware, hasRole("admin"), async (req, res) => {
  try {
    const video = await TutorialVideo.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: "Tutorial video not found." });
    }

    await TutorialProgress.deleteMany({ tutorialId: video._id });
    await video.deleteOne();

    return res.json({ message: "Tutorial video deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete tutorial video.", error: error.message });
  }
});

// ===== Progress =====

// Admin: list per-member progress for a specific video
router.get("/videos/:id/progress", authMiddleware, hasRole("admin"), async (req, res) => {
  try {
    const video = await TutorialVideo.findById(req.params.id).lean();
    if (!video) {
      return res.status(404).json({ message: "Tutorial video not found." });
    }

    const progressDocs = await TutorialProgress.find({ tutorialId: video._id })
      .populate("userId", "_id email name")
      .lean();

    const durationSeconds = video.durationSeconds || 0;

    const entries = progressDocs.map((p) => {
      const watchedSeconds = p.watchedSeconds || 0;
      const progressPercent = durationSeconds > 0
        ? Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100))
        : 0;

      return {
        id: p._id,
        userId: p.userId?._id || null,
        userName: p.userId?.name || "",
        userEmail: p.userId?.email || "",
        watchedSeconds,
        completed: !!p.completed,
        lastWatchedAt: p.lastWatchedAt || null,
        progressPercent,
      };
    });

    return res.json({
      message: "Tutorial video progress retrieved successfully.",
      video: {
        id: video._id,
        title: video.title,
        durationSeconds,
      },
      entries,
      summary: {
        totalMembers: entries.length,
        completedCount: entries.filter((e) => e.completed).length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tutorial progress.", error: error.message });
  }
});

// Update progress for current user on a video
router.patch("/videos/:id/progress", authMiddleware, hasRole("member"), async (req, res) => {
  try {
    const { watchedSeconds, durationSeconds } = req.body || {};

    const video = await TutorialVideo.findById(req.params.id);
    if (!video || !video.isActive) {
      return res.status(404).json({ message: "Tutorial video not found." });
    }

    const safeWatchedSeconds = Math.max(0, Number(watchedSeconds) || 0);
    const totalDuration = Number(durationSeconds) || video.durationSeconds || 0;

    let completed = false;
    if (totalDuration > 0) {
      const ratio = safeWatchedSeconds / totalDuration;
      completed = ratio >= 0.9;
    }

    const progress = await TutorialProgress.findOneAndUpdate(
      { userId: req.user._id, tutorialId: video._id },
      {
        $set: {
          watchedSeconds: safeWatchedSeconds,
          completed,
          lastWatchedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    const progressPercent = totalDuration > 0 ? Math.min(100, Math.round((progress.watchedSeconds / totalDuration) * 100)) : 0;

    return res.json({
      message: "Tutorial progress updated successfully.",
      progress: {
        watchedSeconds: progress.watchedSeconds,
        completed: !!progress.completed,
        lastWatchedAt: progress.lastWatchedAt || null,
        progressPercent,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update tutorial progress.", error: error.message });
  }
});

module.exports = router;
