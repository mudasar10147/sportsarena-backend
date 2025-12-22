/**
 * Authorization Middleware
 * 
 * Following API_ARCHITECTURE.md Section 1.5: Authorization
 * 
 * Ensures role-based access control:
 * - Player → can view facilities, book courts, see own bookings
 * - Facility Admin → can add courts, add slots, manage bookings
 * 
 * Note: This middleware should be used AFTER authenticate middleware
 */

const { sendForbidden } = require('../utils/response');

/**
 * Check if user has required role
 * @param {string|string[]} allowedRoles - Single role or array of allowed roles
 * @returns {Function} Express middleware function
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // Ensure user is authenticated (should be set by authenticate middleware)
    if (!req.user) {
      return sendForbidden(res, 'Authentication required.');
    }

    // Convert single role to array for easier checking
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Check if user's role is in allowed roles
    if (!roles.includes(req.user.role)) {
      return sendForbidden(
        res,
        `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      );
    }

    next();
  };
};

/**
 * Require facility_admin role
 */
const requireFacilityAdmin = requireRole('facility_admin');

/**
 * Require platform_admin role
 */
const requirePlatformAdmin = requireRole('platform_admin');

/**
 * Require player role
 */
const requirePlayer = requireRole('player');

/**
 * Require either player or facility_admin role (any authenticated user)
 */
const requireAnyUser = requireRole(['player', 'facility_admin', 'platform_admin']);

/**
 * Check if user owns a resource or is a facility admin
 * Useful for endpoints where users can only access their own resources
 * @param {Function} getResourceOwnerId - Function to get resource owner ID from request
 * @returns {Function} Express middleware function
 */
const requireOwnershipOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    if (!req.user) {
      return sendForbidden(res, 'Authentication required.');
    }

    // Facility admins can access anything
    if (req.user.role === 'facility_admin') {
      return next();
    }

    // Get resource owner ID
    const resourceOwnerId = await getResourceOwnerId(req);

    // Check if user owns the resource
    if (resourceOwnerId !== req.userId) {
      return sendForbidden(res, 'You can only access your own resources.');
    }

    next();
  };
};

module.exports = {
  requireRole,
  requireFacilityAdmin,
  requirePlatformAdmin,
  requirePlayer,
  requireAnyUser,
  requireOwnershipOrAdmin
};

