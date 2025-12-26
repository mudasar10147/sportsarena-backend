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

// All routes require authentication
// Specific routes must come before parameterized routes to avoid conflicts
router.post('/', authenticate, imageController.createImage);
router.get('/limits/:entityType', authenticate, imageController.getImageLimits);
// Profile image replacement route (must come before :entityType/:entityId to avoid conflicts)
router.put('/profile/user/:userId', authenticate, imageController.replaceProfileImage);
router.get('/:entityType/:entityId', authenticate, imageController.getEntityImages);
// :imageId routes (must come after :entityType/:entityId to avoid conflicts)
router.get('/id/:imageId', authenticate, imageController.getImageById);
router.put('/id/:imageId', authenticate, imageController.updateImage);
router.delete('/id/:imageId', authenticate, imageController.deleteImage);
// S3 upload routes
router.post('/id/:imageId/presign', authenticate, imageController.generatePresignedUrl);
router.post('/id/:imageId/confirm-upload', authenticate, imageController.confirmUpload);

// Admin moderation routes (require platform_admin role)
router.get('/moderation/pending', authenticate, requirePlatformAdmin, imageModerationController.getPendingModeration);
router.get('/moderation/stats', authenticate, requirePlatformAdmin, imageModerationController.getModerationStats);
router.post('/moderation/:imageId/approve', authenticate, requirePlatformAdmin, imageModerationController.approveImage);
router.post('/moderation/:imageId/reject', authenticate, requirePlatformAdmin, imageModerationController.rejectImage);

module.exports = router;

