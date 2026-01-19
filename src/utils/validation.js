/**
 * Validation Utilities
 * 
 * Provides input validation and sanitization functions
 */

/**
 * Sanitize string input
 * Removes leading/trailing whitespace and normalizes
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
const sanitizeString = (input) => {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim();
};

/**
 * Sanitize email address
 * Normalizes email (lowercase, trim)
 * @param {string} email - Email address
 * @returns {string} Sanitized email
 */
const sanitizeEmail = (email) => {
  if (typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateEmailFormat = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const sanitized = sanitizeEmail(email);

  if (!sanitized) {
    return { valid: false, error: 'Email cannot be empty' };
  }

  // Email length validation (max 255 characters as per database)
  if (sanitized.length > 255) {
    return { valid: false, error: 'Email is too long. Maximum 255 characters allowed' };
  }

  // Email format validation (RFC 5322 compliant regex)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(sanitized)) {
    return { valid: false, error: 'Invalid email format. Please provide a valid email address' };
  }

  return { valid: true, email: sanitized };
};

/**
 * Validate verification code format
 * @param {string} code - Verification code
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateVerificationCode = (code) => {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Verification code is required' };
  }

  // Remove any whitespace
  const sanitized = code.trim().replace(/\s/g, '');

  if (!sanitized) {
    return { valid: false, error: 'Verification code cannot be empty' };
  }

  // Must be exactly 6 digits
  if (!/^\d{6}$/.test(sanitized)) {
    return { valid: false, error: 'Invalid code format. Code must be exactly 6 digits.' };
  }

  return { valid: true, code: sanitized };
};

/**
 * Sanitize and validate email for verification
 * @param {string} email - Email address
 * @returns {Object} { valid: boolean, email?: string, error?: string }
 */
const sanitizeAndValidateEmail = (email) => {
  return validateEmailFormat(email);
};

/**
 * Sanitize and validate verification code
 * @param {string} code - Verification code
 * @returns {Object} { valid: boolean, code?: string, error?: string }
 */
const sanitizeAndValidateCode = (code) => {
  return validateVerificationCode(code);
};

module.exports = {
  sanitizeString,
  sanitizeEmail,
  validateEmailFormat,
  validateVerificationCode,
  sanitizeAndValidateEmail,
  sanitizeAndValidateCode
};

