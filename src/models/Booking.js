const { pool } = require('../config/database');

class Booking {
  /**
   * Note: Booking creation is handled by transactionSafeBookingService
   * This model provides read and update operations only
   */

  /**
   * Find booking by ID
   * @param {number} bookingId - Booking ID
   * @returns {Promise<Object|null>} Booking object or null if not found
   */
  static async findById(bookingId) {
    const query = `
      SELECT id, user_id, court_id, booking_date, start_time, end_time, final_price, booking_status, 
             payment_reference, payment_proof_image_id, cancellation_reason, expires_at, created_at, updated_at
      FROM bookings
      WHERE id = $1
    `;
    const result = await pool.query(query, [bookingId]);
    return result.rows[0] ? this._formatBooking(result.rows[0]) : null;
  }

  /**
   * Find bookings by user ID
   * @param {number} userId - User ID
   * @param {Object} [options={}] - Query options
   * @param {string} [options.status] - Filter by booking status
   * @param {number} [options.limit=50] - Number of records to return
   * @param {number} [options.offset=0] - Number of records to skip
   * @returns {Promise<Object>} Object with bookings array and total count
   */
  static async findByUserId(userId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;
    const conditions = ['user_id = $1'];
    const values = [userId];
    let paramCount = 2;

    if (status) {
      conditions.push(`booking_status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT id, user_id, court_id, booking_date, start_time, end_time, final_price, booking_status, 
             payment_reference, payment_proof_image_id, cancellation_reason, expires_at, created_at, updated_at
      FROM bookings
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bookings
      ${whereClause}
    `;

    values.push(limit, offset);
    const [result, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2))
    ]);

    return {
      bookings: result.rows.map(row => this._formatBooking(row)),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };
  }

  /**
   * Find booking by payment reference
   * @param {string} paymentReference - Payment reference/transaction ID
   * @returns {Promise<Object|null>} Booking object or null if not found
   */
  static async findByPaymentReference(paymentReference) {
    const query = `
      SELECT id, user_id, court_id, booking_date, start_time, end_time, final_price, booking_status, 
             payment_reference, cancellation_reason, expires_at, created_at, updated_at
      FROM bookings
      WHERE payment_reference = $1
    `;
    const result = await pool.query(query, [paymentReference]);
    return result.rows[0] ? this._formatBooking(result.rows[0]) : null;
  }

  /**
   * Get all bookings (with pagination and filtering)
   * @param {Object} [options={}] - Query options
   * @param {number} [options.limit=50] - Number of records to return
   * @param {number} [options.offset=0] - Number of records to skip
   * @param {string} [options.status] - Filter by booking status
   * @param {number} [options.userId] - Filter by user ID
   * @returns {Promise<Object>} Object with bookings array and total count
   */
  static async findAll(options = {}) {
    const { limit = 50, offset = 0, status, userId } = options;
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (status) {
      conditions.push(`booking_status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (userId) {
      conditions.push(`user_id = $${paramCount}`);
      values.push(userId);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT id, user_id, court_id, booking_date, start_time, end_time, final_price, booking_status, 
             payment_reference, payment_proof_image_id, cancellation_reason, expires_at, created_at, updated_at
      FROM bookings
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM bookings
      ${whereClause}
    `;

    values.push(limit, offset);
    const [result, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2))
    ]);

    return {
      bookings: result.rows.map(row => this._formatBooking(row)),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };
  }

  /**
   * Update booking information
   * @param {number} bookingId - Booking ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated booking object or null if not found
   */
  static async update(bookingId, updateData) {
    const allowedFields = ['booking_status', 'payment_reference', 'payment_proof_image_id', 'cancellation_reason'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      const dbField = key === 'bookingStatus' ? 'booking_status' :
                     key === 'paymentReference' ? 'payment_reference' :
                     key === 'paymentProofImageId' ? 'payment_proof_image_id' :
                     key === 'cancellationReason' ? 'cancellation_reason' : key;

      if (allowedFields.includes(dbField) && value !== undefined) {
        updates.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return await this.findById(bookingId);
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(bookingId);

    const query = `
      UPDATE bookings
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, user_id, court_id, booking_date, start_time, end_time, final_price, booking_status, 
                 payment_reference, payment_proof_image_id, cancellation_reason, expires_at, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0] ? this._formatBooking(result.rows[0]) : null;
  }

  /**
   * Confirm booking (after payment)
   * @param {number} bookingId - Booking ID
   * @param {string} paymentReference - Payment transaction reference
   * @returns {Promise<Object|null>} Updated booking object or null if not found
   */
  static async confirm(bookingId, paymentReference) {
    const query = `
      UPDATE bookings
      SET booking_status = 'confirmed', payment_reference = $1, expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, user_id, court_id, booking_date, start_time, end_time, final_price, booking_status, 
                 payment_reference, payment_proof_image_id, cancellation_reason, expires_at, created_at, updated_at
    `;
    const result = await pool.query(query, [paymentReference, bookingId]);
    return result.rows[0] ? this._formatBooking(result.rows[0]) : null;
  }

  /**
   * Cancel booking
   * @param {number} bookingId - Booking ID
   * @param {string} [cancellationReason] - Reason for cancellation
   * @returns {Promise<Object|null>} Updated booking object or null if not found
   */
  static async cancel(bookingId, cancellationReason = null) {
    const query = `
      UPDATE bookings
      SET booking_status = 'cancelled', cancellation_reason = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, user_id, court_id, booking_date, start_time, end_time, final_price, booking_status, 
                 payment_reference, payment_proof_image_id, cancellation_reason, expires_at, created_at, updated_at
    `;
    const result = await pool.query(query, [cancellationReason, bookingId]);
    return result.rows[0] ? this._formatBooking(result.rows[0]) : null;
  }

  /**
   * Accept a pending booking (by facility owner)
   * @param {number} bookingId - Booking ID
   * @param {string} [paymentReference] - Payment transaction reference
   * @returns {Promise<Object|null>} Updated booking object or null if not found
   */
  static async accept(bookingId, paymentReference = null) {
    const query = `
      UPDATE bookings
      SET booking_status = 'confirmed', payment_reference = $1, expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, user_id, court_id, booking_date, start_time, end_time, final_price, booking_status, 
                 payment_reference, payment_proof_image_id, cancellation_reason, expires_at, created_at, updated_at
    `;
    const result = await pool.query(query, [paymentReference, bookingId]);
    return result.rows[0] ? this._formatBooking(result.rows[0]) : null;
  }

  /**
   * Reject a pending booking (by facility owner)
   * @param {number} bookingId - Booking ID
   * @param {string} [rejectionReason] - Reason for rejection
   * @returns {Promise<Object|null>} Updated booking object or null if not found
   */
  static async reject(bookingId, rejectionReason = null) {
    const query = `
      UPDATE bookings
      SET booking_status = 'rejected', cancellation_reason = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, user_id, court_id, booking_date, start_time, end_time, final_price, booking_status, 
                 payment_reference, payment_proof_image_id, cancellation_reason, expires_at, created_at, updated_at
    `;
    const result = await pool.query(query, [rejectionReason, bookingId]);
    return result.rows[0] ? this._formatBooking(result.rows[0]) : null;
  }

  /**
   * Mark booking as completed
   * @param {number} bookingId - Booking ID
   * @returns {Promise<Object|null>} Updated booking object or null if not found
   */
  static async markAsCompleted(bookingId) {
    const query = `
      UPDATE bookings
      SET booking_status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, user_id, court_id, booking_date, start_time, end_time, final_price, booking_status, 
                 payment_reference, payment_proof_image_id, cancellation_reason, expires_at, created_at, updated_at
    `;
    const result = await pool.query(query, [bookingId]);
    return result.rows[0] ? this._formatBooking(result.rows[0]) : null;
  }

  /**
   * Format booking object - normalize field names and parse decimal
   * @private
   * @param {Object} row - Raw database row
   * @returns {Object} Formatted booking object
   */
  static _formatBooking(row) {
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      courtId: row.court_id,
      bookingDate: row.booking_date ? new Date(row.booking_date) : null,
      startTime: row.start_time,
      endTime: row.end_time,
      startTimeMinutes: row.start_time,
      endTimeMinutes: row.end_time,
      finalPrice: parseFloat(row.final_price),
      bookingStatus: row.booking_status,
      paymentReference: row.payment_reference,
      paymentProofImageId: row.payment_proof_image_id,
      cancellationReason: row.cancellation_reason,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

module.exports = Booking;

