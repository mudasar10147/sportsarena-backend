const { pool } = require('../config/database');

class TimeSlot {
  /**
   * Create a new time slot
   * @param {Object} slotData - Time slot data object
   * @param {number} slotData.courtId - Court ID
   * @param {Date|string} slotData.startTime - Slot start time
   * @param {Date|string} slotData.endTime - Slot end time
   * @param {string} [slotData.status='available'] - Slot status (available, blocked, booked)
   * @returns {Promise<Object>} Created time slot object
   */
  static async create(slotData) {
    const {
      courtId,
      startTime,
      endTime,
      status = 'available'
    } = slotData;

    const query = `
      INSERT INTO time_slots (court_id, start_time, end_time, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id, court_id, start_time, end_time, status, created_at, updated_at
    `;

    const values = [courtId, startTime, endTime, status];
    const result = await pool.query(query, values);
    return this._formatTimeSlot(result.rows[0]);
  }

  /**
   * Find time slot by ID
   * @param {number} slotId - Time slot ID
   * @returns {Promise<Object|null>} Time slot object or null if not found
   */
  static async findById(slotId) {
    const query = `
      SELECT id, court_id, start_time, end_time, status, created_at, updated_at
      FROM time_slots
      WHERE id = $1
    `;
    const result = await pool.query(query, [slotId]);
    return result.rows[0] ? this._formatTimeSlot(result.rows[0]) : null;
  }

  /**
   * Find time slots by court ID
   * @param {number} courtId - Court ID
   * @param {Object} [options={}] - Query options
   * @param {string} [options.status] - Filter by status
   * @param {Date|string} [options.startDate] - Filter from this date
   * @param {Date|string} [options.endDate] - Filter to this date
   * @returns {Promise<Array>} Array of time slot objects
   */
  static async findByCourtId(courtId, options = {}) {
    const { status, startDate, endDate } = options;
    const conditions = ['court_id = $1'];
    const values = [courtId];
    let paramCount = 2;

    if (status) {
      conditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (startDate) {
      conditions.push(`start_time >= $${paramCount}`);
      values.push(startDate);
      paramCount++;
    }

    if (endDate) {
      conditions.push(`start_time <= $${paramCount}`);
      values.push(endDate);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT id, court_id, start_time, end_time, status, created_at, updated_at
      FROM time_slots
      ${whereClause}
      ORDER BY start_time ASC
    `;

    const result = await pool.query(query, values);
    return result.rows.map(row => this._formatTimeSlot(row));
  }

  /**
   * Get available time slots for a court within a date range
   * @param {number} courtId - Court ID
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {Promise<Array>} Array of available time slot objects
   */
  static async getAvailableSlots(courtId, startDate, endDate) {
    const query = `
      SELECT id, court_id, start_time, end_time, status, created_at, updated_at
      FROM time_slots
      WHERE court_id = $1
        AND status = 'available'
        AND start_time >= $2
        AND start_time <= $3
      ORDER BY start_time ASC
    `;

    const result = await pool.query(query, [courtId, startDate, endDate]);
    return result.rows.map(row => this._formatTimeSlot(row));
  }

  /**
   * Get available time slots for next 7 days for a court
   * @deprecated Use getAvailableSlotsNext30Days instead
   * @param {number} courtId - Court ID
   * @param {Date|string} [fromDate] - Start date (defaults to now)
   * @returns {Promise<Array>} Array of available time slot objects
   */
  static async getAvailableSlotsNext7Days(courtId, fromDate = null) {
    const startDate = fromDate || new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    return this.getAvailableSlots(courtId, startDate, endDate);
  }

  /**
   * Get available time slots for next 30 days for a court
   * @param {number} courtId - Court ID
   * @param {Date|string} [fromDate] - Start date (defaults to now)
   * @param {Date|string} [toDate] - End date (optional, defaults to 30 days from fromDate)
   * @returns {Promise<Array>} Array of available time slot objects
   */
  static async getAvailableSlotsNext30Days(courtId, fromDate = null, toDate = null) {
    const startDate = fromDate || new Date();
    const endDate = toDate || (() => {
      const maxDate = new Date(startDate);
      maxDate.setDate(maxDate.getDate() + 30);
      return maxDate;
    })();

    return this.getAvailableSlots(courtId, startDate, endDate);
  }

  /**
   * Check if time slot is available
   * @param {number} slotId - Time slot ID
   * @returns {Promise<boolean>} True if slot is available
   */
  static async isAvailable(slotId) {
    const query = `
      SELECT 1
      FROM time_slots
      WHERE id = $1 AND status = 'available'
      LIMIT 1
    `;
    const result = await pool.query(query, [slotId]);
    return result.rows.length > 0;
  }

  /**
   * Update time slot status
   * @param {number} slotId - Time slot ID
   * @param {string} status - New status (available, blocked, booked)
   * @returns {Promise<Object|null>} Updated time slot object or null if not found
   */
  static async updateStatus(slotId, status) {
    if (!['available', 'blocked', 'booked'].includes(status)) {
      throw new Error('Invalid status. Must be: available, blocked, or booked');
    }

    const query = `
      UPDATE time_slots
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, court_id, start_time, end_time, status, created_at, updated_at
    `;
    const result = await pool.query(query, [status, slotId]);
    return result.rows[0] ? this._formatTimeSlot(result.rows[0]) : null;
  }

  /**
   * Block a time slot
   * @param {number} slotId - Time slot ID
   * @returns {Promise<Object|null>} Updated time slot object or null if not found
   */
  static async block(slotId) {
    return this.updateStatus(slotId, 'blocked');
  }

  /**
   * Mark time slot as booked
   * @param {number} slotId - Time slot ID
   * @returns {Promise<Object|null>} Updated time slot object or null if not found
   */
  static async markAsBooked(slotId) {
    return this.updateStatus(slotId, 'booked');
  }

  /**
   * Mark time slot as available
   * @param {number} slotId - Time slot ID
   * @returns {Promise<Object|null>} Updated time slot object or null if not found
   */
  static async markAsAvailable(slotId) {
    return this.updateStatus(slotId, 'available');
  }

  /**
   * Create multiple time slots (bulk insert)
   * @param {Array<Object>} slotsData - Array of time slot data objects
   * @returns {Promise<Array>} Array of created time slot objects
   */
  static async createMultiple(slotsData) {
    if (!slotsData || slotsData.length === 0) {
      return [];
    }

    const values = [];
    const placeholders = [];
    slotsData.forEach((slot, index) => {
      const baseIndex = index * 4;
      placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`);
      values.push(
        slot.courtId,
        slot.startTime,
        slot.endTime,
        slot.status || 'available'
      );
    });

    const query = `
      INSERT INTO time_slots (court_id, start_time, end_time, status)
      VALUES ${placeholders.join(', ')}
      RETURNING id, court_id, start_time, end_time, status, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows.map(row => this._formatTimeSlot(row));
  }

  /**
   * Delete time slot
   * @param {number} slotId - Time slot ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async delete(slotId) {
    const query = `
      DELETE FROM time_slots
      WHERE id = $1
    `;
    const result = await pool.query(query, [slotId]);
    return result.rowCount > 0;
  }

  /**
   * Delete all time slots for a court
   * @param {number} courtId - Court ID
   * @returns {Promise<number>} Number of slots deleted
   */
  static async deleteByCourtId(courtId) {
    const query = `
      DELETE FROM time_slots
      WHERE court_id = $1
    `;
    const result = await pool.query(query, [courtId]);
    return result.rowCount;
  }

  /**
   * Format time slot object - normalize field names and parse timestamps
   * @private
   * @param {Object} row - Raw database row
   * @returns {Object} Formatted time slot object
   */
  static _formatTimeSlot(row) {
    if (!row) return null;

    return {
      id: row.id,
      courtId: row.court_id,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

module.exports = TimeSlot;

