/**
 * Image Model
 * 
 * Manages image metadata and references.
 * Note: Actual image files will be stored in S3 (not in database).
 * This model tracks image ownership, types, and relationships to entities.
 */

const { pool } = require('../config/database');
const { getPublicImageUrl, getAllVariantUrls } = require('../config/s3');

class Image {
  /**
   * Create a new image record
   * @param {Object} imageData - Image data object
   * @param {string} imageData.entityType - Entity type (user, facility, court, sport, review)
   * @param {number} imageData.entityId - Entity ID
   * @param {string} imageData.imageType - Image type (profile, cover, gallery, icon, banner, main)
   * @param {number} imageData.createdBy - User ID who created the image
   * @param {string} [imageData.storageKey] - S3 storage key (nullable until S3 integration)
   * @param {string} [imageData.url] - Full URL to image (nullable until S3 integration)
   * @param {boolean} [imageData.isPrimary] - Whether this is the primary image (default: false)
   * @param {number} [imageData.displayOrder] - Display order for gallery images (default: 0)
   * @param {Object} [imageData.metadata] - Additional metadata (dimensions, file size, etc.)
   * @returns {Promise<Object>} Created image object
   */
  static async create(imageData) {
    const {
      entityType,
      entityId,
      imageType,
      createdBy,
      storageKey = null,
      url = null,
      isPrimary = false,
      displayOrder = 0,
      metadata = {}
    } = imageData;

    // Validate entity type
    const validEntityTypes = ['user', 'facility', 'court', 'sport', 'review'];
    if (!validEntityTypes.includes(entityType)) {
      throw new Error(`Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`);
    }

    // Validate image type
    const validImageTypes = ['profile', 'cover', 'gallery', 'icon', 'banner', 'main'];
    if (!validImageTypes.includes(imageType)) {
      throw new Error(`Invalid image type. Must be one of: ${validImageTypes.join(', ')}`);
    }

    // Single-image types must be primary
    const singleImageTypes = ['profile', 'cover', 'icon', 'banner', 'main'];
    if (singleImageTypes.includes(imageType) && !isPrimary) {
      throw new Error(`${imageType} image type must be marked as primary`);
    }

    const query = `
      INSERT INTO images (
        entity_type, entity_id, image_type, storage_key, url,
        created_by, is_primary, display_order, metadata,
        upload_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, entity_type, entity_id, image_type, storage_key, url,
                created_by, is_primary, is_active, display_order, metadata,
                upload_status, uploaded_at, file_size, content_type,
                is_deleted, moderation_status, moderation_notes, moderated_by, moderated_at,
                created_at, updated_at
    `;

    const result = await pool.query(query, [
      entityType,
      entityId,
      imageType,
      storageKey,
      url,
      createdBy,
      isPrimary,
      displayOrder,
      JSON.stringify(metadata),
      'pending' // Default upload_status for new images
    ]);

    return this._formatImage(result.rows[0]);
  }

  /**
   * Find image by ID
   * @param {string} imageId - Image UUID
   * @returns {Promise<Object|null>} Image object or null if not found
   */
  static async findById(imageId) {
    const query = `
      SELECT id, entity_type, entity_id, image_type, storage_key, url,
             created_by, is_primary, is_active, display_order, metadata,
             upload_status, uploaded_at, file_size, content_type,
             is_deleted, moderation_status, moderation_notes, moderated_by, moderated_at,
             created_at, updated_at
      FROM images
      WHERE id = $1
    `;
    const result = await pool.query(query, [imageId]);
    return result.rows.length > 0 ? this._formatImage(result.rows[0]) : null;
  }

  /**
   * Find images by entity
   * @param {string} entityType - Entity type
   * @param {number} entityId - Entity ID
   * @param {Object} [options={}] - Query options
   * @param {string} [options.imageType] - Filter by image type
   * @param {boolean} [options.activeOnly=true] - Only return active images
   * @param {string} [options.uploadStatus] - Filter by upload status (pending, uploaded, failed)
   * @returns {Promise<Array>} Array of image objects
   */
  static async findByEntity(entityType, entityId, options = {}) {
    const { imageType, activeOnly = true, uploadStatus, includePending = false, includeRejected = false } = options;
    const conditions = ['entity_type = $1', 'entity_id = $2'];
    const values = [entityType, entityId];
    let paramCount = 3;

    if (activeOnly) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(true);
      paramCount++;
    }

    // Always exclude deleted images
    conditions.push(`is_deleted = $${paramCount}`);
    values.push(false);
    paramCount++;

    // For public queries, only show approved images
    // Admin queries can override this by setting includePending = true
    if (!includePending && !includeRejected) {
      conditions.push(`moderation_status = $${paramCount}`);
      values.push('approved');
      paramCount++;
    } else if (includePending && !includeRejected) {
      // Include pending and approved, but not rejected
      conditions.push(`moderation_status IN ($${paramCount}, $${paramCount + 1})`);
      values.push('pending', 'approved');
      paramCount += 2;
    }

    if (imageType) {
      conditions.push(`image_type = $${paramCount}`);
      values.push(imageType);
      paramCount++;
    }

    if (uploadStatus) {
      conditions.push(`upload_status = $${paramCount}`);
      values.push(uploadStatus);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT id, entity_type, entity_id, image_type, storage_key, url,
             created_by, is_primary, is_active, display_order, metadata,
             upload_status, uploaded_at, file_size, content_type,
             is_deleted, moderation_status, moderation_notes, moderated_by, moderated_at,
             created_at, updated_at
      FROM images
      ${whereClause}
      ORDER BY is_primary DESC, display_order ASC, created_at ASC
    `;

    const result = await pool.query(query, values);
    return result.rows.map(row => this._formatImage(row));
  }

  /**
   * Get primary image for an entity
   * @param {string} entityType - Entity type
   * @param {number} entityId - Entity ID
   * @param {string} imageType - Image type
   * @returns {Promise<Object|null>} Primary image object or null
   */
  static async getPrimaryImage(entityType, entityId, imageType) {
    const query = `
      SELECT id, entity_type, entity_id, image_type, storage_key, url,
             created_by, is_primary, is_active, display_order, metadata,
             upload_status, uploaded_at, file_size, content_type,
             is_deleted, moderation_status, moderation_notes, moderated_by, moderated_at,
             created_at, updated_at
      FROM images
      WHERE entity_type = $1 
        AND entity_id = $2 
        AND image_type = $3 
        AND is_primary = TRUE 
        AND is_active = TRUE
        AND is_deleted = FALSE
        AND moderation_status = 'approved'
      LIMIT 1
    `;
    const result = await pool.query(query, [entityType, entityId, imageType]);
    return result.rows.length > 0 ? this._formatImage(result.rows[0]) : null;
  }

  /**
   * Update image
   * @param {string} imageId - Image UUID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated image object or null if not found
   */
  static async update(imageId, updateData) {
    const allowedFields = [
      'storage_key', 'url', 'is_primary', 'display_order', 'metadata', 'is_active',
      'upload_status', 'uploaded_at', 'file_size', 'content_type',
      'is_deleted', 'moderation_status', 'moderation_notes', 'moderated_by', 'moderated_at'
    ];
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Field mapping: camelCase JavaScript property -> snake_case database column
    const fieldMapping = {
      'isActive': 'is_active',
      'isPrimary': 'is_primary',
      'displayOrder': 'display_order',
      'storageKey': 'storage_key',
      'uploadStatus': 'upload_status',
      'uploadedAt': 'uploaded_at',
      'fileSize': 'file_size',
      'contentType': 'content_type',
      'isDeleted': 'is_deleted',
      'moderationStatus': 'moderation_status',
      'moderationNotes': 'moderation_notes',
      'moderatedBy': 'moderated_by',
      'moderatedAt': 'moderated_at'
    };

    Object.keys(updateData).forEach(key => {
      // Convert camelCase to snake_case for database field name
      const dbKey = fieldMapping[key] || key;
      
      // Check if the database field name is in allowedFields
      if (allowedFields.includes(dbKey)) {
        updates.push(`${dbKey} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Always update updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(imageId);

    const query = `
      UPDATE images
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, entity_type, entity_id, image_type, storage_key, url,
                created_by, is_primary, is_active, display_order, metadata,
                upload_status, uploaded_at, file_size, content_type,
                is_deleted, moderation_status, moderation_notes, moderated_by, moderated_at,
                created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows.length > 0 ? this._formatImage(result.rows[0]) : null;
  }

  /**
   * Soft delete image (set is_active to false)
   * @param {string} imageId - Image UUID
   * @returns {Promise<Object|null>} Updated image object or null if not found
   */
  static async delete(imageId) {
    return this.update(imageId, { is_active: false });
  }

  /**
   * Count images for an entity
   * @param {string} entityType - Entity type
   * @param {number} entityId - Entity ID
   * @param {string} [imageType] - Filter by image type
   * @param {boolean} [activeOnly=true] - Only count active images
   * @returns {Promise<number>} Count of images
   */
  static async countByEntity(entityType, entityId, imageType = null, activeOnly = true) {
    const conditions = ['entity_type = $1', 'entity_id = $2'];
    const values = [entityType, entityId];
    let paramCount = 3;

    if (activeOnly) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(true);
      paramCount++;
    }

    if (imageType) {
      conditions.push(`image_type = $${paramCount}`);
      values.push(imageType);
      paramCount++;
    }

    let whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Always exclude deleted images from count
    if (whereClause) {
      whereClause += ' AND is_deleted = FALSE';
    } else {
      whereClause = 'WHERE is_deleted = FALSE';
    }

    const query = `
      SELECT COUNT(*) as count
      FROM images
      ${whereClause}
    `;

    const result = await pool.query(query, values);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Format image object - normalize field names
   * @private
   * @param {Object} row - Raw database row
   * @returns {Object} Formatted image object
   */
  static _formatImage(row) {
    if (!row) return null;

    const s3Key = row.storage_key;
    const publicUrl = getPublicImageUrl(s3Key);
    
    // Generate variant URLs (thumb, medium, full)
    // Note: Variants may not exist yet (generated asynchronously)
    // URLs are generated even if variants don't exist - frontend should handle 404 gracefully
    const variants = s3Key ? getAllVariantUrls(s3Key) : {
      thumb: null,
      medium: null,
      full: null
    };

    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      imageType: row.image_type,
      s3Key: s3Key, // Internal S3 object key (for backend use)
      publicUrl: publicUrl, // Public CDN URL for original image (for frontend use)
      // Legacy field: kept for backward compatibility, but frontend should use publicUrl
      url: publicUrl || row.url,
      variants: variants, // Variant URLs (thumb, medium, full)
      createdBy: row.created_by,
      isPrimary: row.is_primary,
      isActive: row.is_active,
      displayOrder: row.display_order,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      uploadStatus: row.upload_status || 'pending',
      uploadedAt: row.uploaded_at ? new Date(row.uploaded_at) : null,
      fileSize: row.file_size ? parseInt(row.file_size, 10) : null,
      contentType: row.content_type || null,
      isDeleted: row.is_deleted || false,
      moderationStatus: row.moderation_status || 'pending',
      moderationNotes: row.moderation_notes || null,
      moderatedBy: row.moderated_by || null,
      moderatedAt: row.moderated_at ? new Date(row.moderated_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

module.exports = Image;

