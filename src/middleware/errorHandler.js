/**
 * Error Handling Middleware
 * 
 * Following API_ARCHITECTURE.md Section 1.7: Error Handling
 * 
 * Handles all errors and returns consistent JSON responses with proper HTTP status codes:
 * - 200 OK → success
 * - 201 Created → resource created
 * - 400 Bad Request → invalid input
 * - 401 Unauthorized → missing/invalid token
 * - 403 Forbidden → insufficient permissions
 * - 404 Not Found → resource not found
 * - 500 Internal Server Error → unexpected errors
 */

const { sendError, sendInternalError, sendValidationError } = require('../utils/response');

/**
 * Global error handler middleware
 * Should be used as the last middleware in the Express app
 */
const errorHandler = (err, req, res, next) => {
  // Log error for debugging
  console.error('Error:', err);

  // Handle known error types
  if (err.name === 'ValidationError') {
    return sendValidationError(res, err.message, err.errors);
  }

  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid or expired token', 'INVALID_TOKEN', 401);
  }

  if (err.name === 'CastError') {
    return sendError(res, 'Invalid resource ID', 'INVALID_ID', 400);
  }

  // Handle database errors
  if (err.code === '23505') { // PostgreSQL unique violation
    return sendError(res, 'Resource already exists', 'DUPLICATE_ENTRY', 409);
  }

  if (err.code === '23503') { // PostgreSQL foreign key violation
    return sendError(res, 'Referenced resource does not exist', 'FOREIGN_KEY_VIOLATION', 400);
  }

  if (err.code === '23514') { // PostgreSQL check constraint violation
    return sendError(res, 'Invalid data provided', 'CHECK_CONSTRAINT_VIOLATION', 400);
  }

  if (err.code === '23502') { // PostgreSQL not null violation
    return sendError(res, 'Required field is missing', 'NOT_NULL_VIOLATION', 400);
  }

  // Handle database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    console.error('Database connection error:', err.message);
    return sendError(res, 'Database connection error. Please try again later.', 'DATABASE_CONNECTION_ERROR', 503);
  }

  // Handle SES API errors
  if (err.name === 'Throttling' || err.name === 'ServiceQuotaExceededException') {
    return sendError(res, 'Email service is temporarily unavailable. Please try again later.', 'EMAIL_SERVICE_UNAVAILABLE', 503);
  }

  if (err.name === 'MessageRejected') {
    return sendError(res, 'Unable to send email. Please check the email address.', 'EMAIL_REJECTED', 400);
  }

  if (err.name === 'MailFromDomainNotVerifiedException') {
    console.error('SES configuration error:', err.message);
    return sendError(res, 'Email service configuration error. Please contact support.', 'EMAIL_CONFIG_ERROR', 500);
  }

  // Handle custom error objects
  if (err.statusCode && err.message) {
    return sendError(res, err.message, err.errorCode, err.statusCode);
  }

  // Default to internal server error
  return sendInternalError(res, err.message || 'An unexpected error occurred');
};

/**
 * 404 Not Found handler
 * Should be used after all routes
 */
const notFoundHandler = (req, res) => {
  return sendError(res, `Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND', 404);
};

module.exports = {
  errorHandler,
  notFoundHandler
};

