/**
 * Response Utility Helpers
 * 
 * Provides consistent JSON response structure for all API endpoints.
 * Following API_ARCHITECTURE.md Section 1.6: Response Structure
 * 
 * All responses follow this format:
 * {
 *   "success": true/false,
 *   "data": {...},
 *   "message": "..."
 * }
 */

/**
 * Send a successful response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send a created response (201)
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Success message
 */
const sendCreated = (res, data = null, message = 'Resource created successfully') => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {string} errorCode - Custom error code for client handling
 * @param {number} statusCode - HTTP status code (default: 400)
 */
const sendError = (res, message = 'An error occurred', errorCode = null, statusCode = 400) => {
  const response = {
    success: false,
    message
  };

  if (errorCode) {
    response.error_code = errorCode;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send unauthorized error (401)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const sendUnauthorized = (res, message = 'Unauthorized. Please provide a valid token.') => {
  return sendError(res, message, 'UNAUTHORIZED', 401);
};

/**
 * Send forbidden error (403)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const sendForbidden = (res, message = 'Forbidden. Insufficient permissions.') => {
  return sendError(res, message, 'FORBIDDEN', 403);
};

/**
 * Send not found error (404)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const sendNotFound = (res, message = 'Resource not found.') => {
  return sendError(res, message, 'NOT_FOUND', 404);
};

/**
 * Send validation error (400)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} errors - Validation errors object (optional)
 */
const sendValidationError = (res, message = 'Validation failed', errors = null) => {
  const response = {
    success: false,
    message,
    error_code: 'VALIDATION_ERROR'
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(400).json(response);
};

/**
 * Send internal server error (500)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const sendInternalError = (res, message = 'Internal server error') => {
  return sendError(res, message, 'INTERNAL_ERROR', 500);
};

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendValidationError,
  sendInternalError
};

