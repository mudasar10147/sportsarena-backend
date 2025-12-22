/**
 * JWT Utility Functions
 * 
 * Helper functions for generating and managing JWT tokens
 * Used for authentication (API_ARCHITECTURE.md Section 1.5)
 * 
 * Token Structure:
 * - Access Token: Short-lived (7 days), contains userId, role, provider
 * - Refresh Token: Long-lived (future), for obtaining new access tokens
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // Default: 7 days
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d'; // Future: 30 days

/**
 * Generate authentication JWT token for a user
 * Includes userId, role, and provider for authorization
 * 
 * @param {Object} user - User object with id, role, and auth_provider
 * @param {number} user.id - User ID
 * @param {string} user.role - User role (player, facility_admin, platform_admin)
 * @param {string} user.auth_provider - Auth provider (email, google)
 * @param {string} [expiresIn] - Token expiration time (default: 7d)
 * @returns {string} JWT access token
 * 
 * @example
 * const token = generateAuthToken({
 *   id: 1,
 *   role: 'player',
 *   auth_provider: 'google'
 * });
 */
const generateAuthToken = (user, expiresIn = JWT_EXPIRES_IN) => {
  if (!user || !user.id) {
    throw new Error('User object with id is required');
  }

  const payload = {
    userId: user.id,
    role: user.role || 'player',
    provider: user.auth_provider || 'email'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: 'sportsarena-api',
    audience: 'sportsarena-client'
  });
};

/**
 * Verify JWT authentication token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload with userId, role, provider
 * @throws {Error} If token is invalid or expired
 */
const verifyAuthToken = (token) => {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'sportsarena-api',
    audience: 'sportsarena-client'
  });
};

/**
 * Generate refresh token (for future implementation)
 * Long-lived token used to obtain new access tokens
 * 
 * @param {Object} user - User object with id
 * @param {number} user.id - User ID
 * @param {string} [expiresIn] - Token expiration time (default: 30d)
 * @returns {string} JWT refresh token
 * 
 * @example
 * // Future implementation
 * const refreshToken = generateRefreshToken({ id: 1 });
 */
const generateRefreshToken = (user, expiresIn = JWT_REFRESH_EXPIRES_IN) => {
  if (!user || !user.id) {
    throw new Error('User object with id is required');
  }

  const payload = {
    userId: user.id,
    type: 'refresh'
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn,
    issuer: 'sportsarena-api',
    audience: 'sportsarena-client'
  });
};

/**
 * Verify refresh token (for future implementation)
 * @param {string} token - Refresh token to verify
 * @returns {Object} Decoded token payload with userId
 * @throws {Error} If token is invalid or expired
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET, {
    issuer: 'sportsarena-api',
    audience: 'sportsarena-client'
  });
};

/**
 * Generate JWT token for a user (legacy - for backward compatibility)
 * @deprecated Use generateAuthToken instead
 * @param {Object} user - User object with id and other properties
 * @param {string} expiresIn - Token expiration time (default: 7d)
 * @returns {string} JWT token
 */
const generateToken = (user, expiresIn = JWT_EXPIRES_IN) => {
  // Map to new function for backward compatibility
  return generateAuthToken(user, expiresIn);
};

/**
 * Verify JWT token (legacy - for backward compatibility)
 * @deprecated Use verifyAuthToken instead
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = (token) => {
  // Try new format first, fall back to old format for backward compatibility
  try {
    return verifyAuthToken(token);
  } catch (error) {
    // Fall back to old verification (no issuer/audience check)
    return jwt.verify(token, JWT_SECRET);
  }
};

module.exports = {
  // New functions
  generateAuthToken,
  verifyAuthToken,
  generateRefreshToken,
  verifyRefreshToken,
  // Legacy functions (for backward compatibility)
  generateToken,
  verifyToken,
  // Constants
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN
};

