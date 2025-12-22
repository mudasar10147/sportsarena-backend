/**
 * Google ID Token Verification Utility
 * 
 * Verifies Google ID tokens and extracts user information.
 * Uses the official google-auth-library for secure token verification.
 * 
 * Required Environment Variables:
 * - GOOGLE_CLIENT_ID: Google OAuth 2.0 client ID
 * 
 * Security:
 * - Validates token signature, issuer, audience, and expiration
 * - All validation happens server-side
 * - No sensitive data exposed to frontend
 */

require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');

// Validate required environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  throw new Error(
    'GOOGLE_CLIENT_ID environment variable is required for Google authentication'
  );
}

// Initialize OAuth2Client
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verify Google ID token and extract user information
 * 
 * @param {string} token - Google ID token to verify
 * @returns {Promise<Object>} Normalized user object with:
 *   - googleId: Google user ID (sub claim)
 *   - email: User's email address
 *   - name: User's full name
 *   - avatar: User's profile picture URL
 * @throws {Error} If token is invalid, expired, or verification fails
 * 
 * @example
 * try {
 *   const user = await verifyGoogleToken(idToken);
 *   console.log(user); // { googleId: '123...', email: 'user@example.com', ... }
 * } catch (error) {
 *   console.error('Token verification failed:', error.message);
 * }
 */
const verifyGoogleToken = async (token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Google ID token is required and must be a string');
  }

  try {
    // Verify the token
    // This automatically validates:
    // - Token signature
    // - Issuer (must be accounts.google.com or https://accounts.google.com)
    // - Audience (must match GOOGLE_CLIENT_ID)
    // - Expiration time
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID
    });

    // Extract payload from verified token
    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Failed to extract payload from verified token');
    }

    // Validate required claims
    if (!payload.sub) {
      throw new Error('Token payload missing required "sub" claim (Google user ID)');
    }

    if (!payload.email) {
      throw new Error('Token payload missing required "email" claim');
    }

    // Validate issuer
    const validIssuers = [
      'accounts.google.com',
      'https://accounts.google.com'
    ];
    
    if (!validIssuers.includes(payload.iss)) {
      throw new Error(
        `Invalid token issuer: ${payload.iss}. Expected one of: ${validIssuers.join(', ')}`
      );
    }

    // Validate audience
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      throw new Error(
        `Token audience mismatch. Expected: ${GOOGLE_CLIENT_ID}, Got: ${payload.aud}`
      );
    }

    // Validate expiration (additional check, though verifyIdToken already does this)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token has expired');
    }

    // Extract and normalize user information
    const userInfo = {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || null,
      avatar: payload.picture || null
    };

    // Verify email is verified (if email_verified claim exists)
    if (payload.email_verified === false) {
      throw new Error('Email address associated with this Google account is not verified');
    }

    return userInfo;
  } catch (error) {
    // Provide clear error messages for common issues
    if (error.message.includes('Token used too early')) {
      throw new Error('Token is not yet valid. Please check your system clock.');
    }
    
    if (error.message.includes('Invalid token signature')) {
      throw new Error('Invalid token signature. The token may be corrupted or tampered with.');
    }
    
    if (error.message.includes('Token expired')) {
      throw new Error('Token has expired. Please request a new token.');
    }

    // Re-throw with original message if it's already clear
    if (error.message.includes('Token') || error.message.includes('token')) {
      throw error;
    }

    // Generic error for unexpected issues
    throw new Error(`Google token verification failed: ${error.message}`);
  }
};

module.exports = {
  verifyGoogleToken
};

