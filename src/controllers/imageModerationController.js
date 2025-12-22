/**
 * Image Moderation Controller
 * 
 * Admin-only endpoints for image moderation.
 * Handles approval, rejection, and moderation queue management.
 */

const Image = require('../models/Image');
const {
  sendSuccess,
  sendError,
  sendValidationError
} = require('../utils/response');

/**
 * Get images pending moderation
 * GET /api/v1/images/moderation/pending
 * 
 * Returns list of images awaiting moderation review.
 * Admin only.
 */
const getPendingModeration = async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const images = await Image.findPendingModeration({
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    const totalCount = await Image.countPendingModeration();

    return sendSuccess(res, {
      images,
      pagination: {
        total: totalCount,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        hasMore: (parseInt(offset, 10) + images.length) < totalCount
      }
    }, 'Pending moderation images retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Approve image for public display
 * POST /api/v1/images/moderation/:imageId/approve
 * 
 * Approves an image, making it visible to the public.
 * Admin only.
 */
const approveImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const moderatorId = req.userId;
    const { notes } = req.body;

    if (!imageId) {
      return sendValidationError(res, 'Image ID is required');
    }

    // Check if image exists
    const image = await Image.findById(imageId);
    if (!image) {
      return sendError(res, 'Image not found', 404, 'IMAGE_NOT_FOUND');
    }

    // Approve image
    const approvedImage = await Image.approve(imageId, moderatorId, notes || null);

    return sendSuccess(res, approvedImage, 'Image approved successfully. It is now visible to the public.');
  } catch (error) {
    next(error);
  }
};

/**
 * Reject image (hide from public)
 * POST /api/v1/images/moderation/:imageId/reject
 * 
 * Rejects an image, hiding it from public view.
 * Admin only.
 */
const rejectImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const moderatorId = req.userId;
    const { notes } = req.body;

    if (!imageId) {
      return sendValidationError(res, 'Image ID is required');
    }

    if (!notes || notes.trim().length === 0) {
      return sendValidationError(res, 'Rejection notes are required. Please provide a reason for rejection.');
    }

    // Check if image exists
    const image = await Image.findById(imageId);
    if (!image) {
      return sendError(res, 'Image not found', 404, 'IMAGE_NOT_FOUND');
    }

    // Reject image
    const rejectedImage = await Image.reject(imageId, moderatorId, notes);

    return sendSuccess(res, rejectedImage, 'Image rejected successfully. It is now hidden from public view.');
  } catch (error) {
    next(error);
  }
};

/**
 * Get moderation statistics
 * GET /api/v1/images/moderation/stats
 * 
 * Returns moderation statistics for admin dashboard.
 * Admin only.
 */
const getModerationStats = async (req, res, next) => {
  try {
    const pendingCount = await Image.countPendingModeration();

    // Get counts for each moderation status
    const { pool } = require('../config/database');
    const statsQuery = `
      SELECT 
        moderation_status,
        COUNT(*) as count
      FROM images
      WHERE is_deleted = FALSE
        AND upload_status = 'uploaded'
      GROUP BY moderation_status
    `;
    const statsResult = await pool.query(statsQuery);
    
    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0
    };

    statsResult.rows.forEach(row => {
      stats[row.moderation_status] = parseInt(row.count, 10);
    });

    return sendSuccess(res, {
      pending: stats.pending,
      approved: stats.approved,
      rejected: stats.rejected,
      total: stats.pending + stats.approved + stats.rejected
    }, 'Moderation statistics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPendingModeration,
  approveImage,
  rejectImage,
  getModerationStats
};

