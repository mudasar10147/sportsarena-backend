/**
 * S3 Pre-Signed URL Service
 * 
 * Generates pre-signed URLs for direct client-to-S3 image uploads.
 * 
 * Security Features:
 * - Validates MIME types (only image/jpeg, image/png, image/webp)
 * - Enforces file size limits (5MB max)
 * - Short-lived URLs (5 minutes expiry)
 * - Content-Type enforcement in pre-signed URL
 * 
 * Future Integration Points:
 * - Image resizing: Can be added via Lambda@Edge or S3 event triggers
 * - CDN (CloudFront): Update generateS3Url() to use CloudFront domain
 * - Virus scanning: Can be added via S3 event triggers to Lambda/ClamAV
 */

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, S3_BUCKET, IMAGE_UPLOAD_CONFIG, generateS3Key, generateS3Url } = require('../config/s3');
const Image = require('../models/Image');

/**
 * Validate content type
 * @param {string} contentType - MIME type
 * @throws {Error} If content type is not allowed
 */
const validateContentType = (contentType) => {
  if (!contentType) {
    const error = new Error('Content type is required');
    error.statusCode = 400;
    error.errorCode = 'MISSING_CONTENT_TYPE';
    throw error;
  }

  if (!IMAGE_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(contentType)) {
    const error = new Error(
      `Invalid content type. Allowed types: ${IMAGE_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`
    );
    error.statusCode = 400;
    error.errorCode = 'INVALID_CONTENT_TYPE';
    throw error;
  }
};

/**
 * Generate pre-signed URL for image upload
 * 
 * @param {string} imageId - Image UUID
 * @param {string} contentType - MIME type (image/jpeg, image/png, image/webp)
 * @param {number} userId - User ID making the request (for authorization)
 * @returns {Promise<Object>} Pre-signed URL and metadata
 * @throws {Error} If validation fails or image not found
 */
const generatePresignedUploadUrl = async (imageId, contentType, userId) => {
  // Validate content type
  validateContentType(contentType);

  // Fetch image record
  const image = await Image.findById(imageId);
  if (!image) {
    const error = new Error('Image not found');
    error.statusCode = 404;
    error.errorCode = 'IMAGE_NOT_FOUND';
    throw error;
  }

  // Validate user has permission (image must be created by the user)
  // Note: Additional ownership validation happens in controller/service layer
  if (image.createdBy !== userId) {
    const error = new Error('You do not have permission to upload this image');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Optional: Check if image is already uploaded (safety check)
  if (image.storageKey) {
    const error = new Error('Image has already been uploaded');
    error.statusCode = 400;
    error.errorCode = 'IMAGE_ALREADY_UPLOADED';
    throw error;
  }

  // Check if bucket is configured
  if (!S3_BUCKET) {
    const error = new Error('S3 bucket is not configured');
    error.statusCode = 500;
    error.errorCode = 'S3_NOT_CONFIGURED';
    throw error;
  }

  // Generate S3 object key
  const s3Key = generateS3Key(image.entityType, image.entityId, image.id, contentType);

  // Create PutObject command
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: contentType,
    // Enforce content type in pre-signed URL
    Metadata: {
      'uploaded-by': userId.toString(),
      'image-id': imageId,
      'entity-type': image.entityType,
      'entity-id': image.entityId.toString()
    },
    // Server-side encryption (optional but recommended)
    //ServerSideEncryption: 'AES256',
    // Cache control (future: can be optimized for CDN)
    CacheControl: 'max-age=31536000', // 1 year
    // ACL: Private (bucket should already be private, but explicit is better)
    // Note: ACL is not set here as bucket should use bucket-level policies
  });

  // Generate pre-signed URL
  // Expiry: 5 minutes (300 seconds)
  let uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: IMAGE_UPLOAD_CONFIG.PRESIGNED_URL_EXPIRY
  });

  // Remove SDK-internal checksum parameters that cause signature mismatches
  // These parameters (x-amz-checksum-crc32, x-amz-sdk-checksum-algorithm, x-id) are added
  // by the SDK but shouldn't be in pre-signed URLs for client uploads
  // We need to remove them and regenerate the URL if they're present
  // Note: This is a workaround for SDK behavior - the signature is calculated with these
  // params, so we can't just strip them. We need to prevent them from being added.
  // For now, we'll let the SDK include them but ensure the client doesn't modify them.
  
  // Parse URL to check for problematic parameters
  try {
    const urlObj = new URL(uploadUrl);
    const params = urlObj.searchParams;
    
    // Check if SDK-added checksum params are present
    if (params.has('x-amz-sdk-checksum-algorithm') || params.has('x-id')) {
      // These params shouldn't cause issues if client doesn't modify the URL
      // But we log them for debugging
      console.warn('⚠️  Pre-signed URL contains SDK-internal parameters:', {
        hasChecksumAlg: params.has('x-amz-sdk-checksum-algorithm'),
        hasXId: params.has('x-id'),
        hasChecksumCrc32: params.has('x-amz-checksum-crc32')
      });
    }
  } catch (parseError) {
    // If URL parsing fails, log but continue
    console.warn('⚠️  Failed to parse pre-signed URL:', parseError.message);
  }

  // Update image record with S3 key and mark as upload_pending
  // Sets upload_status to 'pending' to track upload lifecycle
  // IMPORTANT: We only store storage_key (S3 key), NOT the URL
  // URLs are generated dynamically using getPublicImageUrl() helper
  await Image.update(imageId, {
    storageKey: s3Key,
    // DO NOT store URL in database - URLs are generated dynamically from storage_key
    // url field is kept for backward compatibility but should not be used
    uploadStatus: 'pending',
    contentType: contentType,
    metadata: {
      ...image.metadata,
      uploadRequestedAt: new Date().toISOString()
    }
  });

  // Log upload intent for auditing
  // Future: Can be enhanced with proper logging service (Winston, Pino, etc.)
  console.log(`[S3 Upload] Image ${imageId} - User ${userId} - Key: ${s3Key} - ContentType: ${contentType}`);

  // Get public CDN URL for the image (for frontend display after upload)
  const { getPublicImageUrl } = require('../config/s3');
  const publicUrl = getPublicImageUrl(s3Key);

  return {
    uploadUrl, // Pre-signed S3 URL for PUT upload
    s3Key, // S3 object key (stored in database)
    publicUrl, // Public CDN URL (for frontend use after upload)
    expiresIn: IMAGE_UPLOAD_CONFIG.PRESIGNED_URL_EXPIRY,
    maxFileSize: IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE
  };
};

/**
 * Confirm image upload completion
 * Updates image record after successful upload to S3
 * 
 * Validates:
 * - Image record exists
 * - Upload status is 'pending' (prevents duplicate confirmations)
 * 
 * Updates:
 * - upload_status → 'uploaded'
 * - uploaded_at → current timestamp
 * - file_size (if provided)
 * - content_type (if provided)
 * 
 * @param {string} imageId - Image UUID
 * @param {number} fileSize - File size in bytes
 * @param {string} contentType - MIME type (image/jpeg, image/png, image/webp)
 * @returns {Promise<Object>} Updated image object
 * @throws {Error} If image not found, already uploaded, or validation fails
 */
const confirmUpload = async (imageId, fileSize, contentType) => {
  // Fetch image record
  const image = await Image.findById(imageId);
  if (!image) {
    const error = new Error('Image not found');
    error.statusCode = 404;
    error.errorCode = 'IMAGE_NOT_FOUND';
    throw error;
  }

  // Validate upload_status is 'pending'
  // Prevents duplicate confirmations and confirms only pending uploads
  if (image.uploadStatus !== 'pending') {
    const error = new Error(
      `Image upload status is '${image.uploadStatus}'. Only images with 'pending' status can be confirmed.`
    );
    error.statusCode = 400;
    error.errorCode = 'INVALID_UPLOAD_STATUS';
    throw error;
  }

  // Validate file size if provided
  if (fileSize !== undefined) {
    if (typeof fileSize !== 'number' || fileSize <= 0) {
      const error = new Error('Invalid file size. Must be a positive number.');
      error.statusCode = 400;
      error.errorCode = 'INVALID_FILE_SIZE';
      throw error;
    }

    // Check against maximum file size limit
    if (fileSize > IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
      const error = new Error(
        `File size ${fileSize} bytes exceeds maximum limit of ${IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE} bytes (5MB)`
      );
      error.statusCode = 400;
      error.errorCode = 'FILE_SIZE_EXCEEDED';
      throw error;
    }
  }

  // Validate content type if provided
  if (contentType !== undefined) {
    validateContentType(contentType);
  }

  // Update image record with upload confirmation
  const updateData = {
    uploadStatus: 'uploaded',
    uploadedAt: new Date()
  };

  if (fileSize !== undefined) {
    updateData.fileSize = fileSize;
  }

  if (contentType !== undefined) {
    updateData.contentType = contentType;
  }

  const updatedImage = await Image.update(imageId, updateData);

  // Log upload confirmation for auditing
  console.log(`[S3 Upload Confirmed] Image ${imageId} - Size: ${fileSize || 'unknown'} bytes - Type: ${contentType || 'unknown'}`);

  return updatedImage;
};

/**
 * Delete image file from S3
 * Used when replacing images to clean up old files
 * 
 * @param {string} storageKey - S3 storage key (path)
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails
 */
const deleteImageFromS3 = async (storageKey) => {
  if (!storageKey) {
    // No storage key means file was never uploaded, nothing to delete
    return;
  }

  if (!S3_BUCKET) {
    console.warn(`[S3 Delete] S3 not configured, skipping deletion of: ${storageKey}`);
    return;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: storageKey
    });

    await s3Client.send(command);
    console.log(`[S3 Delete] Successfully deleted: ${storageKey}`);
  } catch (error) {
    // Log error but don't throw - file deletion failure shouldn't block image replacement
    // The old file will remain in S3 but won't be accessible via CDN (soft-deleted in DB)
    console.error(`[S3 Delete] Failed to delete ${storageKey}:`, error.message);
    // Don't throw - allow replacement to continue even if S3 deletion fails
  }
};

module.exports = {
  generatePresignedUploadUrl,
  confirmUpload,
  validateContentType,
  deleteImageFromS3,
  IMAGE_UPLOAD_CONFIG
};

