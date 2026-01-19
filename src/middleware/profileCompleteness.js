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

    // Check profile completeness
    const completeness = checkProfileCompleteness(user);

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
