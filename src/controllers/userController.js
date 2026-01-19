/**
 * User Controller
 * 
 * Handles HTTP requests for user-related operations
 */

const userService = require('../services/userService');
const bookingService = require('../services/bookingService');
const emailVerificationService = require('../services/emailVerificationService');
const signupService = require('../services/signupService');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { sanitizeAndValidateEmail, sanitizeAndValidateCode } = require('../utils/validation');
const { 
  sendSuccess, 
  sendCreated, 
  sendError, 
  sendValidationError,
  sendUnauthorized,
  sendNotFound
} = require('../utils/response');
const { parsePagination, sendPaginatedResponse } = require('../utils/pagination');

/**
 * Initial signup request (username + email only)
 * POST /api/v1/users/signup
 * 
 * Step 1 of signup process:
 * - Validates username and email
 * - Checks uniqueness
 * - Handles existing account states
 * - Sends verification code
 */
const signup = async (req, res, next) => {
  try {
    const { email, username } = req.body;

    // ===== Required Fields Validation =====
    if (!email || !username) {
      return sendValidationError(res, 'Email and username are required');
    }

    // Get IP address and user agent for rate limiting
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || null;
    const userAgent = req.headers['user-agent'] || null;

    // Check signup eligibility and send verification code
    const result = await signupService.checkSignupAndSendCode(
      username,
      email,
      ipAddress,
      userAgent
    );

    // Prepare response
    return sendSuccess(res, {
      email: result.email,
      username: result.username,
      expiresAt: result.expiresAt,
      accountState: result.accountState
    }, result.message);
  } catch (error) {
    // Handle specific error codes
    if (error.errorCode === 'USERNAME_EXISTS') {
      return sendError(res, error.message, error.errorCode, 409);
    }

    if (error.errorCode === 'EMAIL_EXISTS_COMPLETE') {
      return sendError(res, error.message, error.errorCode, 409);
    }

    if (error.errorCode === 'INVALID_USERNAME' || error.errorCode === 'INVALID_EMAIL') {
      return sendValidationError(res, error.message);
    }

    if (error.errorCode === 'EMAIL_RATE_LIMIT' || error.errorCode === 'IP_RATE_LIMIT') {
      return sendError(res, error.message, error.errorCode, 429);
    }

    if (error.errorCode === 'RESEND_COOLDOWN') {
      return sendError(res, error.message, error.errorCode, 429);
    }

    if (error.errorCode === 'DATABASE_ERROR') {
      return sendError(res, 'Unable to process request. Please try again later.', error.errorCode, 500);
      }

    if (error.errorCode === 'EMAIL_SEND_FAILED') {
      return sendError(res, error.message, error.errorCode, 400);
    }

    // Pass other errors to error handler
    next(error);
  }
};

/**
 * Login user
 * POST /api/v1/users/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return sendValidationError(res, 'Email and password are required');
    }

    // Login
    const loginResult = await userService.login(email, password);

    // Prepare response
    const responseData = {
      user: loginResult.user,
      token: loginResult.token,
      emailVerified: loginResult.emailVerified,
      emailVerificationRequired: loginResult.emailVerificationRequired || false
    };

    // Prepare message
    let message = 'Login successful';
    if (!loginResult.emailVerified && !loginResult.emailVerificationRequired) {
      message = 'Login successful. Please verify your email address.';
    }

    return sendSuccess(res, responseData, message);
  } catch (error) {
    // Handle email verification required error
    if (error.errorCode === 'EMAIL_VERIFICATION_REQUIRED') {
      return sendError(res, error.message, error.errorCode, 403);
    }
    next(error);
  }
};

/**
 * Get user profile
 * GET /api/v1/users/profile
 * Requires authentication
 * 
 * Returns profile data with completeness flag.
 * If profile is incomplete, includes missingFields array.
 * Frontend should show profile completion page instead of logging out.
 */
const getProfile = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await userService.getProfile(userId);

    // Prepare message based on profile completeness
    let message = 'Profile retrieved successfully';
    if (!user.profileComplete) {
      message = 'Profile retrieved. Please complete your profile to continue.';
    }

    return sendSuccess(res, user, message);
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * PUT /api/v1/users/profile
 * Requires authentication
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { firstName, lastName, phone } = req.body;

    // Validation - at least one field must be provided
    if (!firstName && !lastName && phone === undefined) {
      return sendValidationError(res, 'At least one field (firstName, lastName, phone) must be provided');
    }

    // Build update data
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;

    // Update user
    const user = await userService.updateProfile(userId, updateData);

    return sendSuccess(res, user, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Complete signup by setting password and profile information
 * POST /api/v1/users/complete-signup
 * Requires authentication
 * 
 * Used after email verification to complete the signup process.
 * Allows users to set password and complete their profile.
 */
const completeSignup = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { password, firstName, lastName, phone } = req.body;

    // Validation - at least one field must be provided
    if (!password && !firstName && !lastName && phone === undefined) {
      return sendValidationError(res, 'At least one field (password, firstName, lastName, phone) must be provided');
    }

    // Complete signup
    const user = await userService.completeSignup(userId, {
      password,
      firstName,
      lastName,
      phone
    });

    // Prepare message based on what was updated
    let message = 'Profile updated successfully';
    if (password) {
      message = 'Signup completed successfully. Your account is now active.';
    } else {
      message = 'Profile updated successfully';
    }

    return sendSuccess(res, user, message);
  } catch (error) {
    // Handle specific error codes
    if (error.errorCode === 'INVALID_PASSWORD') {
      return sendValidationError(res, error.message, error.errors);
    }

    if (error.errorCode === 'VALIDATION_ERROR') {
      return sendValidationError(res, error.message);
    }

    if (error.errorCode === 'USER_NOT_FOUND') {
      return sendNotFound(res, error.message);
    }

    if (error.errorCode === 'UPDATE_FAILED') {
      return sendError(res, error.message, error.errorCode, 500);
    }

    // Pass other errors to error handler
    next(error);
  }
};

/**
 * Change user password
 * PUT /api/v1/users/change-password
 * Requires authentication
 */
const changePassword = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return sendValidationError(res, 'Both currentPassword and newPassword are required');
    }

    // Change password
    const user = await userService.changePassword(userId, currentPassword, newPassword);

    return sendSuccess(res, user, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's bookings
 * GET /api/v1/users/bookings
 * Requires authentication
 * Supports filtering by status (pending, confirmed, cancelled, rejected, completed)
 */
const getUserBookings = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { page, limit, offset } = parsePagination(req.query);
    const { status } = req.query;

    // Fetch bookings with related details (time slot, court, facility)
    const result = await bookingService.getUserBookings(userId, {
      status,
      limit,
      offset
    });

    return sendPaginatedResponse(res, result.bookings, page, limit, result.total, 'Bookings retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user account
 * DELETE /api/v1/users/:identifier
 * Requires authentication
 * Can delete by user ID or username
 * Users can only delete their own account
 */
const deleteUser = async (req, res, next) => {
  try {
    const identifier = req.params.identifier; // Can be ID or username
    const requestingUserId = req.userId;

    // Validation
    if (!identifier) {
      return sendValidationError(res, 'User ID or username is required');
    }

    // Delete user (soft delete - sets is_active to false)
    const deletedUser = await userService.deleteUser(identifier, requestingUserId);

    return sendSuccess(res, deletedUser, 'User account deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Send verification code to email
 * POST /api/v1/users/send-verification-code
 * Can be called without authentication (for signup) or with authentication (for re-verification)
 */
const sendVerificationCode = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return sendValidationError(res, 'Email is required');
    }

    // Validate and sanitize email
    const emailValidation = sanitizeAndValidateEmail(email);
    if (!emailValidation.valid) {
      return sendValidationError(res, emailValidation.error);
    }
    const normalizedEmail = emailValidation.email;

    // Get IP address and user agent from request
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || null;
    const userAgent = req.headers['user-agent'] || null;

    // Get user's first name if authenticated (for personalization)
    let firstName = null;
    if (req.userId) {
      try {
        const user = await User.findById(req.userId);
        if (user && user.email === normalizedEmail) {
          firstName = user.first_name;
        }
      } catch (error) {
        // User might not exist, that's okay
      }
    }

    // Send verification code
    const result = await emailVerificationService.sendVerificationCode(
      normalizedEmail,
      firstName,
      ipAddress,
      userAgent
    );

    return sendSuccess(res, {
      email: result.email,
      expiresAt: result.expiresAt
    }, result.message || 'Verification code sent successfully');
  } catch (error) {
    // Handle specific error codes
    if (error.errorCode === 'EMAIL_RATE_LIMIT' || error.errorCode === 'IP_RATE_LIMIT') {
      return sendError(res, error.message, error.errorCode, 429);
    }

    if (error.errorCode === 'RESEND_COOLDOWN') {
      return sendError(res, error.message, error.errorCode, 429);
    }

    if (error.errorCode === 'INVALID_EMAIL') {
      return sendValidationError(res, error.message);
    }

    if (error.errorCode === 'DATABASE_ERROR') {
      return sendError(res, 'Unable to process request. Please try again later.', 'DATABASE_ERROR', 500);
    }

    if (error.errorCode === 'EMAIL_SEND_FAILED') {
      return sendError(res, error.message, error.errorCode, 400);
    }

    // Pass other errors to error handler
    next(error);
  }
};

/**
 * Verify email with code
 * POST /api/v1/users/verify-email
 * No authentication required (code-based verification)
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    // Validation
    if (!email || !code) {
      return sendValidationError(res, 'Email and code are required');
    }

    // Validate and sanitize email
    const emailValidation = sanitizeAndValidateEmail(email);
    if (!emailValidation.valid) {
      return sendValidationError(res, emailValidation.error);
    }
    const normalizedEmail = emailValidation.email;

    // Validate and sanitize code
    const codeValidation = sanitizeAndValidateCode(code);
    if (!codeValidation.valid) {
      return sendValidationError(res, codeValidation.error);
    }

    // Get IP address from request
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || null;

    // Verify code
    const result = await emailVerificationService.verifyCode(normalizedEmail, codeValidation.code, ipAddress);

    // Return token and user data
    return sendSuccess(res, {
      token: result.token,
      user: result.user,
      email: result.email,
      verified: result.verified
    }, result.message || 'Email verified and account created successfully');
  } catch (error) {
    // Handle specific error codes with security-conscious messages
    if (error.errorCode === 'CODE_NOT_FOUND') {
      // Generic message - don't reveal if email exists
      return sendError(res, 'Invalid or expired verification code. Please request a new code.', error.errorCode, 400);
    }

    if (error.errorCode === 'INVALID_CODE') {
      // Generic message - don't reveal specific reason
      return sendError(res, error.message, error.errorCode, 400);
    }

    if (error.errorCode === 'MAX_ATTEMPTS_EXCEEDED') {
      return sendError(res, error.message, error.errorCode, 400);
    }

    if (error.errorCode === 'INVALID_CODE_FORMAT' || error.errorCode === 'INVALID_EMAIL') {
      return sendValidationError(res, error.message);
    }

    if (error.errorCode === 'MISSING_PARAMETERS') {
      return sendValidationError(res, error.message);
    }

    if (error.errorCode === 'DATABASE_ERROR' || error.errorCode === 'TRANSACTION_ERROR') {
      return sendError(res, 'Unable to process verification. Please try again later.', error.errorCode, 500);
    }

    if (error.errorCode === 'VERIFICATION_ERROR') {
      return sendError(res, 'Unable to verify code. Please try again.', error.errorCode, 500);
    }

    if (error.errorCode === 'ACCOUNT_EXISTS') {
      return sendError(res, error.message, error.errorCode, 409);
    }

    if (error.errorCode === 'USERNAME_REQUIRED') {
      return sendError(res, error.message, error.errorCode, 400);
    }

    // Pass other errors to error handler
    next(error);
  }
};

/**
 * Get email verification status
 * GET /api/v1/users/verification-status
 * Requires authentication
 */
const getVerificationStatus = async (req, res, next) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return sendUnauthorized(res, 'Authentication required');
    }

    // Get user profile
    const user = await userService.getProfile(userId);

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    return sendSuccess(res, {
      email: user.email,
      emailVerified: user.email_verified || false
    }, 'Verification status retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile,
  completeSignup,
  changePassword,
  getUserBookings,
  deleteUser,
  sendVerificationCode,
  verifyEmail,
  getVerificationStatus
};

