/**
 * User Service
 * 
 * Business logic for user operations: signup, login, password hashing
 */

const bcrypt = require('bcrypt');
const User = require('../models/User');
const Image = require('../models/Image');
const { generateAuthToken } = require('../utils/jwt');
const imageService = require('./imageService');
const emailVerificationService = require('./emailVerificationService');
const { pool } = require('../config/database');

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {string} userData.username - User username
 * @param {string} userData.password - Plain text password
 * @param {string} userData.firstName - User first name
 * @param {string} userData.lastName - User last name
 * @param {string} [userData.phone] - User phone number
 * @param {string} [userData.role='player'] - User role
 * @returns {Promise<Object>} Created user object (without password)
 * @throws {Error} If email or username already exists or validation fails
 */
const signup = async (userData) => {
  const { email, username, password, firstName, lastName, phone, role = 'player' } = userData;

  // Check if email already exists
  const emailExists = await User.emailExists(email);
  if (emailExists) {
    const error = new Error('Email already registered');
    error.statusCode = 400;
    error.errorCode = 'EMAIL_EXISTS';
    throw error;
  }

  // Check if username already exists
  const usernameExists = await User.usernameExists(username);
  if (usernameExists) {
    const error = new Error('Username already taken');
    error.statusCode = 400;
    error.errorCode = 'USERNAME_EXISTS';
    throw error;
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const user = await User.create({
    email,
    username,
    passwordHash,
    firstName,
    lastName,
    phone,
    role
  });

  return user;
};

/**
 * Register a new user and optionally send verification email
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {string} userData.username - User username
 * @param {string} userData.password - Plain text password
 * @param {string} userData.firstName - User first name
 * @param {string} userData.lastName - User last name
 * @param {string} [userData.phone] - User phone number
 * @param {string} [userData.role='player'] - User role
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.sendVerificationEmail=false] - Whether to send verification email
 * @param {string} [options.ipAddress] - IP address for rate limiting
 * @param {string} [options.userAgent] - User agent for tracking
 * @returns {Promise<Object>} Created user object (without password) and emailSent flag
 * @throws {Error} If email or username already exists or validation fails
 */
const signupWithVerification = async (userData, options = {}) => {
  const { sendVerificationEmail = false, ipAddress = null, userAgent = null } = options;

  // Create user first (don't fail if email sending fails)
  const user = await signup(userData);

  // Optionally send verification email
  let emailSent = false;
  if (sendVerificationEmail) {
    try {
      await emailVerificationService.sendVerificationCode(
        user.email,
        user.first_name,
        ipAddress,
        userAgent
      );
      emailSent = true;
    } catch (emailError) {
      // Log error but don't fail signup
      console.error(`[User Service] Failed to send verification email to ${user.email}:`, emailError.message);
      // emailSent remains false
    }
  }

  return {
    user,
    emailSent
  };
};

/**
 * Login user and return JWT token
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} Object with user and token
 * @throws {Error} If credentials are invalid or email verification required
 */
const login = async (email, password) => {
  // Find user with password
  const user = await User.findByEmail(email, true);

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.errorCode = 'INVALID_CREDENTIALS';
    throw error;
  }

  // Check if account is active
  if (!user.is_active) {
    const error = new Error('Account is inactive');
    error.statusCode = 403;
    error.errorCode = 'ACCOUNT_INACTIVE';
    throw error;
  }

  // Verify password
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.errorCode = 'INVALID_CREDENTIALS';
    throw error;
  }

  // Check email verification status
  const isVerificationRequired = process.env.IS_VERIFICATION_REQUIRED === 'true' || 
                                  process.env.IS_VERIFICATION_REQUIRED === '1';
  
  if (isVerificationRequired && !user.email_verified) {
    const error = new Error('Email verification required. Please verify your email address before logging in.');
    error.statusCode = 403;
    error.errorCode = 'EMAIL_VERIFICATION_REQUIRED';
    error.emailVerified = false;
    throw error;
  }

  // Generate JWT token
  const token = generateAuthToken(user);

  // Remove password from user object
  delete user.password_hash;

  return {
    user,
    token,
    emailVerified: user.email_verified || false,
    emailVerificationRequired: !user.email_verified && isVerificationRequired
  };
};

/**
 * Check if user profile is complete
 * Profile is considered complete if:
 * - For email-based users: password_hash, first_name, and last_name are set
 * - For OAuth users (Google): first_name and last_name are set (password_hash is NULL)
 * @param {Object} user - User object
 * @returns {Object} { isComplete: boolean, missingFields: string[] }
 */
const checkProfileCompleteness = (user) => {
  const missingFields = [];

  // Check first_name
  if (!user.first_name || user.first_name.trim() === '') {
    missingFields.push('firstName');
  }

  // Check last_name
  if (!user.last_name || user.last_name.trim() === '') {
    missingFields.push('lastName');
  }

  // For email-based users, check password_hash
  if (user.auth_provider === 'email' || !user.auth_provider) {
    if (!user.password_hash) {
      missingFields.push('password');
    }
  }

  // Profile is complete if no missing fields
  return {
    isComplete: missingFields.length === 0,
    missingFields
  };
};

/**
 * Get user profile
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User profile object with avatar URL and completeness info
 * @throws {Error} If user not found
 */
const getProfile = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.errorCode = 'USER_NOT_FOUND';
    throw error;
  }

  // Check if password_hash exists in database (without returning the hash)
  // This is needed because User.findById() doesn't include password_hash for security
  let hasPassword = false;
  if (user.auth_provider === 'email' || !user.auth_provider) {
    try {
      const passwordCheckQuery = `
        SELECT password_hash IS NOT NULL as has_password
        FROM users
        WHERE id = $1
      `;
      const passwordResult = await pool.query(passwordCheckQuery, [userId]);
      hasPassword = passwordResult.rows[0]?.has_password || false;
    } catch (error) {
      // If query fails, fall back to checking signup_status
      // Active email-based users should have a password
      hasPassword = user.signup_status === 'active';
      console.warn(`[User Profile] Failed to check password for user ${userId}, using signup_status fallback:`, error.message);
    }
  }

  // Add hasPassword to user object for completeness check
  const userWithPassword = {
    ...user,
    password_hash: hasPassword ? 'exists' : null // Use 'exists' as placeholder, not actual hash
  };

  // Check profile completeness (but don't throw error - return with flag)
  const completeness = checkProfileCompleteness(userWithPassword);

  // Fetch user's profile image to get avatar URL
  // Query directly for primary profile image that has been uploaded
  // Include pending images (not yet approved) so users can see their newly uploaded images
  let avatar = null;
  try {
    // Query for primary profile image that has been uploaded
    // Include pending moderation status so users can see newly uploaded images
    const query = `
      SELECT id, entity_type, entity_id, image_type, storage_key, url,
             created_by, is_primary, is_active, display_order, metadata,
             upload_status, uploaded_at, file_size, content_type,
             is_deleted, moderation_status, moderation_notes, moderated_by, moderated_at,
             created_at, updated_at
      FROM images
      WHERE entity_type = $1 
        AND entity_id = $2 
        AND image_type = $3 
        AND is_primary = TRUE 
        AND is_active = TRUE
        AND is_deleted = FALSE
        AND upload_status = 'uploaded'
        AND moderation_status IN ('pending', 'approved')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, ['user', userId, 'profile']);
    
    if (result.rows.length > 0) {
      const profileImage = Image._formatImage(result.rows[0]);
      // Use thumbnail variant if available (best for avatars), otherwise use publicUrl
      avatar = profileImage.variants?.thumb || profileImage.publicUrl || profileImage.url;
    }
  } catch (error) {
    // If image fetch fails, just continue without avatar (don't fail the whole request)
    console.warn(`[User Profile] Failed to fetch profile image for user ${userId}:`, error.message);
  }

  // Add avatar and profile completeness info to user object
  return {
    ...user,
    avatar,
    profileComplete: completeness.isComplete,
    missingFields: completeness.isComplete ? [] : completeness.missingFields
  };
};

/**
 * Update user profile
 * @param {number} userId - User ID
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated user object
 * @throws {Error} If user not found
 */
const updateProfile = async (userId, updateData) => {
  const user = await User.update(userId, updateData);

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.errorCode = 'USER_NOT_FOUND';
    throw error;
  }

  return user;
};

/**
 * Change user password
 * @param {number} userId - User ID
 * @param {string} currentPassword - Current password (plain text)
 * @param {string} newPassword - New password (plain text)
 * @returns {Promise<Object>} Updated user object
 * @throws {Error} If user not found, current password is incorrect, or validation fails
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  // Get user with password hash
  const user = await User.findById(userId);
  
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.errorCode = 'USER_NOT_FOUND';
    throw error;
  }

  // Get password hash directly from database
  const { pool } = require('../config/database');
  const passwordQuery = `
    SELECT password_hash
    FROM users
    WHERE id = $1
  `;
  const passwordResult = await pool.query(passwordQuery, [userId]);
  const passwordHash = passwordResult.rows[0]?.password_hash;

  // Check if user has a password (OAuth users might not have passwords)
  if (!passwordHash) {
    const error = new Error('This account does not have a password. Please use your social login provider to sign in.');
    error.statusCode = 400;
    error.errorCode = 'NO_PASSWORD_SET';
    throw error;
  }

  // Verify current password
  const passwordValid = await verifyPassword(currentPassword, passwordHash);
  if (!passwordValid) {
    const error = new Error('Current password is incorrect');
    error.statusCode = 401;
    error.errorCode = 'INVALID_PASSWORD';
    throw error;
  }

  // Validate new password
  if (!newPassword || newPassword.trim().length === 0) {
    const error = new Error('New password cannot be empty');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Password length validation (minimum 8 characters, maximum 128)
  if (newPassword.length < 8) {
    const error = new Error('New password must be at least 8 characters long');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }
  if (newPassword.length > 128) {
    const error = new Error('New password is too long. Maximum 128 characters allowed');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Password strength validation
  const passwordErrors = [];
  
  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(newPassword)) {
    passwordErrors.push('one uppercase letter');
  }
  
  // Check for at least one lowercase letter
  if (!/[a-z]/.test(newPassword)) {
    passwordErrors.push('one lowercase letter');
  }
  
  // Check for at least one numerical digit
  if (!/[0-9]/.test(newPassword)) {
    passwordErrors.push('one numerical digit');
  }
  
  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
    passwordErrors.push('one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  // Check for no whitespace
  if (/\s/.test(newPassword)) {
    passwordErrors.push('no spaces');
  }

  if (passwordErrors.length > 0) {
    const error = new Error(`New password must contain: ${passwordErrors.join(', ')}`);
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Check if new password is different from current password
  const samePassword = await verifyPassword(newPassword, passwordHash);
  if (samePassword) {
    const error = new Error('New password must be different from current password');
    error.statusCode = 400;
    error.errorCode = 'SAME_PASSWORD';
    throw error;
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);

  // Update password
  const updatedUser = await User.update(userId, { passwordHash: newPasswordHash });

  if (!updatedUser) {
    const error = new Error('Failed to update password');
    error.statusCode = 500;
    error.errorCode = 'UPDATE_FAILED';
    throw error;
  }

  return updatedUser;
};

/**
 * Parse full name into first and last name
 * @param {string|null} fullName - Full name string
 * @returns {Object} Object with firstName and lastName
 */
const parseName = (fullName) => {
  if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
    return {
      firstName: 'User',
      lastName: ''
    };
  }

  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: ''
    };
  }

  // Take first part as firstName, rest as lastName
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
};

/**
 * Login or create user with Google authentication
 * Handles the complete Google OAuth flow:
 * 1. Check if user exists by provider+providerId OR email
 * 2. If exists, return user
 * 3. If not, create new user or link account if email exists
 * 
 * @param {Object} googlePayload - Verified Google user payload from verifyGoogleToken
 * @param {string} googlePayload.googleId - Google user ID (sub claim)
 * @param {string} googlePayload.email - User's email address
 * @param {string|null} [googlePayload.name] - User's full name (optional)
 * @param {string|null} [googlePayload.avatar] - User's profile picture URL (optional)
 * @returns {Promise<Object>} User object
 * @throws {Error} If account is inactive or linking fails
 * 
 * @example
 * const googleUser = await verifyGoogleToken(idToken);
 * const user = await loginOrCreateGoogleUser(googleUser);
 */
const loginOrCreateGoogleUser = async (googlePayload) => {
  const { googleId, email, name, avatar } = googlePayload;

  // Validate required fields
  if (!googleId || !email) {
    const error = new Error('Google payload missing required fields (googleId, email)');
    error.statusCode = 400;
    error.errorCode = 'INVALID_PAYLOAD';
    throw error;
  }

  // Step 1: Check if user exists by provider + providerId (Google account)
  let user = await User.findByProvider('google', googleId);

  if (user) {
    // User exists with this Google account
    // Check if account is active
    if (!user.is_active) {
      const error = new Error('Account is inactive');
      error.statusCode = 403;
      error.errorCode = 'ACCOUNT_INACTIVE';
      throw error;
    }

    // Update avatar if provided and different
    if (avatar && user.avatar !== avatar) {
      user = await User.update(user.id, { avatar });
    }

    return user;
  }

  // Step 2: Check if user exists by email (might be email-based account)
  user = await User.findByEmail(email);

  if (user) {
    // Email exists - link Google account to existing user
    if (!user.is_active) {
      const error = new Error('Account is inactive');
      error.statusCode = 403;
      error.errorCode = 'ACCOUNT_INACTIVE';
      throw error;
    }

    // Link Google provider to existing account
    try {
      user = await User.linkProvider(user.id, 'google', googleId, avatar || null);
      
      // Update name if missing and provided
      if (name && (!user.first_name || !user.last_name)) {
        const parsedName = parseName(name);
        const updateData = {};
        if (!user.first_name) updateData.firstName = parsedName.firstName;
        if (!user.last_name) updateData.lastName = parsedName.lastName;
        if (Object.keys(updateData).length > 0) {
          user = await User.update(user.id, updateData);
        }
      }

      return user;
    } catch (linkError) {
      // If linking fails (e.g., provider already linked to another account)
      const error = new Error(`Failed to link Google account: ${linkError.message}`);
      error.statusCode = 400;
      error.errorCode = 'LINK_FAILED';
      throw error;
    }
  }

  // Step 3: User doesn't exist - create new user with Google auth
  const parsedName = parseName(name);
  
  // Generate a username from email (before @) if needed
  // For now, we'll leave username as null since it's optional for OAuth users
  const username = null;

  try {
    user = await User.create({
      email,
      username,
      passwordHash: null, // Google users don't have passwords
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      phone: null,
      role: 'player',
      authProvider: 'google',
      providerId: googleId,
      avatar: avatar || null
    });

    return user;
  } catch (createError) {
    // Handle unique constraint violations
    if (createError.message.includes('unique') || createError.message.includes('duplicate')) {
      // Race condition: user was created between our checks
      // Try to find by provider again
      user = await User.findByProvider('google', googleId);
      if (user) {
        return user;
      }

      // Or try by email
      user = await User.findByEmail(email);
      if (user) {
        // Try to link
        try {
          return await User.linkProvider(user.id, 'google', googleId, avatar || null);
        } catch (linkError) {
          const error = new Error('Account already exists with this email');
          error.statusCode = 400;
          error.errorCode = 'EMAIL_EXISTS';
          throw error;
        }
      }
    }

    // Re-throw other errors
    const error = new Error(`Failed to create user: ${createError.message}`);
    error.statusCode = 500;
    error.errorCode = 'CREATE_FAILED';
    throw error;
  }
};

/**
 * Complete signup by setting password and profile information
 * Used after email verification to complete the signup process
 * 
 * @param {number} userId - User ID
 * @param {Object} profileData - Profile data to update
 * @param {string} [profileData.password] - Plain text password (optional)
 * @param {string} [profileData.firstName] - User first name (optional)
 * @param {string} [profileData.lastName] - User last name (optional)
 * @param {string} [profileData.phone] - User phone number (optional)
 * @returns {Promise<Object>} Updated user object
 * @throws {Error} If user not found, password validation fails, or update fails
 */
const completeSignup = async (userId, profileData) => {
  const { password, firstName, lastName, phone } = profileData;

  // Get user to check current state
  const user = await User.findById(userId);
  
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.errorCode = 'USER_NOT_FOUND';
    throw error;
  }

  // Build update data
  const updateData = {};

  // Validate and hash password if provided
  if (password) {
    // Validate password strength
    const { validatePasswordStrength } = require('../utils/passwordValidation');
    const passwordValidation = validatePasswordStrength(password);
    
    if (!passwordValidation.valid) {
      const error = new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      error.statusCode = 400;
      error.errorCode = 'INVALID_PASSWORD';
      error.errors = passwordValidation.errors;
      throw error;
    }

    // Hash password
    const passwordHash = await hashPassword(password);
    updateData.passwordHash = passwordHash;
    
    // Set signup_status to 'active' when password is set
    updateData.signupStatus = 'active';
  }

  // Add profile fields if provided
  if (firstName !== undefined) {
    // Validate first name
    const trimmedFirstName = firstName ? firstName.trim() : null;
    if (trimmedFirstName && trimmedFirstName.length > 0) {
      if (trimmedFirstName.length < 2) {
        const error = new Error('First name must be at least 2 characters long');
        error.statusCode = 400;
        error.errorCode = 'VALIDATION_ERROR';
        throw error;
      }
      if (trimmedFirstName.length > 50) {
        const error = new Error('First name is too long. Maximum 50 characters allowed');
        error.statusCode = 400;
        error.errorCode = 'VALIDATION_ERROR';
        throw error;
      }
      // Name format validation (only letters, spaces, hyphens, apostrophes)
      const nameRegex = /^[a-zA-Z\s'-]+$/;
      if (!nameRegex.test(trimmedFirstName)) {
        const error = new Error('First name can only contain letters, spaces, hyphens, and apostrophes');
        error.statusCode = 400;
        error.errorCode = 'VALIDATION_ERROR';
        throw error;
      }
      updateData.firstName = trimmedFirstName;
    } else {
      updateData.firstName = null;
    }
  }

  if (lastName !== undefined) {
    // Validate last name
    const trimmedLastName = lastName ? lastName.trim() : null;
    if (trimmedLastName && trimmedLastName.length > 0) {
      if (trimmedLastName.length < 2) {
        const error = new Error('Last name must be at least 2 characters long');
        error.statusCode = 400;
        error.errorCode = 'VALIDATION_ERROR';
        throw error;
      }
      if (trimmedLastName.length > 50) {
        const error = new Error('Last name is too long. Maximum 50 characters allowed');
        error.statusCode = 400;
        error.errorCode = 'VALIDATION_ERROR';
        throw error;
      }
      // Name format validation (only letters, spaces, hyphens, apostrophes)
      const nameRegex = /^[a-zA-Z\s'-]+$/;
      if (!nameRegex.test(trimmedLastName)) {
        const error = new Error('Last name can only contain letters, spaces, hyphens, and apostrophes');
        error.statusCode = 400;
        error.errorCode = 'VALIDATION_ERROR';
        throw error;
      }
      updateData.lastName = trimmedLastName;
    } else {
      updateData.lastName = null;
    }
  }

  if (phone !== undefined) {
    // Validate phone if provided
    if (phone && phone.trim().length > 0) {
      const normalizedPhone = phone.trim();
      
      // Basic phone validation (digits, spaces, hyphens, parentheses, plus sign)
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(normalizedPhone)) {
        const error = new Error('Phone number contains invalid characters');
        error.statusCode = 400;
        error.errorCode = 'VALIDATION_ERROR';
        throw error;
      }

      // Remove non-digit characters for length check
      const digitsOnly = normalizedPhone.replace(/\D/g, '');
      
      // Phone length validation (between 10-15 digits)
      if (digitsOnly.length < 10) {
        const error = new Error('Phone number must contain at least 10 digits');
        error.statusCode = 400;
        error.errorCode = 'VALIDATION_ERROR';
        throw error;
      }
      if (digitsOnly.length > 15) {
        const error = new Error('Phone number is too long. Maximum 15 digits allowed');
        error.statusCode = 400;
        error.errorCode = 'VALIDATION_ERROR';
        throw error;
      }
      updateData.phone = normalizedPhone;
    } else {
      updateData.phone = null;
    }
  }

  // Check if at least one field is being updated
  if (Object.keys(updateData).length === 0) {
    const error = new Error('At least one field (password, firstName, lastName, phone) must be provided');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Update user
  const updatedUser = await User.update(userId, updateData);

  if (!updatedUser) {
    const error = new Error('Failed to update profile');
    error.statusCode = 500;
    error.errorCode = 'UPDATE_FAILED';
    throw error;
  }

  return updatedUser;
};

/**
 * Delete user (soft delete by setting is_active to false)
 * Can delete by user ID or username
 * @param {number|string} identifier - User ID (number) or username (string)
 * @param {number} requestingUserId - ID of user making the request (for authorization)
 * @returns {Promise<Object>} Deleted user object
 * @throws {Error} If user not found or unauthorized
 */
const deleteUser = async (identifier, requestingUserId) => {
  let user;

  // Determine if identifier is ID (number) or username (string)
  const isNumeric = !isNaN(identifier) && !isNaN(parseInt(identifier));

  if (isNumeric) {
    // Find by ID
    user = await User.findById(parseInt(identifier, 10));
  } else {
    // Find by username
    user = await User.findByUsername(identifier);
  }

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.errorCode = 'USER_NOT_FOUND';
    throw error;
  }

  // Check authorization: users can only delete their own account
  // (In future, you might want to allow admins to delete any user)
  if (user.id !== requestingUserId) {
    const error = new Error('You can only delete your own account');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Soft delete user (set is_active to false)
  const deleted = await User.delete(user.id);

  if (!deleted) {
    const error = new Error('Failed to delete user');
    error.statusCode = 500;
    error.errorCode = 'DELETE_FAILED';
    throw error;
  }

  // Return user object (now marked as inactive)
  return {
    ...user,
    is_active: false
  };
};

module.exports = {
  signup,
  signupWithVerification,
  login,
  loginOrCreateGoogleUser,
  getProfile,
  checkProfileCompleteness,
  updateProfile,
  completeSignup,
  changePassword,
  deleteUser,
  hashPassword,
  verifyPassword
};

