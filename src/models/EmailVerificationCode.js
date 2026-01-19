const { pool } = require('../config/database');

class EmailVerificationCode {
  /**
   * Get standard code fields for SELECT queries
   * @returns {string} Comma-separated field list
   */
  static _getCodeFields() {
    return [
      'id', 'email', 'code_hash', 'expires_at', 'created_at', 'verified_at',
      'attempts', 'max_attempts', 'is_used', 'ip_address', 'user_agent'
    ].join(', ');
  }

  /**
   * Format code record from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted code object
   */
  static _formatCode(row) {
    if (!row) return null;
    
    return {
      id: row.id,
      email: row.email,
      codeHash: row.code_hash,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      verifiedAt: row.verified_at,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      isUsed: row.is_used,
      ipAddress: row.ip_address,
      userAgent: row.user_agent
    };
  }

  /**
   * Create a new verification code
   * @param {Object} codeData - Code data object
   * @param {string} codeData.email - Email address
   * @param {string} codeData.codeHash - Hashed verification code
   * @param {Date} codeData.expiresAt - Expiration timestamp
   * @param {string} [codeData.ipAddress] - IP address
   * @param {string} [codeData.userAgent] - User agent
   * @param {number} [codeData.maxAttempts=5] - Maximum verification attempts
   * @returns {Promise<Object>} Created code object
   * @throws {Error} If required fields are missing or constraints violated
   */
  static async create(codeData) {
    const {
      email,
      codeHash,
      expiresAt,
      ipAddress = null,
      userAgent = null,
      maxAttempts = 5
    } = codeData;

    if (!email || !codeHash || !expiresAt) {
      throw new Error('Email, codeHash, and expiresAt are required');
    }

    const query = `
      INSERT INTO email_verification_codes (
        email, code_hash, expires_at, ip_address, user_agent, max_attempts
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${this._getCodeFields()}
    `;

    const values = [email, codeHash, expiresAt, ipAddress, userAgent, maxAttempts];
    const result = await pool.query(query, values);
    return this._formatCode(result.rows[0]);
  }

  /**
   * Find active code by email
   * Finds the most recent active (not expired, not used) code for an email
   * @param {string} email - Email address
   * @param {Object} [client] - Database client (for transactions, optional)
   * @returns {Promise<Object|null>} Code object or null if not found
   */
  static async findActiveByEmail(email, client = null) {
    const query = `
      SELECT ${this._getCodeFields()}
      FROM email_verification_codes
      WHERE email = $1
        AND expires_at > NOW()
        AND is_used = FALSE
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (client) {
      const result = await client.query(query, [email]);
      return result.rows.length > 0 ? this._formatCode(result.rows[0]) : null;
    } else {
      const result = await pool.query(query, [email]);
      return result.rows.length > 0 ? this._formatCode(result.rows[0]) : null;
    }
  }

  /**
   * Find active code by email with lock (for transactions)
   * @param {string} email - Email address
   * @param {Object} client - Database client (required for transactions)
   * @returns {Promise<Object|null>} Code object or null if not found
   */
  static async findActiveByEmailWithLock(email, client) {
    if (!client) {
      throw new Error('Database client is required for locking');
    }

    const query = `
      SELECT ${this._getCodeFields()}
      FROM email_verification_codes
      WHERE email = $1
        AND expires_at > NOW()
        AND is_used = FALSE
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `;

    const result = await client.query(query, [email]);
    return result.rows.length > 0 ? this._formatCode(result.rows[0]) : null;
  }

  /**
   * Find code by ID
   * @param {number} codeId - Code ID
   * @returns {Promise<Object|null>} Code object or null if not found
   */
  static async findById(codeId) {
    const query = `
      SELECT ${this._getCodeFields()}
      FROM email_verification_codes
      WHERE id = $1
    `;
    const result = await pool.query(query, [codeId]);
    return result.rows.length > 0 ? this._formatCode(result.rows[0]) : null;
  }

  /**
   * Invalidate all active codes for an email
   * Marks all active codes as expired (soft delete)
   * @param {string} email - Email address
   * @param {Object} [client] - Database client (for transactions, optional)
   * @returns {Promise<number>} Number of codes invalidated
   */
  static async invalidateByEmail(email, client = null) {
    const query = `
      UPDATE email_verification_codes
      SET expires_at = NOW() - INTERVAL '1 second'
      WHERE email = $1
        AND expires_at > NOW()
        AND is_used = FALSE
    `;

    if (client) {
      const result = await client.query(query, [email]);
      return result.rowCount;
    } else {
      const result = await pool.query(query, [email]);
      return result.rowCount;
    }
  }

  /**
   * Increment attempt count for a code
   * @param {number} codeId - Code ID
   * @param {Object} [client] - Database client (for transactions, optional)
   * @returns {Promise<boolean>} True if updated successfully
   */
  static async incrementAttempts(codeId, client = null) {
    const query = `
      UPDATE email_verification_codes
      SET attempts = attempts + 1
      WHERE id = $1
    `;

    if (client) {
      const result = await client.query(query, [codeId]);
      return result.rowCount > 0;
    } else {
      const result = await pool.query(query, [codeId]);
      return result.rowCount > 0;
    }
  }

  /**
   * Mark code as used and set verified timestamp
   * @param {number} codeId - Code ID
   * @param {Date} [verifiedAt] - Verification timestamp (defaults to now)
   * @param {Object} [client] - Database client (for transactions, optional)
   * @returns {Promise<boolean>} True if updated successfully
   */
  static async markAsUsed(codeId, verifiedAt = null, client = null) {
    const verifiedTimestamp = verifiedAt || new Date();
    const query = `
      UPDATE email_verification_codes
      SET is_used = TRUE, verified_at = $1
      WHERE id = $2
    `;

    if (client) {
      const result = await client.query(query, [verifiedTimestamp, codeId]);
      return result.rowCount > 0;
    } else {
      const result = await pool.query(query, [verifiedTimestamp, codeId]);
      return result.rowCount > 0;
    }
  }

  /**
   * Delete expired codes older than specified hours
   * @param {number} [olderThanHours=24] - Delete codes older than this many hours
   * @returns {Promise<number>} Number of codes deleted
   */
  static async deleteExpired(olderThanHours = 24) {
    // Validate parameter to prevent SQL injection
    const hours = parseInt(olderThanHours, 10);
    if (isNaN(hours) || hours < 0) {
      throw new Error('olderThanHours must be a positive number');
    }

    const query = `
      DELETE FROM email_verification_codes
      WHERE created_at < NOW() - INTERVAL '1 hour' * $1
         OR expires_at < NOW() - INTERVAL '1 hour' * $1
    `;

    const result = await pool.query(query, [hours]);
    return result.rowCount;
  }

  /**
   * Check if code is expired
   * @param {Date|string} expiresAt - Expiration timestamp
   * @returns {boolean} True if expired
   */
  static isExpired(expiresAt) {
    if (!expiresAt) return true;
    const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    return expiryDate < new Date();
  }

  /**
   * Check if max attempts reached
   * @param {number} attempts - Current attempt count
   * @param {number} maxAttempts - Maximum allowed attempts
   * @returns {boolean} True if max attempts reached
   */
  static isMaxAttemptsReached(attempts, maxAttempts) {
    return attempts >= maxAttempts;
  }

  /**
   * Get count of codes sent to email in time window
   * @param {string} email - Email address
   * @param {number} windowMinutes - Time window in minutes
   * @returns {Promise<number>} Count of codes
   */
  static async getCodeCountInWindow(email, windowMinutes) {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    const query = `
      SELECT COUNT(*) as count
      FROM email_verification_codes
      WHERE email = $1
        AND created_at >= $2
    `;
    const result = await pool.query(query, [email, windowStart]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get count of codes sent from IP in time window
   * @param {string} ipAddress - IP address
   * @param {number} windowHours - Time window in hours
   * @returns {Promise<number>} Count of codes
   */
  static async getCodeCountByIP(ipAddress, windowHours) {
    if (!ipAddress) return 0;
    
    const query = `
      SELECT COUNT(*) as count
      FROM email_verification_codes
      WHERE ip_address = $1
        AND created_at >= NOW() - INTERVAL '1 hour' * $2
    `;
    const result = await pool.query(query, [ipAddress, windowHours]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = EmailVerificationCode;

