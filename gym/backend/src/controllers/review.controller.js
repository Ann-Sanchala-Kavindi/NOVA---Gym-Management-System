const mongoose = require('mongoose');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const { generateGeminiSummary } = require('../services/gemini-summary.service');

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'have', 'very', 'good',
  'great', 'gym', 'was', 'are', 'but', 'too', 'from', 'your', 'about',
  'they', 'their', 'them', 'you', 'our', 'has', 'had', 'not', 'all',
  'can', 'just', 'into', 'out', 'its', "it's", 'there', 'here', 'than',
  'then', 'what', 'when', 'where', 'which', 'while', 'been',
]);

const FLAG_CATEGORIES = [
  'Inappropriate Language',
  'Harassment / Abuse',
  'Hate / Discrimination',
  'Sexual / Explicit Content',
  'Spam / Misleading',
  'Other',
];

const REVIEW_CATEGORIES = [
  'Equipment',
  'Cleanliness',
  'Trainer Support',
  'Meal Guidance',
  'Class Experience',
  'App Experience',
  'General',
];

const FEATURE_MAP = {
  Equipment: 'equipment',
  Cleanliness: 'general',
  'Trainer Support': 'workout-plan',
  'Meal Guidance': 'meal-plan',
  'Class Experience': 'general',
  'App Experience': 'general',
  General: 'general',
};

const getSentimentFromRating = (rating) => {
  if (rating >= 4) return 'positive';
  if (rating === 3) return 'neutral';
  return 'negative';
};

const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const extractTopKeywords = (reviews) => {
  const map = {};
  reviews.forEach((review) => {
    const text = `${review.topic || ''} ${review.comment || ''}`.toLowerCase();
    const words = text.match(/[a-zA-Z]{3,}/g) || [];
    words.forEach((word) => {
      if (STOP_WORDS.has(word)) return;
      map[word] = (map[word] || 0) + 1;
    });
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word]) => word);
};

const buildRuleBasedSummary = (reviews, stats) => {
  if (!reviews.length) return 'No reviews have been posted yet.';
  const { recommendationPercentage, averageRating, positiveCount, neutralCount, negativeCount, totalReviews } = stats;
  const keywords = extractTopKeywords(reviews);

  let overallTone = '';
  if (averageRating >= 4.2) overallTone = 'Overall feedback is very positive.';
  else if (averageRating >= 3.2) overallTone = 'Overall feedback is moderately positive.';
  else overallTone = 'Overall feedback is mixed to critical.';

  const topCategory = Object.entries(stats.categoryBreakdown || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
  return [
    overallTone,
    `The average rating is ${averageRating} out of 5.`,
    `${recommendationPercentage}% of reviewers recommend this gym.`,
    `Out of ${totalReviews} reviews, ${positiveCount} are positive, ${neutralCount} are neutral, and ${negativeCount} are negative.`,
    topCategory ? `The most discussed area is ${topCategory}.` : '',
    keywords.length ? `Commonly mentioned topics include ${keywords.slice(0, 5).join(', ')}.` : '',
  ].filter(Boolean).join(' ');
};

const serializeReview = (review, currentUserId = null) => ({
  _id: review._id,
  userId: review.userId ? String(review.userId) : null,
  userName: review.userName,
  country: review.country,
  category: review.category || 'General',
  relatedFeature: review.relatedFeature || 'general',
  topic: review.topic,
  comment: review.comment,
  rating: review.rating,
  sentiment: review.sentiment,
  recommended: review.recommended,
  reply: review.reply,
  isFlaggedByUsers: !!review.isFlaggedByUsers,
  flagCount: review.flagCount || 0,
  flagReports: review.flagReports || [],
  hasReportedByCurrentUser: !!((review.flagReports || []).some((item) => item.reporterId && currentUserId && String(item.reporterId) === String(currentUserId))),
  adminStatus: review.adminStatus,
  removalReason: review.removalReason || '',
  removedAt: review.removedAt,
  removedBy: review.removedBy ? String(review.removedBy) : null,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
});

const createReview = async (req, res) => {
  try {
    let { userName, country, category, relatedFeature, topic, comment, rating } = req.body;
    userName = (userName || req.user?.name || 'Anonymous User').trim();
    country = (country || 'Sri Lanka').trim();
    category = (category || 'General').trim();
    relatedFeature = (relatedFeature || FEATURE_MAP[category] || 'general').trim();
    topic = (topic || '').trim();
    comment = (comment || '').trim();
    rating = Number(rating);

    if (!req.userId) return res.status(401).json({ message: 'Not authorized.' });
    if (!topic || !comment || !rating) return res.status(400).json({ message: 'Topic, comment, and rating are required.' });
    if (!REVIEW_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid review category.' });
    if (topic.length < 3 || topic.length > 60) return res.status(400).json({ message: 'Topic must be between 3 and 60 characters.' });
    if (comment.length < 10 || comment.length > 500) return res.status(400).json({ message: 'Review must be between 10 and 500 characters.' });
    if (Number.isNaN(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be a number between 1 and 5.' });

    const review = await Review.create({
      userId: req.userId,
      userName,
      country,
      category,
      relatedFeature,
      topic,
      comment,
      rating,
      sentiment: getSentimentFromRating(rating),
      recommended: rating >= 4,
    });

    res.status(201).json(serializeReview(review, req.userId || null));
  } catch (error) {
    console.log('Create review error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getReviews = async (req, res) => {
  try {
    const { filter = 'all', visibility = 'public' } = req.query;
    const query = {};
    if (filter !== 'all') {
      if (!['positive', 'neutral', 'negative'].includes(filter)) {
        return res.status(400).json({ message: 'Invalid filter value.' });
      }
      query.sentiment = filter;
    }

    const isAdmin = req.user?.role === 'admin';
    if (visibility === 'public') {
      query.adminStatus = 'visible';
    } else if (visibility === 'mine') {
      if (!req.userId) return res.status(401).json({ message: 'Login required to view your reviews.' });
      query.userId = req.userId;
    } else if (['flagged', 'reported', 'all', 'unflagged'].includes(visibility)) {
      if (!isAdmin) return res.status(403).json({ message: 'Admin access required for this review filter.' });
      if (visibility === 'flagged') query.adminStatus = 'flagged';
      else if (visibility === 'reported') {
        query.flagCount = { $gt: 0 };
        query.adminStatus = { $ne: 'removed' };
      } else if (visibility === 'unflagged') {
        query.adminStatus = 'visible';
        query.flagCount = 0;
      } else if (visibility === 'all') {
        query.adminStatus = { $ne: 'removed' };
      }
    } else {
      return res.status(400).json({ message: 'Invalid visibility value.' });
    }

    const reviews = await Review.find(query).sort({ createdAt: -1 });
    res.status(200).json(reviews.map((review) => serializeReview(review, req.userId || null)));
  } catch (error) {
    console.log('Get reviews error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getReviewSummary = async (_req, res) => {
  try {
    const reviews = await Review.find({ adminStatus: 'visible' });
    const totalReviews = reviews.length;
    const averageRating = totalReviews === 0 ? 0 : reviews.reduce((sum, item) => sum + item.rating, 0) / totalReviews;
    const positiveCount = reviews.filter((r) => r.sentiment === 'positive').length;
    const neutralCount = reviews.filter((r) => r.sentiment === 'neutral').length;
    const negativeCount = reviews.filter((r) => r.sentiment === 'negative').length;
    const pendingReply = reviews.filter((r) => !r.reply || !r.reply.message).length;
    const recommendedCount = reviews.filter((r) => r.recommended).length;
    const recommendationPercentage = totalReviews === 0 ? 0 : Math.round((recommendedCount / totalReviews) * 100);
    const categoryBreakdown = reviews.reduce((acc, review) => {
      const key = review.category || 'General';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const featureBreakdown = reviews.reduce((acc, review) => {
      const key = review.relatedFeature || 'general';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const recent30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTrend = reviews.filter((review) => new Date(review.createdAt) >= recent30Days)
      .reduce((acc, review) => {
        const weekKey = new Date(review.createdAt).toISOString().slice(0, 10);
        acc[weekKey] = (acc[weekKey] || 0) + 1;
        return acc;
      }, {});

    const stats = {
      totalReviews,
      averageRating: Number(averageRating.toFixed(1)),
      pendingReply,
      positiveCount,
      neutralCount,
      negativeCount,
      recommendationPercentage,
      ratingBreakdown: {
        5: reviews.filter((r) => r.rating === 5).length,
        4: reviews.filter((r) => r.rating === 4).length,
        3: reviews.filter((r) => r.rating === 3).length,
        2: reviews.filter((r) => r.rating === 2).length,
        1: reviews.filter((r) => r.rating === 1).length,
      },
      reportedCount: await Review.countDocuments({ adminStatus: 'visible', flagCount: { $gt: 0 } }),
      flaggedCount: await Review.countDocuments({ adminStatus: 'flagged' }),
      unresolvedCount: await Review.countDocuments({ adminStatus: { $in: ['flagged', 'visible'] }, flagCount: { $gt: 0 }, 'reply.message': { $in: [null, ''] } }),
      categoryBreakdown,
      featureBreakdown,
      recentTrend,
    };

    const topKeywords = extractTopKeywords(reviews);
    let quickSummary = buildRuleBasedSummary(reviews, stats);
    let summarySource = 'rule-based';
    try {
      const geminiSummary = await generateGeminiSummary({ reviews, stats });
      if (geminiSummary) {
        quickSummary = geminiSummary;
        summarySource = 'gemini';
      }
    } catch (error) {
      console.log('Gemini summary fallback used:', error.message);
    }

    res.status(200).json({ ...stats, quickSummary, summarySource, topKeywords });
  } catch (error) {
    console.log('Get review summary error:', error);
    res.status(500).json({ message: error.message });
  }
};

const replyToReview = async (req, res) => {
  try {
    const { id } = req.params;
    let { message } = req.body;
    if (!validateObjectId(id)) return res.status(400).json({ message: 'Invalid review ID.' });
    message = (message || '').trim();
    if (!message) return res.status(400).json({ message: 'Reply message is required.' });
    if (message.length < 2 || message.length > 300) return res.status(400).json({ message: 'Reply must be between 2 and 300 characters.' });

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    review.reply = { message, repliedAt: new Date() };
    const updatedReview = await review.save();

    if (review.userId) {
      await Notification.create({
        recipientId: review.userId,
        senderId: req.userId || null,
        type: 'review-reply',
        title: 'Review reply received',
        message: `An admin replied to your review: ${review.topic}`,
        relatedEntityId: review._id,
        relatedEntityType: 'Review',
        priority: 'normal',
        data: { reviewId: String(review._id), topic: review.topic, category: review.category || 'General', replyMessage: message },
      });
    }

    res.status(200).json(serializeReview(updatedReview, req.userId || null));
  } catch (error) {
    console.log('Reply to review error:', error);
    res.status(500).json({ message: error.message });
  }
};

const reportReview = async (req, res) => {
  try {
    const { id } = req.params;
    let { category, note = '' } = req.body;
    if (!validateObjectId(id)) return res.status(400).json({ message: 'Invalid review ID.' });
    category = (category || '').trim();
    note = (note || '').trim();
    if (!FLAG_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid flag category.' });
    if (note.length > 200) return res.status(400).json({ message: 'Flag note cannot exceed 200 characters.' });

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    const alreadyReportedByUser = review.flagReports.some((item) => item.reporterId && req.userId && String(item.reporterId) === String(req.userId));
    if (alreadyReportedByUser) return res.status(400).json({ message: 'You have already reported this review.' });

    review.flagReports.push({ reporterId: req.userId || null, category, note, reportedAt: new Date() });
    review.flagCount = review.flagReports.length;
    review.isFlaggedByUsers = review.flagCount > 0;
    const updatedReview = await review.save();

    if (review.flagCount === 1) {
      const User = require('../models/User');
      const admins = await User.find({ role: 'admin' }).select('_id');
      if (admins.length) {
        await Notification.insertMany(admins.map((admin) => ({
          recipientId: admin._id,
          senderId: req.userId || null,
          type: 'review-flagged',
          title: 'Review flagged by member',
          message: `A member flagged the review "${review.topic}" for ${category}.`,
          relatedEntityId: review._id,
          relatedEntityType: 'Review',
          priority: review.flagCount >= 3 ? 'high' : 'normal',
          data: { reviewId: String(review._id), topic: review.topic, category: review.category || 'General', reportCategory: category, note, flagCount: review.flagCount },
        })));
      }
    }

    res.status(200).json(serializeReview(updatedReview, req.userId || null));
  } catch (error) {
    console.log('Report review error:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { adminStatus } = req.body;
    if (!validateObjectId(id)) return res.status(400).json({ message: 'Invalid review ID.' });
    adminStatus = (adminStatus || '').trim();
    if (!['visible', 'flagged', 'removed'].includes(adminStatus)) return res.status(400).json({ message: 'Invalid admin status.' });

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    review.adminStatus = adminStatus;
    if (adminStatus === 'removed') {
      review.removedAt = new Date();
      review.removedBy = req.userId || null;
    } else {
      review.removedAt = null;
      review.removedBy = null;
      review.removalReason = '';
    }
    const updatedReview = await review.save();
    res.status(200).json(serializeReview(updatedReview, req.userId || null));
  } catch (error) {
    console.log('Update review status error:', error);
    res.status(500).json({ message: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = (req.body?.reason || '').trim();
    if (!validateObjectId(id)) return res.status(400).json({ message: 'Invalid review ID.' });
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ message: 'Review not found.' });

    const isAdmin = req.user?.role === 'admin';
    const isOwner = req.userId && String(review.userId) === String(req.userId);
    if (!isAdmin && !isOwner) return res.status(403).json({ message: 'You can only delete your own reviews.' });

    if (isAdmin) {
      review.adminStatus = 'removed';
      review.removedAt = new Date();
      review.removedBy = req.userId || null;
      review.removalReason = reason || '';
      await review.save();
      if (review.userId) {
        await Notification.create({
          recipientId: review.userId,
          senderId: req.userId || null,
          type: 'review-removed',
          title: 'Review removed by admin',
          message: reason ? `Your review \"${review.topic}\" was removed. Reason: ${reason}` : `Your review \"${review.topic}\" was removed by an admin.`,
          relatedEntityId: review._id,
          relatedEntityType: 'Review',
          priority: 'high',
          data: { reviewId: String(review._id), topic: review.topic, category: review.category || 'General', reason, reviewStatus: 'removed' },
        });
      }
      return res.status(200).json({ message: 'Review removed successfully.', deletedId: id });
    }

    await Review.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Review deleted successfully.', deletedId: id });
  } catch (error) {
    console.log('Delete review error:', error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createReview,
  getReviews,
  getReviewSummary,
  replyToReview,
  reportReview,
  updateReviewStatus,
  deleteReview,
};
