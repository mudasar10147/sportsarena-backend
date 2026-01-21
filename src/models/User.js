const { pool } = require('../config/database');

class User {
  /**
   * Get standard user fields for SELECT queries
   * @param {boolean} includePassword - Whether to include password_hash
   * @returns {string} Comma-separated field list
   */
  static _getUserFields(includePassword = false) {
    const baseFields = [
      'id', 'email', 'username', 'first_name', 'last_name', 'phone', 'role',
      'is_active', 'email_verified', 'signup_status', 'auth_provider', 'provider_id', 'avatar',
      'created_at', 'updated_at'
    ];
    
    if (includePassword) {
      baseFields.splice(3, 0, 'password_hash'); // Insert after username
    }
    
    return baseFields.join(', ');
  }

  /**
   * Create a new user
   * Supports both email-based and OAuth-based (e.g., Google) authentication
   * @param {Object} userData - User data object
   * @param {string} userData.email - User email
   * @param {string} [userData.username] - User username (optional for OAuth users)
   * @param {string} [userData.passwordHash] - Hashed password (required for email auth, null for OAuth)
   * @param {string} userData.firstName - User first name
   * @param {string} userData.lastName - User last name
   * @param {string} [userData.phone] - User phone number
   * @param {string} [userData.role='player'] - User role (player or facility_admin)
   * @param {string} [userData.authProvider='email'] - Auth provider ('email' or 'google')
   * @param {string} [userData.providerId] - Provider-specific user ID (e.g., Google user ID)
   * @param {string} [userData.avatar] - User profile picture URL
   * @returns {Promise<Object>} Created user object (without password)
   * @throws {Error} If required fields are missing or constraints violated
   */
  static async create(userData) {
    const {
      email,
      username = null,
      passwordHash = null,
      firstName,
      lastName,
      phone = null,
      role = 'player',
      authProvider = 'email',
      providerId = null,
      avatar = null
    } = userData;

    // Validate: email auth requires password, OAuth requires providerId
    if (authProvider === 'email' && !passwordHash) {
      throw new Error('Password hash is required for email-based authentication');
    }
    
    if (authProvider === 'google' && !providerId) {
      throw new Error('Provider ID is required for Google authentication');
    }

    const query = `
      INSERT INTO users (
        email, username, password_hash, first_name, last_name, phone, role,
        auth_provider, provider_id, avatar
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${this._getUserFields()}
    `;

    const values = [
      email, username, passwordHash, firstName, lastName, phone, role,
      authProvider, providerId, avatar
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Find user by ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findById(userId) {
    const query = `
      SELECT ${this._getUserFields()}
      FROM users
      WHERE id = $1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @param {boolean} includePassword - Whether to include password_hash in result
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findByEmail(email, includePassword = false) {
    const query = `
      SELECT ${this._getUserFields(includePassword)}
      FROM users
      WHERE email = $1
    `;
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Find user by username
   * @param {string} username - User username
   * @param {boolean} includePassword - Whether to include password_hash in result
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findByUsername(username, includePassword = false) {
    const query = `
      SELECT ${this._getUserFields(includePassword)}
      FROM users
      WHERE username = $1
    `;
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  /**
   * Find user by auth provider and provider ID
   * Used for OAuth authentication (e.g., Google login)
   * @param {string} authProvider - Auth provider ('email', 'google', etc.)
   * @param {string} providerId - Provider-specific user ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findByProvider(authProvider, providerId) {
    const query = `
      SELECT ${this._getUserFields()}
      FROM users
      WHERE auth_provider = $1 AND provider_id = $2
    `;
    const result = await pool.query(query, [authProvider, providerId]);
    return result.rows[0] || null;
  }

  /**
   * Update user information
   * @param {number} userId - User ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object|null>} Updated user object or null if not found
   */
  static async update(userId, updateData) {
    const allowedFields = ['first_name', 'last_name', 'phone', 'is_active', 'email_verified', 'signup_status', 'avatar', 'password_hash'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      const dbField = key === 'firstName' ? 'first_name' :
                     key === 'lastName' ? 'last_name' :
                     key === 'isActive' ? 'is_active' :
                     key === 'emailVerified' ? 'email_verified' :
                     key === 'signupStatus' ? 'signup_status' :
                     key === 'passwordHash' ? 'password_hash' :
                     key === 'avatar' ? 'avatar' : key;

      if (allowedFields.includes(dbField) && value !== undefined) {
        updates.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return await this.findById(userId);
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING ${this._getUserFields()}
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Link OAuth provider (e.g., Google) to existing user account
   * Allows users to link their Google account to an existing email-based account
   * Note: This updates the primary auth_provider to the OAuth provider, but preserves
   * the password_hash so users can still login with email if needed
   * @param {number} userId - User ID
   * @param {string} authProvider - Auth provider ('google', etc.)
   * @param {string} providerId - Provider-specific user ID
   * @param {string} [avatar] - Optional avatar URL from provider
   * @returns {Promise<Object|null>} Updated user object or null if not found
   * @throws {Error} If provider is already linked to another account
   */
  static async linkProvider(userId, authProvider, providerId, avatar = null) {
    // Check if provider is already linked to a different user
    const existingUser = await this.findByProvider(authProvider, providerId);
    if (existingUser && existingUser.id !== userId) {
      throw new Error(`This ${authProvider} account is already linked to another user`);
    }

    // Check if user exists
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }

    // Update user with provider information
    // Note: We update auth_provider but keep password_hash for backward compatibility
    const updates = [
      `auth_provider = $1`,
      `provider_id = $2`,
      `updated_at = CURRENT_TIMESTAMP`
    ];
    const values = [authProvider, providerId];
    let paramCount = 3;

    if (avatar) {
      updates.push(`avatar = $${paramCount}`);
      values.push(avatar);
      paramCount++;
    }

    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING ${this._getUserFields()}
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Update user password
   * @param {number} userId - User ID
   * @param {string} newPasswordHash - New hashed password
   * @returns {Promise<boolean>} True if updated successfully
   */
  static async updatePassword(userId, newPasswordHash) {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    const result = await pool.query(query, [newPasswordHash, userId]);
    return result.rowCount > 0;
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if email exists
   */
  static async emailExists(email) {
    const query = 'SELECT 1 FROM users WHERE email = $1 LIMIT 1';
    const result = await pool.query(query, [email]);
    return result.rows.length > 0;
  }

  /**
   * Check if username exists
   * @param {string} username - Username to check
   * @returns {Promise<boolean>} True if username exists
   */
  static async usernameExists(username) {
    const query = 'SELECT 1 FROM users WHERE username = $1 LIMIT 1';
    const result = await pool.query(query, [username]);
    return result.rows.length > 0;
  }

  /**
   * Check if username exists and get its account status
   * @param {string} username - Username to check
   * @returns {Promise<Object|null>} Account info with completeness status or null if username doesn't exist
   */
  static async getUsernameAccountStatus(username) {
    const query = `
      SELECT 
        id,
        email,
        username,
        email_verified,
        signup_status,
        password_hash IS NOT NULL as has_password,
        is_active
      FROM users
      WHERE username = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // Determine account state
    let accountState = 'not_found';
    if (row.email_verified && row.has_password && row.signup_status === 'active') {
      accountState = 'complete';
    } else if (row.email_verified && !row.has_password) {
      accountState = 'incomplete';
    } else if (!row.email_verified) {
      accountState = 'unverified';
    }

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      emailVerified: row.email_verified,
      signupStatus: row.signup_status,
      hasPassword: row.has_password,
      isActive: row.is_active,
      accountState
    };
  }

  /**
   * Get account status for email
   * Returns account information including signup_status, email_verified, and password status
   * @param {string} email - Email to check
   * @returns {Promise<Object|null>} Account status object or null if email doesn't exist
   */
  static async getAccountStatus(email) {
    const query = `
      SELECT 
        id,
        email,
        username,
        email_verified,
        signup_status,
        password_hash IS NOT NULL as has_password,
        is_active
      FROM users
      WHERE email = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // Determine account state
    let accountState = 'not_found';
    if (row.email_verified && row.has_password && row.signup_status === 'active') {
      accountState = 'complete';
    } else if (row.email_verified && !row.has_password) {
      accountState = 'incomplete';
    } else if (!row.email_verified) {
      accountState = 'unverified';
    }

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      emailVerified: row.email_verified,
      signupStatus: row.signup_status,
      hasPassword: row.has_password,
      isActive: row.is_active,
      accountState
    };
  }

  /**
   * Get all users (with pagination)
   * @param {Object} options - Query options
   * @param {number} [options.limit=50] - Number of records to return
   * @param {number} [options.offset=0] - Number of records to skip
   * @param {string} [options.role] - Filter by role
   * @param {boolean} [options.isActive] - Filter by active status
   * @returns {Promise<Object>} Object with users array and total count
   */
  static async findAll(options = {}) {
    const { limit = 50, offset = 0, role, isActive } = options;
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (role) {
      conditions.push(`role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    if (isActive !== undefined) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(isActive);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT ${this._getUserFields()}
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM users
      ${whereClause}
    `;

    values.push(limit, offset);
    const [result, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, -2))
    ]);

    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    };
  }

  /**
   * Delete user (soft delete - sets is_active to false)
   * Also deactivates related entities for facility admins
   * 
   * Soft delete behavior:
   * 1. Sets user is_active = FALSE
   * 2. For facility admins: sets their facilities is_active = FALSE
   * 3. For facility admins: sets courts in their facilities is_active = FALSE
   * 4. All data is preserved (bookings, images, availability rules, etc.)
   * 
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async delete(userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get user info (role)
      const userResult = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      
      const { role } = userResult.rows[0];
      
      // If user is a facility_admin, deactivate their facilities and courts
      if (role === 'facility_admin') {
        // Get all facility IDs owned by this user
        const facilitiesResult = await client.query('SELECT id FROM facilities WHERE owner_id = $1', [userId]);
        const facilityIds = facilitiesResult.rows.map(row => row.id);
        
        if (facilityIds.length > 0) {
          // Deactivate all courts in these facilities
          await client.query(`
            UPDATE courts 
            SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE facility_id = ANY($1)
          `, [facilityIds]);
          
          // Deactivate all facilities owned by this user
          await client.query(`
            UPDATE facilities 
            SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE owner_id = $1
          `, [userId]);
        }
      }
      
      // Soft delete the user (set is_active to false)
      const result = await client.query(`
        UPDATE users 
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);
      
      await client.query('COMMIT');
      return result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = User;

