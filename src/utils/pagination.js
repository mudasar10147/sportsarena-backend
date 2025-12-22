/**
 * Pagination Utility
 * 
 * Following API_ARCHITECTURE.md Section 1.8: Optional Enhancements
 * 
 * Provides pagination helpers for endpoints returning large lists
 * (e.g., /facilities, /bookings)
 */

/**
 * Parse pagination parameters from query string
 * @param {Object} query - Express request query object
 * @returns {Object} Pagination parameters { page, limit, offset }
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10)); // Max 100 items per page
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Create pagination metadata
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Pagination metadata
 */
const createPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
};

/**
 * Create paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items for current page
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @param {string} message - Success message
 */
const sendPaginatedResponse = (res, data, page, limit, total, message = 'Success') => {
  const pagination = createPaginationMeta(page, limit, total);

  return res.status(200).json({
    success: true,
    message,
    data,
    pagination
  });
};

module.exports = {
  parsePagination,
  createPaginationMeta,
  sendPaginatedResponse
};

