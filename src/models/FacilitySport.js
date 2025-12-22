const { pool } = require('../config/database');

class FacilitySport {
  /**
   * Add a sport to a facility
   * @param {number} facilityId - Facility ID
   * @param {number} sportId - Sport ID
   * @returns {Promise<Object>} Created facility_sport relationship object
   */
  static async create(facilityId, sportId) {
    const query = `
      INSERT INTO facility_sports (facility_id, sport_id)
      VALUES ($1, $2)
      ON CONFLICT (facility_id, sport_id) 
      DO UPDATE SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
      RETURNING id, facility_id, sport_id, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, [facilityId, sportId]);
    return this._formatFacilitySport(result.rows[0]);
  }

  /**
   * Find facility_sport relationship by ID
   * @param {number} id - FacilitySport ID
   * @returns {Promise<Object|null>} FacilitySport object or null if not found
   */
  static async findById(id) {
    const query = `
      SELECT id, facility_id, sport_id, is_active, created_at, updated_at
      FROM facility_sports
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] ? this._formatFacilitySport(result.rows[0]) : null;
  }

  /**
   * Find relationship by facility and sport
   * @param {number} facilityId - Facility ID
   * @param {number} sportId - Sport ID
   * @returns {Promise<Object|null>} FacilitySport object or null if not found
   */
  static async findByFacilityAndSport(facilityId, sportId) {
    const query = `
      SELECT id, facility_id, sport_id, is_active, created_at, updated_at
      FROM facility_sports
      WHERE facility_id = $1 AND sport_id = $2
    `;
    const result = await pool.query(query, [facilityId, sportId]);
    return result.rows[0] ? this._formatFacilitySport(result.rows[0]) : null;
  }

  /**
   * Get all sports for a facility
   * @param {number} facilityId - Facility ID
   * @param {Object} [options={}] - Query options
   * @param {boolean} [options.isActive=true] - Filter by active status
   * @returns {Promise<Array>} Array of sport objects with relationship info
   */
  static async getSportsByFacility(facilityId, options = {}) {
    const { isActive = true } = options;

    const query = `
      SELECT 
        fs.id,
        fs.facility_id,
        fs.sport_id,
        fs.is_active,
        fs.created_at,
        fs.updated_at,
        s.name as sport_name,
        s.description as sport_description,
        s.icon_url as sport_icon_url
      FROM facility_sports fs
      INNER JOIN sports s ON fs.sport_id = s.id
      WHERE fs.facility_id = $1 AND fs.is_active = $2 AND s.is_active = TRUE
      ORDER BY s.name ASC
    `;

    const result = await pool.query(query, [facilityId, isActive]);
    return result.rows.map(row => this._formatFacilitySportWithSport(row));
  }

  /**
   * Get all facilities for a sport
   * @param {number} sportId - Sport ID
   * @param {Object} [options={}] - Query options
   * @param {boolean} [options.isActive=true] - Filter by active status
   * @returns {Promise<Array>} Array of facility objects with relationship info
   */
  static async getFacilitiesBySport(sportId, options = {}) {
    const { isActive = true } = options;

    const query = `
      SELECT 
        fs.id,
        fs.facility_id,
        fs.sport_id,
        fs.is_active,
        fs.created_at,
        fs.updated_at,
        f.name as facility_name,
        f.address as facility_address,
        f.city as facility_city,
        f.latitude as facility_latitude,
        f.longitude as facility_longitude,
        f.is_active as facility_is_active
      FROM facility_sports fs
      INNER JOIN facilities f ON fs.facility_id = f.id
      WHERE fs.sport_id = $1 AND fs.is_active = $2 AND f.is_active = TRUE
      ORDER BY f.name ASC
    `;

    const result = await pool.query(query, [sportId, isActive]);
    return result.rows.map(row => this._formatFacilitySportWithFacility(row));
  }

  /**
   * Check if facility offers a sport
   * @param {number} facilityId - Facility ID
   * @param {number} sportId - Sport ID
   * @returns {Promise<boolean>} True if facility offers the sport
   */
  static async facilityOffersSport(facilityId, sportId) {
    const query = `
      SELECT 1
      FROM facility_sports
      WHERE facility_id = $1 AND sport_id = $2 AND is_active = TRUE
      LIMIT 1
    `;
    const result = await pool.query(query, [facilityId, sportId]);
    return result.rows.length > 0;
  }

  /**
   * Add multiple sports to a facility
   * @param {number} facilityId - Facility ID
   * @param {Array<number>} sportIds - Array of sport IDs
   * @returns {Promise<Array>} Array of created facility_sport objects
   */
  static async addSportsToFacility(facilityId, sportIds) {
    if (!sportIds || sportIds.length === 0) {
      return [];
    }

    const values = [];
    const placeholders = [];
    sportIds.forEach((sportId, index) => {
      const baseIndex = index * 2;
      placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2})`);
      values.push(facilityId, sportId);
    });

    const query = `
      INSERT INTO facility_sports (facility_id, sport_id)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (facility_id, sport_id) 
      DO UPDATE SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
      RETURNING id, facility_id, sport_id, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows.map(row => this._formatFacilitySport(row));
  }

  /**
   * Remove a sport from a facility (soft delete)
   * @param {number} facilityId - Facility ID
   * @param {number} sportId - Sport ID
   * @returns {Promise<boolean>} True if removed successfully
   */
  static async removeSportFromFacility(facilityId, sportId) {
    const query = `
      UPDATE facility_sports
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE facility_id = $1 AND sport_id = $2
    `;
    const result = await pool.query(query, [facilityId, sportId]);
    return result.rowCount > 0;
  }

  /**
   * Remove all sports from a facility
   * @param {number} facilityId - Facility ID
   * @returns {Promise<number>} Number of sports removed
   */
  static async removeAllSportsFromFacility(facilityId) {
    const query = `
      UPDATE facility_sports
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE facility_id = $1 AND is_active = TRUE
    `;
    const result = await pool.query(query, [facilityId]);
    return result.rowCount;
  }

  /**
   * Update relationship status
   * @param {number} facilityId - Facility ID
   * @param {number} sportId - Sport ID
   * @param {boolean} isActive - Active status
   * @returns {Promise<Object|null>} Updated facility_sport object or null
   */
  static async updateStatus(facilityId, sportId, isActive) {
    const query = `
      UPDATE facility_sports
      SET is_active = $3, updated_at = CURRENT_TIMESTAMP
      WHERE facility_id = $1 AND sport_id = $2
      RETURNING id, facility_id, sport_id, is_active, created_at, updated_at
    `;
    const result = await pool.query(query, [facilityId, sportId, isActive]);
    return result.rows[0] ? this._formatFacilitySport(result.rows[0]) : null;
  }

  /**
   * Format facility_sport object - normalize field names
   * @private
   * @param {Object} row - Raw database row
   * @returns {Object} Formatted facility_sport object
   */
  static _formatFacilitySport(row) {
    if (!row) return null;

    return {
      id: row.id,
      facilityId: row.facility_id,
      sportId: row.sport_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Format facility_sport with sport details
   * @private
   * @param {Object} row - Raw database row with sport join
   * @returns {Object} Formatted object with sport info
   */
  static _formatFacilitySportWithSport(row) {
    const base = this._formatFacilitySport(row);
    return {
      ...base,
      sport: {
        id: row.sport_id,
        name: row.sport_name,
        description: row.sport_description,
        iconUrl: row.sport_icon_url
      }
    };
  }

  /**
   * Format facility_sport with facility details
   * @private
   * @param {Object} row - Raw database row with facility join
   * @returns {Object} Formatted object with facility info
   */
  static _formatFacilitySportWithFacility(row) {
    const base = this._formatFacilitySport(row);
    return {
      ...base,
      facility: {
        id: row.facility_id,
        name: row.facility_name,
        address: row.facility_address,
        city: row.facility_city,
        latitude: row.facility_latitude ? parseFloat(row.facility_latitude) : null,
        longitude: row.facility_longitude ? parseFloat(row.facility_longitude) : null,
        isActive: row.facility_is_active
      }
    };
  }
}

module.exports = FacilitySport;

