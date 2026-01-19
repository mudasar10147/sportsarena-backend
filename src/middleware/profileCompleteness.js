/**
 * Profile Completeness Middleware
 * 
 * Ensures users with incomplete profiles cannot access application data.
 * Blocks access to facilities, courts, bookings, and other data endpoints
 * until profile is complete.
 * 
 * Profile is considered complete if:
 * - Email-based users: firstName, lastName, and password are set
 * - OAuth users (Google): firstName and lastName are set (password not required)
 * 
 * Excluded routes (always allowed):
 * - GET /api/v1/users/profile - User needs to see their profile
 * - POST /api/v1/users/complete-signup - User needs to complete profile
 * - GET /api/v1/users/verification-status - User needs to check status
 */

const { sendError } = require('../utils/response');
const User = require('../models/User');
const { checkProfileCompleteness } = require('../services/userService');
const { pool } = require('../config/database');

/**
 * Check if user profile is complete
 * Blocks access to data endpoints if profile is incomplete
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const requireCompleteProfile = async (req, res, next) => {
  try {
    // Only check if user is authenticated
    if (!req.userId) {
      // Not authenticated - let other middleware handle it
      return next();
    }

    // Get user from database (already verified by authenticate middleware)
    const user = await User.findById(req.userId);

    if (!user) {
      // User not found - this shouldn't happen if authenticate middleware worked
      return sendError(res, 'User not found', 'USER_NOT_FOUND', 404);
    }

    // Check if password_hash exists in database (without returning the hash)
    // This is needed because User.findById() doesn't include password_hash for security
    let hasPassword = false;
    if (user.auth_provider === 'email' || !user.auth_provider) {
      try {
        const passwordCheckQuery = `
          SELECT password_hash IS NOT NULL as has_password
          FROM users
          WHERE id = $1
        `;
        const passwordResult = await pool.query(passwordCheckQuery, [req.userId]);
        hasPassword = passwordResult.rows[0]?.has_password || false;
      } catch (error) {
        // If query fails, fall back to checking signup_status
        // Active email-based users should have a password
        hasPassword = user.signup_status === 'active';
        console.warn(`[Profile Completeness Middleware] Failed to check password for user ${req.userId}, using signup_status fallback:`, error.message);
      }
    }

    // Add hasPassword to user object for completeness check
    const userWithPassword = {
      ...user,
      password_hash: hasPassword ? 'exists' : null // Use 'exists' as placeholder, not actual hash
    };

    // Check profile completeness
    const completeness = checkProfileCompleteness(userWithPassword);

    // If profile is incomplete, block access
    if (!completeness.isComplete) {
      return sendError(
        res,
        'Profile is incomplete. Please complete your profile to access this feature.',
        'PROFILE_INCOMPLETE',
        403,
        {
          missingFields: completeness.missingFields,
          signupStatus: user.signup_status
        }
      );
    }

    // Profile is complete - allow access
    next();
  } catch (error) {
    // If something fails, let it pass through to error handler
    next(error);
  }
};

module.exports = {
  requireCompleteProfile
};
