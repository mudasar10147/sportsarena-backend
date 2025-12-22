/**
 * User Routes
 * 
 * Following MVP_FULL_ROADMAP.md Step 2: User Routes
 * 
 * Endpoints:
 * - POST   /users/signup   - Register a new user
 * - POST   /users/login    - Login and get JWT token
 * - GET    /users/profile  - Get logged-in user profile
 * - PUT    /users/profile  - Update profile (optional for MVP)
 * - GET    /users/bookings - Fetch user's bookings
 * - DELETE /users/:identifier - Delete user account (by ID or username)
 */

const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const { authenticate } = require('../../middleware/auth');

// Public routes (no authentication required)
router.post('/signup', userController.signup);
router.post('/login', userController.login);

// Protected routes (authentication required)
// Note: Specific routes must come before parameterized routes
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.get('/bookings', authenticate, userController.getUserBookings);

// Delete user route (must come after specific routes to avoid conflicts)
// Supports both user ID (number) and username (string)
router.delete('/:identifier', authenticate, userController.deleteUser);

module.exports = router;

