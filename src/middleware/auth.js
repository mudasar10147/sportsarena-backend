/**
 * Authentication Middleware
 * 
 * Following API_ARCHITECTURE.md Section 1.5: Authentication
 * 
 * Uses JWT tokens for authentication:
 * - User logs in → backend returns JWT
 * - App stores JWT → sends it in Authorization: Bearer <token> header
 * - Middleware verifies token and attaches user to request
 */

const { sendUnauthorized } = require('../utils/response');
const { verifyToken, verifyAuthToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Verify JWT token and attach user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendUnauthorized(res, 'No token provided. Please include Authorization: Bearer <token> header.');
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return sendUnauthorized(res, 'Token is missing.');
    }

    // Verify token
    const decoded = verifyToken(token);

    // Find user in database
    const user = await User.findById(decoded.userId);

    if (!user) {
      return sendUnauthorized(res, 'User not found. Token may be invalid.');
    }

    if (!user.is_active) {
      return sendUnauthorized(res, 'User account is inactive.');
    }

    // Attach user to request object
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return sendUnauthorized(res, 'Invalid token.');
    }

    if (error.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Token has expired. Please login again.');
    }

    return sendUnauthorized(res, 'Authentication failed.');
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for endpoints that work with or without authentication
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);

      if (user && user.is_active) {
        req.user = user;
        req.userId = user.id;
      }
    }
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
};

/**
 * Simple token verification middleware (optional helper)
 * Verifies token and attaches decoded payload to request
 * Does NOT fetch user from database - use authenticate() for full auth
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 * 
 * @example
 * // For endpoints that only need token validation without user lookup
 * router.get('/public-data', verifyAuthToken, (req, res) => {
 *   const userId = req.token.userId;
 *   // Use userId without fetching full user
 * });
 */
const verifyAuthTokenMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendUnauthorized(res, 'No token provided. Please include Authorization: Bearer <token> header.');
    }

    const token = authHeader.substring(7);

    if (!token) {
      return sendUnauthorized(res, 'Token is missing.');
    }

    // Verify token and attach decoded payload
    const decoded = verifyAuthToken(token);
    req.token = decoded;
    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return sendUnauthorized(res, 'Invalid token.');
    }

    if (error.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Token has expired. Please login again.');
    }

    return sendUnauthorized(res, 'Token verification failed.');
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  verifyAuthToken: verifyAuthTokenMiddleware
};

