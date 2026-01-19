/**
 * Email Verification Logger
 * 
 * Provides structured logging for email verification events.
 * Logs are sanitized to prevent information leakage.
 */

const { logSecurityEvent } = require('./security');

/**
 * Mask email address for logging (privacy)
 * @param {string} email - Email address
 * @returns {string} Masked email (e.g., "te***@example.com")
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return '[UNKNOWN]';
  }
  const parts = email.split('@');
  if (parts.length !== 2) {
    return '[INVALID]';
  }
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local}***@${domain}`;
  }
  return `${local.substring(0, 2)}***@${domain}`;
};

/**
 * Log verification code sent event
 * @param {string} email - Email address (will be masked)
 * @param {string} ipAddress - IP address
 * @param {Object} metadata - Additional metadata
 */
const logCodeSent = (email, ipAddress = null, metadata = {}) => {
  logSecurityEvent('email_verification_code_sent', {
    email: maskEmail(email),
    ip: ipAddress,
    ...metadata
  }, 'info');
};

/**
 * Log verification attempt (success)
 * @param {string} email - Email address (will be masked)
 * @param {string} ipAddress - IP address
 * @param {Object} metadata - Additional metadata
 */
const logVerificationSuccess = (email, ipAddress = null, metadata = {}) => {
  logSecurityEvent('email_verification_success', {
    email: maskEmail(email),
    ip: ipAddress,
    ...metadata
  }, 'info');
};

/**
 * Log verification attempt (failure)
 * @param {string} email - Email address (will be masked)
 * @param {string} reason - Failure reason
 * @param {string} ipAddress - IP address
 * @param {Object} metadata - Additional metadata
 */
const logVerificationFailure = (email, reason, ipAddress = null, metadata = {}) => {
  logSecurityEvent('email_verification_failure', {
    email: maskEmail(email),
    reason,
    ip: ipAddress,
    ...metadata
  }, 'warn');
};

/**
 * Log rate limit hit
 * @param {string} type - Rate limit type ('email', 'ip', 'resend_cooldown')
 * @param {string} email - Email address (will be masked)
 * @param {string} ipAddress - IP address
 * @param {Object} metadata - Additional metadata
 */
const logRateLimitHit = (type, email = null, ipAddress = null, metadata = {}) => {
  logSecurityEvent('email_verification_rate_limit', {
    type,
    email: email ? maskEmail(email) : null,
    ip: ipAddress,
    ...metadata
  }, 'warn');
};

/**
 * Log SES error
 * @param {string} email - Email address (will be masked)
 * @param {string} errorType - Error type
 * @param {string} errorMessage - Error message
 * @param {Object} metadata - Additional metadata
 */
const logSESError = (email, errorType, errorMessage, metadata = {}) => {
  logSecurityEvent('email_verification_ses_error', {
    email: maskEmail(email),
    errorType,
    errorMessage: errorMessage.substring(0, 200), // Limit length
    ...metadata
  }, 'error');
};

/**
 * Log cleanup job execution
 * @param {number} deletedCount - Number of codes deleted
 * @param {number} olderThanHours - Age threshold
 */
const logCleanupJob = (deletedCount, olderThanHours) => {
  console.log(`[Email Verification] Cleanup job completed: ${deletedCount} codes deleted (older than ${olderThanHours} hours)`);
  logSecurityEvent('email_verification_cleanup', {
    deletedCount,
    olderThanHours
  }, 'info');
};

/**
 * Log database error
 * @param {string} operation - Operation that failed
 * @param {Error} error - Error object
 * @param {Object} metadata - Additional metadata
 */
const logDatabaseError = (operation, error, metadata = {}) => {
  console.error(`[Email Verification] Database error (${operation}):`, error.message);
  logSecurityEvent('email_verification_db_error', {
    operation,
    errorCode: error.code,
    errorMessage: error.message.substring(0, 200),
    ...metadata
  }, 'error');
};

module.exports = {
  logCodeSent,
  logVerificationSuccess,
  logVerificationFailure,
  logRateLimitHit,
  logSESError,
  logCleanupJob,
  logDatabaseError,
  maskEmail
};

