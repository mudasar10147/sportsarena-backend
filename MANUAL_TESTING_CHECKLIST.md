# Email Verification - Manual Testing Checklist

Use this checklist to manually test the email verification system.

---

## Pre-Testing Setup

- [ ] Server is running (`npm run dev`)
- [ ] Database is accessible
- [ ] AWS SES is configured
- [ ] SES_FROM_EMAIL is verified in AWS SES
- [ ] Test email addresses are verified (if in SES sandbox)
- [ ] Postman or API client ready
- [ ] Access to test email inbox

---

## Basic Functionality Tests

### ✅ Test 1: Send Verification Code to Valid Email
**Endpoint:** `POST /api/v1/users/send-verification-code`

**Request:**
```json
{
  "email": "test@example.com"
}
```

**Expected:**
- [ ] Status: 200 OK
- [ ] Response: `{ "success": true, "data": { "email": "...", "expiresAt": "..." } }`
- [ ] Email received with 6-digit code
- [ ] Code visible in email

**Actual Result:** _________________________

---

### ✅ Test 2: Verify Code Successfully
**Endpoint:** `POST /api/v1/users/verify-email`

**Request:**
```json
{
  "email": "test@example.com",
  "code": "123456"
}
```
*(Use actual code from email)*

**Expected:**
- [ ] Status: 200 OK
- [ ] Response: `{ "success": true, "data": { "email": "...", "verified": true } }`
- [ ] User's `email_verified` = true in database
- [ ] Code marked as `is_used = true` in database

**Database Check:**
```sql
SELECT email_verified FROM users WHERE email = 'test@example.com';
SELECT is_used FROM email_verification_codes WHERE email = 'test@example.com';
```

**Actual Result:** _________________________

---

## Error Handling Tests

### ✅ Test 3: Expired Code Rejection
**Steps:**
1. Send verification code
2. Manually expire in database:
   ```sql
   UPDATE email_verification_codes 
   SET expires_at = NOW() - INTERVAL '1 minute' 
   WHERE email = 'test@example.com';
   ```
3. Attempt to verify

**Expected:**
- [ ] Status: 400 Bad Request
- [ ] Error: "Invalid or expired verification code. Please request a new code."
- [ ] Error code: `CODE_NOT_FOUND`

**Actual Result:** _________________________

---

### ✅ Test 4: Invalid Code Rejection
**Request:**
```json
{
  "email": "test@example.com",
  "code": "000000"
}
```

**Expected:**
- [ ] Status: 400 Bad Request
- [ ] Error: "Invalid verification code. Please check and try again."
- [ ] Error code: `INVALID_CODE`
- [ ] Attempts incremented in database

**Actual Result:** _________________________

---

### ✅ Test 5: Max Attempts Limit
**Steps:**
1. Send verification code
2. Attempt verification with wrong code 5 times
3. Check attempts after each:
   ```sql
   SELECT attempts, max_attempts FROM email_verification_codes WHERE email = 'test@example.com';
   ```
4. Attempt 6th time

**Expected:**
- [ ] First 5 attempts: Status 400, `INVALID_CODE`
- [ ] 6th attempt: Status 400, `MAX_ATTEMPTS_EXCEEDED`
- [ ] Message: "Maximum verification attempts exceeded. Please request a new code."

**Actual Result:** _________________________

---

## Rate Limiting Tests

### ✅ Test 6: Rate Limiting (Per Email - 3 per 15 minutes)
**Steps:**
1. Send verification code to same email 3 times (wait a few seconds between)
2. Attempt to send 4th code immediately

**Expected:**
- [ ] First 3 requests: Status 200
- [ ] 4th request: Status 429
- [ ] Error code: `EMAIL_RATE_LIMIT`
- [ ] Message mentions "15 minutes"

**Actual Result:** _________________________

---

### ✅ Test 7: Rate Limiting (Per IP - 10 per hour)
**Steps:**
1. Send verification codes to 10 different emails from same IP
2. Attempt to send 11th code

**Expected:**
- [ ] First 10 requests: Status 200
- [ ] 11th request: Status 429
- [ ] Error code: `IP_RATE_LIMIT` or `RATE_LIMIT_EXCEEDED`

**Actual Result:** _________________________

---

### ✅ Test 8: Resend Cooldown (60 seconds)
**Steps:**
1. Send verification code
2. Immediately attempt to resend (within 60 seconds)

**Expected:**
- [ ] Status: 429
- [ ] Error code: `RESEND_COOLDOWN`
- [ ] Message includes seconds remaining
- [ ] Wait 60+ seconds
- [ ] Resend succeeds

**Actual Result:** _________________________

---

## Integration Tests

### ✅ Test 9: Signup with Verification Email
**Endpoint:** `POST /api/v1/users/signup`

**Request:**
```json
{
  "email": "newuser@example.com",
  "username": "newuser123",
  "password": "Test123!@#",
  "firstName": "New",
  "lastName": "User",
  "sendVerificationEmail": true
}
```

**Expected:**
- [ ] Status: 201 Created
- [ ] User created successfully
- [ ] Response includes `emailSent: true`
- [ ] Verification email received

**Actual Result:** _________________________

---

### ✅ Test 10: Signup without Verification Email
**Request:**
```json
{
  "email": "newuser2@example.com",
  "username": "newuser456",
  "password": "Test123!@#",
  "firstName": "New",
  "lastName": "User2",
  "sendVerificationEmail": false
}
```

**Expected:**
- [ ] Status: 201 Created
- [ ] User created successfully
- [ ] Response includes `emailSent: false`
- [ ] No verification email sent

**Actual Result:** _________________________

---

### ✅ Test 11: Login with Verification Required (Not Verified)
**Prerequisites:**
- Set `IS_VERIFICATION_REQUIRED=true` in `.env`
- User exists with `email_verified = false`

**Endpoint:** `POST /api/v1/users/login`

**Request:**
```json
{
  "email": "unverified@example.com",
  "password": "Test123!@#"
}
```

**Expected:**
- [ ] Status: 403 Forbidden
- [ ] Error code: `EMAIL_VERIFICATION_REQUIRED`
- [ ] Message: "Email verification required. Please verify your email address before logging in."

**Actual Result:** _________________________

---

### ✅ Test 12: Login with Verification Optional (Not Verified)
**Prerequisites:**
- Set `IS_VERIFICATION_REQUIRED=false` in `.env` (or unset)
- User exists with `email_verified = false`

**Request:**
```json
{
  "email": "unverified@example.com",
  "password": "Test123!@#"
}
```

**Expected:**
- [ ] Status: 200 OK
- [ ] Login successful
- [ ] Response includes `emailVerified: false`
- [ ] Warning message about verification

**Actual Result:** _________________________

---

### ✅ Test 13: Login with Verified Email
**Prerequisites:**
- User exists with `email_verified = true`

**Request:**
```json
{
  "email": "verified@example.com",
  "password": "Test123!@#"
}
```

**Expected:**
- [ ] Status: 200 OK
- [ ] Login successful
- [ ] Response includes `emailVerified: true`
- [ ] Token returned

**Actual Result:** _________________________

---

### ✅ Test 14: Get Verification Status (Authenticated)
**Endpoint:** `GET /api/v1/users/verification-status`

**Headers:**
```
Authorization: Bearer <token>
```

**Expected:**
- [ ] Status: 200 OK
- [ ] Response: `{ "success": true, "data": { "email": "...", "emailVerified": true/false } }`

**Actual Result:** _________________________

---

## Security Tests

### ✅ Test 15: Email Enumeration Prevention
**Endpoint:** `POST /api/v1/users/verify-email`

**Test A: Non-existent Email**
**Request:**
```json
{
  "email": "nonexistent@example.com",
  "code": "123456"
}
```

**Test B: Existing Email (Unverified)**
**Request:**
```json
{
  "email": "existing@example.com",
  "code": "123456"
}
```

**Expected:**
- [ ] Both return same error message
- [ ] Both return Status 400
- [ ] No indication of whether email exists
- [ ] Error code: `CODE_NOT_FOUND` for both

**Actual Result:** _________________________

---

### ✅ Test 16: Code Format Validation
**Endpoint:** `POST /api/v1/users/verify-email`

**Test Cases:**
1. Code with spaces: `"123 456"`
2. Code too short: `"12345"`
3. Code too long: `"1234567"`
4. Code with letters: `"abc123"`
5. Empty code: `""`

**Expected:**
- [ ] All return Status 400
- [ ] Error code: `INVALID_CODE_FORMAT` or `VALIDATION_ERROR`
- [ ] Message: "Invalid code format. Code must be exactly 6 digits."

**Actual Result:** _________________________

---

### ✅ Test 17: Email Format Validation
**Endpoint:** `POST /api/v1/users/send-verification-code`

**Test Cases:**
1. Invalid format: `"not-an-email"`
2. Missing @: `"testexample.com"`
3. Empty: `""`
4. Too long: `"a".repeat(256) + "@example.com"`

**Expected:**
- [ ] All return Status 400
- [ ] Error code: `VALIDATION_ERROR`
- [ ] Appropriate error message

**Actual Result:** _________________________

---

## Maintenance Tests

### ✅ Test 18: Cleanup Job
**Function:** `cleanupExpiredCodes()`

**Steps:**
1. Create old code in database:
   ```sql
   INSERT INTO email_verification_codes (email, code_hash, expires_at, created_at, max_attempts)
   VALUES ('old@example.com', 'hash123', NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours', 5);
   ```
2. Run cleanup:
   ```javascript
   const { cleanupExpiredCodes } = require('./src/services/emailVerificationService');
   await cleanupExpiredCodes(24);
   ```
3. Check database:
   ```sql
   SELECT * FROM email_verification_codes WHERE email = 'old@example.com';
   ```

**Expected:**
- [ ] Old code deleted
- [ ] Recent codes remain
- [ ] Cleanup logs number deleted

**Actual Result:** _________________________

---

## Error Handling Tests

### ✅ Test 19: SES Error Handling
**Endpoint:** `POST /api/v1/users/send-verification-code`

**Test A: Invalid Email (SES Rejection)**
- Send to clearly invalid email
- **Expected:** Status 400, validation error

**Test B: Network Error**
- Temporarily disconnect network
- Send code
- **Expected:** Error logged, generic error to user

**Test C: SES Throttling**
- Send many codes rapidly
- **Expected:** Retry logic, eventually succeeds or fails gracefully

**Actual Result:** _________________________

---

### ✅ Test 20: Database Error Handling
**Steps:**
1. Temporarily stop database
2. Attempt to send verification code
3. Restart database
4. Attempt again

**Expected:**
- [ ] First attempt: Status 500, `DATABASE_ERROR`
- [ ] Second attempt: Status 200, succeeds

**Actual Result:** _________________________

---

## Edge Cases

### ✅ Test 21: Case Insensitive Email
**Request:**
```json
{
  "email": "TEST@EXAMPLE.COM"
}
```

**Expected:**
- [ ] Email normalized to lowercase
- [ ] Code sent successfully
- [ ] Verification works with lowercase email

**Actual Result:** _________________________

---

### ✅ Test 22: Code with Whitespace
**Request:**
```json
{
  "email": "test@example.com",
  "code": " 123 456 "
}
```

**Expected:**
- [ ] Code sanitized (whitespace removed)
- [ ] Verification succeeds with "123456"

**Actual Result:** _________________________

---

### ✅ Test 23: Multiple Codes for Same Email
**Steps:**
1. Send verification code
2. Send another code (after cooldown)
3. Verify first code (should fail - invalidated)
4. Verify second code (should succeed)

**Expected:**
- [ ] First code invalidated when second sent
- [ ] First code verification fails
- [ ] Second code verification succeeds

**Actual Result:** _________________________

---

## Summary

**Total Tests:** 23

**Passed:** ___ / 23

**Failed:** ___ / 23

**Notes:**
_________________________________________________
_________________________________________________
_________________________________________________

---

**Tested By:** _________________________

**Date:** _________________________

**Environment:** [ ] Development [ ] Staging [ ] Production

