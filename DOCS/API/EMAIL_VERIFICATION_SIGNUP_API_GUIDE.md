# 📧 Email Verification & Progressive Signup API Guide

Complete guide for Email Verification and Progressive Signup API endpoints in SportsArena MVP.

**Base URL:** `/api/v1/users`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Signup Flow Overview](#signup-flow-overview)
3. [Authentication](#authentication)
4. [Endpoints](#endpoints)
5. [Account States](#account-states)
6. [Rate Limiting](#rate-limiting)
7. [Error Handling](#error-handling)
8. [Security Features](#security-features)
9. [Testing Guide](#testing-guide)

---

## Overview

The Email Verification & Progressive Signup system implements a secure, multi-step signup process using Amazon SES for email delivery. The system supports:

- **Progressive Signup Flow**: Email verification first, profile completion later
- **Account State Management**: Handles complete, incomplete, and unverified accounts
- **Secure Code Generation**: 6-digit numeric codes with bcrypt hashing
- **Rate Limiting**: Protection against abuse (per email and per IP)
- **Transaction Safety**: Atomic operations for code verification and account creation

### Key Features

- ✅ Email verification via 6-digit codes
- ✅ Progressive signup (email → verification → profile completion)
- ✅ Account state management
- ✅ Rate limiting and cooldown periods
- ✅ Secure code storage (bcrypt hashing)
- ✅ Automatic cleanup of expired codes
- ✅ Comprehensive error handling
- ✅ Logging and metrics tracking

---

## Signup Flow Overview

The progressive signup process consists of 4 steps:

### Step 1: Initial Signup Request
User provides `username` and `email`. Backend validates and sends verification code.

### Step 2: Email Verification Code Sent
Verification code is sent to user's email via Amazon SES.

### Step 3: Code Verification & Account Creation
User enters verification code. Backend verifies code and creates minimal account with JWT token.

### Step 4: Profile Completion (Optional)
User completes profile by setting password and additional details.

---

## Authentication

### JWT Token Authentication

Most endpoints require JWT authentication. After successful email verification (Step 3), a JWT token is returned that should be used for subsequent authenticated requests:

```
Authorization: Bearer <your-jwt-token>
```

### Unauthenticated Endpoints

The following endpoints do NOT require authentication:
- `POST /api/v1/users/signup` - Initial signup request
- `POST /api/v1/users/verify-email` - Email verification
- `POST /api/v1/users/send-verification-code` - Can be used with or without authentication

---

## Endpoints

### 1. Initial Signup Request

**`POST /api/v1/users/signup`**

Step 1 of the signup process. Validates username and email, checks uniqueness, and sends verification code.

**Requires Authentication:** No

#### Request Body

```json
{
  "username": "johndoe",
  "email": "john@example.com"
}
```

**Required Fields:**
- `username` (string): Username (3-50 characters, alphanumeric + underscore/hyphen)
- `email` (string): Valid email address

#### Username Validation Rules

- Length: 3-50 characters
- Allowed characters: Letters (a-z, A-Z), numbers (0-9), underscore (_), hyphen (-)
- Must start with a letter or number
- Cannot be a reserved username (admin, root, etc.)

#### Email Validation Rules

- Must be a valid email format
- Automatically normalized (lowercase)
- Sanitized to prevent injection attacks

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Verification code sent to your email",
  "data": {
    "email": "john@example.com",
    "username": "johndoe",
    "expiresAt": "2025-01-15T10:45:00.000Z",
    "accountState": "new"
  }
}
```

**Response Fields:**
- `email`: Normalized email address
- `username`: Normalized username
- `expiresAt`: Code expiration timestamp (15 minutes from now)
- `accountState`: Account state (`new`, `incomplete`, `unverified`)

#### Account State Responses

**New Email (accountState: "new")**
```json
{
  "success": true,
  "message": "Verification code sent to your email",
  "data": {
    "accountState": "new"
  }
}
```

**Incomplete Account (accountState: "incomplete")**
```json
{
  "success": true,
  "message": "Verification code sent. Complete your signup.",
  "data": {
    "accountState": "incomplete"
  }
}
```

**Unverified Account (accountState: "unverified")**
```json
{
  "success": true,
  "message": "Verification code sent to your email",
  "data": {
    "accountState": "unverified"
  }
}
```

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "Email and username are required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Username**
```json
{
  "success": false,
  "message": "Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Email**
```json
{
  "success": false,
  "message": "Invalid email format",
  "error_code": "VALIDATION_ERROR"
}
```

**409 Conflict - Username Exists**
```json
{
  "success": false,
  "message": "Username is already taken. Please choose another.",
  "error_code": "USERNAME_EXISTS"
}
```

**409 Conflict - Complete Account Exists**
```json
{
  "success": false,
  "message": "An account with this email already exists. Please login.",
  "error_code": "EMAIL_EXISTS_COMPLETE"
}
```

**429 Too Many Requests - Rate Limit**
```json
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "error_code": "IP_RATE_LIMIT"
}
```

**429 Too Many Requests - Resend Cooldown**
```json
{
  "success": false,
  "message": "Please wait 60 seconds before requesting another code",
  "error_code": "RESEND_COOLDOWN"
}
```

**400 Bad Request - Email Send Failed**
```json
{
  "success": false,
  "message": "Failed to send verification email. Please try again later.",
  "error_code": "EMAIL_SEND_FAILED"
}
```

---

### 2. Send Verification Code

**`POST /api/v1/users/send-verification-code`**

Sends a verification code to the specified email address. Can be used for:
- Initial signup (unauthenticated)
- Re-verification of existing accounts (authenticated)

**Requires Authentication:** Optional (works with or without authentication)

#### Request Body

```json
{
  "email": "john@example.com"
}
```

**Required Fields:**
- `email` (string): Valid email address

#### Headers (Optional)

```
Authorization: Bearer <jwt-token>
```

If authenticated, the user's first name will be included in the email for personalization.

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Verification code sent successfully",
  "data": {
    "email": "john@example.com",
    "expiresAt": "2025-01-15T10:45:00.000Z"
  }
}
```

**Response Fields:**
- `email`: Normalized email address
- `expiresAt`: Code expiration timestamp (15 minutes from now)

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "Email is required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Email**
```json
{
  "success": false,
  "message": "Invalid email format",
  "error_code": "VALIDATION_ERROR"
}
```

**429 Too Many Requests - Rate Limit**
```json
{
  "success": false,
  "message": "Too many verification code requests. Please try again later.",
  "error_code": "EMAIL_RATE_LIMIT"
}
```

**429 Too Many Requests - Resend Cooldown**
```json
{
  "success": false,
  "message": "Please wait 60 seconds before requesting another code",
  "error_code": "RESEND_COOLDOWN"
}
```

**400 Bad Request - Email Send Failed**
```json
{
  "success": false,
  "message": "Failed to send verification email. Please try again later.",
  "error_code": "EMAIL_SEND_FAILED"
}
```

**500 Internal Server Error - Database Error**
```json
{
  "success": false,
  "message": "Unable to process request. Please try again later.",
  "error_code": "DATABASE_ERROR"
}
```

---

### 3. Verify Email with Code

**`POST /api/v1/users/verify-email`**

Step 3 of the signup process. Verifies the email verification code and creates a minimal user account (or updates existing incomplete account).

**Requires Authentication:** No

#### Request Body

```json
{
  "email": "john@example.com",
  "code": "123456"
}
```

**Required Fields:**
- `email` (string): Email address used in signup
- `code` (string): 6-digit verification code

#### Code Validation Rules

- Must be exactly 6 digits
- Numeric only (0-9)
- Case-insensitive (automatically normalized)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Email verified and account created successfully",
  "data": {
    "email": "john@example.com",
    "verified": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "john@example.com",
      "username": "johndoe",
      "email_verified": true,
      "signup_status": "pending_completion",
      "role": "player"
    }
  }
}
```

**Response Fields:**
- `email`: Verified email address
- `verified`: Always `true` on success
- `token`: JWT authentication token (use for subsequent requests)
- `user`: Minimal user object with:
  - `id`: User ID
  - `email`: Email address
  - `username`: Username
  - `email_verified`: Always `true`
  - `signup_status`: `pending_completion` (password not set yet)
  - `role`: Default role (`player`)

#### Account Creation Details

Upon successful verification, a minimal user account is created with:
- ✅ `email` (verified)
- ✅ `username`
- ✅ `email_verified = true`
- ✅ `signup_status = 'pending_completion'`
- ✅ `role = 'player'` (default)
- ✅ `is_active = true`
- ❌ `password_hash = NULL` (not set yet)
- ❌ `first_name = NULL` (optional)
- ❌ `last_name = NULL` (optional)
- ❌ `phone = NULL` (optional)

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "Email and code are required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Code Format**
```json
{
  "success": false,
  "message": "Verification code must be exactly 6 digits",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Code**
```json
{
  "success": false,
  "message": "Invalid verification code",
  "error_code": "INVALID_CODE"
}
```

**400 Bad Request - Code Expired**
```json
{
  "success": false,
  "message": "Verification code has expired. Please request a new code.",
  "error_code": "CODE_EXPIRED"
}
```

**400 Bad Request - Code Already Used**
```json
{
  "success": false,
  "message": "This verification code has already been used",
  "error_code": "CODE_ALREADY_USED"
}
```

**400 Bad Request - Max Attempts Reached**
```json
{
  "success": false,
  "message": "Maximum verification attempts reached. Please request a new code.",
  "error_code": "MAX_ATTEMPTS_REACHED"
}
```

**400 Bad Request - No Active Code**
```json
{
  "success": false,
  "message": "No active verification code found for this email. Please request a new code.",
  "error_code": "NO_ACTIVE_CODE"
}
```

**429 Too Many Requests - Rate Limit**
```json
{
  "success": false,
  "message": "Too many verification attempts. Please try again later.",
  "error_code": "IP_RATE_LIMIT"
}
```

**500 Internal Server Error - Database Error**
```json
{
  "success": false,
  "message": "Unable to process request. Please try again later.",
  "error_code": "DATABASE_ERROR"
}
```

---

### 4. Complete Signup (Profile Completion)

**`POST /api/v1/users/complete-signup`**

Step 4 of the signup process (optional). Completes the user profile by setting password and additional details.

**Requires Authentication:** Yes

#### Headers

```
Authorization: Bearer <jwt-token>
```

#### Request Body

```json
{
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+923001234567"
}
```

**Optional Fields:**
- `password` (string): User password (required for account activation)
- `firstName` (string): User's first name
- `lastName` (string): User's last name
- `phone` (string): User's phone number

**Note:** At least one field must be provided. Password is recommended to activate the account.

#### Password Validation Rules

- Minimum 8 characters
- Maximum 128 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one numerical digit (0-9)
- At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
- No spaces allowed

#### Name Validation Rules

**First Name / Last Name:**
- Minimum 2 characters
- Maximum 50 characters
- Only letters, spaces, hyphens, and apostrophes allowed

#### Phone Validation Rules

- 10-15 digits (after removing formatting)
- Can contain spaces, hyphens, parentheses, plus sign
- Automatically normalized

#### Success Response (200 OK)

**With Password (Account Activated):**
```json
{
  "success": true,
  "message": "Signup completed successfully. Your account is now active.",
  "data": {
    "id": 1,
    "email": "john@example.com",
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+923001234567",
    "email_verified": true,
    "signup_status": "active",
    "role": "player",
    "is_active": true,
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:45:00.000Z"
  }
}
```

**Without Password (Profile Updated):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "email": "john@example.com",
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+923001234567",
    "email_verified": true,
    "signup_status": "pending_completion",
    "role": "player",
    "is_active": true,
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:45:00.000Z"
  }
}
```

**Response Notes:**
- `signup_status` changes to `"active"` when password is set
- `signup_status` remains `"pending_completion"` if password is not provided

#### Error Responses

**401 Unauthorized - Missing/Invalid Token**
```json
{
  "success": false,
  "message": "Authentication required",
  "error_code": "UNAUTHORIZED"
}
```

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "At least one field (password, firstName, lastName, phone) must be provided",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Password**
```json
{
  "success": false,
  "message": "Password validation failed: Password must contain at least one uppercase letter, Password must contain at least one special character",
  "error_code": "INVALID_PASSWORD",
  "errors": [
    "Password must contain at least one uppercase letter",
    "Password must contain at least one special character"
  ]
}
```

**400 Bad Request - Invalid Name**
```json
{
  "success": false,
  "message": "First name must be at least 2 characters long",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Phone**
```json
{
  "success": false,
  "message": "Phone number must contain at least 10 digits",
  "error_code": "VALIDATION_ERROR"
}
```

**404 Not Found - User Not Found**
```json
{
  "success": false,
  "message": "User not found",
  "error_code": "USER_NOT_FOUND"
}
```

**500 Internal Server Error - Update Failed**
```json
{
  "success": false,
  "message": "Failed to update profile",
  "error_code": "UPDATE_FAILED"
}
```

---

## Profile Completeness Requirement

### Important Note

After email verification (Step 3), users receive a JWT token and can access the application. However, **the profile must be completed before users can fully use the system**.

### Profile Completeness Check

The `GET /api/v1/users/profile` endpoint automatically checks if the user's profile is complete:

**Required Fields for Email-Based Users:**
- `firstName` (required)
- `lastName` (required)
- `password` (required)

**Required Fields for OAuth Users (Google):**
- `firstName` (required)
- `lastName` (required)
- `password` (not required - OAuth users don't have passwords)

### Behavior

- **Complete Profile**: Returns user profile data with `profileComplete: true` (200 OK)
- **Incomplete Profile**: Returns user profile data with `profileComplete: false` and `missingFields` array (200 OK)
- **Frontend Action**: Should show profile completion page/modal instead of logging out

### Example Response - Incomplete Profile

```json
{
  "success": true,
  "message": "Profile retrieved. Please complete your profile to continue.",
  "data": {
    "id": 1,
    "email": "john@example.com",
    "username": "johndoe",
    "firstName": null,
    "lastName": null,
    "phone": null,
    "profileComplete": false,
    "missingFields": ["firstName", "lastName", "password"],
    "signupStatus": "pending_completion",
    ...
  }
}
```

### Frontend Implementation

When the frontend receives `profileComplete: false`:

1. **Keep user authenticated** (do NOT log out)
2. Show profile completion page/modal with message: "Your profile is incomplete. Please complete your signup process."
3. Display button: "Complete Profile" or "Go to Signup"
4. Navigate to profile completion form (`/complete-signup`)
5. User fills: `firstName`, `lastName`, `password`
6. Submit via `POST /api/v1/users/complete-signup`
7. After successful completion, user can use the app normally
8. Re-fetch profile to verify `profileComplete: true`

### Data Access Restriction

**Important:** Users with incomplete profiles cannot access any application data:

- All data endpoints return `403 Forbidden` with `PROFILE_INCOMPLETE` error
- Blocked endpoints include: facilities, courts, bookings, sports, availability, images
- Only profile-related endpoints remain accessible (profile, complete-signup, profile image upload)

**Frontend should:**
- Show completion prompt when `profileComplete: false`
- Block navigation to data pages (facilities, courts, bookings, etc.)
- Show message: "Please complete your profile to access this feature"
- Redirect to profile completion page

---

### 5. Get Verification Status

**`GET /api/v1/users/verification-status`**

Get the email verification status for the authenticated user.

**Requires Authentication:** Yes

#### Headers

```
Authorization: Bearer <jwt-token>
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Verification status retrieved successfully",
  "data": {
    "email": "john@example.com",
    "emailVerified": true,
    "signupStatus": "pending_completion"
  }
}
```

**Response Fields:**
- `email`: User's email address
- `emailVerified`: Boolean indicating if email is verified
- `signupStatus`: Current signup status (`pending_verification`, `pending_completion`, `active`)

#### Error Responses

**401 Unauthorized - Missing/Invalid Token**
```json
{
  "success": false,
  "message": "Authentication required",
  "error_code": "UNAUTHORIZED"
}
```

**404 Not Found - User Not Found**
```json
{
  "success": false,
  "message": "User not found",
  "error_code": "USER_NOT_FOUND"
}
```

---

## Account States

The system manages three account states:

### 1. `pending_verification`
- Email verification code has been sent
- User has not yet verified their email
- Account does not exist yet (or exists but unverified)

### 2. `pending_completion`
- Email has been verified
- Minimal account created (email, username, email_verified = true)
- Password not set yet
- Profile details (first_name, last_name, phone) optional

### 3. `active`
- Email verified
- Password set
- Account fully activated
- User can login with email/password

---

## Rate Limiting

### Per Email Rate Limits

- **Send Verification Code**: 3 requests per 15 minutes per email
- **Resend Cooldown**: 60 seconds minimum between resends

### Per IP Rate Limits

- **Send Verification Code**: 10 requests per hour per IP
- **Verify Email Attempts**: 20 attempts per hour per IP

### Rate Limit Headers

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1642234567
```

### Rate Limit Error Response

```json
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "error_code": "IP_RATE_LIMIT"
}
```

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error_code": "ERROR_CODE"
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `INVALID_USERNAME` | 400 | Username format invalid |
| `INVALID_EMAIL` | 400 | Email format invalid |
| `INVALID_CODE` | 400 | Verification code invalid |
| `INVALID_PASSWORD` | 400 | Password validation failed |
| `USERNAME_EXISTS` | 409 | Username already taken |
| `EMAIL_EXISTS_COMPLETE` | 409 | Complete account exists for email |
| `CODE_EXPIRED` | 400 | Verification code expired |
| `CODE_ALREADY_USED` | 400 | Code already used |
| `MAX_ATTEMPTS_REACHED` | 400 | Maximum attempts exceeded |
| `NO_ACTIVE_CODE` | 400 | No active code found |
| `EMAIL_RATE_LIMIT` | 429 | Email rate limit exceeded |
| `IP_RATE_LIMIT` | 429 | IP rate limit exceeded |
| `RESEND_COOLDOWN` | 429 | Resend cooldown active |
| `EMAIL_SEND_FAILED` | 400 | Email sending failed |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `USER_NOT_FOUND` | 404 | User not found |
| `UPDATE_FAILED` | 500 | Update operation failed |
| `PROFILE_INCOMPLETE` | 200 | User profile is incomplete (returned as flag in response, not error) |

---

## Security Features

### Code Security

- **Hashing**: Verification codes are hashed with bcrypt (salt rounds: 10) before storage
- **Never Stored in Plain Text**: Plain codes are never stored in the database
- **Expiration**: Codes expire after 15 minutes
- **Single Use**: Codes are marked as used after successful verification
- **Attempt Limiting**: Maximum 5 attempts per code

### Input Security

- **Sanitization**: All inputs are sanitized to prevent injection attacks
- **Validation**: Strict validation rules for all fields
- **Email Normalization**: Emails are normalized (lowercase) before processing
- **Username Normalization**: Usernames are normalized before storage

### Rate Limiting

- **Per Email Limits**: Prevents abuse from single email
- **Per IP Limits**: Prevents abuse from single IP
- **Cooldown Periods**: Minimum time between requests

### Error Message Security

- **No Information Leakage**: Error messages don't reveal if email exists
- **Generic Messages**: Security-sensitive errors use generic messages
- **No Code Hints**: Invalid code errors don't reveal code format or existence

### Transaction Safety

- **Database Transactions**: Code verification uses transactions for atomicity
- **Race Condition Protection**: Prevents duplicate account creation
- **Consistent State**: Ensures data consistency across operations

---

## Testing Guide

### Manual Testing Checklist

#### Step 1: Initial Signup
- [ ] Send signup request with valid username and email
- [ ] Verify response includes `expiresAt` and `accountState`
- [ ] Check email for verification code
- [ ] Test with invalid username format
- [ ] Test with invalid email format
- [ ] Test with existing username
- [ ] Test with existing complete account email
- [ ] Test rate limiting (too many requests)

#### Step 2: Send Verification Code
- [ ] Send verification code request
- [ ] Verify code received in email
- [ ] Test resend cooldown (wait 60 seconds)
- [ ] Test rate limiting
- [ ] Test with authenticated user (personalized email)

#### Step 3: Verify Email
- [ ] Verify with correct code
- [ ] Verify response includes JWT token
- [ ] Verify user account created with correct status
- [ ] Test with incorrect code
- [ ] Test with expired code (wait 15+ minutes)
- [ ] Test with already used code
- [ ] Test max attempts (5 incorrect attempts)
- [ ] Test with invalid code format

#### Step 4: Complete Signup
- [ ] Complete signup with password and profile
- [ ] Verify `signup_status` changes to `active`
- [ ] Complete signup without password (profile only)
- [ ] Verify `signup_status` remains `pending_completion`
- [ ] Test password validation (weak passwords)
- [ ] Test name validation
- [ ] Test phone validation
- [ ] Test with missing authentication token

#### Additional Tests
- [ ] Get verification status (authenticated)
- [ ] Test account state transitions
- [ ] Test incomplete account resume
- [ ] Test unverified account resend
- [ ] Test cleanup job (expired codes)
- [ ] Test profile completeness check (GET /api/v1/users/profile)
- [ ] Verify incomplete profile returns `PROFILE_INCOMPLETE` error
- [ ] Verify frontend logs out user when profile is incomplete

### Example Test Flow

```bash
# Step 1: Initial Signup
curl -X POST http://localhost:3000/api/v1/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com"
  }'

# Step 2: Check email for code (e.g., "123456")

# Step 3: Verify Email
curl -X POST http://localhost:3000/api/v1/users/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "123456"
  }'

# Step 4: Complete Signup (use token from Step 3)
curl -X POST http://localhost:3000/api/v1/users/complete-signup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+923001234567"
  }'
```

---

## Configuration

### Environment Variables

The following environment variables are required:

```env
# AWS SES Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
SES_FROM_EMAIL=noreply@yourdomain.com
SES_FROM_NAME=SportsArena

# Optional: Email Verification
IS_VERIFICATION_REQUIRED=true  # Require email verification for login
```

### Code Configuration

Default configuration values (can be adjusted in code):

- **Code Expiration**: 15 minutes
- **Max Attempts**: 5 attempts per code
- **Resend Cooldown**: 60 seconds
- **Cleanup Age**: 24 hours (codes older than this are deleted)

---

## Support

For issues or questions:
- Check error codes and messages in responses
- Review rate limiting headers
- Verify environment variables are set correctly
- Check AWS SES account status and email verification
- Review server logs for detailed error information

---

**Last Updated:** January 2025
**Version:** 1.0.0
