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
 * Login user and return JWT token
 * @param {string} email - User email
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} Object with user and token
 * @throws {Error} If credentials are invalid
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

  // Generate JWT token
  const token = generateAuthToken(user);

  // Remove password from user object
  delete user.password_hash;

  return {
    user,
    token
  };
};

/**
 * Get user profile
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User profile object with avatar URL
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

  // Add avatar to user object
  return {
    ...user,
    avatar
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
  login,
  loginOrCreateGoogleUser,
  getProfile,
  updateProfile,
  deleteUser,
  hashPassword,
  verifyPassword
};

