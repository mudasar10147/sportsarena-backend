const { pool } = require('../config/database');

class PaymentTransaction {
  /**
   * Create a new payment transaction
   * @param {Object} transactionData - Payment transaction data object
   * @param {number} transactionData.bookingId - Booking ID (optional)
   * @param {number} transactionData.amount - Payment amount in PKR
   * @param {string} transactionData.paymentMethod - Payment method (e.g., 'card', 'bank_transfer')
   * @param {string} [transactionData.status='pending'] - Transaction status
   * @param {string} [transactionData.gatewayName] - Payment gateway name (e.g., 'stripe', 'razorpay')
   * @param {string} [transactionData.gatewayTransactionId] - Gateway transaction ID
   * @param {Object} [transactionData.gatewayResponse] - Full gateway response (stored as JSON)
   * @param {string} [transactionData.failureReason] - Reason for failure (if failed)
   * @returns {Promise<Object>} Created payment transaction object
   */
  static async create(transactionData) {
    const {
      bookingId = null,
      amount,
      paymentMethod,
      status = 'pending',
      gatewayName = null,
      gatewayTransactionId = null,
      gatewayResponse = null,
      failureReason = null
    } = transactionData;

    const query = `
      INSERT INTO payment_transactions (
        booking_id, amount, payment_method, status, gateway_name,
        gateway_transaction_id, gateway_response, failure_reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, booking_id, amount, payment_method, status, gateway_name,
                gateway_transaction_id, gateway_response, failure_reason, created_at, updated_at
    `;

    const values = [
      bookingId,
      amount,
      paymentMethod,
      status,
      gatewayName,
      gatewayTransactionId,
      gatewayResponse ? JSON.stringify(gatewayResponse) : null,
      failureReason
    ];

    const result = await pool.query(query, values);
    return this._formatTransaction(result.rows[0]);
  }

  /**
   * Find payment transaction by ID
   * @param {number} transactionId - Payment transaction ID
   * @returns {Promise<Object|null>} Payment transaction object or null if not found
   */
  static async findById(transactionId) {
    const query = `
      SELECT id, booking_id, amount, payment_method, status, gateway_name,
             gateway_transaction_id, gateway_response, failure_reason, created_at, updated_at
      FROM payment_transactions
      WHERE id = $1
    `;
    const result = await pool.query(query, [transactionId]);
    return result.rows[0] ? this._formatTransaction(result.rows[0]) : null;
  }

  /**
   * Find payment transactions by booking ID
   * @param {number} bookingId - Booking ID
   * @returns {Promise<Array>} Array of payment transaction objects
   */
  static async findByBookingId(bookingId) {
    const query = `
      SELECT id, booking_id, amount, payment_method, status, gateway_name,
             gateway_transaction_id, gateway_response, failure_reason, created_at, updated_at
      FROM payment_transactions
      WHERE booking_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [bookingId]);
    return result.rows.map(row => this._formatTransaction(row));
  }

  /**
   * Find payment transaction by gateway transaction ID
   * @param {string} gatewayTransactionId - Gateway transaction ID
   * @returns {Promise<Object|null>} Payment transaction object or null if not found
   */
  static async findByGatewayTransactionId(gatewayTransactionId) {
    const query = `
      SELECT id, booking_id, amount, payment_method, status, gateway_name,
             gateway_transaction_id, gateway_response, failure_reason, created_at, updated_at
      FROM payment_transactions
      WHERE gateway_transaction_id = $1
    `;
    const result = await pool.query(query, [gatewayTransactionId]);
    return result.rows[0] ? this._formatTransaction(result.rows[0]) : null;
  }

  /**
   * Get all payment transactions (with pagination and filtering)
   * @param {Object} [options={}] - Query options
   * @param {number} [options.limit=50] - Number of records to return
   * @param {number} [options.offset=0] - Number of records to skip
   * @param {string} [options.status] - Filter by status
   * @param {number} [options.bookingId] - Filter by booking ID
   * @param {string} [options.gatewayName] - Filter by gateway name
   * @returns {Promise<Object>} Object with transactions array and total count
   */
  static async findAll(options = {}) {
    const { limit = 50, offset = 0, status, bookingId, gatewayName } = options;
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (status) {
      conditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (bookingId) {
      conditions.push(`booking_id = $${paramCount}`);
      values.push(bookingId);
      paramCount++;
    }

    if (gatewayName) {
      conditions.push(`gateway_name = $${paramCount}`);
      values.push(gatewayName);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT id, booking_id, amount, payment_method, status, gateway_name,
             gateway_transaction_id, gateway_response, failure_reason, created_at, updated_at
      FROM payment_transactions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM payment_transactions
      ${whereClause}
    `;

    values.push(limit, offset);
    const [result, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2))
    ]);

    return {
      transactions: result.rows.map(row => this._formatTransaction(row)),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };
  }

  /**
   * Update payment transaction
   * @param {number} transactionId - Payment transaction ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated payment transaction object or null if not found
   */
  static async update(transactionId, updateData) {
    const allowedFields = ['status', 'gateway_transaction_id', 'gateway_response', 'failure_reason'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      const dbField = key === 'gatewayTransactionId' ? 'gateway_transaction_id' :
                     key === 'gatewayResponse' ? 'gateway_response' :
                     key === 'failureReason' ? 'failure_reason' : key;

      if (allowedFields.includes(dbField) && value !== undefined) {
        if (dbField === 'gateway_response') {
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
      return await this.findById(transactionId);
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(transactionId);

    const query = `
      UPDATE payment_transactions
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, booking_id, amount, payment_method, status, gateway_name,
                gateway_transaction_id, gateway_response, failure_reason, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0] ? this._formatTransaction(result.rows[0]) : null;
  }

  /**
   * Mark transaction as success
   * @param {number} transactionId - Payment transaction ID
   * @param {string} gatewayTransactionId - Gateway transaction ID
   * @param {Object} [gatewayResponse] - Full gateway response
   * @returns {Promise<Object|null>} Updated payment transaction object or null if not found
   */
  static async markAsSuccess(transactionId, gatewayTransactionId, gatewayResponse = null) {
    const updateData = {
      status: 'success',
      gatewayTransactionId,
      gatewayResponse
    };
    return this.update(transactionId, updateData);
  }

  /**
   * Mark transaction as failed
   * @param {number} transactionId - Payment transaction ID
   * @param {string} failureReason - Reason for failure
   * @param {Object} [gatewayResponse] - Full gateway response
   * @returns {Promise<Object|null>} Updated payment transaction object or null if not found
   */
  static async markAsFailed(transactionId, failureReason, gatewayResponse = null) {
    const updateData = {
      status: 'failed',
      failureReason,
      gatewayResponse
    };
    return this.update(transactionId, updateData);
  }

  /**
   * Mark transaction as refunded
   * @param {number} transactionId - Payment transaction ID
   * @param {Object} [gatewayResponse] - Refund gateway response
   * @returns {Promise<Object|null>} Updated payment transaction object or null if not found
   */
  static async markAsRefunded(transactionId, gatewayResponse = null) {
    const updateData = {
      status: 'refunded',
      gatewayResponse
    };
    return this.update(transactionId, updateData);
  }

  /**
   * Format payment transaction object - normalize field names and parse JSON
   * @private
   * @param {Object} row - Raw database row
   * @returns {Object} Formatted payment transaction object
   */
  static _formatTransaction(row) {
    if (!row) return null;

    return {
      id: row.id,
      bookingId: row.booking_id,
      amount: parseFloat(row.amount),
      paymentMethod: row.payment_method,
      status: row.status,
      gatewayName: row.gateway_name,
      gatewayTransactionId: row.gateway_transaction_id,
      gatewayResponse: typeof row.gateway_response === 'string' 
        ? JSON.parse(row.gateway_response) 
        : (row.gateway_response || null),
      failureReason: row.failure_reason,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

module.exports = PaymentTransaction;

