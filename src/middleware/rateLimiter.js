/**
 * Rate Limiting Middleware
 * 
 * Protects endpoints from abuse and brute-force attacks
 * Uses express-rate-limit for in-memory rate limiting
 */

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication endpoints
 * Prevents brute-force attacks and token replay attempts
 * 
 * Limits: 5 requests per 15 minutes per IP
 * This is stricter than general API limits to protect auth endpoints
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
    error_code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use IP address for rate limiting
  keyGenerator: (req) => {
    // Try to get real IP from proxy headers
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           'unknown';
  },
  // Skip rate limiting for successful authentications (optional optimization)
  skipSuccessfulRequests: false,
  // Skip rate limiting for failed requests (we want to limit failures)
  skipFailedRequests: false
});

/**
 * General API rate limiter (less strict)
 * For non-auth endpoints
 */
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    error_code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  authRateLimiter,
  apiRateLimiter
};

