# Middleware Usage Guide

This guide explains how to use the authentication, authorization, and error handling middleware in the SportsArena API.

## Overview

All middleware follows the architecture defined in `API_ARCHITECTURE.md`:
- **Section 1.5**: Authentication & Authorization
- **Section 1.6**: Response Structure
- **Section 1.7**: Error Handling

---

## 1. Response Utilities (`src/utils/response.js`)

Use these helpers to send consistent JSON responses:

### Success Responses

```javascript
const { sendSuccess, sendCreated } = require('../utils/response');

// Standard success (200)
sendSuccess(res, data, 'Operation successful');

// Created resource (201)
sendCreated(res, newResource, 'User created successfully');
```

### Error Responses

```javascript
const { 
  sendError, 
  sendUnauthorized, 
  sendForbidden, 
  sendNotFound,
  sendValidationError 
} = require('../utils/response');

// Custom error (400)
sendError(res, 'Invalid input', 'INVALID_INPUT', 400);

// Unauthorized (401)
sendUnauthorized(res, 'Token expired');

// Forbidden (403)
sendForbidden(res, 'Insufficient permissions');

// Not Found (404)
sendNotFound(res, 'User not found');

// Validation Error (400)
sendValidationError(res, 'Validation failed', { email: 'Invalid email format' });
```

---

## 2. Authentication Middleware (`src/middleware/auth.js`)

### `authenticate` - Required Authentication

Protects routes that require a valid JWT token:

```javascript
const { authenticate } = require('../middleware/auth');

// Protect a route
router.get('/profile', authenticate, async (req, res) => {
  // req.user is available here
  sendSuccess(res, req.user, 'Profile retrieved');
});
```

**How it works:**
- Extracts token from `Authorization: Bearer <token>` header
- Verifies token and finds user in database
- Attaches `req.user` and `req.userId` to request
- Returns 401 if token is missing/invalid

### `optionalAuthenticate` - Optional Authentication

Useful for endpoints that work with or without authentication:

```javascript
const { optionalAuthenticate } = require('../middleware/auth');

router.get('/facilities', optionalAuthenticate, async (req, res) => {
  // req.user may or may not be set
  if (req.user) {
    // User is authenticated
  } else {
    // User is not authenticated
  }
});
```

---

## 3. Authorization Middleware (`src/middleware/authorization.js`)

**Important:** Use authorization middleware AFTER authentication middleware.

### `requireRole` - Check Specific Role

```javascript
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorization');

// Require facility_admin role
router.post('/courts', 
  authenticate, 
  requireRole('facility_admin'), 
  async (req, res) => {
    // Only facility admins can access this
  }
);

// Require either player or facility_admin
router.get('/bookings', 
  authenticate, 
  requireRole(['player', 'facility_admin']), 
  async (req, res) => {
    // Both roles can access
  }
);
```

### Predefined Role Helpers

```javascript
const { 
  requireFacilityAdmin, 
  requirePlayer, 
  requireAnyUser 
} = require('../middleware/authorization');

// Require facility admin
router.post('/slots', authenticate, requireFacilityAdmin, handler);

// Require player
router.get('/my-bookings', authenticate, requirePlayer, handler);

// Require any authenticated user
router.get('/profile', authenticate, requireAnyUser, handler);
```

### `requireOwnershipOrAdmin` - Resource Ownership

Check if user owns a resource or is an admin:

```javascript
const { requireOwnershipOrAdmin } = require('../middleware/authorization');

router.get('/bookings/:id', 
  authenticate, 
  requireOwnershipOrAdmin(async (req) => {
    // Get booking owner ID
    const booking = await Booking.findById(req.params.id);
    return booking.user_id;
  }), 
  async (req, res) => {
    // User owns the booking OR is a facility admin
  }
);
```

---

## 4. Error Handling (`src/middleware/errorHandler.js`)

Error handling is automatically set up in `server.js`. It handles:

- **ValidationError**: Returns 400 with validation details
- **JsonWebTokenError**: Returns 401 for invalid tokens
- **Database errors**: PostgreSQL constraint violations
- **Custom errors**: Errors with `statusCode` and `message`
- **Unknown errors**: Returns 500 Internal Server Error

### Throwing Custom Errors

```javascript
// In your route handlers
const error = new Error('Time slot already booked');
error.statusCode = 400;
error.errorCode = 'SLOT_OCCUPIED';
throw error;
```

---

## 5. Complete Route Example

```javascript
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireFacilityAdmin } = require('../middleware/authorization');
const { sendSuccess, sendCreated, sendError } = require('../utils/response');
const { parsePagination, sendPaginatedResponse } = require('../utils/pagination');

// Public route - no authentication
router.get('/facilities', async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  // ... fetch facilities
  sendPaginatedResponse(res, facilities, page, limit, total);
});

// Protected route - requires authentication
router.get('/bookings', authenticate, async (req, res) => {
  // req.user is available
  const bookings = await getBookingsForUser(req.userId);
  sendSuccess(res, bookings, 'Bookings retrieved');
});

// Admin route - requires facility_admin role
router.post('/courts', 
  authenticate, 
  requireFacilityAdmin, 
  async (req, res) => {
    const court = await createCourt(req.body);
    sendCreated(res, court, 'Court created successfully');
  }
);
```

---

## 6. JWT Token Generation

Use the JWT utility to generate tokens during login:

```javascript
const { generateToken } = require('../utils/jwt');

// After successful login
const token = generateToken(user);
sendSuccess(res, { token, user }, 'Login successful');
```

---

## Summary

1. **Response utilities**: Use for consistent JSON responses
2. **Authentication**: Use `authenticate` to protect routes
3. **Authorization**: Use `requireRole` or helpers after authentication
4. **Error handling**: Automatic via middleware in server.js
5. **Pagination**: Use `parsePagination` and `sendPaginatedResponse` for lists

All middleware follows REST API best practices and the architecture defined in `API_ARCHITECTURE.md`.

