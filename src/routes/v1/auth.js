/**
 * Authentication Routes
 * 
 * Handles authentication endpoints:
 * - POST /auth/google - Google OAuth authentication
 * 
 * Security:
 * - Rate limiting applied to prevent brute-force attacks
 * - Input validation and sanitization
 * - Secure logging (no sensitive data exposed)
 */

const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { authRateLimiter } = require('../../middleware/rateLimiter');

// Google OAuth authentication
// Rate limited: 5 requests per 15 minutes per IP
router.post('/google', authRateLimiter, authController.googleAuth);

module.exports = router;

