/**
 * Image Routes
 * 
 * Image management endpoints with S3 pre-signed URL support.
 * 
 * Image uploads use direct client-to-S3 uploads via pre-signed URLs.
 * Backend never handles binary image data.
 * 
 * Endpoints:
 * - POST   /images                    - Create image record (register intent to upload)
 * - PUT    /images/profile/user/:userId - Replace user profile image (convenience endpoint)
 * - GET    /images/:entityType/:entityId - Get images for an entity
 * - GET    /images/id/:imageId         - Get image by ID
 * - PUT    /images/id/:imageId         - Update image metadata
 * - DELETE /images/id/:imageId         - Delete image (soft delete)
 * - GET    /images/limits/:entityType  - Get image limits for entity type
 * - POST   /images/id/:imageId/presign - Generate pre-signed URL for S3 upload
 * - POST   /images/id/:imageId/confirm-upload - Confirm image upload completion (REQUIRED after S3 upload)
 * 
 * Authorization:
 * - All endpoints require authentication
 * - Role-based access control enforced in service layer
 */

const express = require('express');
const router = express.Router();
const imageController = require('../../controllers/imageController');
const imageModerationController = require('../../controllers/imageModerationController');
const { authenticate } = require('../../middleware/auth');
const { requirePlatformAdmin } = require('../../middleware/authorization');
const { requireCompleteProfile } = require('../../middleware/profileCompleteness');

// All routes require authentication
// Specific routes must come before parameterized routes to avoid conflicts
// Profile image operations are allowed for incomplete profiles (needed for completion)
router.put('/profile/user/:userId', authenticate, imageController.replaceProfileImage);
router.post('/id/:imageId/presign', authenticate, imageController.generatePresignedUrl); // Allow for profile images
router.post('/id/:imageId/confirm-upload', authenticate, imageController.confirmUpload); // Allow for profile images

// All other image operations require complete profile
router.post('/', authenticate, requireCompleteProfile, imageController.createImage);
router.get('/limits/:entityType', authenticate, requireCompleteProfile, imageController.getImageLimits);
router.get('/:entityType/:entityId', authenticate, requireCompleteProfile, imageController.getEntityImages);
// :imageId routes (must come after :entityType/:entityId to avoid conflicts)
router.get('/id/:imageId', authenticate, requireCompleteProfile, imageController.getImageById);
router.put('/id/:imageId', authenticate, requireCompleteProfile, imageController.updateImage);
router.delete('/id/:imageId', authenticate, requireCompleteProfile, imageController.deleteImage);

// Admin moderation routes (require platform_admin role and complete profile)
router.get('/moderation/pending', authenticate, requireCompleteProfile, requirePlatformAdmin, imageModerationController.getPendingModeration);
router.get('/moderation/stats', authenticate, requireCompleteProfile, requirePlatformAdmin, imageModerationController.getModerationStats);
router.post('/moderation/:imageId/approve', authenticate, requireCompleteProfile, requirePlatformAdmin, imageModerationController.approveImage);
router.post('/moderation/:imageId/reject', authenticate, requireCompleteProfile, requirePlatformAdmin, imageModerationController.rejectImage);

module.exports = router;

