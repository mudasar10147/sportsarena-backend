# Email Verification Testing Strategy

## Overview

This document outlines the testing strategy for the email verification system. Testing is divided into three categories:
1. Unit Tests (optional but recommended)
2. Integration Tests
3. Manual Testing

---

## Phase 14.1: Unit Tests (Optional but Recommended)

### Test Setup

**Recommended Testing Framework:** Jest or Mocha + Chai

**Installation:**
```bash
npm install --save-dev jest
# OR
npm install --save-dev mocha chai
```

### Test Files Structure

```
tests/
├── unit/
│   ├── emailVerificationService.test.js
│   └── validation.test.js
├── integration/
│   ├── emailVerification.api.test.js
│   └── rateLimiting.test.js
└── helpers/
    └── testHelpers.js
```

### Unit Test Cases

#### 1. Code Generation Tests
**File:** `tests/unit/emailVerificationService.test.js`

```javascript
describe('Code Generation', () => {
  test('should generate 6-digit numeric code', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(code.length).toBe(6);
  });

  test('should generate unique codes', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateVerificationCode());
    }
    // Should have high uniqueness (at least 95% unique)
    expect(codes.size).toBeGreaterThan(95);
  });

  test('should generate codes with leading zeros', () => {
    // Test that codes like "000123" are valid
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });
});
```

#### 2. Code Hashing Tests
**File:** `tests/unit/emailVerificationService.test.js`

```javascript
describe('Code Hashing', () => {
  test('should hash code with bcrypt', async () => {
    const code = '123456';
    const hash = await hashCode(code);
    expect(hash).not.toBe(code);
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
  });

  test('should verify code hash correctly', async () => {
    const code = '123456';
    const hash = await hashCode(code);
    const isValid = await verifyCodeHash(code, hash);
    expect(isValid).toBe(true);
  });

  test('should reject incorrect code', async () => {
    const code = '123456';
    const wrongCode = '654321';
    const hash = await hashCode(code);
    const isValid = await verifyCodeHash(wrongCode, hash);
    expect(isValid).toBe(false);
  });

  test('should use same salt rounds as passwords', async () => {
    const code = '123456';
    const hash = await hashCode(code);
    // bcrypt with 10 rounds should start with $2a$10$ or $2b$10$
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
  });
});
```

#### 3. Verification Logic Tests
**File:** `tests/unit/emailVerificationService.test.js`

```javascript
describe('Verification Logic', () => {
  test('should validate email format', () => {
    const valid = sanitizeAndValidateEmail('test@example.com');
    expect(valid.valid).toBe(true);
    
    const invalid = sanitizeAndValidateEmail('invalid-email');
    expect(invalid.valid).toBe(false);
  });

  test('should validate code format', () => {
    const valid = sanitizeAndValidateCode('123456');
    expect(valid.valid).toBe(true);
    
    const invalid = sanitizeAndValidateCode('12345');
    expect(invalid.valid).toBe(false);
  });

  test('should sanitize email (lowercase, trim)', () => {
    const result = sanitizeAndValidateEmail('  TEST@EXAMPLE.COM  ');
    expect(result.valid).toBe(true);
    expect(result.email).toBe('test@example.com');
  });

  test('should sanitize code (remove whitespace)', () => {
    const result = sanitizeAndValidateCode('123 456');
    expect(result.valid).toBe(true);
    expect(result.code).toBe('123456');
  });
});
```

#### 4. Rate Limiting Logic Tests
**File:** `tests/unit/emailVerificationService.test.js`

```javascript
describe('Rate Limiting Logic', () => {
  test('should check email rate limit', async () => {
    // Mock database to return count
    // Test that 3 codes in 15 minutes triggers limit
  });

  test('should check IP rate limit', async () => {
    // Mock database to return count
    // Test that 10 codes in 1 hour triggers limit
  });

  test('should check resend cooldown', async () => {
    // Mock database to return recent code
    // Test that 60 second cooldown is enforced
  });
});
```

---

## Phase 14.2: Integration Tests

### Test Setup

**Tools Needed:**
- Test database (separate from production)
- Mock AWS SES (or use SES sandbox)
- HTTP client (supertest or axios)

### Integration Test Cases

#### 1. Send Verification Code Endpoint
**File:** `tests/integration/emailVerification.api.test.js`

```javascript
describe('POST /api/v1/users/send-verification-code', () => {
  test('should send verification code to valid email', async () => {
    const response = await request(app)
      .post('/api/v1/users/send-verification-code')
      .send({ email: 'test@example.com' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('test@example.com');
    expect(response.body.data.expiresAt).toBeDefined();
  });

  test('should reject invalid email format', async () => {
    const response = await request(app)
      .post('/api/v1/users/send-verification-code')
      .send({ email: 'invalid-email' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error_code).toBe('VALIDATION_ERROR');
  });

  test('should enforce rate limiting', async () => {
    // Send 4 requests rapidly
    for (let i = 0; i < 4; i++) {
      await request(app)
        .post('/api/v1/users/send-verification-code')
        .send({ email: 'test@example.com' });
    }

    // 4th request should be rate limited
    const response = await request(app)
      .post('/api/v1/users/send-verification-code')
      .send({ email: 'test@example.com' })
      .expect(429);

    expect(response.body.error_code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
```

#### 2. Verify Email Endpoint
**File:** `tests/integration/emailVerification.api.test.js`

```javascript
describe('POST /api/v1/users/verify-email', () => {
  test('should verify valid code', async () => {
    // First, send a code
    await request(app)
      .post('/api/v1/users/send-verification-code')
      .send({ email: 'test@example.com' });

    // Get code from database (in test, you might need to query directly)
    // Then verify it
    const response = await request(app)
      .post('/api/v1/users/verify-email')
      .send({ email: 'test@example.com', code: '123456' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.verified).toBe(true);
  });

  test('should reject invalid code', async () => {
    const response = await request(app)
      .post('/api/v1/users/verify-email')
      .send({ email: 'test@example.com', code: '000000' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error_code).toBe('INVALID_CODE');
  });

  test('should reject expired code', async () => {
    // Create expired code in database
    // Attempt to verify
    // Should return CODE_NOT_FOUND error
  });

  test('should enforce max attempts', async () => {
    // Send code
    // Attempt verification 6 times with wrong code
    // 6th attempt should return MAX_ATTEMPTS_EXCEEDED
  });
});
```

#### 3. Rate Limiting Tests
**File:** `tests/integration/rateLimiting.test.js`

```javascript
describe('Rate Limiting', () => {
  test('should limit per email (3 per 15 minutes)', async () => {
    // Send 3 codes - should succeed
    // Send 4th code - should be rate limited
  });

  test('should limit per IP (10 per hour)', async () => {
    // Send 10 codes from same IP - should succeed
    // Send 11th code - should be rate limited
  });

  test('should enforce resend cooldown (60 seconds)', async () => {
    // Send code
    // Immediately try to resend - should be blocked
    // Wait 60 seconds
    // Try again - should succeed
  });
});
```

#### 4. Expiration Handling Tests
**File:** `tests/integration/emailVerification.api.test.js`

```javascript
describe('Code Expiration', () => {
  test('should reject expired code', async () => {
    // Create code with past expiration
    // Attempt to verify
    // Should return CODE_NOT_FOUND
  });

  test('should accept valid non-expired code', async () => {
    // Create code with future expiration
    // Attempt to verify
    // Should succeed
  });
});
```

---

## Phase 14.3: Manual Testing Checklist

### Prerequisites for Manual Testing

1. **Environment Setup:**
   - [ ] Database is running and accessible
   - [ ] AWS SES is configured (sandbox or production)
   - [ ] SES_FROM_EMAIL is verified in AWS SES
   - [ ] Server is running (`npm run dev`)
   - [ ] Test email addresses are verified (if in SES sandbox)

2. **Test Tools:**
   - [ ] Postman or similar API client
   - [ ] Access to test email inbox
   - [ ] Database query tool (psql or pgAdmin)

---

### Manual Test Cases

#### Test 1: Send Verification Code to Valid Email
**Endpoint:** `POST /api/v1/users/send-verification-code`

**Steps:**
1. Send POST request with valid email
2. Check response status (should be 200)
3. Check email inbox for verification code
4. Verify code is 6 digits

**Expected Result:**
- [ ] Status: 200 OK
- [ ] Response contains `emailSent: true`
- [ ] Email received with 6-digit code
- [ ] Code expires in 15 minutes

**Test Data:**
```json
{
  "email": "test@example.com"
}
```

---

#### Test 2: Verify Code Successfully
**Endpoint:** `POST /api/v1/users/verify-email`

**Steps:**
1. First, send verification code (Test 1)
2. Get code from email
3. Send verification request with email and code
4. Check response

**Expected Result:**
- [ ] Status: 200 OK
- [ ] Response contains `verified: true`
- [ ] User's `email_verified` is set to `true` in database
- [ ] Code is marked as `is_used = true` in database

**Test Data:**
```json
{
  "email": "test@example.com",
  "code": "123456"
}
```

---

#### Test 3: Test Expired Code Rejection
**Endpoint:** `POST /api/v1/users/verify-email`

**Steps:**
1. Send verification code
2. Manually expire code in database:
   ```sql
   UPDATE email_verification_codes 
   SET expires_at = NOW() - INTERVAL '1 minute' 
   WHERE email = 'test@example.com';
   ```
3. Attempt to verify with the code

**Expected Result:**
- [ ] Status: 400 Bad Request
- [ ] Error code: `CODE_NOT_FOUND`
- [ ] Message: "Invalid or expired verification code. Please request a new code."

---

#### Test 4: Test Invalid Code Rejection
**Endpoint:** `POST /api/v1/users/verify-email`

**Steps:**
1. Send verification code
2. Attempt verification with wrong code (e.g., "000000")

**Expected Result:**
- [ ] Status: 400 Bad Request
- [ ] Error code: `INVALID_CODE`
- [ ] Message: "Invalid verification code. Please check and try again."
- [ ] Attempts counter incremented in database

---

#### Test 5: Test Max Attempts Limit
**Endpoint:** `POST /api/v1/users/verify-email`

**Steps:**
1. Send verification code
2. Attempt verification with wrong code 5 times
3. Check attempts in database after each attempt
4. Attempt 6th time with wrong code

**Expected Result:**
- [ ] First 5 attempts: Status 400, `INVALID_CODE`
- [ ] 6th attempt: Status 400, `MAX_ATTEMPTS_EXCEEDED`
- [ ] Message: "Maximum verification attempts exceeded. Please request a new code."
- [ ] Code cannot be used anymore

**Database Check:**
```sql
SELECT attempts, max_attempts, is_used 
FROM email_verification_codes 
WHERE email = 'test@example.com';
```

---

#### Test 6: Test Rate Limiting (Per Email)
**Endpoint:** `POST /api/v1/users/send-verification-code`

**Steps:**
1. Send verification code to same email 3 times (wait a few seconds between)
2. Attempt to send 4th code immediately

**Expected Result:**
- [ ] First 3 requests: Status 200
- [ ] 4th request: Status 429
- [ ] Error code: `EMAIL_RATE_LIMIT`
- [ ] Message: "Too many verification codes sent to this email. Please try again in 15 minutes."

---

#### Test 7: Test Rate Limiting (Per IP)
**Endpoint:** `POST /api/v1/users/send-verification-code`

**Steps:**
1. Send verification codes to 10 different emails from same IP
2. Attempt to send 11th code

**Expected Result:**
- [ ] First 10 requests: Status 200
- [ ] 11th request: Status 429
- [ ] Error code: `IP_RATE_LIMIT`
- [ ] Message: "Too many verification requests from this IP. Please try again later."

---

#### Test 8: Test Resend Functionality
**Endpoint:** `POST /api/v1/users/send-verification-code`

**Steps:**
1. Send verification code
2. Immediately attempt to resend (within 60 seconds)

**Expected Result:**
- [ ] Status: 429
- [ ] Error code: `RESEND_COOLDOWN`
- [ ] Message includes seconds remaining
- [ ] Wait 60+ seconds
- [ ] Resend should succeed

---

#### Test 9: Test Cleanup Job
**Function:** `cleanupExpiredCodes()`

**Steps:**
1. Create old codes in database:
   ```sql
   INSERT INTO email_verification_codes (email, code_hash, expires_at, created_at)
   VALUES ('old@example.com', 'hash123', NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours');
   ```
2. Run cleanup function:
   ```javascript
   const { cleanupExpiredCodes } = require('./src/services/emailVerificationService');
   await cleanupExpiredCodes(24);
   ```
3. Check database

**Expected Result:**
- [ ] Old codes (older than 24 hours) are deleted
- [ ] Recent codes (less than 24 hours) remain
- [ ] Cleanup logs number of deleted codes

---

#### Test 10: Test SES Error Handling
**Endpoint:** `POST /api/v1/users/send-verification-code`

**Test Cases:**

**A. Invalid Email Address:**
- Send code to invalid email (e.g., "not-an-email")
- **Expected:** Status 400, validation error

**B. Unverified From Email:**
- Temporarily remove SES_FROM_EMAIL verification in AWS
- Send code
- **Expected:** Status 500, configuration error (logged)

**C. SES Throttling:**
- Send many codes rapidly (if in sandbox, this is easy to trigger)
- **Expected:** Retry logic kicks in, eventually succeeds or fails gracefully

**D. Network Error:**
- Disconnect network temporarily
- Send code
- **Expected:** Error logged, user gets generic error message

---

### Additional Manual Tests

#### Test 11: Signup with Verification Email
**Endpoint:** `POST /api/v1/users/signup`

**Steps:**
1. Send signup request with `sendVerificationEmail: true`
2. Check response
3. Check email inbox

**Expected Result:**
- [ ] User created successfully
- [ ] Verification email sent
- [ ] Response includes `emailSent: true`

**Test Data:**
```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "Test123!@#",
  "firstName": "New",
  "lastName": "User",
  "sendVerificationEmail": true
}
```

---

#### Test 12: Login with Email Verification Required
**Endpoint:** `POST /api/v1/users/login`

**Prerequisites:**
- Set `IS_VERIFICATION_REQUIRED=true` in `.env`
- Create user with unverified email

**Steps:**
1. Attempt to login with unverified email
2. Verify email
3. Attempt to login again

**Expected Result:**
- [ ] First login: Status 403, `EMAIL_VERIFICATION_REQUIRED`
- [ ] After verification: Status 200, login successful

---

#### Test 13: Login with Email Verification Optional
**Endpoint:** `POST /api/v1/users/login`

**Prerequisites:**
- Set `IS_VERIFICATION_REQUIRED=false` in `.env` (or unset)
- Create user with unverified email

**Steps:**
1. Attempt to login with unverified email

**Expected Result:**
- [ ] Status: 200 OK
- [ ] Response includes `emailVerified: false`
- [ ] Warning message about verification

---

#### Test 14: Get Verification Status
**Endpoint:** `GET /api/v1/users/verification-status`

**Prerequisites:**
- User must be authenticated (include JWT token)

**Steps:**
1. Login to get token
2. Send GET request with Authorization header
3. Check response

**Expected Result:**
- [ ] Status: 200 OK
- [ ] Response includes `emailVerified` status
- [ ] Response includes user's email

---

#### Test 15: Security - Email Enumeration Prevention
**Endpoint:** `POST /api/v1/users/verify-email`

**Steps:**
1. Attempt to verify code for non-existent email
2. Attempt to verify code for existing but unverified email
3. Compare error messages

**Expected Result:**
- [ ] Both return same generic error message
- [ ] No indication of whether email exists
- [ ] Error code is `CODE_NOT_FOUND` for both

---

## Test Execution Order

**Recommended order for manual testing:**

1. **Basic Functionality:**
   - Test 1: Send verification code
   - Test 2: Verify code successfully

2. **Error Handling:**
   - Test 3: Expired code rejection
   - Test 4: Invalid code rejection
   - Test 5: Max attempts limit

3. **Rate Limiting:**
   - Test 6: Per-email rate limiting
   - Test 7: Per-IP rate limiting
   - Test 8: Resend cooldown

4. **Integration:**
   - Test 11: Signup with verification
   - Test 12/13: Login with verification requirement

5. **Maintenance:**
   - Test 9: Cleanup job

6. **Error Scenarios:**
   - Test 10: SES error handling

7. **Security:**
   - Test 14: Verification status
   - Test 15: Email enumeration prevention

---

## Test Data Requirements

### Test Email Addresses
- At least 3-4 test email addresses (if in SES sandbox, these must be verified)
- Examples: `test1@example.com`, `test2@example.com`, etc.

### Database State
- Clean database before testing (or use test database)
- Or manually clean verification codes:
  ```sql
  DELETE FROM email_verification_codes;
  ```

---

## Troubleshooting Common Issues

### Issue: "Email not received"
**Solutions:**
- Check spam folder
- Verify email is verified in SES (if sandbox)
- Check SES sending statistics in AWS Console
- Check server logs for SES errors

### Issue: "Rate limit not working"
**Solutions:**
- Check database for existing codes
- Verify rate limit middleware is applied
- Check IP address detection (proxy headers)

### Issue: "Code verification fails"
**Solutions:**
- Check code hasn't expired
- Verify code format (6 digits, no spaces)
- Check attempts haven't exceeded limit
- Verify code in database matches

---

## Success Criteria

All tests should pass:
- [ ] All unit tests pass (if implemented)
- [ ] All integration tests pass (if implemented)
- [ ] All manual test cases pass
- [ ] No security vulnerabilities exposed
- [ ] Error messages are generic and secure
- [ ] Rate limiting works correctly
- [ ] Email delivery works reliably

---

**Last Updated:** Complete this checklist as you test each feature.

