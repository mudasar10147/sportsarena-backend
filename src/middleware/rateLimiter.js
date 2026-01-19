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
  // Use default IP detection (handles IPv4 and IPv6 correctly)
  // Express automatically sets req.ip from X-Forwarded-For header
  // No custom keyGenerator needed - default handles it properly
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

/**
 * Email verification rate limiter
 * Limits verification code requests per IP
 * 
 * Limits: 10 requests per hour per IP
 * Additional per-email rate limiting is handled in the service layer
 */
const emailVerificationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour per IP
  message: {
    success: false,
    message: 'Too many verification requests. Please try again later.',
    error_code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

/**
 * Email verification code verification rate limiter
 * Limits verification attempts per IP
 * 
 * Limits: 20 attempts per hour per IP
 * Additional per-code attempt limiting is handled in the service layer
 */
const emailVerificationAttemptRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 verification attempts per hour per IP
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.',
    error_code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

module.exports = {
  authRateLimiter,
  apiRateLimiter,
  emailVerificationRateLimiter,
  emailVerificationAttemptRateLimiter
};

