/**
 * Image Service
 * 
 * Business logic for image management.
 * Handles validation, role-based access control, and image limits.
 * 
 * NOTE: This service currently handles image metadata only.
 * Actual file uploads and S3 integration will be added later.
 * 
 * Image Limits (per entity):
 * - User profile: 1 image
 * - User gallery: 10 max
 * - Facility profile: 1 image
 * - Facility cover: 1 image
 * - Facility gallery: 20 max
 * - Court main: 1 image
 * - Court gallery: 10 max
 * - Sport icon: 1 image
 * - Sport banner: 1 image
 * - Review images: 5 max per review
 * 
 * Limits are enforced at image creation time to prevent abuse.
 */

const Image = require('../models/Image');
const User = require('../models/User');
const Facility = require('../models/Facility');
const Court = require('../models/Court');
const Sport = require('../models/Sport');
const Booking = require('../models/Booking');
const { deleteImageFromS3 } = require('./s3Service');

// Image limits configuration
const IMAGE_LIMITS = {
  user: {
    profile: 1,
    gallery: 10
  },
  facility: {
    profile: 1,
    cover: 1,
    gallery: 20
  },
  court: {
    main: 1,
    gallery: 10
  },
  sport: {
    icon: 1,
    banner: 1
  },
  review: {
    gallery: 5
  },
  booking: {
    payment_proof: 1  // Only one payment proof per booking
  }
};

// Single-image types (must be primary and only one allowed)
const SINGLE_IMAGE_TYPES = ['profile', 'cover', 'icon', 'banner', 'main', 'payment_proof'];

/**
 * Validate image creation request
 * Note: For single-image types, existing images will be automatically replaced
 * @param {Object} imageData - Image data
 * @param {number} userId - User ID making the request
 * @param {string} userRole - User role
 * @returns {Promise<Object|null>} Existing image to replace (if any), or null
 * @throws {Error} If validation fails
 */
const validateImageCreation = async (imageData, userId, userRole) => {
  const { entityType, entityId, imageType } = imageData;

  // Validate entity exists and user has permission
  await validateEntityAccess(entityType, entityId, userId, userRole, imageType);

  // Check image limits (for gallery types, not single-image types)
  // Single-image types are handled by replacement logic
  if (!SINGLE_IMAGE_TYPES.includes(imageType)) {
    await checkImageLimits(entityType, entityId, imageType);
  }

  // For single-image types, return existing image for replacement
  // Don't throw error - we'll replace it automatically
  // We need to find ANY image with is_primary = TRUE, regardless of status,
  // because the unique constraint only checks is_primary = TRUE
  if (SINGLE_IMAGE_TYPES.includes(imageType)) {
    let existing = await Image.getPrimaryImage(entityType, entityId, imageType);
    
    // If getPrimaryImage didn't find it (due to filters), query directly for any primary image
    // This handles old accounts where images might be inactive or rejected
    if (!existing) {
      const { pool } = require('../config/database');
      const directQuery = `
        SELECT id
        FROM images
        WHERE entity_type = $1 
          AND entity_id = $2 
          AND image_type = $3 
          AND is_primary = TRUE
        LIMIT 1
      `;
      const result = await pool.query(directQuery, [entityType, entityId, imageType]);
      if (result.rows.length > 0) {
        // Use findById to get the properly formatted image object
        existing = await Image.findById(result.rows[0].id);
      }
    }
    
    return existing; // Return existing image or null
  }

  return null; // No existing image to replace
};

/**
 * Validate entity access (ownership/permissions)
 * @param {string} entityType - Entity type
 * @param {number} entityId - Entity ID
 * @param {number} userId - User ID
 * @param {string} userRole - User role
 * @param {string} [imageType] - Image type (optional, needed for booking validation)
 * @returns {Promise<void>}
 * @throws {Error} If user doesn't have access
 */
const validateEntityAccess = async (entityType, entityId, userId, userRole, imageType = null) => {
  switch (entityType) {
    case 'user':
      // Users can only upload images for themselves
      if (parseInt(entityId, 10) !== userId) {
        const error = new Error('You can only upload images for your own profile');
        error.statusCode = 403;
        error.errorCode = 'FORBIDDEN';
        throw error;
      }
      // Verify user exists
      const user = await User.findById(entityId);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        error.errorCode = 'USER_NOT_FOUND';
        throw error;
      }
      break;

    case 'facility':
      // Only facility owners can upload facility images
      if (userRole !== 'facility_admin' && userRole !== 'platform_admin') {
        const error = new Error('Only facility owners can upload facility images');
        error.statusCode = 403;
        error.errorCode = 'FORBIDDEN';
        throw error;
      }
      // Verify facility exists and user is owner
      const facility = await Facility.findById(entityId);
      if (!facility) {
        const error = new Error('Facility not found');
        error.statusCode = 404;
        error.errorCode = 'FACILITY_NOT_FOUND';
        throw error;
      }
      if (facility.ownerId !== userId && userRole !== 'platform_admin') {
        const error = new Error('You can only upload images for facilities you own');
        error.statusCode = 403;
        error.errorCode = 'FORBIDDEN';
        throw error;
      }
      break;

    case 'court':
      // Only facility owners can upload court images
      if (userRole !== 'facility_admin' && userRole !== 'platform_admin') {
        const error = new Error('Only facility owners can upload court images');
        error.statusCode = 403;
        error.errorCode = 'FORBIDDEN';
        throw error;
      }
      // Verify court exists and user owns the facility
      const court = await Court.findById(entityId);
      if (!court) {
        const error = new Error('Court not found');
        error.statusCode = 404;
        error.errorCode = 'COURT_NOT_FOUND';
        throw error;
      }
      const courtFacility = await Facility.findById(court.facilityId);
      if (!courtFacility) {
        const error = new Error('Facility not found');
        error.statusCode = 404;
        error.errorCode = 'FACILITY_NOT_FOUND';
        throw error;
      }
      if (courtFacility.ownerId !== userId && userRole !== 'platform_admin') {
        const error = new Error('You can only upload images for courts in facilities you own');
        error.statusCode = 403;
        error.errorCode = 'FORBIDDEN';
        throw error;
      }
      break;

    case 'sport':
      // Only platform admins can upload sport images
      if (userRole !== 'platform_admin') {
        const error = new Error('Only platform admins can upload sport images');
        error.statusCode = 403;
        error.errorCode = 'FORBIDDEN';
        throw error;
      }
      // Verify sport exists
      const sport = await Sport.findById(entityId);
      if (!sport) {
        const error = new Error('Sport not found');
        error.statusCode = 404;
        error.errorCode = 'SPORT_NOT_FOUND';
        throw error;
      }
      break;

    case 'review':
      // Users can upload review images (ownership validated in review system)
      // For now, allow any authenticated user
      break;

    case 'booking':
      // Users can upload payment proof for their own bookings
      // Verify booking exists and user owns it
      const booking = await Booking.findById(entityId);
      if (!booking) {
        const error = new Error('Booking not found');
        error.statusCode = 404;
        error.errorCode = 'BOOKING_NOT_FOUND';
        throw error;
      }
      if (booking.userId !== userId) {
        const error = new Error('You can only upload payment proof for your own bookings');
        error.statusCode = 403;
        error.errorCode = 'FORBIDDEN';
        throw error;
      }
      // Only allow payment_proof image type for bookings
      if (imageType !== 'payment_proof') {
        const error = new Error('Only payment_proof image type is allowed for bookings');
        error.statusCode = 400;
        error.errorCode = 'INVALID_IMAGE_TYPE';
        throw error;
      }
      break;

    default:
      const error = new Error(`Invalid entity type: ${entityType}`);
      error.statusCode = 400;
      error.errorCode = 'VALIDATION_ERROR';
      throw error;
  }
};

/**
 * Check if image limit is reached for an entity
 * Enforces upload limits to prevent abuse
 * 
 * @param {string} entityType - Entity type
 * @param {number} entityId - Entity ID
 * @param {string} imageType - Image type
 * @returns {Promise<void>}
 * @throws {Error} If limit is reached
 */
const checkImageLimits = async (entityType, entityId, imageType) => {
  const limits = IMAGE_LIMITS[entityType];
  if (!limits || !limits[imageType]) {
    // No limit defined, allow unlimited
    return;
  }

  const limit = limits[imageType];
  
  // Count only active images (is_active = true)
  // This ensures deleted images don't count toward the limit
  const currentCount = await Image.countByEntity(entityType, entityId, imageType, true);

  if (currentCount >= limit) {
    // Build user-friendly error message
    const entityDisplayName = entityType.charAt(0).toUpperCase() + entityType.slice(1);
    const imageTypeDisplayName = imageType.charAt(0).toUpperCase() + imageType.slice(1);
    
    const error = new Error(
      `Image limit reached. Maximum ${limit} ${imageTypeDisplayName} image${limit > 1 ? 's' : ''} allowed per ${entityDisplayName}. ` +
      `Please delete an existing ${imageType} image before uploading a new one.`
    );
    error.statusCode = 400;
    error.errorCode = 'IMAGE_LIMIT_REACHED';
    error.details = {
      entityType,
      entityId,
      imageType,
      limit,
      currentCount
    };
    throw error;
  }
};

/**
 * Create image record
 * Automatically replaces existing single-image types (profile, cover, icon, banner, main)
 * @param {Object} imageData - Image data
 * @param {number} userId - User ID creating the image
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Created image object
 * @throws {Error} If validation fails
 */
const createImage = async (imageData, userId, userRole) => {
  const { entityType, entityId, imageType } = imageData;

  // Validate request and get existing image (if any) for single-image types
  const existingImage = await validateImageCreation(imageData, userId, userRole);

  // If this is a single-image type and one already exists, replace it
  if (existingImage && SINGLE_IMAGE_TYPES.includes(imageType)) {
    // Update old image: set is_active = false AND is_primary = false
    // This is necessary because the unique constraint idx_images_single_primary
    // only applies to rows where is_primary = TRUE
    const updatedImage = await Image.update(existingImage.id, {
      isActive: false,
      isPrimary: false
    });

    // Verify the update succeeded
    if (!updatedImage || updatedImage.isPrimary !== false) {
      console.error(`[Image Replacement] Warning: Failed to set is_primary = false for image ${existingImage.id}`);
      // Try direct SQL update as fallback
      const { pool } = require('../config/database');
      await pool.query(
        'UPDATE images SET is_primary = FALSE, is_active = FALSE WHERE id = $1',
        [existingImage.id]
      );
    }

    // Delete the old file from S3 (non-blocking - won't fail if S3 delete fails)
    if (existingImage.s3Key) {
      await deleteImageFromS3(existingImage.s3Key);
    }

    console.log(`[Image Replacement] Replaced ${imageType} image for ${entityType} ${entityId}. Old image ID: ${existingImage.id}`);
  }

  // Set isPrimary for single-image types
  const isPrimary = SINGLE_IMAGE_TYPES.includes(imageType);

  // Create new image record
  const image = await Image.create({
    ...imageData,
    createdBy: userId,
    isPrimary
  });

  return image;
};

/**
 * Get images for an entity
 * @param {string} entityType - Entity type
 * @param {number} entityId - Entity ID
 * @param {Object} [options={}] - Query options
 * @param {string} [options.imageType] - Filter by image type
 * @returns {Promise<Array>} Array of image objects
 */
const getEntityImages = async (entityType, entityId, options = {}) => {
  return Image.findByEntity(entityType, entityId, options);
};

/**
 * Get image by ID
 * @param {string} imageId - Image UUID
 * @returns {Promise<Object>} Image object
 * @throws {Error} If image not found
 */
const getImageById = async (imageId) => {
  const image = await Image.findById(imageId);
  if (!image) {
    const error = new Error('Image not found');
    error.statusCode = 404;
    error.errorCode = 'IMAGE_NOT_FOUND';
    throw error;
  }
  return image;
};

/**
 * Update image
 * @param {string} imageId - Image UUID
 * @param {Object} updateData - Fields to update
 * @param {number} userId - User ID making the request
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Updated image object
 * @throws {Error} If validation fails
 */
const updateImage = async (imageId, updateData, userId, userRole) => {
  // Get existing image
  const image = await getImageById(imageId);

  // Validate access
  await validateEntityAccess(image.entityType, image.entityId, userId, userRole);

  // Update image
  const updatedImage = await Image.update(imageId, updateData);

  return updatedImage;
};

/**
 * Delete image (soft delete)
 * @param {string} imageId - Image UUID
 * @param {number} userId - User ID making the request
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Deleted image object
 * @throws {Error} If validation fails
 */
const deleteImage = async (imageId, userId, userRole) => {
  // Get existing image
  const image = await getImageById(imageId);

  // Validate access
  await validateEntityAccess(image.entityType, image.entityId, userId, userRole);

  // Soft delete
  const deletedImage = await Image.delete(imageId);

  return deletedImage;
};

/**
 * Get image limits for an entity type
 * @param {string} entityType - Entity type
 * @returns {Object} Image limits object
 */
const getImageLimits = (entityType) => {
  return IMAGE_LIMITS[entityType] || {};
};

/**
 * Replace profile image for a user
 * This is a convenience function that finds and deletes existing profile image,
 * then creates a new image record ready for upload.
 * 
 * @param {number} userId - User ID whose profile image to replace
 * @param {number} requestingUserId - User ID making the request
 * @param {string} userRole - User role
 * @param {Object} [imageData={}] - Additional image data (displayOrder, metadata)
 * @returns {Promise<Object>} New image record ready for upload
 * @throws {Error} If validation fails
 */
const replaceProfileImage = async (userId, requestingUserId, userRole, imageData = {}) => {
  // Validate that user can only replace their own profile image
  if (parseInt(userId, 10) !== requestingUserId) {
    const error = new Error('You can only replace your own profile image');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Verify user exists
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.errorCode = 'USER_NOT_FOUND';
    throw error;
  }

  // Find existing profile image - we need to find ANY image with is_primary = TRUE
  // regardless of is_active, is_deleted, or moderation_status, because the unique
  // constraint idx_images_single_primary only checks is_primary = TRUE
  // This handles old accounts that might have inactive/rejected images
  let existingImage = await Image.getPrimaryImage('user', userId, 'profile');
  
  // If getPrimaryImage didn't find it (due to filters), query directly for any primary image
  // This is necessary for old accounts where images might be inactive or rejected
  if (!existingImage) {
    const { pool } = require('../config/database');
    const directQuery = `
      SELECT id
      FROM images
      WHERE entity_type = $1 
        AND entity_id = $2 
        AND image_type = $3 
        AND is_primary = TRUE
      LIMIT 1
    `;
    const result = await pool.query(directQuery, ['user', userId, 'profile']);
    if (result.rows.length > 0) {
      // Use findById to get the properly formatted image object
      existingImage = await Image.findById(result.rows[0].id);
    }
  }

  // If existing image found (active or inactive), update it
  if (existingImage) {
    // Update old image: set is_active = false AND is_primary = false
    // This is necessary because the unique constraint idx_images_single_primary
    // only applies to rows where is_primary = TRUE
    const updatedImage = await Image.update(existingImage.id, {
      isActive: false,
      isPrimary: false
    });

    // Verify the update succeeded
    if (!updatedImage || updatedImage.isPrimary !== false) {
      console.error(`[Profile Image Replacement] Warning: Failed to set is_primary = false for image ${existingImage.id}`);
      // Try direct SQL update as fallback
      const { pool } = require('../config/database');
      await pool.query(
        'UPDATE images SET is_primary = FALSE, is_active = FALSE WHERE id = $1',
        [existingImage.id]
      );
    }

    // Delete the old file from S3 (non-blocking - won't fail if S3 delete fails)
    if (existingImage.s3Key) {
      await deleteImageFromS3(existingImage.s3Key);
    }

    console.log(`[Profile Image Replacement] Replaced profile image for user ${userId}. Old image ID: ${existingImage.id}`);
  }

  // Create new image record
  const newImage = await Image.create({
    entityType: 'user',
    entityId: userId,
    imageType: 'profile',
    createdBy: requestingUserId,
    isPrimary: true,
    displayOrder: imageData.displayOrder || 0,
    metadata: imageData.metadata || {}
  });

  return newImage;
};

module.exports = {
  createImage,
  getEntityImages,
  getImageById,
  updateImage,
  deleteImage,
  getImageLimits,
  replaceProfileImage,
  validateEntityAccess, // Exported for use in controllers
  IMAGE_LIMITS,
  SINGLE_IMAGE_TYPES
};

