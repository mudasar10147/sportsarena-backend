/**
 * User Routes
 * 
 * Following MVP_FULL_ROADMAP.md Step 2: User Routes
 * 
 * Endpoints:
 * - POST   /users/signup   - Register a new user (username + email)
 * - POST   /users/login    - Login and get JWT token
 * - GET    /users/profile  - Get logged-in user profile
 * - PUT    /users/profile  - Update profile (optional for MVP)
 * - POST   /users/complete-signup - Complete signup (set password and profile)
 * - PUT    /users/change-password - Change user password
 * - GET    /users/bookings - Fetch user's bookings
 * - DELETE /users/:identifier - Delete user account (by ID or username)
 * - POST   /users/send-verification-code - Send email verification code
 * - POST   /users/verify-email - Verify email with code
 * - GET    /users/verification-status - Get email verification status
 */

const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { authenticate, optionalAuthenticate } = require('../../middleware/auth');
const { 
  emailVerificationRateLimiter, 
  emailVerificationAttemptRateLimiter 
} = require('../../middleware/rateLimiter');

// Public routes (no authentication required)
router.post('/signup', userController.signup);
router.post('/login', userController.login);

// Email verification routes
// send-verification-code: Works with or without authentication
// - Unauthenticated: For signup flow
// - Authenticated: For re-verification of existing accounts
router.post(
  '/send-verification-code',
  optionalAuthenticate, // Optional auth - allows both authenticated and unauthenticated requests
  emailVerificationRateLimiter, // IP-based rate limiting (10 per hour)
  userController.sendVerificationCode
);

// verify-email: No authentication required (code-based verification)
router.post(
  '/verify-email',
  emailVerificationAttemptRateLimiter, // IP-based rate limiting (20 per hour)
  userController.verifyEmail
);

// Protected routes (authentication required)
// Note: Specific routes must come before parameterized routes
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.post('/complete-signup', authenticate, userController.completeSignup);
router.put('/change-password', authenticate, userController.changePassword);
router.get('/bookings', authenticate, userController.getUserBookings);
router.get('/verification-status', authenticate, userController.getVerificationStatus);

// Delete user route (must come after specific routes to avoid conflicts)
// Supports both user ID (number) and username (string)
router.delete('/:identifier', authenticate, userController.deleteUser);

module.exports = router;

