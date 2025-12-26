/**
 * Image Controller
 * 
 * Handles HTTP requests for image management.
 * 
 * NOTE: This controller currently handles image metadata only.
 * Actual file uploads and S3 integration will be added later.
 * 
 * Current flow:
 * 1. Client registers intent to upload (POST /images)
 * 2. Backend creates image record and returns imageId
 * 3. Future: Client uploads file to S3 using pre-signed URL
 * 4. Future: Client updates image record with storage_key/url
 */

const imageService = require('../services/imageService');
const s3Service = require('../services/s3Service');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError
} = require('../utils/response');

/**
 * Create image record (register intent to upload)
 * POST /api/v1/images
 * 
 * This endpoint creates an image record in the database.
 * The actual file upload will happen via S3 pre-signed URLs (to be implemented).
 * 
 * Request body:
 * {
 *   "entityType": "facility",
 *   "entityId": 1,
 *   "imageType": "gallery",
 *   "displayOrder": 0,
 *   "metadata": {}
 * }
 */
const createImage = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userRole = req.user.role;
    const { entityType, entityId, imageType, displayOrder, metadata } = req.body;

    // Validation
    if (!entityType || !entityId || !imageType) {
      return sendValidationError(res, 'Missing required fields: entityType, entityId, imageType');
    }

    const validEntityTypes = ['user', 'facility', 'court', 'sport', 'review'];
    if (!validEntityTypes.includes(entityType)) {
      return sendValidationError(
        res,
        `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`
      );
    }

    const validImageTypes = ['profile', 'cover', 'gallery', 'icon', 'banner', 'main'];
    if (!validImageTypes.includes(imageType)) {
      return sendValidationError(
        res,
        `Invalid imageType. Must be one of: ${validImageTypes.join(', ')}`
      );
    }

    const parsedEntityId = parseInt(entityId, 10);
    if (isNaN(parsedEntityId)) {
      return sendValidationError(res, 'Invalid entityId. Must be a number.');
    }

    // Create image record
    const image = await imageService.createImage(
      {
        entityType,
        entityId: parsedEntityId,
        imageType,
        displayOrder: displayOrder || 0,
        metadata: metadata || {}
      },
      userId,
      userRole
    );

    return sendCreated(res, image, 'Image record created successfully. Ready for file upload.');
  } catch (error) {
    next(error);
  }
};

/**
 * Get images for an entity
 * GET /api/v1/images/:entityType/:entityId
 * 
 * Returns all images for a specific entity.
 * Optionally filter by imageType using query parameter.
 */
const getEntityImages = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { imageType } = req.query;

    // Validation
    const validEntityTypes = ['user', 'facility', 'court', 'sport', 'review'];
    if (!validEntityTypes.includes(entityType)) {
      return sendValidationError(
        res,
        `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`
      );
    }

    const parsedEntityId = parseInt(entityId, 10);
    if (isNaN(parsedEntityId)) {
      return sendValidationError(res, 'Invalid entityId. Must be a number.');
    }

    // Get images
    const images = await imageService.getEntityImages(entityType, parsedEntityId, { imageType });

    return sendSuccess(res, images, 'Images retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get image by ID
 * GET /api/v1/images/id/:imageId
 */
const getImageById = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    if (!imageId) {
      return sendValidationError(res, 'Image ID is required');
    }

    const image = await imageService.getImageById(imageId);

    return sendSuccess(res, image, 'Image retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update image
 * PUT /api/v1/images/id/:imageId
 * 
 * Updates image metadata.
 * Used to update storage_key and url after S3 upload (future implementation).
 */
const updateImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const userId = req.userId;
    const userRole = req.user.role;
    const { storageKey, url, displayOrder, metadata, isActive } = req.body;

    if (!imageId) {
      return sendValidationError(res, 'Image ID is required');
    }

    // Build update data
    const updateData = {};
    if (storageKey !== undefined) updateData.storageKey = storageKey;
    if (url !== undefined) updateData.url = url;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length === 0) {
      return sendValidationError(res, 'No fields to update');
    }

    const image = await imageService.updateImage(imageId, updateData, userId, userRole);

    return sendSuccess(res, image, 'Image updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete image (soft delete)
 * DELETE /api/v1/images/id/:imageId
 */
const deleteImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const userId = req.userId;
    const userRole = req.user.role;

    if (!imageId) {
      return sendValidationError(res, 'Image ID is required');
    }

    const image = await imageService.deleteImage(imageId, userId, userRole);

    return sendSuccess(res, image, 'Image deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get image limits for an entity type
 * GET /api/v1/images/limits/:entityType
 * 
 * Returns the maximum number of images allowed per type for an entity.
 */
const getImageLimits = async (req, res, next) => {
  try {
    const { entityType } = req.params;

    const validEntityTypes = ['user', 'facility', 'court', 'sport', 'review'];
    if (!validEntityTypes.includes(entityType)) {
      return sendValidationError(
        res,
        `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`
      );
    }

    const limits = imageService.getImageLimits(entityType);

    return sendSuccess(res, limits, 'Image limits retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Generate pre-signed URL for image upload
 * POST /api/v1/images/id/:imageId/presign
 * 
 * Generates a pre-signed URL that allows direct client-to-S3 upload.
 * The client uses this URL to upload the image file directly to S3.
 * 
 * Security:
 * - Validates user has permission to upload this image
 * - Enforces allowed MIME types (image/jpeg, image/png, image/webp)
 * - Pre-signed URL expires in 5 minutes
 * - Content-Type is enforced in the pre-signed URL
 * 
 * Request Body:
 * {
 *   "contentType": "image/jpeg"
 * }
 * 
 * Response:
 * {
 *   "uploadUrl": "https://...",  // Pre-signed S3 URL for PUT upload
 *   "s3Key": "facility/1/uuid.jpg",  // S3 object key (stored in database)
 *   "publicUrl": "https://cdn.example.com/facility/1/uuid.jpg",  // Public CDN URL (for frontend use after upload)
 *   "expiresIn": 300,
 *   "maxFileSize": 5242880
 * }
 */
const generatePresignedUrl = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const userId = req.userId;
    const userRole = req.user.role;
    const { contentType } = req.body;

    // Validation
    if (!imageId) {
      return sendValidationError(res, 'Image ID is required');
    }

    if (!contentType) {
      return sendValidationError(res, 'Content type is required');
    }

    // Get image to validate ownership
    const image = await imageService.getImageById(imageId);

    // Validate user has permission to upload this image
    // This uses the same validation as imageService.validateEntityAccess
    await imageService.validateEntityAccess(
      image.entityType,
      image.entityId,
      userId,
      userRole
    );

    // Generate pre-signed URL
    const presignedData = await s3Service.generatePresignedUploadUrl(
      imageId,
      contentType,
      userId
    );

    return sendSuccess(res, presignedData, 'Pre-signed URL generated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm image upload completion
 * POST /api/v1/images/id/:imageId/confirm-upload
 * 
 * Called by client after successful S3 upload to finalize image record.
 * 
 * Backend Responsibilities:
 * - Validates image record exists
 * - Validates requesting user owns the image
 * - Validates upload_status is 'pending' (prevents duplicate confirmations)
 * - Updates upload_status → 'uploaded'
 * - Updates uploaded_at → current timestamp
 * - Updates file_size and content_type
 * 
 * Request Body:
 * {
 *   "fileSize": 245678,
 *   "contentType": "image/webp"
 * }
 * 
 * Note: This endpoint is REQUIRED after successful S3 upload.
 * The image record remains in 'pending' status until this is called.
 * 
 * Future: Can be automated via S3 event triggers (Lambda) for server-side confirmation.
 */
const confirmUpload = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const userId = req.userId;
    const userRole = req.user.role;
    const { fileSize, contentType } = req.body;

    // Validation
    if (!imageId) {
      return sendValidationError(res, 'Image ID is required');
    }

    // Get image to validate ownership
    const image = await imageService.getImageById(imageId);

    // Validate user has permission to confirm this upload
    await imageService.validateEntityAccess(
      image.entityType,
      image.entityId,
      userId,
      userRole
    );

    // Confirm upload (validates upload_status and updates record)
    const updatedImage = await s3Service.confirmUpload(imageId, fileSize, contentType);

    return sendSuccess(res, updatedImage, 'Image upload confirmed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Replace user profile image
 * PUT /api/v1/images/profile/user/:userId
 * 
 * Replaces existing profile image for a user.
 * This endpoint:
 * 1. Finds and deletes existing profile image (if any)
 * 2. Creates a new image record ready for upload
 * 3. Returns the new imageId for the upload flow
 * 
 * This is a convenience endpoint that combines delete + create into a single operation.
 * After calling this endpoint, follow the standard upload flow:
 * - POST /api/v1/images/id/:imageId/presign (get pre-signed URL)
 * - PUT <pre-signed-url> (upload to S3)
 * - POST /api/v1/images/id/:imageId/confirm-upload (confirm upload)
 * 
 * Request Body (optional):
 * {
 *   "displayOrder": 0,
 *   "metadata": {}
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Profile image replacement initiated. Ready for upload.",
 *   "data": {
 *     "id": "550e8400-e29b-41d4-a716-446655440000",
 *     "entityType": "user",
 *     "entityId": 1,
 *     "imageType": "profile",
 *     "uploadStatus": "pending",
 *     ...
 *   }
 * }
 */
const replaceProfileImage = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.userId;
    const userRole = req.user.role;
    const { displayOrder, metadata } = req.body;

    // Validation
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      return sendValidationError(res, 'Invalid userId. Must be a number.');
    }

    // Replace profile image (validates ownership and creates new record)
    const newImage = await imageService.replaceProfileImage(
      parsedUserId,
      requestingUserId,
      userRole,
      {
        displayOrder,
        metadata
      }
    );

    return sendCreated(res, newImage, 'Profile image replacement initiated. Ready for upload.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createImage,
  getEntityImages,
  getImageById,
  updateImage,
  deleteImage,
  getImageLimits,
  generatePresignedUrl,
  confirmUpload,
  replaceProfileImage
};

