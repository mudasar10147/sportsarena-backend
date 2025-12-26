/**
 * User Controller
 * 
 * Handles HTTP requests for user-related operations
 */

const userService = require('../services/userService');
const bookingService = require('../services/bookingService');
const Booking = require('../models/Booking');
const { 
  sendSuccess, 
  sendCreated, 
  sendError, 
  sendValidationError 
} = require('../utils/response');
const { parsePagination, sendPaginatedResponse } = require('../utils/pagination');

/**
 * Register a new user
 * POST /api/v1/users/signup
 */
const signup = async (req, res, next) => {
  try {
    const { email, username, password, firstName, lastName, phone, role } = req.body;

    // ===== Required Fields Validation =====
    if (!email || !username || !password || !firstName || !lastName) {
      return sendValidationError(res, 'Missing required fields: email, username, password, firstName, lastName');
    }

    // ===== Email Validation =====
    // Trim and normalize email
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check email is not empty after trimming
    if (!normalizedEmail) {
      return sendValidationError(res, 'Email cannot be empty');
    }

    // Email format validation (more robust)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(normalizedEmail)) {
      return sendValidationError(res, 'Invalid email format. Please provide a valid email address');
    }

    // Email length validation (max 255 characters as per database)
    if (normalizedEmail.length > 255) {
      return sendValidationError(res, 'Email is too long. Maximum 255 characters allowed');
    }

    // ===== Username Validation =====
    // Trim username
    const normalizedUsername = username.trim();
    
    // Check username is not empty after trimming
    if (!normalizedUsername) {
      return sendValidationError(res, 'Username cannot be empty');
    }

    // Username length validation (minimum 3, maximum 50 characters)
    if (normalizedUsername.length < 3) {
      return sendValidationError(res, 'Username must be at least 3 characters long');
    }
    if (normalizedUsername.length > 50) {
      return sendValidationError(res, 'Username is too long. Maximum 50 characters allowed');
    }

    // Username format validation (alphanumeric, underscores, hyphens only)
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(normalizedUsername)) {
      return sendValidationError(res, 'Username can only contain letters, numbers, underscores, and hyphens');
    }

    // Username cannot start or end with underscore or hyphen
    if (/^[_-]|[_-]$/.test(normalizedUsername)) {
      return sendValidationError(res, 'Username cannot start or end with underscore or hyphen');
    }

    // Username cannot be all numbers
    if (/^\d+$/.test(normalizedUsername)) {
      return sendValidationError(res, 'Username cannot be all numbers');
    }

    // ===== Password Validation =====
    // Check password is not empty
    if (!password || password.trim().length === 0) {
      return sendValidationError(res, 'Password cannot be empty');
    }

    // Password length validation (minimum 8 characters, maximum 128)
    if (password.length < 8) {
      return sendValidationError(res, 'Password must be at least 8 characters long');
    }
    if (password.length > 128) {
      return sendValidationError(res, 'Password is too long. Maximum 128 characters allowed');
    }

    // Password strength validation
    const passwordErrors = [];
    
    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      passwordErrors.push('one uppercase letter');
    }
    
    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      passwordErrors.push('one lowercase letter');
    }
    
    // Check for at least one numerical digit
    if (!/[0-9]/.test(password)) {
      passwordErrors.push('one numerical digit');
    }
    
    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      passwordErrors.push('one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    }

    // Check for no whitespace
    if (/\s/.test(password)) {
      passwordErrors.push('no spaces');
    }

    if (passwordErrors.length > 0) {
      return sendValidationError(
        res,
        `Password must contain: ${passwordErrors.join(', ')}`
      );
    }

    // ===== Name Validation =====
    // Trim names
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    // Check first name is not empty after trimming
    if (!trimmedFirstName) {
      return sendValidationError(res, 'First name cannot be empty');
    }

    // Check last name is not empty after trimming
    if (!trimmedLastName) {
      return sendValidationError(res, 'Last name cannot be empty');
    }

    // Name length validation (reasonable limits)
    if (trimmedFirstName.length < 2) {
      return sendValidationError(res, 'First name must be at least 2 characters long');
    }
    if (trimmedFirstName.length > 50) {
      return sendValidationError(res, 'First name is too long. Maximum 50 characters allowed');
    }

    if (trimmedLastName.length < 2) {
      return sendValidationError(res, 'Last name must be at least 2 characters long');
    }
    if (trimmedLastName.length > 50) {
      return sendValidationError(res, 'Last name is too long. Maximum 50 characters allowed');
    }

    // Name format validation (only letters, spaces, hyphens, apostrophes)
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(trimmedFirstName)) {
      return sendValidationError(res, 'First name can only contain letters, spaces, hyphens, and apostrophes');
    }
    if (!nameRegex.test(trimmedLastName)) {
      return sendValidationError(res, 'Last name can only contain letters, spaces, hyphens, and apostrophes');
    }

    // ===== Phone Validation (if provided) =====
    let normalizedPhone = null;
    if (phone) {
      // Trim phone
      normalizedPhone = phone.trim();
      
      // Basic phone validation (digits, spaces, hyphens, parentheses, plus sign)
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(normalizedPhone)) {
        return sendValidationError(res, 'Phone number contains invalid characters');
      }

      // Remove non-digit characters for length check
      const digitsOnly = normalizedPhone.replace(/\D/g, '');
      
      // Phone length validation (between 10-15 digits)
      if (digitsOnly.length < 10) {
        return sendValidationError(res, 'Phone number must contain at least 10 digits');
      }
      if (digitsOnly.length > 15) {
        return sendValidationError(res, 'Phone number is too long. Maximum 15 digits allowed');
      }
    }

    // ===== Role Validation =====
    // Note: platform_admin cannot be created via signup - use createPlatformAdmin script
    if (role && !['player', 'facility_admin'].includes(role)) {
      return sendValidationError(res, 'Invalid role. Must be "player" or "facility_admin". Platform admin accounts must be created using the admin script.');
    }

    // ===== All Validations Passed - Create User =====
    const user = await userService.signup({
      email: normalizedEmail,
      username: normalizedUsername,
      password,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      phone: normalizedPhone,
      role: role || 'player'
    });

    return sendCreated(res, {
      user,
    }, 'User registered successfully');
  } catch (error) {
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
    const { user, token } = await userService.login(email, password);

    return sendSuccess(res, {
      user,
      token
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * Get user profile
 * GET /api/v1/users/profile
 * Requires authentication
 */
const getProfile = async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await userService.getProfile(userId);

    return sendSuccess(res, user, 'Profile retrieved successfully');
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

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getUserBookings,
  deleteUser
};

