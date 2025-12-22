# 📚 User API Guide

Complete guide for User API endpoints in SportsArena MVP.

**Base URL:** `/api/v1/users`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
4. [Request/Response Examples](#requestresponse-examples)
5. [Error Handling](#error-handling)
6. [Testing](#testing)

---

## Overview

The User API handles user registration, authentication, profile management, and booking retrieval. All endpoints follow REST API conventions and return consistent JSON responses.

### User Roles

- **`player`**: Regular users who can book courts
- **`facility_admin`**: Facility owners who can manage courts and slots

---

## Authentication

Most endpoints require JWT authentication. After successful login, include the token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Register New User

**`POST /api/v1/users/signup`**

Register a new user account. Returns user object and JWT token for immediate login.

#### Request Body

```json
{
  "email": "john@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+923001234567",
  "role": "player"
}
```

**Required Fields:**
- `email` (string): Valid email address
- `password` (string): Minimum 6 characters
- `firstName` (string): User's first name
- `lastName` (string): User's last name

**Optional Fields:**
- `phone` (string): Phone number
- `role` (string): `"player"` or `"facility_admin"` (default: `"player"`)

**Note:** `platform_admin` role cannot be created via signup. Platform admin accounts must be created using the special script: `npm run create:admin`

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+923001234567",
      "role": "player",
      "isActive": true,
      "emailVerified": false,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "Missing required fields: email, password, firstName, lastName",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Email Already Exists**
```json
{
  "success": false,
  "message": "Email already registered",
  "error_code": "EMAIL_EXISTS"
}
```

---

### 2. Login

**`POST /api/v1/users/login`**

Authenticate user and receive JWT token.

#### Request Body

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Required Fields:**
- `email` (string): User email
- `password` (string): User password

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+923001234567",
      "role": "player",
      "isActive": true,
      "emailVerified": false,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Error Responses

**401 Unauthorized - Invalid Credentials**
```json
{
  "success": false,
  "message": "Invalid email or password",
  "error_code": "INVALID_CREDENTIALS"
}
```

**403 Forbidden - Account Inactive**
```json
{
  "success": false,
  "message": "Account is inactive",
  "error_code": "ACCOUNT_INACTIVE"
}
```

---

### 3. Get User Profile

**`GET /api/v1/users/profile`**

Get the authenticated user's profile information.

**Requires Authentication:** Yes

#### Headers

```
Authorization: Bearer <your-jwt-token>
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": 1,
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+923001234567",
    "role": "player",
    "isActive": true,
    "emailVerified": false,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses

**401 Unauthorized - Missing/Invalid Token**
```json
{
  "success": false,
  "message": "No token provided. Please include Authorization: Bearer <token> header.",
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

### 4. Update User Profile

**`PUT /api/v1/users/profile`**

Update the authenticated user's profile information.

**Requires Authentication:** Yes

#### Headers

```
Authorization: Bearer <your-jwt-token>
```

#### Request Body

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+923009876543"
}
```

**Optional Fields:** At least one field must be provided
- `firstName` (string): Updated first name
- `lastName` (string): Updated last name
- `phone` (string): Updated phone number

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "email": "john@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "phone": "+923009876543",
    "role": "player",
    "isActive": true,
    "emailVerified": false,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:35:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "At least one field (firstName, lastName, phone) must be provided",
  "error_code": "VALIDATION_ERROR"
}
```

---

### 5. Get User Bookings

**`GET /api/v1/users/bookings`**

Retrieve all bookings for the authenticated user with pagination support.

**Requires Authentication:** Yes

#### Headers

```
Authorization: Bearer <your-jwt-token>
```

#### Query Parameters

- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10, max: 100)
- `status` (string, optional): Filter by booking status (`pending`, `confirmed`, `cancelled`, `rejected`, `completed`)

#### Example Request

```
GET /api/v1/users/bookings?page=1&limit=10&status=confirmed
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Bookings retrieved successfully",
  "data": [
    {
      "id": 1,
      "userId": 1,
      "timeSlotId": 5,
      "finalPrice": 1500.00,
      "bookingStatus": "pending",
      "paymentReference": null,
      "cancellationReason": null,
      "createdAt": "2025-01-15T10:40:00.000Z",
      "updatedAt": "2025-01-15T10:40:00.000Z",
      "timeSlot": {
        "id": 5,
        "startTime": "2025-01-20T14:00:00.000Z",
        "endTime": "2025-01-20T15:00:00.000Z",
        "status": "booked"
      },
      "court": {
        "id": 3,
        "name": "Padel Court 1",
        "description": "Indoor padel court with premium flooring",
        "pricePerHour": 1500.00,
        "isIndoor": true
      },
      "facility": {
        "id": 1,
        "name": "Ace Padel",
        "address": "123 Sports Street, Karachi",
        "city": "Karachi",
        "contactPhone": "+923001234567",
        "contactEmail": "info@acepadel.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Note:** The response includes complete booking details with:
- **Time Slot**: Start time, end time, and slot status
- **Court**: Court name, description, price per hour, and indoor/outdoor status
- **Facility**: Facility name, address, city, and contact information

This allows users to see all relevant information about their bookings without making additional API calls.

#### Error Responses

**401 Unauthorized - Missing/Invalid Token**
```json
{
  "success": false,
  "message": "No token provided. Please include Authorization: Bearer <token> header.",
  "error_code": "UNAUTHORIZED"
}
```

---

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error_code": "ERROR_CODE"
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `EMAIL_EXISTS` | 400 | Email already registered |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `ACCOUNT_INACTIVE` | 403 | User account is inactive |
| `USER_NOT_FOUND` | 404 | User does not exist |

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid input or validation error
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Testing

### Using cURL

#### Signup
```bash
curl -X POST http://localhost:3000/api/v1/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+923001234567"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

#### Get Profile
```bash
curl -X GET http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Update Profile
```bash
curl -X PUT http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "phone": "+923009876543"
  }'
```

#### Get Bookings
```bash
curl -X GET "http://localhost:3000/api/v1/users/bookings?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using Postman/Insomnia

1. **Signup/Login**: Create POST requests with JSON body
2. **Protected Routes**: Add `Authorization` header with value `Bearer <token>`
3. **Query Parameters**: Add pagination and filter parameters in URL

---

## Notes

- JWT tokens expire after 7 days (configurable via `JWT_EXPIRES_IN` environment variable)
- Passwords are hashed using bcrypt (10 salt rounds)
- Email addresses must be unique
- User accounts use soft delete (`is_active` flag)
- All timestamps are in ISO 8601 format (UTC)

---

## Related Documentation

- [API Architecture](../API_ARCHITECTURE.md) - Overall API design
- [MVP Full Roadmap](./MVP_FULL_ROADMAP.md) - Complete MVP implementation plan
- [User Model](../../MODELS/User.md) - Database model documentation

---

**Last Updated:** 2025-01-15

