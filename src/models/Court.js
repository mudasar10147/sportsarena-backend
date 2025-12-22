const { pool } = require('../config/database');

class Court {
  /**
   * Create a new court
   * @param {Object} courtData - Court data object
   * @param {number} courtData.facilityId - Facility ID
   * @param {number} courtData.sportId - Sport ID
   * @param {string} courtData.name - Court name/number
   * @param {number} courtData.pricePerHour - Price per hour in PKR
   * @param {string} [courtData.description] - Court description
   * @param {boolean} [courtData.isIndoor=true] - Whether court is indoor
   * @returns {Promise<Object>} Created court object
   */
  static async create(courtData) {
    const {
      facilityId,
      sportId,
      name,
      pricePerHour,
      description = null,
      isIndoor = true
    } = courtData;

    const query = `
      INSERT INTO courts (facility_id, sport_id, name, description, price_per_hour, is_indoor)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, facility_id, sport_id, name, description, price_per_hour, is_indoor, is_active, created_at, updated_at
    `;

    const values = [facilityId, sportId, name, description, pricePerHour, isIndoor];
    const result = await pool.query(query, values);
    return this._formatCourt(result.rows[0]);
  }

  /**
   * Find court by ID
   * @param {number} courtId - Court ID
   * @returns {Promise<Object|null>} Court object or null if not found
   */
  static async findById(courtId) {
    const query = `
      SELECT id, facility_id, sport_id, name, description, price_per_hour, is_indoor, is_active, created_at, updated_at
      FROM courts
      WHERE id = $1
    `;
    const result = await pool.query(query, [courtId]);
    return result.rows[0] ? this._formatCourt(result.rows[0]) : null;
  }

  /**
   * Find courts by facility ID
   * @param {number} facilityId - Facility ID
   * @param {Object} [options={}] - Query options
   * @param {boolean} [options.isActive=true] - Filter by active status
   * @returns {Promise<Array>} Array of court objects
   */
  static async findByFacilityId(facilityId, options = {}) {
    const { isActive = true } = options;

    const query = `
      SELECT id, facility_id, sport_id, name, description, price_per_hour, is_indoor, is_active, created_at, updated_at
      FROM courts
      WHERE facility_id = $1 AND is_active = $2
      ORDER BY name ASC
    `;

    const result = await pool.query(query, [facilityId, isActive]);
    return result.rows.map(row => this._formatCourt(row));
  }

  /**
   * Find courts by sport ID
   * @param {number} sportId - Sport ID
   * @param {Object} [options={}] - Query options
   * @param {boolean} [options.isActive=true] - Filter by active status
   * @returns {Promise<Array>} Array of court objects
   */
  static async findBySportId(sportId, options = {}) {
    const { isActive = true } = options;

    const query = `
      SELECT id, facility_id, sport_id, name, description, price_per_hour, is_indoor, is_active, created_at, updated_at
      FROM courts
      WHERE sport_id = $1 AND is_active = $2
      ORDER BY name ASC
    `;

    const result = await pool.query(query, [sportId, isActive]);
    return result.rows.map(row => this._formatCourt(row));
  }

  /**
   * Find courts by facility and sport
   * @param {number} facilityId - Facility ID
   * @param {number} sportId - Sport ID
   * @param {Object} [options={}] - Query options
   * @param {boolean} [options.isActive=true] - Filter by active status
   * @returns {Promise<Array>} Array of court objects
   */
  static async findByFacilityAndSport(facilityId, sportId, options = {}) {
    const { isActive = true } = options;

    const query = `
      SELECT id, facility_id, sport_id, name, description, price_per_hour, is_indoor, is_active, created_at, updated_at
      FROM courts
      WHERE facility_id = $1 AND sport_id = $2 AND is_active = $3
      ORDER BY price_per_hour ASC, name ASC
    `;

    const result = await pool.query(query, [facilityId, sportId, isActive]);
    return result.rows.map(row => this._formatCourt(row));
  }

  /**
   * Get all courts (with pagination and filtering)
   * @param {Object} [options={}] - Query options
   * @param {number} [options.limit=50] - Number of records to return
   * @param {number} [options.offset=0] - Number of records to skip
   * @param {number} [options.facilityId] - Filter by facility
   * @param {number} [options.sportId] - Filter by sport
   * @param {boolean} [options.isIndoor] - Filter by indoor/outdoor
   * @param {boolean} [options.isActive=true] - Filter by active status
   * @param {number} [options.minPrice] - Minimum price per hour
   * @param {number} [options.maxPrice] - Maximum price per hour
   * @returns {Promise<Object>} Object with courts array and total count
   */
  static async findAll(options = {}) {
    const {
      limit = 50,
      offset = 0,
      facilityId,
      sportId,
      isIndoor,
      isActive = true,
      minPrice,
      maxPrice
    } = options;

    const conditions = ['is_active = $1'];
    const values = [isActive];
    let paramCount = 2;

    if (facilityId) {
      conditions.push(`facility_id = $${paramCount}`);
      values.push(facilityId);
      paramCount++;
    }

    if (sportId) {
      conditions.push(`sport_id = $${paramCount}`);
      values.push(sportId);
      paramCount++;
    }

    if (isIndoor !== undefined) {
      conditions.push(`is_indoor = $${paramCount}`);
      values.push(isIndoor);
      paramCount++;
    }

    if (minPrice !== undefined) {
      conditions.push(`price_per_hour >= $${paramCount}`);
      values.push(minPrice);
      paramCount++;
    }

    if (maxPrice !== undefined) {
      conditions.push(`price_per_hour <= $${paramCount}`);
      values.push(maxPrice);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT id, facility_id, sport_id, name, description, price_per_hour, is_indoor, is_active, created_at, updated_at
      FROM courts
      ${whereClause}
      ORDER BY price_per_hour ASC, name ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM courts
      ${whereClause}
    `;

    values.push(limit, offset);
    const [result, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2))
    ]);

    return {
      courts: result.rows.map(row => this._formatCourt(row)),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };
  }

  /**
   * Update court information
   * @param {number} courtId - Court ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated court object or null if not found
   */
  static async update(courtId, updateData) {
    const allowedFields = ['name', 'description', 'price_per_hour', 'is_indoor', 'is_active'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      const dbField = key === 'pricePerHour' ? 'price_per_hour' :
                     key === 'isIndoor' ? 'is_indoor' :
                     key === 'isActive' ? 'is_active' : key;

      if (allowedFields.includes(dbField) && value !== undefined) {
        updates.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return await this.findById(courtId);
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(courtId);

    const query = `
      UPDATE courts
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, facility_id, sport_id, name, description, price_per_hour, is_indoor, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0] ? this._formatCourt(result.rows[0]) : null;
  }

  /**
   * Delete court (soft delete by setting is_active to false)
   * @param {number} courtId - Court ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async delete(courtId) {
    const query = `
      UPDATE courts
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    const result = await pool.query(query, [courtId]);
    return result.rowCount > 0;
  }

  /**
   * Format court object - normalize field names and parse decimal
   * @private
   * @param {Object} row - Raw database row
   * @returns {Object} Formatted court object
   */
  static _formatCourt(row) {
    if (!row) return null;

    return {
      id: row.id,
      facilityId: row.facility_id,
      sportId: row.sport_id,
      name: row.name,
      description: row.description,
      pricePerHour: parseFloat(row.price_per_hour),
      isIndoor: row.is_indoor,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = Court;

