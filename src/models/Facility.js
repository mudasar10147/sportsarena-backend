const { pool } = require('../config/database');

class Facility {
  /**
   * Create a new facility
   * @param {Object} facilityData - Facility data object
   * @param {string} facilityData.name - Facility name
   * @param {string} facilityData.address - Full address
   * @param {number} facilityData.ownerId - User ID of facility owner/admin
   * @param {string} [facilityData.description] - Facility description
   * @param {string} [facilityData.city] - City name
   * @param {number} [facilityData.latitude] - Latitude coordinate
   * @param {number} [facilityData.longitude] - Longitude coordinate
   * @param {string} [facilityData.contactPhone] - Contact phone number
   * @param {string} [facilityData.contactEmail] - Contact email
   * @param {Array<string>} [facilityData.photos] - Array of photo URLs
   * @param {Object} [facilityData.openingHours] - Opening hours object by day
   * @returns {Promise<Object>} Created facility object
   */
  static async create(facilityData) {
    const {
      name,
      address,
      ownerId,
      description = null,
      city = null,
      latitude = null,
      longitude = null,
      contactPhone = null,
      contactEmail = null,
      photos = [],
      openingHours = {}
    } = facilityData;

    const query = `
      INSERT INTO facilities (
        name, description, address, city, latitude, longitude,
        contact_phone, contact_email, owner_id, photos, opening_hours
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, name, description, address, city, latitude, longitude,
                contact_phone, contact_email, owner_id, photos, opening_hours,
                is_active, created_at, updated_at
    `;

    const values = [
      name,
      description,
      address,
      city,
      latitude,
      longitude,
      contactPhone,
      contactEmail,
      ownerId,
      JSON.stringify(photos),
      JSON.stringify(openingHours)
    ];

    const result = await pool.query(query, values);
    return this._formatFacility(result.rows[0]);
  }

  /**
   * Find facility by ID
   * @param {number} facilityId - Facility ID
   * @returns {Promise<Object|null>} Facility object or null if not found
   */
  static async findById(facilityId) {
    const query = `
      SELECT id, name, description, address, city, latitude, longitude,
             contact_phone, contact_email, owner_id, photos, opening_hours,
             is_active, created_at, updated_at
      FROM facilities
      WHERE id = $1
    `;
    const result = await pool.query(query, [facilityId]);
    return result.rows[0] ? this._formatFacility(result.rows[0]) : null;
  }

  /**
   * Find facilities by owner ID
   * @param {number} ownerId - Owner user ID
   * @returns {Promise<Array>} Array of facility objects
   */
  static async findByOwnerId(ownerId) {
    const query = `
      SELECT id, name, description, address, city, latitude, longitude,
             contact_phone, contact_email, owner_id, photos, opening_hours,
             is_active, created_at, updated_at
      FROM facilities
      WHERE owner_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [ownerId]);
    return result.rows.map(row => this._formatFacility(row));
  }

  /**
   * Update facility information
   * @param {number} facilityId - Facility ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated facility object or null if not found
   */
  static async update(facilityId, updateData) {
    const allowedFields = [
      'name', 'description', 'address', 'city', 'latitude', 'longitude',
      'contact_phone', 'contact_email', 'photos', 'opening_hours', 'is_active'
    ];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      const dbField = key === 'contactPhone' ? 'contact_phone' :
                     key === 'contactEmail' ? 'contact_email' :
                     key === 'ownerId' ? 'owner_id' :
                     key === 'isActive' ? 'is_active' :
                     key === 'openingHours' ? 'opening_hours' : key;

      if (allowedFields.includes(dbField) && value !== undefined) {
        // Handle JSON fields
        if (dbField === 'photos' || dbField === 'opening_hours') {
          updates.push(`${dbField} = $${paramCount}::jsonb`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${dbField} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return await this.findById(facilityId);
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(facilityId);

    const query = `
      UPDATE facilities
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, description, address, city, latitude, longitude,
                contact_phone, contact_email, owner_id, photos, opening_hours,
                is_active, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0] ? this._formatFacility(result.rows[0]) : null;
  }

  /**
   * Get all facilities (with pagination and filtering)
   * @param {Object} options - Query options
   * @param {number} [options.limit=50] - Number of records to return
   * @param {number} [options.offset=0] - Number of records to skip
   * @param {string} [options.city] - Filter by city
   * @param {boolean} [options.isActive] - Filter by active status
   * @param {number} [options.latitude] - Latitude for distance calculation
   * @param {number} [options.longitude] - Longitude for distance calculation
   * @param {number} [options.radiusKm] - Radius in kilometers for location-based search
   * @returns {Promise<Object>} Object with facilities array and total count
   */
  static async findAll(options = {}) {
    const {
      limit = 50,
      offset = 0,
      city,
      isActive,
      latitude,
      longitude,
      radiusKm
    } = options;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (city) {
      conditions.push(`city = $${paramCount}`);
      values.push(city);
      paramCount++;
    }

    if (isActive !== undefined) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(isActive);
      paramCount++;
    }

    // Location-based search (within radius)
    let distanceSelect = '';
    let orderBy = 'ORDER BY created_at DESC';
    if (latitude && longitude && radiusKm) {
      // Using Haversine formula for distance calculation
      distanceSelect = `, (
        6371 * acos(
          cos(radians($${paramCount})) *
          cos(radians(latitude)) *
          cos(radians(longitude) - radians($${paramCount + 1})) +
          sin(radians($${paramCount})) *
          sin(radians(latitude))
        )
      ) AS distance_km`;
      values.push(latitude, longitude);
      conditions.push(`latitude IS NOT NULL AND longitude IS NOT NULL`);
      orderBy = `ORDER BY distance_km ASC`;
      paramCount += 2;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT id, name, description, address, city, latitude, longitude,
             contact_phone, contact_email, owner_id, photos, opening_hours,
             is_active, created_at, updated_at
             ${distanceSelect}
      FROM facilities
      ${whereClause}
      ${orderBy}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM facilities
      ${whereClause}
    `;

    values.push(limit, offset);
    const [result, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2))
    ]);

    return {
      facilities: result.rows.map(row => this._formatFacility(row)),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };
  }

  /**
   * Search facilities by name or address
   * @param {string} searchTerm - Search keyword
   * @param {Object} [options={}] - Additional query options
   * @returns {Promise<Array>} Array of matching facilities
   */
  static async search(searchTerm, options = {}) {
    const { limit = 50, offset = 0, isActive = true } = options;
    const searchPattern = `%${searchTerm}%`;

    const query = `
      SELECT id, name, description, address, city, latitude, longitude,
             contact_phone, contact_email, owner_id, photos, opening_hours,
             is_active, created_at, updated_at
      FROM facilities
      WHERE is_active = $1
        AND (name ILIKE $2 OR address ILIKE $2 OR city ILIKE $2)
      ORDER BY name ASC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [isActive, searchPattern, limit, offset]);
    return result.rows.map(row => this._formatFacility(row));
  }

  /**
   * Delete facility (soft delete by setting is_active to false)
   * @param {number} facilityId - Facility ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async delete(facilityId) {
    const query = `
      UPDATE facilities
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    const result = await pool.query(query, [facilityId]);
    return result.rowCount > 0;
  }

  /**
   * Format facility object - parse JSON fields and normalize field names
   * @private
   * @param {Object} row - Raw database row
   * @returns {Object} Formatted facility object
   */
  static _formatFacility(row) {
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      address: row.address,
      city: row.city,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      contactPhone: row.contact_phone,
      contactEmail: row.contact_email,
      ownerId: row.owner_id,
      photos: typeof row.photos === 'string' ? JSON.parse(row.photos) : (row.photos || []),
      openingHours: typeof row.opening_hours === 'string' ? JSON.parse(row.opening_hours) : (row.opening_hours || {}),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.distance_km !== undefined && { distanceKm: parseFloat(row.distance_km) })
    };
  }
}

module.exports = Facility;

