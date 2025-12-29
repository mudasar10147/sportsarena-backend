# 🔐 Middleware Setup Guide

Complete guide for middleware implementation in SportsArena MVP.

**Following:** MVP_FULL_ROADMAP.md Step 3: Set Up Middleware

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication Middleware](#authentication-middleware)
3. [Authorization Middleware](#authorization-middleware)
4. [Error Handling Middleware](#error-handling-middleware)
5. [Middleware Usage Across Routes](#middleware-usage-across-routes)
6. [Testing Middleware](#testing-middleware)

---

## Overview

The middleware system provides three core functionalities:

1. **Authentication**: Verifies JWT tokens for protected routes
2. **Authorization**: Ensures role-based access control
3. **Error Handling**: Provides consistent error responses

All middleware follows the architecture defined in `API_ARCHITECTURE.md` Section 1.5 and 1.7.

---

## Authentication Middleware

**Location:** `src/middleware/auth.js`

### Purpose

Verifies JWT tokens and attaches authenticated user to request object.

### Features

- Extracts token from `Authorization: Bearer <token>` header
- Verifies JWT token signature and expiration
- Validates user exists and is active
- Attaches `req.user` and `req.userId` to request

### Usage

```javascript
const { authenticate } = require('../middleware/auth');

// Protect a route
router.get('/profile', authenticate, handler);
```

### Middleware Functions

#### `authenticate`
- **Required**: Yes (fails if no token)
- **Sets**: `req.user`, `req.userId`
- **Returns**: 401 if token missing/invalid

#### `optionalAuthenticate`
- **Required**: No (silently continues if no token)
- **Sets**: `req.user`, `req.userId` (if token valid)
- **Use Case**: Endpoints that work with or without auth

### Error Responses

- **401 Unauthorized**: Missing token, invalid token, expired token, inactive user

---

## Authorization Middleware

**Location:** `src/middleware/authorization.js`

### Purpose

Ensures role-based access control. Must be used **after** authentication middleware.

### Features

- Role-based access control (player, facility_admin)
- Ownership validation (users can only access their own resources)
- Predefined helpers for common scenarios

### Usage

```javascript
const { authenticate } = require('../middleware/auth');
const { requireFacilityAdmin } = require('../middleware/authorization');

// Require facility_admin role
router.post('/facilities', authenticate, requireFacilityAdmin, handler);
```

### Middleware Functions

#### `requireRole(allowedRoles)`
- **Parameters**: Single role string or array of roles
- **Checks**: User role matches allowed roles
- **Returns**: 403 if role doesn't match

#### `requireFacilityAdmin`
- **Shorthand**: `requireRole('facility_admin')`
- **Use Case**: Admin-only endpoints

#### `requirePlayer`
- **Shorthand**: `requireRole('player')`
- **Use Case**: Player-only endpoints

#### `requireAnyUser`
- **Shorthand**: `requireRole(['player', 'facility_admin'])`
- **Use Case**: Any authenticated user

#### `requireOwnershipOrAdmin(getResourceOwnerId)`
- **Parameters**: Function to get resource owner ID
- **Checks**: User owns resource OR is facility_admin
- **Use Case**: Users can access their own resources, admins can access all

### Error Responses

- **403 Forbidden**: Insufficient permissions, wrong role

### Important Note

**Ownership checks** are performed in **services**, not middleware. The authorization middleware checks roles, while services verify ownership (e.g., facility owner can only update their own facilities).

---

## Error Handling Middleware

**Location:** `src/middleware/errorHandler.js`

### Purpose

Catches all errors and returns consistent JSON responses with proper HTTP status codes.

### Features

- Handles validation errors
- Handles JWT errors
- Handles database errors (PostgreSQL)
- Handles custom errors
- Provides 404 handler for undefined routes

### Usage

**Already integrated in `server.js`:**

```javascript
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// After all routes
app.use(notFoundHandler); // Handle 404
app.use(errorHandler);    // Handle all errors
```

### Error Types Handled

| Error Type | HTTP Status | Error Code |
|------------|-------------|------------|
| ValidationError | 400 | VALIDATION_ERROR |
| JsonWebTokenError | 401 | INVALID_TOKEN |
| TokenExpiredError | 401 | INVALID_TOKEN |
| CastError | 400 | INVALID_ID |
| PostgreSQL 23505 (unique) | 409 | DUPLICATE_ENTRY |
| PostgreSQL 23503 (foreign key) | 400 | FOREIGN_KEY_VIOLATION |
| Custom errors (statusCode) | Custom | Custom errorCode |
| Unknown errors | 500 | INTERNAL_ERROR |

### Response Format

```json
{
  "success": false,
  "message": "Error description",
  "error_code": "ERROR_CODE"
}
```

---

## Middleware Usage Across Routes

### Public Routes (No Authentication)

| Route | Endpoint | Middleware |
|-------|----------|------------|
| User | `POST /users/signup` | None |
| User | `POST /users/login` | None |
| Facility | `GET /facilities` | None |
| Facility | `GET /facilities/:id` | None |
| Facility | `GET /facilities/:id/sports` | None |
| Facility | `GET /facilities/:id/courts` | None |
| Sport | `GET /sports` | None |
| Sport | `GET /sports/:id` | None |
| Court | `GET /courts/:id/timeslots` | None |

### Protected Routes (Authentication Required)

| Route | Endpoint | Middleware |
|-------|----------|------------|
| User | `GET /users/profile` | `authenticate` |
| User | `PUT /users/profile` | `authenticate` |
| User | `GET /users/bookings` | `authenticate` |
| Booking | `POST /bookings` | `authenticate` |
| Booking | `GET /bookings/:id` | `authenticate` |
| Booking | `PUT /bookings/:id/cancel` | `authenticate` |

### Admin Routes (Authentication + Role)

| Route | Endpoint | Middleware | Ownership Check |
|-------|----------|------------|-----------------|
| Facility | `POST /facilities` | `authenticate`, `requireFacilityAdmin` | Service level |
| Facility | `PUT /facilities/:id` | `authenticate`, `requireFacilityAdmin` | Service level |
| Facility | `POST /facilities/:id/sports` | `authenticate`, `requireFacilityAdmin` | Service level |
| Facility | `POST /facilities/:id/courts` | `authenticate`, `requireFacilityAdmin` | Service level |
| Sport | `POST /sports` | `authenticate`, `requireFacilityAdmin` | None |
| Court | `PUT /courts/:id` | `authenticate`, `requireFacilityAdmin` | Service level |
| TimeSlot | `POST /courts/:id/timeslots` | `authenticate`, `requireFacilityAdmin` | Service level |
| TimeSlot | `PUT /timeslots/:id` | `authenticate`, `requireFacilityAdmin` | Service level |

### Ownership Validation

**Important:** While authorization middleware checks roles, **ownership validation** is performed in **services**:

- `facilityService.updateFacility()` - Checks if user owns facility
- `facilitySportService.assignSportToFacility()` - Checks if user owns facility
- `courtService.createCourt()` - Checks if user owns facility
- `courtService.updateCourt()` - Checks if user owns facility
- `timeSlotService.createTimeSlot()` - Checks if user owns facility
- `timeSlotService.updateTimeSlot()` - Checks if user owns facility
- `bookingService.getBookingDetails()` - Checks if user owns booking
- `bookingService.cancelBooking()` - Checks if user owns booking

This ensures that even facility admins can only manage their own facilities.

---

## Testing Middleware

### Test Authentication

#### Missing Token
```bash
curl -X GET http://localhost:3000/api/v1/users/profile
# Expected: 401 Unauthorized
```

#### Invalid Token
```bash
curl -X GET http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer invalid-token"
# Expected: 401 Unauthorized
```

#### Valid Token
```bash
curl -X GET http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_VALID_JWT_TOKEN"
# Expected: 200 OK with user data
```

### Test Authorization

#### Player Trying to Create Facility
```bash
# Login as player, get token
curl -X POST http://localhost:3000/api/v1/facilities \
  -H "Authorization: Bearer PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "address": "Test"}'
# Expected: 403 Forbidden - "Access denied. Required role: facility_admin"
```

#### Facility Admin Creating Facility
```bash
curl -X POST http://localhost:3000/api/v1/facilities \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "address": "Test"}'
# Expected: 201 Created
```

### Test Error Handling

#### Invalid Route
```bash
curl -X GET http://localhost:3000/api/v1/invalid-route
# Expected: 404 Not Found with consistent JSON format
```

#### Validation Error
```bash
curl -X POST http://localhost:3000/api/v1/bookings \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 Bad Request with validation error message
```

---

## Middleware Order

**Critical:** Middleware order matters in Express. Current setup in `server.js`:

```javascript
// 1. CORS and body parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. API routes
app.use('/api/v1', v1Routes);

// 3. Error handling (MUST be last)
app.use(notFoundHandler); // 404 handler
app.use(errorHandler);    // Global error handler
```

**In route files:**
```javascript
// Correct order:
router.post('/endpoint', 
  authenticate,           // 1. Check authentication first
  requireFacilityAdmin,    // 2. Check authorization second
  handler                 // 3. Handle request
);
```

---

## Security Best Practices

### ✅ Implemented

1. **JWT Token Verification**: All protected routes verify tokens
2. **Role-Based Access**: Admin routes require facility_admin role
3. **Ownership Validation**: Services verify resource ownership
4. **Error Handling**: Consistent error responses don't leak sensitive info
5. **Transaction Safety**: Database transactions prevent race conditions

### 🔒 Security Features

- **Token Expiration**: JWT tokens expire (configurable via `JWT_EXPIRES_IN`)
- **Active User Check**: Inactive users cannot authenticate
- **Row Locking**: Prevents double booking with database locks
- **Input Validation**: All inputs validated before processing
- **SQL Injection Prevention**: Using parameterized queries

---

## Configuration

### Environment Variables

Required in `.env`:

```env
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
PORT=3000
```

### JWT Configuration

- **Secret**: Must be set in production (use strong random string)
- **Expiration**: Default 7 days (configurable)
- **Algorithm**: HS256 (default for jsonwebtoken)

---

## Troubleshooting

### Common Issues

#### "No token provided"
- **Cause**: Missing `Authorization` header
- **Solution**: Include `Authorization: Bearer <token>` header

#### "Token has expired"
- **Cause**: JWT token expired
- **Solution**: User needs to login again

#### "Access denied. Required role: facility_admin"
- **Cause**: User doesn't have required role
- **Solution**: User must have `facility_admin` role

#### "You can only update your own facilities"
- **Cause**: Ownership validation failed
- **Solution**: User must be the facility owner

---

## Summary

✅ **Authentication Middleware**: Implemented and used across all protected routes
✅ **Authorization Middleware**: Implemented with role-based access control
✅ **Error Handling Middleware**: Implemented with consistent JSON responses
✅ **Ownership Validation**: Implemented in services for resource protection
✅ **Slot Locking**: Implemented in booking service to prevent double booking

All middleware is properly integrated and follows best practices for security and error handling.

---

## Related Documentation

- [API Architecture](./API_ARCHITECTURE.md) - Overall API design
- [MVP Full Roadmap](./MVP_FULL_ROADMAP.md) - Complete MVP implementation plan
- [Middleware README](../src/middleware/README.md) - Detailed middleware usage guide
- [User API Guide](./USER_API_GUIDE.md) - User endpoints
- [Facility API Guide](./FACILITY_API_GUIDE.md) - Facility endpoints

---

**Last Updated:** 2025-01-15

