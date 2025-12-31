# 📚 Booking API Guide

Complete guide for Booking API endpoints in SportsArena MVP.

**Base URL:** `/api/v1/bookings`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
4. [Request/Response Examples](#requestresponse-examples)
5. [Error Handling](#error-handling)
6. [Slot Locking & Double Booking Prevention](#slot-locking--double-booking-prevention)
7. [Testing](#testing)

---

## Overview

The Booking API handles court bookings by users. Bookings link users to time slots with pricing and status tracking.

**Important:** When a user creates a booking (POST `/bookings`), the booking is created with status `pending`. Facility owners can then accept or reject the booking via PUT `/bookings/:id/accept` or PUT `/bookings/:id/reject`.

### Key Concepts

- **Slot Locking**: Backend prevents double booking by locking time slots during booking creation
- **Pending Status**: Bookings start as `pending` and must be accepted/rejected by facility owner
- **Facility Owner Approval**: Only facility owners can accept or reject bookings for their facilities
- **Automatic Slot Release**: Rejected bookings automatically release the time slot back to `available`
- **Price Calculation**: Automatically calculated from court price per hour × duration
- **Cancellation Policy**: Users can cancel bookings (pending or confirmed) if the time slot hasn't started yet

### Booking Status Values

- **`pending`**: Booking is created but not yet accepted/rejected by facility owner (default status when created)
- **`confirmed`**: Booking has been accepted by facility owner
- **`rejected`**: Booking has been rejected by facility owner (slot is released)
- **`cancelled`**: Booking has been cancelled by user
- **`completed`**: Booking time slot has passed

---

## Authentication

All booking endpoints require authentication. Include JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Create Booking

**`POST /api/v1/bookings`**

Create a new booking. The booking is created with status `pending` and must be accepted/rejected by the facility owner.

**Authentication:** Required

**Slot Locking:** Backend automatically locks the time slot to prevent double booking.

#### Request Body

```json
{
  "courtId": 5,
  "date": "2024-01-15",
  "startTime": "10:00",
  "endTime": "11:30",
  "paymentReference": null
}
```

**Required Fields:**
- `courtId` (number): Court ID to book
- `date` (string): Booking date in YYYY-MM-DD format
- `startTime` (string): Start time in HH:MM format (e.g., "10:00")
- `endTime` (string): End time in HH:MM format (e.g., "11:30")

**Optional Fields:**
- `paymentReference` (string): Payment transaction reference (if applicable)

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "courtId": 5,
    "bookingDate": "2024-01-15T00:00:00.000Z",
    "startTime": 600,
    "endTime": 690,
    "startTimeMinutes": 600,
    "endTimeMinutes": 690,
    "finalPrice": 1500.00,
    "bookingStatus": "pending",
    "paymentReference": null,
    "cancellationReason": null,
    "expiresAt": "2025-01-16T10:30:00.000Z",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Note:** 
- Booking status is automatically set to `pending` (must be accepted/rejected by facility owner)
- Price is automatically calculated from court's price per hour × duration
- Time range is automatically blocked to prevent double booking (transaction-safe)
- Booking expires after configurable duration (default: 24 hours) if not accepted
- Facility owner will review and accept/reject the booking

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "Missing required fields: courtId, date, startTime, endTime",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Booking Conflict**
```json
{
  "success": false,
  "message": "Time slot is already booked",
  "error_code": "BOOKING_CONFLICT",
  "conflictingBooking": {
    "id": 123,
    "startTime": 600,
    "endTime": 690,
    "status": "confirmed"
  }
}
```

**400 Bad Request - Time Blocked**
```json
{
  "success": false,
  "message": "Time slot is blocked: Maintenance",
  "error_code": "TIME_BLOCKED"
}
```

**400 Bad Request - Outside Availability**
```json
{
  "success": false,
  "message": "Requested time is outside court availability hours",
  "error_code": "OUTSIDE_AVAILABILITY"
}
```

**401 Unauthorized - Missing/Invalid Token**
```json
{
  "success": false,
  "message": "No token provided. Please include Authorization: Bearer <token> header.",
  "error_code": "UNAUTHORIZED"
}
```

**404 Not Found - Court Not Found**
```json
{
  "success": false,
  "message": "Court not found",
  "error_code": "COURT_NOT_FOUND"
}
```

---

### 2. Get Booking Details

**`GET /api/v1/bookings/:id`**

Get detailed information about a specific booking, including time slot and court details.

**Authentication:** Required (must be booking owner)

#### URL Parameters

- `id` (number, required): Booking ID

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Booking details retrieved successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "courtId": 5,
    "bookingDate": "2024-01-15T00:00:00.000Z",
    "startTime": 600,
    "endTime": 690,
    "startTimeMinutes": 600,
    "endTimeMinutes": 690,
    "finalPrice": 1500.00,
    "bookingStatus": "confirmed",
    "paymentReference": null,
    "cancellationReason": null,
    "expiresAt": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - Invalid Booking ID**
```json
{
  "success": false,
  "message": "Invalid booking ID",
  "error_code": "VALIDATION_ERROR"
}
```

**403 Forbidden - Not Booking Owner**
```json
{
  "success": false,
  "message": "You can only view your own bookings",
  "error_code": "FORBIDDEN"
}
```

**404 Not Found - Booking Not Found**
```json
{
  "success": false,
  "message": "Booking not found",
  "error_code": "BOOKING_NOT_FOUND"
}
```

---

### 3. Get Pending Bookings for Facility (Facility Owner Only)

**`GET /api/v1/facilities/:id/bookings/pending`**

Get all pending bookings for a facility. Only the facility owner can access this endpoint.

**Authentication:** Required (must be facility owner)

#### URL Parameters

- `id` (number, required): Facility ID

#### Query Parameters

- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Number of records per page (default: 50, max: 100)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Pending bookings retrieved successfully",
  "data": {
    "bookings": [
      {
        "id": 1,
        "userId": 5,
        "courtId": 3,
        "bookingDate": "2024-01-20T00:00:00.000Z",
        "startTime": 840,
        "endTime": 900,
        "startTimeMinutes": 840,
        "endTimeMinutes": 900,
        "finalPrice": 1500.00,
        "bookingStatus": "pending",
        "paymentReference": null,
        "cancellationReason": null,
        "expiresAt": "2025-01-16T10:30:00.000Z",
        "createdAt": "2025-01-15T10:30:00.000Z",
        "updatedAt": "2025-01-15T10:30:00.000Z",
        "court": {
          "id": 3,
          "name": "Padel Court 1",
          "pricePerHour": 1500.00
        },
        "user": {
          "id": 5,
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com",
          "phone": "+923001234567"
        }
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

#### Error Responses

**400 Bad Request - Invalid Facility ID**
```json
{
  "success": false,
  "message": "Invalid facility ID",
  "error_code": "VALIDATION_ERROR"
}
```

**403 Forbidden - Not Facility Owner**
```json
{
  "success": false,
  "message": "You can only view bookings for your own facilities",
  "error_code": "FORBIDDEN"
}
```

**404 Not Found - Facility Not Found**
```json
{
  "success": false,
  "message": "Facility not found",
  "error_code": "FACILITY_NOT_FOUND"
}
```

---

### 4. Accept Booking (Facility Owner Only)

**`PUT /api/v1/bookings/:id/accept`**

Accept a pending booking. Changes booking status from `pending` to `confirmed`. Only the facility owner can accept bookings for their facilities.

**Authentication:** Required (must be facility owner)

#### URL Parameters

- `id` (number, required): Booking ID

#### Request Body

```json
{
  "paymentReference": "PAY-123456789"
}
```

**Optional Fields:**
- `paymentReference` (string): Payment transaction reference (if applicable)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Booking accepted successfully",
  "data": {
    "id": 1,
    "userId": 5,
    "courtId": 3,
    "bookingDate": "2024-01-20T00:00:00.000Z",
    "startTime": 840,
    "endTime": 900,
    "startTimeMinutes": 840,
    "endTimeMinutes": 900,
    "finalPrice": 1500.00,
    "bookingStatus": "confirmed",
    "paymentReference": "PAY-123456789",
    "cancellationReason": null,
    "expiresAt": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:35:00.000Z"
  }
}
```

**Note:** 
- Only pending bookings can be accepted
- Booking status changes from `pending` to `confirmed`
- Expiration time is cleared (expiresAt becomes null)
- Only facility owners can accept bookings for their facilities

#### Error Responses

**400 Bad Request - Invalid Booking ID**
```json
{
  "success": false,
  "message": "Invalid booking ID",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Cannot Accept Non-Pending Booking**
```json
{
  "success": false,
  "message": "Only pending bookings can be accepted",
  "error_code": "CANNOT_ACCEPT_NON_PENDING"
}
```

**403 Forbidden - Not Facility Owner**
```json
{
  "success": false,
  "message": "You can only accept bookings for your own facilities",
  "error_code": "FORBIDDEN"
}
```

**404 Not Found - Booking Not Found**
```json
{
  "success": false,
  "message": "Booking not found",
  "error_code": "BOOKING_NOT_FOUND"
}
```

---

### 5. Reject Booking (Facility Owner Only)

**`PUT /api/v1/bookings/:id/reject`**

Reject a pending booking. Changes booking status from `pending` to `rejected` and releases the time slot back to `available`. Only the facility owner can reject bookings for their facilities.

**Authentication:** Required (must be facility owner)

#### URL Parameters

- `id` (number, required): Booking ID

#### Request Body

```json
{
  "rejectionReason": "Court maintenance scheduled"
}
```

**Optional Fields:**
- `rejectionReason` (string): Reason for rejection

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Booking rejected successfully. Time slot is now available.",
  "data": {
    "id": 1,
    "userId": 5,
    "courtId": 3,
    "bookingDate": "2024-01-20T00:00:00.000Z",
    "startTime": 840,
    "endTime": 900,
    "startTimeMinutes": 840,
    "endTimeMinutes": 900,
    "finalPrice": 1500.00,
    "bookingStatus": "rejected",
    "paymentReference": null,
    "cancellationReason": "Court maintenance scheduled",
    "expiresAt": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:35:00.000Z"
  }
}
```

**Note:** 
- Only pending bookings can be rejected
- Booking status changes from `pending` to `rejected`
- Time range becomes available again for other users
- Only facility owners can reject bookings for their facilities

#### Error Responses

**400 Bad Request - Invalid Booking ID**
```json
{
  "success": false,
  "message": "Invalid booking ID",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Cannot Reject Non-Pending Booking**
```json
{
  "success": false,
  "message": "Only pending bookings can be rejected",
  "error_code": "CANNOT_REJECT_NON_PENDING"
}
```

**403 Forbidden - Not Facility Owner**
```json
{
  "success": false,
  "message": "You can only reject bookings for your own facilities",
  "error_code": "FORBIDDEN"
}
```

**404 Not Found - Booking Not Found**
```json
{
  "success": false,
  "message": "Booking not found",
  "error_code": "BOOKING_NOT_FOUND"
}
```

---

### 6. Confirm Booking (DEPRECATED)

**`PUT /api/v1/bookings/:id/confirm`**

⚠️ **DEPRECATED:** This endpoint is deprecated. Facility owners should use PUT `/bookings/:id/accept` instead.

Confirm a pending booking. Changes booking status from `pending` to `confirmed`.

**Authentication:** Required (must be booking owner)

#### URL Parameters

- `id` (number, required): Booking ID

#### Request Body

```json
{
  "paymentReference": "PAY-123456789"
}
```

**Optional Fields:**
- `paymentReference` (string): Payment transaction reference (if applicable)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Booking confirmed successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "courtId": 5,
    "bookingDate": "2024-01-15T00:00:00.000Z",
    "startTime": 600,
    "endTime": 690,
    "startTimeMinutes": 600,
    "endTimeMinutes": 690,
    "finalPrice": 1500.00,
    "bookingStatus": "confirmed",
    "paymentReference": "PAY-123456789",
    "cancellationReason": null,
    "expiresAt": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:35:00.000Z"
  }
}
```

**Note:** 
- Only pending bookings can be confirmed
- Time slot remains `booked` (no change needed)
- Cannot confirm bookings for time slots that have already started

#### Error Responses

**400 Bad Request - Invalid Booking ID**
```json
{
  "success": false,
  "message": "Invalid booking ID",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Already Confirmed**
```json
{
  "success": false,
  "message": "Booking is already confirmed",
  "error_code": "ALREADY_CONFIRMED"
}
```

**400 Bad Request - Cannot Confirm Cancelled Booking**
```json
{
  "success": false,
  "message": "Cannot confirm a cancelled booking",
  "error_code": "CANNOT_CONFIRM_CANCELLED"
}
```

**400 Bad Request - Cannot Confirm Completed Booking**
```json
{
  "success": false,
  "message": "Cannot confirm a completed booking",
  "error_code": "CANNOT_CONFIRM_COMPLETED"
}
```

**400 Bad Request - Cannot Confirm Past Slot**
```json
{
  "success": false,
  "message": "Cannot confirm a booking for a time slot that has already started",
  "error_code": "CANNOT_CONFIRM_PAST_SLOT"
}
```

**403 Forbidden - Not Booking Owner**
```json
{
  "success": false,
  "message": "You can only confirm your own bookings",
  "error_code": "FORBIDDEN"
}
```

**404 Not Found - Booking Not Found**
```json
{
  "success": false,
  "message": "Booking not found",
  "error_code": "BOOKING_NOT_FOUND"
}
```

**404 Not Found - Time Slot Not Found**
```json
{
  "success": false,
  "message": "Time slot not found",
  "error_code": "TIME_SLOT_NOT_FOUND"
}
```

---

### 7. Cancel Booking

**`PUT /api/v1/bookings/:id/cancel`**

Cancel a booking (pending or confirmed). The time slot will be made available again if cancellation is allowed.

**Authentication:** Required (must be booking owner)

#### URL Parameters

- `id` (number, required): Booking ID

#### Request Body

```json
{
  "cancellationReason": "Change of plans"
}
```

**Optional Fields:**
- `cancellationReason` (string): Reason for cancellation

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "courtId": 5,
    "bookingDate": "2024-01-15T00:00:00.000Z",
    "startTime": 600,
    "endTime": 690,
    "startTimeMinutes": 600,
    "endTimeMinutes": 690,
    "finalPrice": 1500.00,
    "bookingStatus": "cancelled",
    "paymentReference": null,
    "cancellationReason": "Change of plans",
    "expiresAt": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

**Note:** After cancellation, the time range becomes available again for other users to book.

#### Error Responses

**400 Bad Request - Invalid Booking ID**
```json
{
  "success": false,
  "message": "Invalid booking ID",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Already Cancelled**
```json
{
  "success": false,
  "message": "Booking is already cancelled",
  "error_code": "ALREADY_CANCELLED"
}
```

**400 Bad Request - Cannot Cancel Completed**
```json
{
  "success": false,
  "message": "Cannot cancel a completed booking",
  "error_code": "CANNOT_CANCEL_COMPLETED"
}
```

**400 Bad Request - Cannot Cancel Past Slot**
```json
{
  "success": false,
  "message": "Cannot cancel a booking for a time slot that has already started",
  "error_code": "CANNOT_CANCEL_PAST_SLOT"
}
```

**403 Forbidden - Not Booking Owner**
```json
{
  "success": false,
  "message": "You can only cancel your own bookings",
  "error_code": "FORBIDDEN"
}
```

**404 Not Found - Booking Not Found**
```json
{
  "success": false,
  "message": "Booking not found",
  "error_code": "BOOKING_NOT_FOUND"
}
```

---

### 7. Upload Payment Proof (Bank Transfer)

**`PUT /api/v1/bookings/:id/payment-proof`**

Upload payment proof image for a pending booking. This endpoint creates an image record, generates a pre-signed S3 URL for upload, and links the image to the booking.

**Authentication:** Required (must be booking owner)

**Use Case:** For bank transfer payments, users upload payment proof after creating booking.

#### URL Parameters

- `id` (number, required): Booking ID

#### Request Body

```json
{
  "contentType": "image/jpeg"
}
```

**Required Fields:**
- `contentType` (string): Image MIME type. Must be one of: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Payment proof upload initiated. Use the uploadUrl to upload the image file.",
  "data": {
    "booking": {
      "id": 1,
      "paymentProofImageId": "550e8400-e29b-41d4-a716-446655440000"
    },
    "image": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "uploadUrl": "https://s3.amazonaws.com/...",
      "s3Key": "booking/1/550e8400-e29b-41d4-a716-446655440000.jpg",
      "publicUrl": "https://cdn.example.com/booking/1/550e8400-e29b-41d4-a716-446655440000.jpg",
      "expiresIn": 300,
      "maxFileSize": 5242880
    }
  }
}
```

**Note:**
- Image record is created immediately
- Use `uploadUrl` to upload image file directly to S3 (PUT request)
- Pre-signed URL expires in 5 minutes
- Only one payment proof per booking (replaces existing if any)
- Only pending bookings can have payment proof uploaded

#### Upload Flow

1. **Call this endpoint** → Get pre-signed URL
2. **Upload image to S3** → PUT request to `uploadUrl` with image file
3. **Image is automatically linked** → Booking now has `paymentProofImageId`
4. **Facility admin can view** → Payment proof appears in pending bookings list

#### Error Responses

**400 Bad Request - Invalid Booking Status**
```json
{
  "success": false,
  "message": "Payment proof can only be uploaded for pending bookings",
  "error_code": "INVALID_BOOKING_STATUS"
}
```

**403 Forbidden - Not Booking Owner**
```json
{
  "success": false,
  "message": "You can only upload payment proof for your own bookings",
  "error_code": "FORBIDDEN"
}
```

**404 Not Found - Booking Not Found**
```json
{
  "success": false,
  "message": "Booking not found",
  "error_code": "BOOKING_NOT_FOUND"
}
```

---

### 8. Remove Payment Proof

**`DELETE /api/v1/bookings/:id/payment-proof`**

Remove payment proof image from a booking.

**Authentication:** Required (must be booking owner)

#### URL Parameters

- `id` (number, required): Booking ID

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Payment proof removed successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "courtId": 5,
    "paymentProofImageId": null,
    "bookingStatus": "pending"
  }
}
```

**Note:**
- Removes link between booking and payment proof image
- Image record itself is not deleted (soft delete)
- Only booking owner can remove payment proof

---

### 9. Get User Bookings

**`GET /api/v1/users/bookings`**

Get all bookings for the logged-in user. This endpoint is already implemented in User Routes.

**Authentication:** Required

See [User API Guide](./USER_API_GUIDE.md) for details.

---

## Slot Locking & Double Booking Prevention

The backend implements **slot locking** to prevent double booking:

### How It Works

1. **Transaction-Based Locking**: Uses PostgreSQL transactions with `FOR UPDATE` row lock
2. **Atomic Operations**: All validation and booking creation happen in a single transaction
3. **Re-Validation**: Verifies availability inside transaction (prevents race conditions)
4. **Overlap Detection**: Checks for overlapping bookings using time range overlap logic
5. **Automatic Blocking**: Time range is automatically blocked when booking is created

### Process Flow

```
1. User selects time range from availability
2. User creates booking request (courtId, date, startTime, endTime)
3. Backend starts database transaction
4. Lock court row (FOR UPDATE)
5. Check for overlapping bookings (FOR UPDATE)
6. Check availability rules (within court hours)
7. Check blocked time ranges
8. Calculate price from court
9. Create booking with status 'pending' and expiration time
10. Commit transaction
11. Booking appears in facility admin's pending bookings list
12. Facility admin accepts/rejects booking
13. If accepted: status changes to 'confirmed', expiresAt cleared
14. If rejected: status changes to 'rejected', time range released
```

### Benefits

- **Prevents Race Conditions**: Row locking ensures only one booking can be created at a time
- **Atomic Operations**: All-or-nothing - if any step fails, entire transaction rolls back
- **Data Integrity**: Ensures time slot status and booking are always in sync

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
| `BOOKING_CONFLICT` | 409 | Time range is already booked by another booking |
| `TIME_BLOCKED` | 409 | Time range is blocked (maintenance, private event) |
| `OUTSIDE_AVAILABILITY` | 400 | Requested time is outside court availability hours |
| `INVALID_TIME_RANGE` | 400 | Start time must be before end time |
| `INVALID_TIME_GRANULARITY` | 400 | Times must align to 30-minute intervals |
| `DURATION_TOO_SHORT` | 400 | Booking duration is too short |
| `BOOKING_NOT_FOUND` | 404 | Booking does not exist |
| `COURT_NOT_FOUND` | 404 | Court does not exist |
| `FACILITY_NOT_FOUND` | 404 | Facility does not exist |
| `ALREADY_CONFIRMED` | 400 | Booking is already confirmed |
| `CANNOT_CONFIRM_CANCELLED` | 400 | Cannot confirm a cancelled booking |
| `CANNOT_CONFIRM_COMPLETED` | 400 | Cannot confirm a completed booking |
| `CANNOT_CONFIRM_PAST_SLOT` | 400 | Cannot confirm booking for past time slot |
| `CANNOT_ACCEPT_NON_PENDING` | 400 | Only pending bookings can be accepted |
| `CANNOT_REJECT_NON_PENDING` | 400 | Only pending bookings can be rejected |
| `ALREADY_CANCELLED` | 400 | Booking is already cancelled |
| `CANNOT_CANCEL_COMPLETED` | 400 | Cannot cancel completed booking |
| `CANNOT_CANCEL_PAST_SLOT` | 400 | Cannot cancel booking for past time slot |
| `COURT_INACTIVE` | 400 | Court is not active |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Not booking owner, facility owner, or insufficient permissions |

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid input or validation error
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions or not booking owner
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Testing

### Using cURL

#### Create Booking
```bash
curl -X POST http://localhost:3000/api/v1/bookings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "courtId": 5,
    "date": "2024-01-15",
    "startTime": "10:00",
    "endTime": "11:30"
  }'
```

#### Upload Payment Proof
```bash
# Step 1: Get pre-signed URL
curl -X PUT http://localhost:3000/api/v1/bookings/1/payment-proof \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "image/jpeg"
  }'

# Step 2: Upload image to S3 using the uploadUrl from response
curl -X PUT "<uploadUrl_from_response>" \
  -H "Content-Type: image/jpeg" \
  --data-binary @payment_proof.jpg
```

#### Remove Payment Proof
```bash
curl -X DELETE http://localhost:3000/api/v1/bookings/1/payment-proof \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Booking Details
```bash
curl -X GET http://localhost:3000/api/v1/bookings/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Pending Bookings for Facility (Facility Owner)
```bash
curl -X GET "http://localhost:3000/api/v1/facilities/1/bookings/pending?page=1&limit=10" \
  -H "Authorization: Bearer FACILITY_OWNER_JWT_TOKEN"
```

#### Accept Booking (Facility Owner)
```bash
curl -X PUT http://localhost:3000/api/v1/bookings/1/accept \
  -H "Authorization: Bearer FACILITY_OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentReference": "PAY-123456789"
  }'
```

#### Reject Booking (Facility Owner)
```bash
curl -X PUT http://localhost:3000/api/v1/bookings/1/reject \
  -H "Authorization: Bearer FACILITY_OWNER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rejectionReason": "Court maintenance scheduled"
  }'
```

#### Confirm Booking (DEPRECATED)
```bash
curl -X PUT http://localhost:3000/api/v1/bookings/1/confirm \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentReference": "PAY-123456789"
  }'
```

#### Cancel Booking
```bash
curl -X PUT http://localhost:3000/api/v1/bookings/1/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancellationReason": "Change of plans"
  }'
```

#### Get User Bookings
```bash
curl -X GET "http://localhost:3000/api/v1/users/bookings?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using Postman/Insomnia

1. **All Endpoints**: Require `Authorization` header with value `Bearer <token>`
2. **URL Parameters**: Replace `:id` with actual booking ID
3. **Request Body**: Use JSON format for POST/PUT requests
4. **Query Parameters**: Add pagination and filter parameters in URL for GET requests

---

## Usage Examples

### Complete Booking Flow (User Perspective)

```javascript
// Frontend example - user booking flow with bank transfer
const courtId = 5;
const date = "2024-01-15";
const startTime = "10:00";
const endTime = "11:30";

// 1. Create booking (status: pending)
const createResponse = await fetch('/api/v1/bookings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ 
    courtId, 
    date, 
    startTime, 
    endTime 
  })
});

const { data: booking } = await createResponse.json();
console.log(`Booking created: ${booking.id}, Status: ${booking.bookingStatus}, Price: PKR ${booking.finalPrice}`);

// 2. Upload payment proof (bank transfer receipt)
const fileInput = document.getElementById('paymentProofFile'); // File input element
const file = fileInput.files[0];

if (file) {
  // Step 2a: Get pre-signed URL
  const proofResponse = await fetch(`/api/v1/bookings/${booking.id}/payment-proof`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contentType: file.type
    })
  });

  const { data: proofData } = await proofResponse.json();
  
  // Step 2b: Upload image to S3
  await fetch(proofData.image.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type
    },
    body: file
  });

  console.log('Payment proof uploaded successfully');
  console.log(`Image URL: ${proofData.image.publicUrl}`);
}

// 3. Cancel if needed (works for both pending and confirmed bookings)
if (needsCancellation) {
  await fetch(`/api/v1/bookings/${booking.id}/cancel`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      cancellationReason: 'Change of plans'
    })
  });
}
```

### Facility Owner Booking Management Flow

```javascript
// Frontend example - facility owner managing bookings
const facilityId = 1;
const facilityOwnerToken = 'FACILITY_OWNER_JWT_TOKEN';

// 1. Get pending bookings for facility
const pendingResponse = await fetch(`/api/v1/facilities/${facilityId}/bookings/pending?page=1&limit=10`, {
  headers: {
    'Authorization': `Bearer ${facilityOwnerToken}`
  }
});

const { data: pendingBookings } = await pendingResponse.json();
console.log(`Found ${pendingBookings.total} pending bookings`);

// 2. Accept a booking
const bookingId = pendingBookings.bookings[0].id;
await fetch(`/api/v1/bookings/${bookingId}/accept`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${facilityOwnerToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentReference: 'PAY-123456789' // Optional
  })
});
console.log(`Booking ${bookingId} accepted`);

// 3. Reject a booking (with reason)
const bookingToReject = pendingBookings.bookings[1].id;
await fetch(`/api/v1/bookings/${bookingToReject}/reject`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${facilityOwnerToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    rejectionReason: 'Court maintenance scheduled for this time slot'
  })
});
console.log(`Booking ${bookingToReject} rejected. Time slot is now available.`);
```

---

## Data Format Notes

### Booking Object Structure

```json
{
  "id": 1,
  "userId": 1,
  "courtId": 5,
  "bookingDate": "2024-01-15T00:00:00.000Z",
  "startTime": 600,
  "endTime": 690,
  "startTimeMinutes": 600,
  "endTimeMinutes": 690,
  "finalPrice": 1500.00,
  "bookingStatus": "pending",
  "paymentReference": null,
  "cancellationReason": null,
  "expiresAt": "2025-01-16T10:30:00.000Z",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### Field Descriptions

- **id**: Unique booking identifier
- **userId**: User ID who made the booking
- **courtId**: Court ID being booked
- **bookingDate**: Booking date (YYYY-MM-DD)
- **startTime**: Start time in minutes since midnight (0-1439)
- **endTime**: End time in minutes since midnight (0-1439)
- **startTimeMinutes**: Same as startTime (for convenience)
- **endTimeMinutes**: Same as endTime (for convenience)
- **finalPrice**: Final booking price in PKR (calculated automatically)
- **bookingStatus**: Booking status (`pending`, `confirmed`, `rejected`, `cancelled`, `completed`, `expired`)
- **paymentReference**: Payment transaction reference (null until payment confirmed)
- **paymentProofImageId**: UUID of payment proof image (null if not uploaded yet)
- **cancellationReason**: Reason for cancellation/rejection (if cancelled/rejected)
- **expiresAt**: Expiration timestamp for pending bookings (null after acceptance)
- **createdAt**: Creation timestamp (ISO 8601)
- **updatedAt**: Last update timestamp (ISO 8601)

### Price Calculation

Price is automatically calculated:
```
Price = Court Price Per Hour × Duration (in hours)
```

Example:
- Court price: PKR 1500/hour
- Slot duration: 1 hour
- Final price: PKR 1500.00

---

## Notes

- **Pending Booking Flow**: Bookings are created with `pending` status and must be accepted by facility owner
- **Bank Transfer Payment**: Users upload payment proof image after creating booking
- **Payment Proof Upload**: Two-step process: get pre-signed URL, then upload image to S3
- **Transaction-Safe Booking**: Backend prevents double booking using database transactions with row-level locking
- **Automatic Price Calculation**: Price calculated from court price × duration
- **Expiration Mechanism**: Pending bookings expire after configurable duration (default: 24 hours)
- **Facility Owner Approval**: Only facility owners can accept/reject bookings for their facilities
- **Payment Proof Review**: Facility admin can view payment proof images when reviewing pending bookings
- **Cancellation Policy**: Users can cancel pending or confirmed bookings if time hasn't started
- **Time Range Release**: Cancelled/rejected bookings automatically release the time range
- **Ownership Validation**: Users can only view/cancel/upload proof for their own bookings
- **Time Format**: Times stored as minutes since midnight (0-1439) for consistency
- All timestamps are in ISO 8601 format (UTC)

---

## Related Documentation

- [API Architecture](./API_ARCHITECTURE.md) - Overall API design
- [MVP Full Roadmap](../Concept/MVP_FULL_ROADMAP.md) - Complete MVP implementation plan
- [Booking Model](../MODELS/Booking.md) - Database model documentation
- [Rule-Based Availability Architecture](../Architecture/RULE_BASED_AVAILABILITY_ARCHITECTURE.md) - Availability system (replaces timeslot system)
- [User API Guide](./USER_API_GUIDE.md) - User endpoints (includes GET /users/bookings)
- [Court API Guide](./COURT_API_GUIDE.md) - Court endpoints

---

**Last Updated:** 2025-01-15

