/**
 * Authentication Controller
 * 
 * Handles HTTP requests for authentication operations
 * - Google OAuth authentication
 * 
 * Security Features:
 * - Input validation and sanitization
 * - Rate limiting (via middleware)
 * - Secure logging (no sensitive data)
 * - Error normalization (no information leakage)
 * - Token replay mitigation (rate limiting + format validation)
 */

const { verifyGoogleToken } = require('../utils/googleAuth');
const { loginOrCreateGoogleUser } = require('../services/userService');
const { generateAuthToken } = require('../utils/jwt');
const { 
  sendSuccess, 
  sendError, 
  sendUnauthorized,
  sendValidationError,
  sendInternalError
} = require('../utils/response');
const {
  sanitizeError,
  logSecurityEvent,
  validateTokenFormat,
  getClientIp,
  getUserAgent
} = require('../utils/security');

/**
 * Authenticate user with Google ID token
 * POST /api/v1/auth/google
 * 
 * Request body:
 * {
 *   "idToken": "google_id_token_string"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "user": { ... },
 *     "token": "jwt_token_string"
 *   },
 *   "message": "Authentication successful"
 * }
 */
const googleAuth = async (req, res, next) => {
  const clientIp = getClientIp(req);
  const userAgent = getUserAgent(req);
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { idToken } = req.body;

    // ===== Step 1: Enhanced Input Validation =====
    if (!idToken) {
      logSecurityEvent('auth_validation_failure', {
        requestId,
        ip: clientIp,
        userAgent,
        reason: 'missing_idToken'
      }, 'warn');
      return sendValidationError(res, 'Missing required field: idToken');
    }

    if (typeof idToken !== 'string') {
      logSecurityEvent('auth_validation_failure', {
        requestId,
        ip: clientIp,
        userAgent,
        reason: 'invalid_idToken_type'
      }, 'warn');
      return sendValidationError(res, 'idToken must be a string');
    }

    const trimmedToken = idToken.trim();

    if (trimmedToken.length === 0) {
      logSecurityEvent('auth_validation_failure', {
        requestId,
        ip: clientIp,
        userAgent,
        reason: 'empty_idToken'
      }, 'warn');
      return sendValidationError(res, 'idToken cannot be empty');
    }

    // Format validation before sending to Google API (mitigates token replay attacks)
    const formatValidation = validateTokenFormat(trimmedToken);
    if (!formatValidation.valid) {
      logSecurityEvent('auth_validation_failure', {
        requestId,
        ip: clientIp,
        userAgent,
        reason: 'invalid_token_format',
        error: formatValidation.error
      }, 'warn');
      return sendValidationError(res, formatValidation.error);
    }

    // ===== Step 2: Verify Google ID Token =====
    let googlePayload;
    try {
      googlePayload = await verifyGoogleToken(trimmedToken);
      
      // Log successful token verification (without sensitive data)
      logSecurityEvent('auth_token_verified', {
        requestId,
        ip: clientIp,
        userAgent,
        email: googlePayload.email,
        hasName: !!googlePayload.name,
        hasAvatar: !!googlePayload.avatar
      }, 'info');
    } catch (error) {
      // Token verification failed - log security event
      logSecurityEvent('auth_token_verification_failure', {
        requestId,
        ip: clientIp,
        userAgent,
        error: sanitizeError(error, 'Token verification failed')
      }, 'warn');

      // Return normalized error (no sensitive information)
      const sanitizedMessage = sanitizeError(error, 'Token verification failed');
      return sendUnauthorized(res, sanitizedMessage);
    }

    // ===== Step 3: Login or Create User =====
    let user;
    try {
      user = await loginOrCreateGoogleUser(googlePayload);
      
      logSecurityEvent('auth_user_resolved', {
        requestId,
        ip: clientIp,
        userAgent,
        userId: user.id,
        email: user.email,
        isNewUser: user.created_at && 
          new Date(user.created_at).getTime() > Date.now() - 5000 // Created within last 5 seconds
      }, 'info');
    } catch (error) {
      // Handle service errors with normalized messages
      const sanitizedMessage = sanitizeError(error, 'Authentication failed');
      
      logSecurityEvent('auth_user_resolution_failure', {
        requestId,
        ip: clientIp,
        userAgent,
        email: googlePayload.email,
        error: sanitizedMessage,
        statusCode: error.statusCode
      }, error.statusCode === 403 ? 'warn' : 'error');

      if (error.statusCode === 403) {
        // Account inactive
        return sendError(res, sanitizedMessage, error.errorCode, 403);
      }
      
      if (error.statusCode === 400) {
        // Validation or linking errors
        return sendError(res, sanitizedMessage, error.errorCode, 400);
      }

      // Unexpected error - don't expose details
      return sendInternalError(res, 'Failed to authenticate user');
    }

    // ===== Step 4: Generate JWT Token =====
    let token;
    try {
      token = generateAuthToken(user);
    } catch (error) {
      logSecurityEvent('auth_jwt_generation_failure', {
        requestId,
        ip: clientIp,
        userAgent,
        userId: user.id,
        error: sanitizeError(error, 'JWT generation failed')
      }, 'error');
      
      return sendInternalError(res, 'Failed to generate authentication token');
    }

    // ===== Step 5: Success Response =====
    logSecurityEvent('auth_success', {
      requestId,
      ip: clientIp,
      userAgent,
      userId: user.id,
      email: user.email,
      authProvider: user.auth_provider
    }, 'info');

    return sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          authProvider: user.auth_provider,
          isActive: user.is_active,
          emailVerified: user.email_verified,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        token
      },
      'Authentication successful'
    );
  } catch (error) {
    // Unexpected server error - log but don't expose details
    logSecurityEvent('auth_unexpected_error', {
      requestId,
      ip: clientIp,
      userAgent,
      error: sanitizeError(error, 'Unexpected error')
    }, 'error');

    return sendInternalError(res, 'An unexpected error occurred during authentication');
  }
};

module.exports = {
  googleAuth
};

