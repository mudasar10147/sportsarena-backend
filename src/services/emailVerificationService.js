/**
 * Email Verification Service
 * 
 * Handles email verification code generation, storage, verification, and cleanup.
 * Includes rate limiting, code hashing, and transaction-safe verification.
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const emailService = require('./emailService');
const emailTemplateService = require('./emailTemplateService');
const User = require('../models/User');
const { sanitizeAndValidateEmail, sanitizeAndValidateCode } = require('../utils/validation');
const {
  logCodeSent,
  logVerificationSuccess,
  logVerificationFailure,
  logRateLimitHit,
  logSESError,
  logCleanupJob,
  logDatabaseError
} = require('../utils/emailVerificationLogger');
const {
  incrementCodesSent,
  incrementVerificationAttempt,
  incrementRateLimitHit,
  incrementSESError,
  recordCleanupJob
} = require('../utils/emailVerificationMetrics');
const { generateAuthToken } = require('../utils/jwt');

// Configuration constants
const CODE_EXPIRATION_MINUTES = 15; // Code expires in 15 minutes
const MAX_ATTEMPTS = 5; // Maximum verification attempts per code
const RESEND_COOLDOWN_SECONDS = 60; // Minimum time between resends (60 seconds)
const RESEND_LIMIT_PER_EMAIL = 3; // Max 3 resends per 15 minutes per email
const RESEND_WINDOW_MINUTES = 15; // Resend rate limit window
const CLEANUP_AGE_HOURS = 24; // Delete codes older than 24 hours

/**
 * Generate a 6-digit numeric verification code
 * @returns {string} 6-digit code (e.g., "123456")
 */
const generateVerificationCode = () => {
  // Generate random integer between 100000 and 999999 (inclusive)
  const code = crypto.randomInt(100000, 999999);
  return code.toString().padStart(6, '0'); // Ensure 6 digits with leading zeros if needed
};

/**
 * Hash verification code using bcrypt
 * @param {string} code - Plain text code
 * @returns {Promise<string>} Hashed code
 */
const hashCode = async (code) => {
  const saltRounds = 10; // Same as passwords
  return await bcrypt.hash(code, saltRounds);
};

/**
 * Verify code against hash
 * @param {string} code - Plain text code
 * @param {string} hash - Hashed code
 * @returns {Promise<boolean>} True if code matches
 */
const verifyCodeHash = async (code, hash) => {
  return await bcrypt.compare(code, hash);
};

/**
 * Check rate limits for sending verification code
 * @param {string} email - Email address
 * @param {string} ipAddress - IP address
 * @returns {Promise<Object>} Object with allowed flag and reason if not allowed
 */
const checkRateLimits = async (email, ipAddress) => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RESEND_WINDOW_MINUTES * 60 * 1000);

  // Check per-email rate limit (max 3 codes per 15 minutes)
  const emailLimitQuery = `
    SELECT COUNT(*) as count
    FROM email_verification_codes
    WHERE email = $1
      AND created_at >= $2
      AND expires_at > NOW()
  `;
  const emailResult = await pool.query(emailLimitQuery, [email, windowStart]);
  const emailCount = parseInt(emailResult.rows[0].count);

  if (emailCount >= RESEND_LIMIT_PER_EMAIL) {
    return {
      allowed: false,
      reason: 'EMAIL_RATE_LIMIT',
      message: `Too many verification codes sent to this email. Please try again in ${RESEND_WINDOW_MINUTES} minutes.`
    };
  }

  // Check per-IP rate limit (max 10 codes per hour per IP)
  if (ipAddress) {
    const ipLimitQuery = `
      SELECT COUNT(*) as count
      FROM email_verification_codes
      WHERE ip_address = $1
        AND created_at >= NOW() - INTERVAL '1 hour'
    `;
    const ipResult = await pool.query(ipLimitQuery, [ipAddress]);
    const ipCount = parseInt(ipResult.rows[0].count);

    if (ipCount >= 10) {
      return {
        allowed: false,
        reason: 'IP_RATE_LIMIT',
        message: 'Too many verification requests from this IP. Please try again later.'
      };
    }
  }

  return { allowed: true };
};

/**
 * Check resend cooldown (minimum time between resends)
 * @param {string} email - Email address
 * @returns {Promise<Object>} Object with allowed flag and seconds remaining if not allowed
 */
const checkResendCooldown = async (email) => {
  const cooldownQuery = `
    SELECT created_at
    FROM email_verification_codes
    WHERE email = $1
      AND expires_at > NOW()
      AND is_used = FALSE
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const result = await pool.query(cooldownQuery, [email]);

  if (result.rows.length > 0) {
    const lastCreated = new Date(result.rows[0].created_at);
    const now = new Date();
    const secondsSinceLast = Math.floor((now - lastCreated) / 1000);

    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      const secondsRemaining = RESEND_COOLDOWN_SECONDS - secondsSinceLast;
      return {
        allowed: false,
        secondsRemaining,
        message: `Please wait ${secondsRemaining} seconds before requesting a new code.`
      };
    }
  }

  return { allowed: true };
};

/**
 * Invalidate previous codes for an email (soft delete by marking as expired)
 * @param {string} email - Email address
 * @param {Object} client - Database client (optional, for transactions)
 * @returns {Promise<void>}
 */
const invalidatePreviousCodes = async (email, client = null) => {
  const query = `
    UPDATE email_verification_codes
    SET expires_at = NOW() - INTERVAL '1 second'
    WHERE email = $1
      AND expires_at > NOW()
      AND is_used = FALSE
  `;

  if (client) {
    await client.query(query, [email]);
  } else {
    await pool.query(query, [email]);
  }
};

/**
 * Send verification code to email
 * 
 * @param {string} email - Email address to send code to
 * @param {string} [firstName] - User's first name (optional, for personalization)
 * @param {string} [ipAddress] - IP address of the request
 * @param {string} [userAgent] - User agent of the request
 * @param {string} [username] - Username (optional, for signup flow)
 * @returns {Promise<Object>} Success result
 * @throws {Error} If rate limit exceeded or sending fails
 */
const sendVerificationCode = async (email, firstName = null, ipAddress = null, userAgent = null, username = null) => {
  // Validate and sanitize email
  const emailValidation = sanitizeAndValidateEmail(email);
  if (!emailValidation.valid) {
    const error = new Error(emailValidation.error);
    error.statusCode = 400;
    error.errorCode = 'INVALID_EMAIL';
    throw error;
  }
  const normalizedEmail = emailValidation.email;

  // Check rate limits
  let rateLimitCheck;
  try {
    rateLimitCheck = await checkRateLimits(normalizedEmail, ipAddress);
  } catch (dbError) {
    // Handle database errors gracefully
    logDatabaseError('checkRateLimits', dbError, { email: normalizedEmail, ipAddress });
    const error = new Error('Unable to process verification request. Please try again later.');
    error.statusCode = 500;
    error.errorCode = 'DATABASE_ERROR';
    error.originalError = dbError;
    throw error;
  }

  if (!rateLimitCheck.allowed) {
    // Log rate limit hit
    const rateLimitType = rateLimitCheck.reason === 'EMAIL_RATE_LIMIT' ? 'email' : 
                         rateLimitCheck.reason === 'IP_RATE_LIMIT' ? 'ip' : 'unknown';
    logRateLimitHit(rateLimitType, normalizedEmail, ipAddress, { reason: rateLimitCheck.reason });
    incrementRateLimitHit(rateLimitType);
    
    const error = new Error(rateLimitCheck.message);
    error.statusCode = 429;
    error.errorCode = rateLimitCheck.reason;
    throw error;
  }

  // Check resend cooldown
  let cooldownCheck;
  try {
    cooldownCheck = await checkResendCooldown(normalizedEmail);
  } catch (dbError) {
    // Handle database errors gracefully
    logDatabaseError('checkResendCooldown', dbError, { email: normalizedEmail, ipAddress });
    const error = new Error('Unable to process verification request. Please try again later.');
    error.statusCode = 500;
    error.errorCode = 'DATABASE_ERROR';
    error.originalError = dbError;
    throw error;
  }

  if (!cooldownCheck.allowed) {
    // Log rate limit hit (resend cooldown)
    logRateLimitHit('resend_cooldown', normalizedEmail, ipAddress, { 
      secondsRemaining: cooldownCheck.secondsRemaining 
    });
    incrementRateLimitHit('resendCooldown');
    
    const error = new Error(cooldownCheck.message);
    error.statusCode = 429;
    error.errorCode = 'RESEND_COOLDOWN';
    error.secondsRemaining = cooldownCheck.secondsRemaining;
    throw error;
  }

  // Generate code
  const plainCode = generateVerificationCode();
  const codeHash = await hashCode(plainCode);

  // Calculate expiration time
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + CODE_EXPIRATION_MINUTES);

  // Invalidate previous codes
  try {
    await invalidatePreviousCodes(normalizedEmail);
  } catch (dbError) {
    // Log but don't fail - we can still create a new code
    logDatabaseError('invalidatePreviousCodes', dbError, { email: normalizedEmail });
  }

  // Store code in database
  let insertResult;
  try {
    const insertQuery = `
      INSERT INTO email_verification_codes (
        email, code_hash, expires_at, ip_address, user_agent, max_attempts, username
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, expires_at, created_at, username
    `;
    insertResult = await pool.query(insertQuery, [
      normalizedEmail,
      codeHash,
      expiresAt,
      ipAddress,
      userAgent,
      MAX_ATTEMPTS,
      username
    ]);
  } catch (dbError) {
    // Handle database errors
    logDatabaseError('storeCode', dbError, { email: normalizedEmail, ipAddress });
    
    // Check for specific database errors
    if (dbError.code === '23505') { // Unique constraint violation
      const error = new Error('A verification code was recently sent. Please check your email or wait before requesting another.');
      error.statusCode = 429;
      error.errorCode = 'DUPLICATE_CODE';
      throw error;
    }

    const error = new Error('Unable to process verification request. Please try again later.');
    error.statusCode = 500;
    error.errorCode = 'DATABASE_ERROR';
    error.originalError = dbError;
    throw error;
  }

  // Prepare email content using templates
  const greeting = firstName ? `Hello ${firstName},` : 'Hello,';
  const subject = 'Verify Your Email Address';
  
  // Render email templates
  let htmlBody, textBody;
  try {
    const templateResult = await emailTemplateService.renderEmailVerificationTemplate({
      greeting,
      verificationCode: plainCode,
      expirationMinutes: CODE_EXPIRATION_MINUTES
    });
    htmlBody = templateResult.html;
    textBody = templateResult.text;
  } catch (templateError) {
    // If template rendering fails, log and use fallback
    logDatabaseError('renderTemplate', templateError, { email: normalizedEmail });
    // Fallback to simple template
    htmlBody = `<p>${greeting}</p><p>Your verification code is: <strong>${plainCode}</strong></p><p>This code expires in ${CODE_EXPIRATION_MINUTES} minutes.</p>`;
    textBody = `${greeting}\n\nYour verification code is: ${plainCode}\n\nThis code expires in ${CODE_EXPIRATION_MINUTES} minutes.`;
  }

  // Send email
  try {
    await emailService.sendEmail(normalizedEmail, subject, htmlBody, textBody);
    
    // Log successful code sent
    logCodeSent(normalizedEmail, ipAddress, {
      codeId: insertResult.rows[0].id,
      expiresAt: insertResult.rows[0].expires_at
    });
    incrementCodesSent();
  } catch (emailError) {
    // Handle SES API errors
    const errorType = emailError.errorCode || emailError.name || 'UNKNOWN';
    logSESError(normalizedEmail, errorType, emailError.message, {
      codeId: insertResult.rows[0].id,
      errorCode: emailError.errorCode
    });
    incrementSESError(errorType);
    
    // Re-throw if it's a critical error (invalid email, etc.)
    if (emailError.errorCode === 'EMAIL_REJECTED' || 
        emailError.errorCode === 'INVALID_EMAIL' ||
        emailError.errorCode === 'FROM_EMAIL_NOT_VERIFIED') {
      // Don't reveal the specific error to user for security
      const error = new Error('Unable to send verification email. Please check your email address and try again.');
      error.statusCode = 400;
      error.errorCode = 'EMAIL_SEND_FAILED';
      error.originalError = emailError;
      throw error;
    }
    
    // For network/SES throttling errors, we'll still return success
    // The code is stored and can be verified if email eventually arrives
    // Log the error for monitoring (already logged above)
    // Still increment codes sent since code was stored
    logCodeSent(normalizedEmail, ipAddress, {
      codeId: insertResult.rows[0].id,
      expiresAt: insertResult.rows[0].expires_at,
      emailSendFailed: true,
      emailErrorCode: emailError.errorCode
    });
    incrementCodesSent();
  }

  return {
    success: true,
    email: normalizedEmail,
    expiresAt: insertResult.rows[0].expires_at,
    message: 'Verification code sent successfully'
  };
};

/**
 * Verify email verification code
 * 
 * @param {string} email - Email address
 * @param {string} code - Verification code (6 digits)
 * @param {string} [ipAddress] - IP address of the request
 * @returns {Promise<Object>} Success result with user update
 * @throws {Error} If code is invalid, expired, or max attempts reached
 */
const verifyCode = async (email, code, ipAddress = null) => {
  // Validate and sanitize inputs
  if (!email || !code) {
    const error = new Error('Email and code are required');
    error.statusCode = 400;
    error.errorCode = 'MISSING_PARAMETERS';
    throw error;
  }

  // Validate and sanitize email
  const emailValidation = sanitizeAndValidateEmail(email);
  if (!emailValidation.valid) {
    const error = new Error(emailValidation.error);
    error.statusCode = 400;
    error.errorCode = 'INVALID_EMAIL';
    throw error;
  }
  const normalizedEmail = emailValidation.email;

  // Validate and sanitize code
  const codeValidation = sanitizeAndValidateCode(code);
  if (!codeValidation.valid) {
    const error = new Error(codeValidation.error);
    error.statusCode = 400;
    error.errorCode = 'INVALID_CODE_FORMAT';
    throw error;
  }
  const normalizedCode = codeValidation.code;

  // Get database client for transaction
  let client;
  try {
    client = await pool.connect();
  } catch (dbError) {
    logDatabaseError('connect', dbError, { email: normalizedEmail, ipAddress });
    const error = new Error('Unable to process verification. Please try again later.');
    error.statusCode = 500;
    error.errorCode = 'DATABASE_ERROR';
    error.originalError = dbError;
    throw error;
  }

  try {
    // Start transaction
    await client.query('BEGIN');

    // Find active code for email (not expired, not used)
    // Use generic error message to avoid revealing if email exists
    let codeResult;
    try {
      const findCodeQuery = `
        SELECT id, code_hash, expires_at, attempts, max_attempts, is_used, username
        FROM email_verification_codes
        WHERE email = $1
          AND expires_at > NOW()
          AND is_used = FALSE
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `;
      codeResult = await client.query(findCodeQuery, [normalizedEmail]);
    } catch (dbError) {
      await client.query('ROLLBACK');
      logDatabaseError('findCode', dbError, { email: normalizedEmail, ipAddress });
      incrementVerificationAttempt(false);
      const error = new Error('Unable to process verification. Please try again later.');
      error.statusCode = 500;
      error.errorCode = 'DATABASE_ERROR';
      error.originalError = dbError;
      throw error;
    }

    if (codeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      // Generic error message - don't reveal if email exists or code exists
      logVerificationFailure(normalizedEmail, 'CODE_NOT_FOUND', ipAddress);
      incrementVerificationAttempt(false);
      const error = new Error('Invalid or expired verification code. Please request a new code.');
      error.statusCode = 400;
      error.errorCode = 'CODE_NOT_FOUND';
      throw error;
    }

    const codeRecord = codeResult.rows[0];

    // Check attempt limit
    if (codeRecord.attempts >= codeRecord.max_attempts) {
      await client.query('ROLLBACK');
      logVerificationFailure(normalizedEmail, 'MAX_ATTEMPTS_EXCEEDED', ipAddress, {
        codeId: codeRecord.id,
        attempts: codeRecord.attempts,
        maxAttempts: codeRecord.max_attempts
      });
      incrementVerificationAttempt(false);
      const error = new Error('Maximum verification attempts exceeded. Please request a new code.');
      error.statusCode = 400;
      error.errorCode = 'MAX_ATTEMPTS_EXCEEDED';
      throw error;
    }

    // Verify code
    let codeValid;
    try {
      codeValid = await verifyCodeHash(normalizedCode, codeRecord.code_hash);
    } catch (hashError) {
      await client.query('ROLLBACK');
      logDatabaseError('verifyCodeHash', hashError, { email: normalizedEmail, codeId: codeRecord.id });
      incrementVerificationAttempt(false);
      const error = new Error('Unable to verify code. Please try again.');
      error.statusCode = 500;
      error.errorCode = 'VERIFICATION_ERROR';
      error.originalError = hashError;
      throw error;
    }

    if (!codeValid) {
      // Increment attempts
      try {
        const updateAttemptsQuery = `
          UPDATE email_verification_codes
          SET attempts = attempts + 1
          WHERE id = $1
        `;
        await client.query(updateAttemptsQuery, [codeRecord.id]);
      } catch (dbError) {
        // Log but continue - we'll rollback anyway
        logDatabaseError('incrementAttempts', dbError, { email: normalizedEmail, codeId: codeRecord.id });
      }

      await client.query('ROLLBACK');
      // Generic error message - don't reveal specific reason
      logVerificationFailure(normalizedEmail, 'INVALID_CODE', ipAddress, {
        codeId: codeRecord.id,
        attempts: codeRecord.attempts + 1,
        maxAttempts: codeRecord.max_attempts
      });
      incrementVerificationAttempt(false);
      const error = new Error('Invalid verification code. Please check and try again.');
      error.statusCode = 400;
      error.errorCode = 'INVALID_CODE';
      error.attemptsRemaining = codeRecord.max_attempts - codeRecord.attempts - 1;
      throw error;
    }

    // Code is valid - mark as used and update user
    const now = new Date();

    // Mark code as used
    try {
      const markUsedQuery = `
        UPDATE email_verification_codes
        SET is_used = TRUE, verified_at = $1
        WHERE id = $2
      `;
      await client.query(markUsedQuery, [now, codeRecord.id]);
    } catch (dbError) {
      await client.query('ROLLBACK');
      logDatabaseError('markCodeAsUsed', dbError, { email: normalizedEmail, codeId: codeRecord.id });
      incrementVerificationAttempt(false);
      const error = new Error('Unable to complete verification. Please try again.');
      error.statusCode = 500;
      error.errorCode = 'DATABASE_ERROR';
      error.originalError = dbError;
      throw error;
    }

    // Get username from code record (for signup flow)
    const username = codeRecord.username;

    // Check if user exists
    let user;
    try {
      user = await User.findByEmail(normalizedEmail);
    } catch (dbError) {
      await client.query('ROLLBACK');
      logDatabaseError('findUser', dbError, { email: normalizedEmail, codeId: codeRecord.id });
      incrementVerificationAttempt(false);
      const error = new Error('Unable to complete verification. Please try again.');
      error.statusCode = 500;
      error.errorCode = 'DATABASE_ERROR';
      error.originalError = dbError;
      throw error;
    }

    // If user doesn't exist and we have a username, create minimal account
    if (!user && username) {
      try {
        // Create minimal user account
        const createUserQuery = `
          INSERT INTO users (
            email, username, password_hash, first_name, last_name, phone, role,
            is_active, email_verified, signup_status, auth_provider
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING ${User._getUserFields()}
        `;
        const createResult = await client.query(createUserQuery, [
          normalizedEmail,
          username,
          null, // password_hash = NULL
          null, // first_name = NULL
          null, // last_name = NULL
          null, // phone = NULL
          'player', // role = 'player' (default)
          true, // is_active = true
          true, // email_verified = true
          'pending_completion', // signup_status = 'pending_completion'
          'email' // auth_provider = 'email'
        ]);
        user = createResult.rows[0];
      } catch (dbError) {
        await client.query('ROLLBACK');
        logDatabaseError('createUser', dbError, { email: normalizedEmail, username, codeId: codeRecord.id });
        incrementVerificationAttempt(false);
        
        // Check for unique constraint violations
        if (dbError.code === '23505') { // Unique constraint violation
          const error = new Error('Username or email already exists. Please try logging in.');
          error.statusCode = 409;
          error.errorCode = 'ACCOUNT_EXISTS';
          throw error;
        }

        const error = new Error('Unable to create account. Please try again.');
        error.statusCode = 500;
        error.errorCode = 'DATABASE_ERROR';
        error.originalError = dbError;
        throw error;
      }
    } else if (user) {
      // User exists - update email_verified and signup_status if needed
      try {
        const updateFields = ['email_verified = TRUE'];
        const updateValues = [];
        let paramCount = 1;

        // If user doesn't have password, set signup_status to pending_completion
        if (!user.password_hash) {
          updateFields.push(`signup_status = 'pending_completion'`);
        } else {
          updateFields.push(`signup_status = 'active'`);
        }

        // If username is provided and different, update it (for incomplete accounts)
        if (username && username !== user.username) {
          updateFields.push(`username = $${paramCount}`);
          updateValues.push(username);
          paramCount++;
        }

        updateValues.push(normalizedEmail);

        const updateUserQuery = `
          UPDATE users
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE email = $${paramCount}
          RETURNING ${User._getUserFields()}
        `;
        const updateResult = await client.query(updateUserQuery, updateValues);
        user = updateResult.rows[0];
      } catch (dbError) {
        await client.query('ROLLBACK');
        logDatabaseError('updateUser', dbError, { email: normalizedEmail, codeId: codeRecord.id });
        incrementVerificationAttempt(false);
        const error = new Error('Unable to complete verification. Please try again.');
        error.statusCode = 500;
        error.errorCode = 'DATABASE_ERROR';
        error.originalError = dbError;
        throw error;
      }
    } else {
      // User doesn't exist and no username in code - this shouldn't happen in signup flow
      // But we'll allow it for backward compatibility (email verification without signup)
      await client.query('ROLLBACK');
      const error = new Error('Unable to complete verification. Username is required for account creation.');
      error.statusCode = 400;
      error.errorCode = 'USERNAME_REQUIRED';
      throw error;
    }

    // Commit transaction
    try {
      await client.query('COMMIT');
    } catch (dbError) {
      // If commit fails, we're in a bad state - log and throw
      logDatabaseError('commitTransaction', dbError, { email: normalizedEmail, codeId: codeRecord.id });
      incrementVerificationAttempt(false);
      const error = new Error('Unable to complete verification. Please try again.');
      error.statusCode = 500;
      error.errorCode = 'TRANSACTION_ERROR';
      error.originalError = dbError;
      throw error;
    }

    // Log successful verification
    logVerificationSuccess(normalizedEmail, ipAddress, {
      codeId: codeRecord.id,
      attempts: codeRecord.attempts,
      userId: user.id
    });
    incrementVerificationAttempt(true);

    // Generate JWT token for authenticated session
    const token = generateAuthToken(user);

    return {
      success: true,
      email: normalizedEmail,
      verified: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        email_verified: user.email_verified,
        signup_status: user.signup_status,
        role: user.role
      },
      message: 'Email verified and account created successfully'
    };
  } catch (error) {
    // Rollback transaction on any error
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Log rollback error but don't mask original error
      logDatabaseError('rollbackTransaction', rollbackError, { email: normalizedEmail });
    }
    throw error;
  } finally {
    // Release client back to pool
    if (client) {
      client.release();
    }
  }
};

/**
 * Resend verification code
 * 
 * @param {string} email - Email address
 * @param {string} [ipAddress] - IP address of the request
 * @param {string} [userAgent] - User agent of the request
 * @returns {Promise<Object>} Success result
 * @throws {Error} If rate limit exceeded or sending fails
 */
const resendVerificationCode = async (email, ipAddress = null, userAgent = null) => {
  // Get user's first name if available (for personalization)
  let firstName = null;
  try {
    const user = await User.findByEmail(email);
    if (user) {
      firstName = user.first_name;
    }
  } catch (error) {
    // User might not exist yet (during signup), that's okay
  }

  // Use the same sendVerificationCode function (it handles rate limiting and cooldown)
  return await sendVerificationCode(email, firstName, ipAddress, userAgent);
};

/**
 * Cleanup expired verification codes
 * Deletes codes older than specified hours
 * 
 * @param {number} [olderThanHours=CLEANUP_AGE_HOURS] - Delete codes older than this many hours
 * @returns {Promise<Object>} Cleanup statistics
 */
const cleanupExpiredCodes = async (olderThanHours = CLEANUP_AGE_HOURS) => {
  // Validate parameter to prevent SQL injection
  const hours = parseInt(olderThanHours, 10);
  if (isNaN(hours) || hours < 0) {
    throw new Error('olderThanHours must be a positive number');
  }

  const deleteQuery = `
    DELETE FROM email_verification_codes
    WHERE created_at < NOW() - INTERVAL '1 hour' * $1
      OR expires_at < NOW() - INTERVAL '1 hour' * $1
  `;

  const result = await pool.query(deleteQuery, [hours]);
  const deletedCount = result.rowCount;

  // Log cleanup statistics
  if (deletedCount > 0) {
    logCleanupJob(deletedCount, olderThanHours);
    recordCleanupJob(deletedCount);
  }

  return {
    success: true,
    deletedCount,
    olderThanHours
  };
};

module.exports = {
  sendVerificationCode,
  verifyCode,
  resendVerificationCode,
  cleanupExpiredCodes,
  generateVerificationCode,
  hashCode,
  verifyCodeHash
};

