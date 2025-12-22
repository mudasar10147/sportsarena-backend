/**
 * Security Utilities
 * 
 * Helper functions for security-related operations:
 * - Secure logging (without sensitive data)
 * - Error normalization (sanitize error messages)
 * - Input sanitization
 */

/**
 * Sanitize error message for client response
 * Removes sensitive information and stack traces
 * 
 * @param {Error} error - Error object
 * @param {string} defaultMessage - Default message if error is sensitive
 * @returns {string} Sanitized error message
 */
const sanitizeError = (error, defaultMessage = 'An error occurred') => {
  if (!error) return defaultMessage;

  const message = error.message || String(error);

  // List of sensitive patterns to remove
  const sensitivePatterns = [
    /password/gi,
    /secret/gi,
    /token/gi,
    /key/gi,
    /credential/gi,
    /authorization/gi,
    /sql/gi,
    /database/gi,
    /connection/gi,
    /stack trace/gi,
    /at \w+\./gi, // Stack trace patterns
    /node_modules/gi
  ];

  // Check if message contains sensitive information
  const containsSensitive = sensitivePatterns.some(pattern => pattern.test(message));

  if (containsSensitive) {
    return defaultMessage;
  }

  // Return sanitized message (limit length to prevent information leakage)
  return message.length > 200 ? message.substring(0, 200) + '...' : message;
};

/**
 * Log security event without sensitive data
 * 
 * @param {string} event - Event type (e.g., 'auth_attempt', 'auth_success', 'auth_failure')
 * @param {Object} context - Context object (will be sanitized)
 * @param {string} level - Log level ('info', 'warn', 'error')
 */
const logSecurityEvent = (event, context = {}, level = 'info') => {
  // Sanitize context - remove sensitive fields
  const sanitizedContext = {
    ...context,
    // Remove sensitive fields
    idToken: context.idToken ? '[REDACTED]' : undefined,
    token: context.token ? '[REDACTED]' : undefined,
    password: context.password ? '[REDACTED]' : undefined,
    passwordHash: context.passwordHash ? '[REDACTED]' : undefined,
    secret: context.secret ? '[REDACTED]' : undefined,
    // Keep safe fields
    userId: context.userId,
    email: context.email ? context.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : undefined, // Mask email
    ip: context.ip,
    userAgent: context.userAgent,
    timestamp: new Date().toISOString()
  };

  // Remove undefined fields
  Object.keys(sanitizedContext).forEach(key => {
    if (sanitizedContext[key] === undefined) {
      delete sanitizedContext[key];
    }
  });

  const logMessage = `[SECURITY] ${event}: ${JSON.stringify(sanitizedContext)}`;

  switch (level) {
    case 'error':
      console.error(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    default:
      console.log(logMessage);
  }
};

/**
 * Validate Google ID token format
 * Basic format validation before sending to Google API
 * 
 * @param {string} token - Google ID token
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateTokenFormat = (token) => {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token must be a non-empty string' };
  }

  const trimmed = token.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Token cannot be empty' };
  }

  // Google ID tokens are JWT format: three base64url-encoded parts separated by dots
  // Minimum reasonable length (header.payload.signature)
  if (trimmed.length < 100) {
    return { valid: false, error: 'Token format appears invalid' };
  }

  // Check for JWT format (three parts separated by dots)
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Token must be in JWT format' };
  }

  // Check each part is base64url-like (basic check)
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
  for (const part of parts) {
    if (!base64UrlRegex.test(part)) {
      return { valid: false, error: 'Token contains invalid characters' };
    }
  }

  // Maximum reasonable length (prevent DoS)
  if (trimmed.length > 10000) {
    return { valid: false, error: 'Token is too long' };
  }

  return { valid: true };
};

/**
 * Get client IP address from request
 * Handles proxy headers (X-Forwarded-For, etc.)
 * 
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
const getClientIp = (req) => {
  return req.ip ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
};

/**
 * Get user agent from request
 * 
 * @param {Object} req - Express request object
 * @returns {string} User agent string
 */
const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

module.exports = {
  sanitizeError,
  logSecurityEvent,
  validateTokenFormat,
  getClientIp,
  getUserAgent
};

