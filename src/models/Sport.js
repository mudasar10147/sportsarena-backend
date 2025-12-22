const { pool } = require('../config/database');

class Sport {
  /**
   * Create a new sport
   * @param {Object} sportData - Sport data object
   * @param {string} sportData.name - Sport name (must be unique)
   * @param {string} [sportData.description] - Sport description
   * @param {string} [sportData.iconUrl] - Icon/image URL
   * @returns {Promise<Object>} Created sport object
   */
  static async create(sportData) {
    const {
      name,
      description = null,
      iconUrl = null
    } = sportData;

    const query = `
      INSERT INTO sports (name, description, icon_url)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, icon_url, is_active, created_at, updated_at
    `;

    const values = [name, description, iconUrl];
    const result = await pool.query(query, values);
    return this._formatSport(result.rows[0]);
  }

  /**
   * Find sport by ID
   * @param {number} sportId - Sport ID
   * @returns {Promise<Object|null>} Sport object or null if not found
   */
  static async findById(sportId) {
    const query = `
      SELECT id, name, description, icon_url, is_active, created_at, updated_at
      FROM sports
      WHERE id = $1
    `;
    const result = await pool.query(query, [sportId]);
    return result.rows[0] ? this._formatSport(result.rows[0]) : null;
  }

  /**
   * Find sport by name
   * @param {string} name - Sport name
   * @returns {Promise<Object|null>} Sport object or null if not found
   */
  static async findByName(name) {
    const query = `
      SELECT id, name, description, icon_url, is_active, created_at, updated_at
      FROM sports
      WHERE LOWER(name) = LOWER($1)
    `;
    const result = await pool.query(query, [name]);
    return result.rows[0] ? this._formatSport(result.rows[0]) : null;
  }

  /**
   * Get all sports (with optional filtering)
   * @param {Object} [options={}] - Query options
   * @param {boolean} [options.isActive] - Filter by active status (default: true)
   * @returns {Promise<Array>} Array of sport objects
   */
  static async findAll(options = {}) {
    const { isActive = true } = options;

    const query = `
      SELECT id, name, description, icon_url, is_active, created_at, updated_at
      FROM sports
      WHERE is_active = $1
      ORDER BY name ASC
    `;

    const result = await pool.query(query, [isActive]);
    return result.rows.map(row => this._formatSport(row));
  }

  /**
   * Search sports by name
   * @param {string} searchTerm - Search keyword
   * @param {Object} [options={}] - Additional query options
   * @param {boolean} [options.isActive=true] - Filter by active status
   * @returns {Promise<Array>} Array of matching sport objects
   */
  static async search(searchTerm, options = {}) {
    const { isActive = true } = options;
    const searchPattern = `%${searchTerm}%`;

    const query = `
      SELECT id, name, description, icon_url, is_active, created_at, updated_at
      FROM sports
      WHERE is_active = $1
        AND (name ILIKE $2 OR description ILIKE $2)
      ORDER BY name ASC
    `;

    const result = await pool.query(query, [isActive, searchPattern]);
    return result.rows.map(row => this._formatSport(row));
  }

  /**
   * Update sport information
   * @param {number} sportId - Sport ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated sport object or null if not found
   */
  static async update(sportId, updateData) {
    const allowedFields = ['name', 'description', 'icon_url', 'is_active'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      const dbField = key === 'iconUrl' ? 'icon_url' :
                     key === 'isActive' ? 'is_active' : key;

      if (allowedFields.includes(dbField) && value !== undefined) {
        updates.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return await this.findById(sportId);
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(sportId);

    const query = `
      UPDATE sports
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, description, icon_url, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0] ? this._formatSport(result.rows[0]) : null;
  }

  /**
   * Check if sport name exists
   * @param {string} name - Sport name to check
   * @param {number} [excludeId] - Exclude this sport ID from check
   * @returns {Promise<boolean>} True if name exists
   */
  static async nameExists(name, excludeId = null) {
    let query = 'SELECT 1 FROM sports WHERE LOWER(name) = LOWER($1)';
    const values = [name];

    if (excludeId) {
      query += ' AND id != $2';
      values.push(excludeId);
    }

    query += ' LIMIT 1';
    const result = await pool.query(query, values);
    return result.rows.length > 0;
  }

  /**
   * Delete sport (soft delete by setting is_active to false)
   * @param {number} sportId - Sport ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async delete(sportId) {
    const query = `
      UPDATE sports
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    const result = await pool.query(query, [sportId]);
    return result.rowCount > 0;
  }

  /**
   * Format sport object - normalize field names
   * @private
   * @param {Object} row - Raw database row
   * @returns {Object} Formatted sport object
   */
  static _formatSport(row) {
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      iconUrl: row.icon_url,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = Sport;

