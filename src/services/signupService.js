/**
 * Signup Service
 * 
 * Handles initial signup request (username + email validation and verification code sending)
 */

const User = require('../models/User');
const emailVerificationService = require('./emailVerificationService');
const { sanitizeAndValidateEmail } = require('../utils/validation');
const { sanitizeAndValidateUsername } = require('../utils/usernameValidation');

/**
 * Check signup eligibility and send verification code
 * 
 * @param {string} username - Username
 * @param {string} email - Email address
 * @param {string} [ipAddress] - IP address for rate limiting
 * @param {string} [userAgent] - User agent for tracking
 * @returns {Promise<Object>} Result object with status and message
 * @throws {Error} If validation fails or account conflicts
 */
const checkSignupAndSendCode = async (username, email, ipAddress = null, userAgent = null) => {
  // Validate username format
  const usernameValidation = sanitizeAndValidateUsername(username);
  if (!usernameValidation.valid) {
    const error = new Error(usernameValidation.error);
    error.statusCode = 400;
    error.errorCode = 'INVALID_USERNAME';
    throw error;
  }
  const normalizedUsername = usernameValidation.username;

  // Validate email format
  const emailValidation = sanitizeAndValidateEmail(email);
  if (!emailValidation.valid) {
    const error = new Error(emailValidation.error);
    error.statusCode = 400;
    error.errorCode = 'INVALID_EMAIL';
    throw error;
  }
  const normalizedEmail = emailValidation.email;

  // Check email and account status first (to handle resume signup)
  const accountStatus = await User.getAccountStatus(normalizedEmail);

  // Handle email conflicts
  if (accountStatus) {
    if (accountStatus.accountState === 'complete') {
      // Email exists, verified, complete account - block signup
      const error = new Error('An account with this email already exists. Please login.');
      error.statusCode = 409;
      error.errorCode = 'EMAIL_EXISTS_COMPLETE';
      throw error;
    }
    // Email exists but incomplete or unverified - allow resume signup
    // Continue to check username below
  }

  // Check username uniqueness
  // If email matches incomplete account, username can be updated during verification
  // Otherwise, check if username is available
  const usernameAccountStatus = await User.getUsernameAccountStatus(normalizedUsername);
  
  if (usernameAccountStatus) {
    // Username exists - check if we can allow it
    if (usernameAccountStatus.accountState === 'complete') {
      // Username belongs to a complete account - block
      const error = new Error('Username is already taken. Please choose another.');
      error.statusCode = 409;
      error.errorCode = 'USERNAME_EXISTS';
      throw error;
    }
    
    // Username belongs to incomplete/unverified account
    if (accountStatus && accountStatus.email === usernameAccountStatus.email) {
      // Same email - this is resume signup, allow it
      // Username can be same or different (will be updated during verification if different)
    } else {
      // Different email - username is taken by another account (even if incomplete)
      // Block to prevent unique constraint violation during account creation
      const error = new Error('Username is already taken. Please choose another.');
      error.statusCode = 409;
      error.errorCode = 'USERNAME_EXISTS';
      throw error;
    }
  }

  // All checks passed - send verification code
  try {
    const result = await emailVerificationService.sendVerificationCode(
      normalizedEmail,
      null, // No first name yet
      ipAddress,
      userAgent,
      normalizedUsername // Pass username for account creation during verification
    );

    return {
      success: true,
      email: normalizedEmail,
      username: normalizedUsername,
      expiresAt: result.expiresAt,
      message: accountStatus && accountStatus.accountState === 'incomplete'
        ? 'Verification code sent. Complete your signup.'
        : 'Verification code sent to your email',
      accountState: accountStatus ? accountStatus.accountState : 'new'
    };
  } catch (emailError) {
    // Re-throw email service errors (rate limiting, etc.)
    throw emailError;
  }
};

module.exports = {
  checkSignupAndSendCode
};

