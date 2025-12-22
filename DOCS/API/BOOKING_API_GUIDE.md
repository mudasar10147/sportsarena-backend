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
  "timeSlotId": 5
}
```

**Required Fields:**
- `timeSlotId` (number): Time slot ID to book

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": 1,
    "userId": 1,
    "timeSlotId": 5,
    "finalPrice": 1500.00,
    "bookingStatus": "pending",
    "paymentReference": null,
    "cancellationReason": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Note:** 
- Booking status is automatically set to `pending` (must be accepted/rejected by facility owner)
- Price is automatically calculated from court's price per hour × duration
- Time slot is automatically marked as `booked` to prevent double booking
- Facility owner will review and accept/reject the booking

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "Time slot ID is required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Slot Not Available**
```json
{
  "success": false,
  "message": "Time slot is not available for booking",
  "error_code": "SLOT_NOT_AVAILABLE"
}
```

**400 Bad Request - Slot Already Booked**
```json
{
  "success": false,
  "message": "Time slot is already booked",
  "error_code": "SLOT_ALREADY_BOOKED"
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

**404 Not Found - Time Slot Not Found**
```json
{
  "success": false,
  "message": "Time slot not found",
  "error_code": "TIME_SLOT_NOT_FOUND"
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
    "timeSlotId": 5,
    "finalPrice": 1500.00,
    "bookingStatus": "confirmed",
    "paymentReference": null,
    "cancellationReason": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z",
    "timeSlot": {
      "id": 5,
      "startTime": "2025-01-20T10:00:00.000Z",
      "endTime": "2025-01-20T11:00:00.000Z",
      "status": "booked"
    },
    "court": {
      "id": 1,
      "name": "Court 1",
      "description": "Premium indoor court with air conditioning",
      "pricePerHour": 1500.00,
      "isIndoor": true
    }
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
        "timeSlotId": 10,
        "finalPrice": 1500.00,
        "bookingStatus": "pending",
        "paymentReference": null,
        "cancellationReason": null,
        "createdAt": "2025-01-15T10:30:00.000Z",
        "updatedAt": "2025-01-15T10:30:00.000Z",
        "timeSlot": {
          "id": 10,
          "startTime": "2025-01-20T14:00:00.000Z",
          "endTime": "2025-01-20T15:00:00.000Z"
        },
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
    "timeSlotId": 10,
    "finalPrice": 1500.00,
    "bookingStatus": "confirmed",
    "paymentReference": "PAY-123456789",
    "cancellationReason": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:35:00.000Z"
  }
}
```

**Note:** 
- Only pending bookings can be accepted
- Time slot remains `booked` (no change needed)
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
    "timeSlotId": 10,
    "finalPrice": 1500.00,
    "bookingStatus": "rejected",
    "paymentReference": null,
    "cancellationReason": "Court maintenance scheduled",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:35:00.000Z"
  }
}
```

**Note:** 
- Only pending bookings can be rejected
- Time slot is automatically released and set to `available`
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
    "timeSlotId": 5,
    "finalPrice": 1500.00,
    "bookingStatus": "confirmed",
    "paymentReference": "PAY-123456789",
    "cancellationReason": null,
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
    "timeSlotId": 5,
    "finalPrice": 1500.00,
    "bookingStatus": "cancelled",
    "paymentReference": null,
    "cancellationReason": "Change of plans",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

**Note:** After cancellation, the time slot status is automatically changed back to `available`.

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

### 4. Get User Bookings

**`GET /api/v1/users/bookings`**

Get all bookings for the logged-in user. This endpoint is already implemented in User Routes.

**Authentication:** Required

See [User API Guide](./USER_API_GUIDE.md) for details.

---

## Slot Locking & Double Booking Prevention

The backend implements **slot locking** to prevent double booking:

### How It Works

1. **Transaction-Based Locking**: Uses PostgreSQL transactions with `FOR UPDATE` row lock
2. **Atomic Operations**: Booking creation and slot status update happen in a single transaction
3. **Double-Check**: Verifies slot availability before and during booking creation
4. **Automatic Slot Update**: Time slot is automatically marked as `booked` when booking is created

### Process Flow

```
1. User requests booking for time slot
2. Backend starts database transaction
3. Lock time slot row (FOR UPDATE)
4. Check if slot is available
5. Check if slot is already booked (double-check)
6. Calculate price from court
7. Create booking with status 'pending'
8. Mark time slot as 'booked'
9. Commit transaction
10. User confirms booking via PUT /bookings/:id/confirm
11. Booking status updated to 'confirmed'
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
| `TIME_SLOT_NOT_FOUND` | 404 | Time slot does not exist |
| `SLOT_NOT_AVAILABLE` | 400 | Time slot is not available (blocked or booked) |
| `SLOT_ALREADY_BOOKED` | 400 | Time slot is already booked |
| `BOOKING_NOT_FOUND` | 404 | Booking does not exist |
| `COURT_NOT_FOUND` | 404 | Court does not exist |
| `FACILITY_NOT_FOUND` | 404 | Facility does not exist |
| `ALREADY_CONFIRMED` | 400 | Booking is already confirmed |
| `CANNOT_CONFIRM_CANCELLED` | 400 | Cannot confirm a cancelled booking |
| `CANNOT_CONFIRM_COMPLETED` | 400 | Cannot confirm a completed booking |
| `CANNOT_CONFIRM_PAST_SLOT` | 400 | Cannot confirm booking for past time slot |
| `SLOT_NOT_BOOKED` | 400 | Time slot is not in booked status |
| `CANNOT_ACCEPT_NON_PENDING` | 400 | Only pending bookings can be accepted |
| `CANNOT_REJECT_NON_PENDING` | 400 | Only pending bookings can be rejected |
| `ALREADY_CANCELLED` | 400 | Booking is already cancelled |
| `CANNOT_CANCEL_COMPLETED` | 400 | Cannot cancel completed booking |
| `CANNOT_CANCEL_PAST_SLOT` | 400 | Cannot cancel booking for past time slot |
| `SLOT_UPDATE_FAILED` | 500 | Failed to update time slot status |
| `SLOT_STATUS_UPDATE_FAILED` | 500 | Time slot status was not updated correctly |
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
    "timeSlotId": 5
  }'
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
// Frontend example - user booking flow
const timeSlotId = 5;

// 1. Create booking (status: pending)
const createResponse = await fetch('/api/v1/bookings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ timeSlotId })
});

const { data: booking } = await createResponse.json();
console.log(`Booking created: ${booking.id}, Status: ${booking.bookingStatus}, Price: PKR ${booking.finalPrice}`);

// 2. Get booking details
const detailsResponse = await fetch(`/api/v1/bookings/${booking.id}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data: bookingDetails } = await detailsResponse.json();
console.log(`Court: ${bookingDetails.court.name}`);
console.log(`Time: ${new Date(bookingDetails.timeSlot.startTime).toLocaleString()}`);
console.log(`Status: ${bookingDetails.bookingStatus}`); // Will be 'pending' until facility owner accepts

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
  "timeSlotId": 5,
  "finalPrice": 1500.00,
  "bookingStatus": "confirmed",
  "paymentReference": null,
  "cancellationReason": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### Field Descriptions

- **id**: Unique booking identifier
- **userId**: User ID who made the booking
- **timeSlotId**: Time slot ID being booked
- **finalPrice**: Final booking price in PKR (calculated automatically)
- **bookingStatus**: Booking status (`confirmed` for MVP)
- **paymentReference**: Payment transaction reference (null for MVP)
- **cancellationReason**: Reason for cancellation (if cancelled)
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

- **No Payment Process**: Bookings are created and confirmed immediately (MVP)
- **Slot Locking**: Backend prevents double booking using database transactions
- **Automatic Price Calculation**: Price calculated from court price × duration
- **Immediate Confirmation**: Booking status is `confirmed` upon creation
- **Cancellation Policy**: Users can cancel if time slot hasn't started
- **Time Slot Release**: Cancelled bookings automatically release the time slot
- **Ownership Validation**: Users can only view/cancel their own bookings
- All timestamps are in ISO 8601 format (UTC)

---

## Related Documentation

- [API Architecture](./API_ARCHITECTURE.md) - Overall API design
- [MVP Full Roadmap](./MVP_FULL_ROADMAP.md) - Complete MVP implementation plan
- [Booking Model](../MODELS/Booking.md) - Database model documentation
- [TimeSlot API Guide](./TIMESLOT_API_GUIDE.md) - Time slot endpoints
- [User API Guide](./USER_API_GUIDE.md) - User endpoints (includes GET /users/bookings)
- [Court API Guide](./COURT_API_GUIDE.md) - Court endpoints

---

**Last Updated:** 2025-01-15

