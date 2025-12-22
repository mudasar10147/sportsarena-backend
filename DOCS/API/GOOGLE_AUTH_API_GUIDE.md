# 📚 Google Authentication API Guide

Complete guide for Google OAuth authentication endpoint in SportsArena MVP.

**Base URL:** `/api/v1/auth`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [Endpoint](#endpoint)
4. [Request/Response Examples](#requestresponse-examples)
5. [Error Handling](#error-handling)
6. [Security Features](#security-features)
7. [Frontend Integration](#frontend-integration)
8. [Testing](#testing)

---

## Overview

The Google Authentication API allows users to authenticate using their Google account. The endpoint verifies Google ID tokens, creates or links user accounts, and returns a JWT token for subsequent API requests.

### Key Features

- **OAuth 2.0 Integration**: Uses Google's official authentication library
- **Automatic Account Creation**: Creates new users if they don't exist
- **Account Linking**: Links Google accounts to existing email-based accounts
- **Rate Limited**: Protected against brute-force attacks (5 requests per 15 minutes per IP)
- **Secure**: No client secrets exposed, all validation server-side

### Authentication Providers

The system supports multiple authentication providers:
- **`email`**: Traditional email/password authentication
- **`google`**: Google OAuth authentication

Users can link their Google account to an existing email-based account.

---

## Authentication Flow

### High-Level Flow

```
1. Frontend obtains Google ID token from Google Sign-In
2. Frontend sends ID token to POST /api/v1/auth/google
3. Backend verifies token with Google
4. Backend checks if user exists (by provider ID or email)
5. Backend creates new user OR links to existing account
6. Backend generates JWT token
7. Backend returns user info + JWT token
8. Frontend stores JWT token for subsequent API requests
```

### Detailed Flow

1. **Token Verification**
   - Validates token signature, issuer, audience, and expiration
   - Extracts user information (email, name, avatar, Google ID)

2. **User Resolution**
   - First checks if user exists with this Google account (`provider + providerId`)
   - If not found, checks if email already exists in system
   - If email exists, links Google account to existing user
   - If neither exists, creates new user with Google authentication

3. **Token Generation**
   - Generates JWT token with `userId`, `role`, and `provider`
   - Token expires in 7 days (configurable)

---

## Endpoint

### Google Authentication

**`POST /api/v1/auth/google`**

Authenticate or register a user using Google ID token.

#### Request Headers

```
Content-Type: application/json
```

#### Request Body

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Required Fields:**
- `idToken` (string): Google ID token obtained from Google Sign-In SDK

**Token Requirements:**
- Must be a valid JWT format (three base64url-encoded parts separated by dots)
- Minimum length: 100 characters
- Maximum length: 10,000 characters
- Must be a non-empty string

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "username": null,
      "firstName": "John",
      "lastName": "Doe",
      "phone": null,
      "role": "player",
      "avatar": "https://lh3.googleusercontent.com/a/...",
      "authProvider": "google",
      "isActive": true,
      "emailVerified": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response Fields:**

- `user.id` (number): Unique user ID
- `user.email` (string): User's email address
- `user.username` (string|null): Username (null for Google users)
- `user.firstName` (string): User's first name
- `user.lastName` (string): User's last name
- `user.phone` (string|null): Phone number (if provided)
- `user.role` (string): User role (`"player"` or `"facility_admin"`)
- `user.avatar` (string|null): Profile picture URL from Google
- `user.authProvider` (string): Authentication provider (`"google"` or `"email"`)
- `user.isActive` (boolean): Whether account is active
- `user.emailVerified` (boolean): Whether email is verified (always `true` for Google)
- `user.createdAt` (string): Account creation timestamp (ISO 8601)
- `user.updatedAt` (string): Last update timestamp (ISO 8601)
- `token` (string): JWT token for subsequent API requests

**JWT Token Payload:**
```json
{
  "userId": 1,
  "role": "player",
  "provider": "google",
  "iss": "sportsarena-api",
  "aud": "sportsarena-client",
  "exp": 1737129600
}
```

---

## Request/Response Examples

### Example 1: New User Registration

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": 42,
      "email": "newuser@gmail.com",
      "username": null,
      "firstName": "Jane",
      "lastName": "Smith",
      "phone": null,
      "role": "player",
      "avatar": "https://lh3.googleusercontent.com/a/avatar.jpg",
      "authProvider": "google",
      "isActive": true,
      "emailVerified": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQyLCJyb2xlIjoicGxheWVyIiwicHJvdmlkZXIiOiJnb29nbGUiLCJpYXQiOjE3MzY5MjgwMDAsImV4cCI6MTczNzUzMjgwMH0..."
  }
}
```

### Example 2: Existing User Login

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": 1,
      "email": "existing@gmail.com",
      "username": null,
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+923001234567",
      "role": "player",
      "avatar": "https://lh3.googleusercontent.com/a/updated-avatar.jpg",
      "authProvider": "google",
      "isActive": true,
      "emailVerified": true,
      "createdAt": "2025-01-10T08:00:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Example 3: Account Linking (Email Exists)

When a user with an existing email-based account logs in with Google for the first time, the system automatically links the Google account.

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": 5,
      "email": "linked@gmail.com",
      "username": "linkeduser",
      "firstName": "Linked",
      "lastName": "User",
      "phone": "+923001234567",
      "role": "player",
      "avatar": "https://lh3.googleusercontent.com/a/new-avatar.jpg",
      "authProvider": "google",
      "isActive": true,
      "emailVerified": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Note:** The `authProvider` field changes from `"email"` to `"google"` after linking, but the user can still login with email if they have a password.

---

## Error Handling

### Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "message": "Error message here",
  "error_code": "ERROR_CODE"
}
```

### Error Codes

| HTTP Status | Error Code | Description | Frontend Action |
|-------------|------------|-------------|----------------|
| 400 | `VALIDATION_ERROR` | Invalid request format or missing fields | Show validation message to user |
| 400 | `LINK_FAILED` | Failed to link Google account (already linked to another user) | Show error, suggest manual account merge |
| 400 | `EMAIL_EXISTS` | Email already exists (race condition) | Retry authentication |
| 401 | `UNAUTHORIZED` | Token verification failed | Request new Google ID token |
| 403 | `ACCOUNT_INACTIVE` | User account is deactivated | Show account disabled message |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests | Show rate limit message, wait before retry |
| 500 | `INTERNAL_ERROR` | Server error | Log error, show generic error message |

### Error Examples

#### 1. Missing Token (400 Bad Request)

```json
{
  "success": false,
  "message": "Missing required field: idToken",
  "error_code": "VALIDATION_ERROR"
}
```

#### 2. Invalid Token Format (400 Bad Request)

```json
{
  "success": false,
  "message": "Token must be in JWT format",
  "error_code": "VALIDATION_ERROR"
}
```

#### 3. Token Verification Failed (401 Unauthorized)

```json
{
  "success": false,
  "message": "Token verification failed",
  "error_code": "UNAUTHORIZED"
}
```

**Common Causes:**
- Token expired
- Token tampered with
- Token issued for different client ID
- Token from wrong issuer

**Frontend Action:** Request a new Google ID token from Google Sign-In SDK.

#### 4. Account Inactive (403 Forbidden)

```json
{
  "success": false,
  "message": "Account is inactive",
  "error_code": "ACCOUNT_INACTIVE"
}
```

**Frontend Action:** Show message that account has been deactivated and contact support.

#### 5. Rate Limit Exceeded (429 Too Many Requests)

```json
{
  "success": false,
  "message": "Too many authentication attempts. Please try again later.",
  "error_code": "RATE_LIMIT_EXCEEDED"
}
```

**Rate Limit:** 5 requests per 15 minutes per IP address

**Frontend Action:** 
- Show rate limit message
- Disable login button for 15 minutes
- Optionally show countdown timer

#### 6. Server Error (500 Internal Server Error)

```json
{
  "success": false,
  "message": "An unexpected error occurred during authentication",
  "error_code": "INTERNAL_ERROR"
}
```

**Frontend Action:** 
- Log error for debugging
- Show generic error message
- Allow user to retry after a delay

---

## Security Features

### Rate Limiting

- **Limit:** 5 requests per 15 minutes per IP address
- **Purpose:** Prevent brute-force attacks and token replay attacks
- **Response:** Returns `429 Too Many Requests` with `RATE_LIMIT_EXCEEDED` error code

### Input Validation

- **Token Format:** Validates JWT structure before sending to Google
- **Length Checks:** Minimum 100 characters, maximum 10,000 characters
- **Type Validation:** Ensures `idToken` is a non-empty string

### Error Sanitization

- **No Sensitive Data:** Error messages never expose:
  - Stack traces
  - Database errors
  - Internal implementation details
  - Token values
  - User passwords or secrets

### Secure Logging

- **No Sensitive Data:** Logs never contain:
  - Full tokens (redacted as `[REDACTED]`)
  - Passwords (redacted)
  - Client secrets (never logged)
- **Audit Trail:** Logs include:
  - Request ID
  - Client IP address
  - User agent
  - Timestamp
  - Event type (success/failure)

### Client Secret Protection

- **Never Exposed:** `GOOGLE_CLIENT_SECRET` is never used or exposed
- **ID Token Verification:** Only requires `GOOGLE_CLIENT_ID` (public, safe)
- **Server-Side Only:** All secrets stay in environment variables

---

## Frontend Integration

### Prerequisites

1. **Google Sign-In SDK**: Integrate Google Sign-In for your platform (Web, iOS, Android)
2. **Google OAuth Client ID**: Obtain from [Google Cloud Console](https://console.cloud.google.com/)
3. **Backend API URL**: Configure backend API base URL

### Integration Steps

#### 1. Initialize Google Sign-In

**Web (JavaScript):**
```javascript
// Load Google Sign-In library
<script src="https://accounts.google.com/gsi/client" async defer></script>

// Initialize
window.onload = function () {
  google.accounts.id.initialize({
    client_id: 'YOUR_GOOGLE_CLIENT_ID',
    callback: handleCredentialResponse
  });
};
```

**React Native (expo-google-sign-in):**
```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: 'YOUR_GOOGLE_CLIENT_ID',
});
```

#### 2. Handle Google Sign-In Response

```javascript
async function handleCredentialResponse(response) {
  const idToken = response.credential; // Google ID token
  
  try {
    // Send to backend
    const result = await authenticateWithGoogle(idToken);
    
    // Store JWT token
    localStorage.setItem('authToken', result.data.token);
    localStorage.setItem('user', JSON.stringify(result.data.user));
    
    // Redirect to app
    window.location.href = '/dashboard';
  } catch (error) {
    handleAuthError(error);
  }
}
```

#### 3. Send Request to Backend

```javascript
async function authenticateWithGoogle(idToken) {
  const response = await fetch('https://api.sportsarena.com/api/v1/auth/google', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idToken: idToken
    })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Authentication failed');
  }
  
  return data;
}
```

#### 4. Handle Errors

```javascript
function handleAuthError(error) {
  if (error.status === 429) {
    // Rate limit exceeded
    showError('Too many login attempts. Please wait 15 minutes.');
    disableLoginButton(15 * 60); // 15 minutes in seconds
  } else if (error.status === 401) {
    // Token verification failed
    showError('Login failed. Please try again.');
    // Request new token from Google
    requestNewGoogleToken();
  } else if (error.status === 403) {
    // Account inactive
    showError('Your account has been deactivated. Please contact support.');
  } else {
    // Generic error
    showError('An error occurred. Please try again.');
  }
}
```

#### 5. Use JWT Token for Subsequent Requests

```javascript
// Include token in Authorization header
const response = await fetch('https://api.sportsarena.com/api/v1/users/profile', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  }
});
```

### Frontend Expectations

#### Success Flow

1. User clicks "Sign in with Google"
2. Google Sign-In popup appears
3. User selects Google account
4. Frontend receives Google ID token
5. Frontend sends token to `/api/v1/auth/google`
6. Backend returns user data + JWT token
7. Frontend stores token (localStorage/sessionStorage/secure storage)
8. Frontend redirects to authenticated area
9. Frontend includes token in all subsequent API requests

#### Error Handling

- **Rate Limiting:** Show user-friendly message, disable login button temporarily
- **Token Expired:** Automatically request new Google token and retry
- **Account Inactive:** Show message with support contact information
- **Network Errors:** Show retry option with exponential backoff

#### Token Storage

**Web:**
- Use `localStorage` for persistent login (survives browser restart)
- Use `sessionStorage` for session-only login (cleared on tab close)
- Consider `httpOnly` cookies for enhanced security (requires cookie support)

**Mobile:**
- Use secure storage (Keychain on iOS, Keystore on Android)
- Never store tokens in plain text
- Use libraries like `react-native-keychain` or `expo-secure-store`

#### Token Refresh

- JWT tokens expire in 7 days
- Before expiration, request new Google ID token and re-authenticate
- Implement automatic token refresh 1 day before expiration

---

## Testing

### Manual Testing

#### 1. Test New User Registration

```bash
# Get Google ID token from Google Sign-In SDK
# Then test endpoint
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "YOUR_GOOGLE_ID_TOKEN"}'
```

**Expected:** 200 OK with new user data and JWT token

#### 2. Test Existing User Login

```bash
# Use same Google account that was previously registered
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "YOUR_GOOGLE_ID_TOKEN"}'
```

**Expected:** 200 OK with existing user data and JWT token

#### 3. Test Invalid Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "invalid_token"}'
```

**Expected:** 401 Unauthorized with `UNAUTHORIZED` error code

#### 4. Test Missing Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** 400 Bad Request with `VALIDATION_ERROR` error code

#### 5. Test Rate Limiting

```bash
# Make 6 requests rapidly
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/v1/auth/google \
    -H "Content-Type: application/json" \
    -d '{"idToken": "YOUR_GOOGLE_ID_TOKEN"}'
  echo ""
done
```

**Expected:** First 5 requests succeed, 6th returns 429 Too Many Requests

### Test Cases

| Test Case | Input | Expected Result |
|-----------|-------|----------------|
| Valid new user | Valid Google ID token | 200 OK, new user created |
| Valid existing user | Valid Google ID token (existing) | 200 OK, existing user returned |
| Account linking | Valid token, email exists | 200 OK, account linked |
| Missing token | `{}` | 400 Bad Request |
| Invalid format | `"not_a_jwt"` | 400 Bad Request |
| Expired token | Expired Google ID token | 401 Unauthorized |
| Wrong client ID | Token for different client | 401 Unauthorized |
| Rate limit | 6 requests in 15 min | 429 Too Many Requests |
| Inactive account | Valid token, inactive user | 403 Forbidden |

---

## Environment Variables

Required environment variables for Google authentication:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
```

**Note:** `GOOGLE_CLIENT_SECRET` is NOT required for ID token verification. Only `GOOGLE_CLIENT_ID` is needed.

---

## Related Documentation

- [User API Guide](./USER_API_GUIDE.md) - Email/password authentication
- [API Architecture](./API_ARCHITECTURE.md) - Overall API design
- [Middleware Setup](./MIDDLEWARE_SETUP.md) - Authentication middleware

---

## Support

For issues or questions:
1. Check error codes and messages
2. Review security logs (server-side)
3. Verify Google OAuth configuration
4. Ensure token is fresh (not expired)

---

**Last Updated:** 2025-01-15  
**API Version:** v1

