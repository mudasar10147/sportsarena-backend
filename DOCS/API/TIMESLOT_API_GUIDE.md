# 📚 TimeSlot API Guide

Complete guide for TimeSlot API endpoints in SportsArena MVP.

**Base URLs:**
- `/api/v1/courts/:id/timeslots` (nested routes)
- `/api/v1/timeslots/:id` (standalone route)

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

The TimeSlot API manages available booking slots for courts. **Time slots are automatically generated** based on facility opening hours, eliminating the need for manual creation.

### Key Concepts

- **Automatic Generation**: Slots are created automatically based on facility opening hours
- **Time Slots**: Specific time periods (start time to end time) for court availability
- **Status**: `available`, `blocked`, or `booked`
- **30-Day Window**: Shows available slots for up to 30 days from today
- **Auto-Maintenance**: System automatically maintains 30 days of slots ahead
- **Admin Control**: Facility owners can block/unblock slots (not create manually)

### How It Works

1. **Facility Setup**: Admin sets opening hours for the facility
2. **Court Creation**: When a new court is created, slots are **automatically generated** (if opening hours exist)
3. **Existing Courts**: For existing courts without slots, use bulk generation (see [Bulk Generation](#3-generate-slots-for-all-courts))
4. **User Booking**: Users book from available slots
5. **Admin Management**: Admins block/unblock slots as needed

### Automatic vs Manual Generation

- **New Courts**: Slots are automatically generated when a court is created (if facility has opening hours)
- **Existing Courts**: Use bulk generation endpoint to generate slots for all courts in a facility
- **Individual Courts**: Can still generate slots for a specific court if needed

### Status Values

- **`available`**: Slot is available for booking
- **`blocked`**: Slot is blocked (e.g., maintenance, private event)
- **`booked`**: Slot is already booked by a user

---

## Authentication

- **GET** `/courts/:id/timeslots` - Public (no authentication required)
- **POST** `/courts/:id/timeslots` - **DEPRECATED** - Use slot generation instead (see [Slot Generation](#2-generate-time-slots-automatically))
- **POST** `/courts/:id/generate-slots` - Generate slots for a specific court (facility admin)
- **POST** `/facilities/:id/generate-slots` - Generate slots for all courts in a facility (facility admin) - **Useful for existing courts**
- **PUT** `/timeslots/:id` - Requires authentication + `facility_admin` role + facility ownership (for blocking/unblocking)

For protected endpoints, include JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Get Available Time Slots for a Court

**`GET /api/v1/courts/:id/timeslots`**

Retrieve all available time slots for a court up to 30 days from today.

**Authentication:** Not required (public endpoint)

**Important Notes:**
- Slots are always capped at **30 days from today**, regardless of `fromDate`
- If `fromDate` is more than 30 days in the future, no slots will be returned
- If `fromDate` is in the past, slots from today onwards will be returned
- The system automatically generates slots if less than 25 days of slots remain

#### URL Parameters

- `id` (number, required): Court ID

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromDate` | string | No | Start date (ISO 8601 format). Defaults to current date/time. Maximum: 30 days from today |
| `duration` | number | No | Duration in hours. Must be in 0.5-hour increments (0.5, 1, 1.5, 2, 2.5, 3, etc.). Default: 1 hour. Minimum: 0.5 hours (30 minutes) |

#### Example Requests

```
GET /api/v1/courts/1/timeslots
GET /api/v1/courts/1/timeslots?fromDate=2025-01-20T00:00:00Z
GET /api/v1/courts/1/timeslots?fromDate=2025-01-20T00:00:00Z&duration=1
GET /api/v1/courts/1/timeslots?duration=2
GET /api/v1/courts/1/timeslots?duration=0.5
GET /api/v1/courts/1/timeslots?fromDate=2025-01-20T00:00:00Z&duration=2
```

**Duration Examples:**
- `duration=0.5` - Show only 30-minute slots
- `duration=1` - Show only 1-hour slots (default)
- `duration=1.5` - Show only 1.5-hour slots
- `duration=2` - Show only 2-hour slots
- `duration=2.5` - Show only 2.5-hour slots
- `duration=3` - Show only 3-hour slots

**Note:** Duration must be in 0.5-hour increments (0.5, 1, 1.5, 2, 2.5, 3, etc.). Invalid values like `1.2` or `2.3` will return an error.

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Time slots retrieved successfully",
  "data": [
    {
      "id": 1,
      "courtId": 1,
      "startTime": "2025-01-15T10:00:00.000Z",
      "endTime": "2025-01-15T11:00:00.000Z",
      "status": "available",
      "createdAt": "2025-01-15T09:00:00.000Z",
      "updatedAt": "2025-01-15T09:00:00.000Z"
    },
    {
      "id": 2,
      "courtId": 1,
      "startTime": "2025-01-15T11:00:00.000Z",
      "endTime": "2025-01-15T12:00:00.000Z",
      "status": "available",
      "createdAt": "2025-01-15T09:00:00.000Z",
      "updatedAt": "2025-01-15T09:00:00.000Z"
    },
    {
      "id": 3,
      "courtId": 1,
      "startTime": "2025-01-16T10:00:00.000Z",
      "endTime": "2025-01-16T11:00:00.000Z",
      "status": "available",
      "createdAt": "2025-01-15T09:00:00.000Z",
      "updatedAt": "2025-01-15T09:00:00.000Z"
    }
  ]
}
```

**Note:** 
- Only returns slots with `status: "available"` for the next 7 days from the specified date (or current date if not provided)
- Only returns slots that match the requested duration (default: 1 hour, minimum: 0.5 hours)
- Results are sorted by start time

#### Error Responses

**400 Bad Request - Invalid Court ID**
```json
{
  "success": false,
  "message": "Invalid court ID",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Duration (Too Short)**
```json
{
  "success": false,
  "message": "Invalid duration. Must be at least 0.5 hours (30 minutes)",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Duration (Not in 0.5-hour increments)**
```json
{
  "success": false,
  "message": "Invalid duration. Duration must be in 0.5-hour increments (0.5, 1, 1.5, 2, 2.5, 3, etc.)",
  "error_code": "VALIDATION_ERROR"
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

### 2. Generate Time Slots Automatically

**`POST /api/v1/courts/:id/generate-slots`**

Generate time slots automatically for a court based on facility opening hours. Creates slots for the next 7 days.

**Authentication:** Required (facility_admin role + facility ownership)

**Note:** This is the recommended way to create time slots. Manual slot creation is deprecated.

#### URL Parameters

- `id` (number, required): Court ID

#### Request Body

```json
{
  "slotDuration": 1
}
```

**Optional Fields:**
- `slotDuration` (number): Duration of each slot in hours. Must be in 0.5-hour increments (0.5, 1, 1.5, 2, etc.). Default: 1 hour

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Successfully generated 84 time slots for the next 7 days.",
  "data": {
    "count": 84,
    "message": "Successfully generated 84 time slots for the next 7 days."
  }
}
```

#### Error Responses

**400 Bad Request - No Opening Hours**
```json
{
  "success": false,
  "message": "Facility must have opening hours configured before generating slots",
  "error_code": "NO_OPENING_HOURS"
}
```

**400 Bad Request - Invalid Slot Duration**
```json
{
  "success": false,
  "message": "Slot duration must be in 0.5-hour increments (0.5, 1, 1.5, 2, etc.)",
  "error_code": "VALIDATION_ERROR"
}
```

**403 Forbidden - Not Facility Owner**
```json
{
  "success": false,
  "message": "You can only generate time slots for courts in your own facilities",
  "error_code": "FORBIDDEN"
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

### 3. Generate Time Slots for All Courts in a Facility

**`POST /api/v1/facilities/:id/generate-slots`**

Generate time slots automatically for **all active courts** in a facility. This is especially useful for:
- **Existing facilities** that were created before automatic slot generation
- **Facilities with multiple courts** that need slots generated at once
- **After updating opening hours** to regenerate slots for all courts

**Authentication:** Required (facility_admin role + facility ownership)

#### URL Parameters

- `id` (number, required): Facility ID

#### Request Body

```json
{
  "slotDuration": 1
}
```

**Optional Fields:**
- `slotDuration` (number): Duration of each slot in hours. Must be in 0.5-hour increments (0.5, 1, 1.5, 2, etc.). Default: 1 hour

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Generated 168 slots across 2 court(s)",
  "data": {
    "facilityId": 1,
    "facilityName": "Premium Sports Center",
    "totalCourts": 2,
    "totalSlotsGenerated": 168,
    "courts": [
      {
        "courtId": 1,
        "courtName": "Court 1",
        "slotsGenerated": 84,
        "message": "Successfully generated 84 time slots for the next 7 days."
      },
      {
        "courtId": 2,
        "courtName": "Court 2",
        "slotsGenerated": 84,
        "message": "Successfully generated 84 time slots for the next 7 days."
      }
    ],
    "message": "Generated 168 slots across 2 court(s)"
  }
}
```

#### Error Responses

**400 Bad Request - No Opening Hours**
```json
{
  "success": false,
  "message": "Facility must have opening hours configured before generating slots",
  "error_code": "NO_OPENING_HOURS"
}
```

**400 Bad Request - No Active Courts**
```json
{
  "success": false,
  "message": "No active courts found for this facility",
  "error_code": "NO_COURTS"
}
```

**403 Forbidden - Not Facility Owner**
```json
{
  "success": false,
  "message": "You can only generate time slots for courts in your own facilities",
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

**Note:** If some courts fail to generate slots, they will be included in the response with an error message, but the operation will continue for other courts.

---

### 4. Create Time Slot for a Court (DEPRECATED)

**`POST /api/v1/courts/:id/timeslots`**

⚠️ **This endpoint is deprecated.** Time slots should be automatically generated based on facility opening hours.

**Use Instead:**
- **POST** `/api/v1/courts/:id/generate-slots` - Generate slots automatically (see [Slot Generation](#2-generate-time-slots-automatically))

**Authentication:** Required (facility_admin role + facility ownership)

**Note:** Manual slot creation is not recommended. Use automatic slot generation and blocking/unblocking instead.

#### URL Parameters

- `id` (number, required): Court ID

#### Request Body

```json
{
  "startTime": "2025-01-15T10:00:00Z",
  "endTime": "2025-01-15T11:00:00Z",
  "status": "available"
}
```

**Required Fields:**
- `startTime` (string): Slot start time in ISO 8601 format (e.g., `2025-01-15T10:00:00Z`)
- `endTime` (string): Slot end time in ISO 8601 format (e.g., `2025-01-15T11:00:00Z`)

**Optional Fields:**
- `status` (string): Slot status - `available`, `blocked`, or `booked` (default: `available`)

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Time slot created successfully",
  "data": {
    "id": 1,
    "courtId": 1,
    "startTime": "2025-01-15T10:00:00.000Z",
    "endTime": "2025-01-15T11:00:00.000Z",
    "status": "available",
    "createdAt": "2025-01-15T09:00:00.000Z",
    "updatedAt": "2025-01-15T09:00:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "startTime and endTime are required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Date Format**
```json
{
  "success": false,
  "message": "Invalid date format. Use ISO 8601 format (e.g., 2025-01-15T10:00:00Z)",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Time Range**
```json
{
  "success": false,
  "message": "End time must be after start time",
  "error_code": "INVALID_TIME_RANGE"
}
```

**400 Bad Request - Invalid Status**
```json
{
  "success": false,
  "message": "Invalid status. Must be: available, blocked, or booked",
  "error_code": "INVALID_STATUS"
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

**403 Forbidden - Not Facility Owner**
```json
{
  "success": false,
  "message": "You can only add time slots to courts in your own facilities",
  "error_code": "FORBIDDEN"
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

### 5. Update Time Slot (Block/Unblock)

**`PUT /api/v1/timeslots/:id`**

Update time slot status to block or unblock slots. This is the primary way facility admins manage slot availability.

**Use Cases:**
- Block slot for maintenance
- Block slot for private event
- Unblock slot to make it available again

**Authentication:** Required (facility_admin role + facility ownership)

**Note:** Slots are automatically generated. Admins use this endpoint to block/unblock specific slots as needed.

#### URL Parameters

- `id` (number, required): Time slot ID

#### Request Body

```json
{
  "status": "blocked"
}
```

**Required Fields:**
- `status` (string): New status - `available`, `blocked`, or `booked`

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Time slot updated successfully",
  "data": {
    "id": 1,
    "courtId": 1,
    "startTime": "2025-01-15T10:00:00.000Z",
    "endTime": "2025-01-15T11:00:00.000Z",
    "status": "blocked",
    "createdAt": "2025-01-15T09:00:00.000Z",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

#### Common Use Cases

**Block a slot for maintenance:**
```json
{
  "status": "blocked"
}
```

**Unblock a slot (make it available again):**
```json
{
  "status": "available"
}
```

**Note:** Marking as `booked` is typically done automatically when a booking is confirmed.

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "Status is required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Status**
```json
{
  "success": false,
  "message": "Invalid status. Must be: available, blocked, or booked",
  "error_code": "INVALID_STATUS"
}
```

**403 Forbidden - Not Facility Owner**
```json
{
  "success": false,
  "message": "You can only update time slots for courts in your own facilities",
  "error_code": "FORBIDDEN"
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
| `COURT_NOT_FOUND` | 404 | Court does not exist |
| `TIME_SLOT_NOT_FOUND` | 404 | Time slot does not exist |
| `FACILITY_NOT_FOUND` | 404 | Facility does not exist |
| `INVALID_DATE` | 400 | Invalid date format |
| `INVALID_TIME_RANGE` | 400 | End time must be after start time |
| `INVALID_STATUS` | 400 | Invalid status value |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Not facility owner or insufficient permissions |
| `UPDATE_FAILED` | 500 | Failed to update time slot |

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid input or validation error
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions or not facility owner
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Testing

### Using cURL

#### Get Available Time Slots (Default: 1 hour)
```bash
curl -X GET http://localhost:3000/api/v1/courts/1/timeslots
```

#### Get Time Slots for 2 Hours Duration
```bash
curl -X GET "http://localhost:3000/api/v1/courts/1/timeslots?duration=2"
```

#### Get Time Slots for 1.5 Hours Duration
```bash
curl -X GET "http://localhost:3000/api/v1/courts/1/timeslots?duration=1.5"
```

#### Get Time Slots for 30 Minutes Duration
```bash
curl -X GET "http://localhost:3000/api/v1/courts/1/timeslots?duration=0.5"
```

#### Get Time Slots from Specific Date with Duration
```bash
curl -X GET "http://localhost:3000/api/v1/courts/1/timeslots?fromDate=2025-01-20T00:00:00Z&duration=2"
```

#### Generate Time Slots for a Specific Court
```bash
curl -X POST http://localhost:3000/api/v1/courts/1/generate-slots \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slotDuration": 1
  }'
```

#### Generate Time Slots for All Courts in a Facility (Bulk Generation)
```bash
curl -X POST http://localhost:3000/api/v1/facilities/1/generate-slots \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slotDuration": 1
  }'
```

**Use this for existing facilities that need slots generated for all their courts.**

#### Block Time Slot (Maintenance)
```bash
curl -X PUT http://localhost:3000/api/v1/timeslots/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "blocked"
  }'
```

#### Unblock Time Slot
```bash
curl -X PUT http://localhost:3000/api/v1/timeslots/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "available"
  }'
```

### Using Postman/Insomnia

1. **Public Endpoints**: No authentication needed for GET requests
2. **Protected Endpoints**: Add `Authorization` header with value `Bearer <token>` for POST/PUT requests
3. **URL Parameters**: Replace `:id` with actual court/time slot ID
4. **Request Body**: Use JSON format for POST/PUT requests
5. **Date Format**: Use ISO 8601 format for dates (e.g., `2025-01-15T10:00:00Z`)

---

## Usage Examples

### Getting Available Slots for Booking

When a user wants to book a court, fetch available slots with their preferred duration:

```javascript
// Frontend example - user selects 2-hour slot
const courtId = 1;
const duration = 2; // User wants 2-hour slot
const response = await fetch(`/api/v1/courts/${courtId}/timeslots?duration=${duration}`);
const { data: slots } = await response.json();

// Display available slots
slots.forEach(slot => {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);
  console.log(`${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`);
});
```

**Example with Duration Selection:**
```javascript
// Frontend example - user can select duration
const courtId = 1;
const userSelectedDuration = 0.5; // 30 minutes, 1 hour, or 2 hours

// Fetch slots matching the selected duration
const response = await fetch(`/api/v1/courts/${courtId}/timeslots?duration=${userSelectedDuration}`);
const { data: slots } = await response.json();

// Only slots matching the duration will be returned
console.log(`Found ${slots.length} slots of ${userSelectedDuration} hour(s)`);
```

### Automatic Slot Generation for New Courts

When a new court is created, slots are automatically generated (if facility has opening hours):

```javascript
// Frontend example - create court (slots auto-generated)
const facilityId = 1;
const response = await fetch(`/api/v1/facilities/${facilityId}/courts`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    sportId: 5,
    name: 'Court 1',
    pricePerHour: 1500,
    isIndoor: true
  })
});

// Slots are automatically generated in the background
// No need to call generate-slots separately
```

### Generating Slots for Existing Courts

For existing facilities that need slots generated:

```javascript
// Frontend example - generate slots for all courts in a facility
const facilityId = 1;
const slotDuration = 1; // 1-hour slots

const response = await fetch(`/api/v1/facilities/${facilityId}/generate-slots`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ slotDuration })
});

const { data } = await response.json();
console.log(`Generated ${data.totalSlotsGenerated} slots across ${data.totalCourts} courts`);
console.log('Per court:', data.courts);
```

**Note:** 
- New courts automatically get slots generated when created
- Use bulk generation for existing facilities
- Can regenerate slots if opening hours change

### Blocking Slots for Maintenance

Facility owners can block slots when maintenance is needed:

```javascript
// Frontend example - block a slot
const slotId = 1;
await fetch(`/api/v1/timeslots/${slotId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ status: 'blocked' })
});
```

---

## Data Format Notes

### TimeSlot Object Structure

```json
{
  "id": 1,
  "courtId": 1,
  "startTime": "2025-01-15T10:00:00.000Z",
  "endTime": "2025-01-15T11:00:00.000Z",
  "status": "available",
  "createdAt": "2025-01-15T09:00:00.000Z",
  "updatedAt": "2025-01-15T09:00:00.000Z"
}
```

### Field Descriptions

- **id**: Unique time slot identifier
- **courtId**: Court ID this slot belongs to
- **startTime**: Slot start time (ISO 8601 format)
- **endTime**: Slot end time (ISO 8601 format)
- **status**: Slot status (`available`, `blocked`, or `booked`)
- **createdAt**: Creation timestamp (ISO 8601)
- **updatedAt**: Last update timestamp (ISO 8601)

### Date/Time Format

All dates and times use **ISO 8601 format**:
- Example: `2025-01-15T10:00:00Z`
- Example: `2025-01-15T10:00:00+05:00` (with timezone)

### Status Values

- **`available`**: Slot is available for booking (default)
- **`blocked`**: Slot is blocked (maintenance, private event, etc.)
- **`booked`**: Slot is already booked (typically set automatically)

---

## Notes

- **Automatic Generation for New Courts**: When a new court is created, time slots are automatically generated for the next 30 days (if facility has opening hours configured)
- **Bulk Generation for Existing Courts**: Use `POST /facilities/:id/generate-slots` to generate slots for all courts in an existing facility
- **Automatic Slot Maintenance**: The system automatically maintains slots for the next 30 days
  - When fetching slots, if less than 25 days of slots remain, the system automatically generates new slots
  - This ensures slots are always available without manual intervention
  - Auto-generation only happens if the facility has opening hours configured
  - If auto-generation fails, the system returns existing slots (doesn't break the API)
- **30-Day Window**: Slots are always capped at 30 days from today
  - If `fromDate` is more than 30 days in the future, no slots are returned
  - If `fromDate` is day 15 and you request slots, you'll get slots from day 15 to day 30 (not beyond)
  - Example: Requesting slots for day 32 will return empty (max is day 30)
- **Manual Creation Deprecated**: Manual slot creation is deprecated - use automatic generation instead
- Only available slots are returned in GET endpoint (up to 30 days from today)
- **Duration Filtering**: Users can filter slots by duration
  - Allowed values: 0.5, 1, 1.5, 2, 2.5, 3, etc. (increments of 0.5 hours)
  - Default duration: 1 hour
  - Minimum duration: 0.5 hours (30 minutes)
  - Only slots matching the requested duration are returned
  - Invalid durations (e.g., 1.2, 2.3) will return validation error
- **Admin Management**: Facility admins block/unblock slots (not create manually)
- Time slots are sorted by start time in responses
- All timestamps are in ISO 8601 format (UTC)
- Status changes are logged via `updatedAt` timestamp
- **Automatic Slot Blocking**: When a booking is created, the time slot status is automatically updated to `'booked'` to prevent double booking
- **Opening Hours Required**: Facility must have opening hours configured before generating slots
- **Slot Lifecycle**: 
  - Slots are generated for the next 30 days from today
  - As days pass, slots automatically regenerate to maintain 30 days ahead
  - No manual intervention needed once initial setup is complete

---

## Troubleshooting

### Issue: "No slots generated. Check facility opening hours configuration."

This error means the facility doesn't have valid opening hours configured. Here's how to fix it:

#### Step 1: Check Current Opening Hours

```bash
GET /api/v1/facilities/1
```

Look at the `openingHours` field in the response. It should look like:
```json
{
  "openingHours": {
    "monday": { "open": "09:00", "close": "22:00" },
    "tuesday": { "open": "09:00", "close": "22:00" },
    "wednesday": { "open": "09:00", "close": "22:00" },
    "thursday": { "open": "09:00", "close": "22:00" },
    "friday": { "open": "09:00", "close": "22:00" },
    "saturday": { "open": "10:00", "close": "20:00" },
    "sunday": null  // Closed
  }
}
```

#### Step 2: Update Opening Hours (if missing or incorrect)

```bash
PUT /api/v1/facilities/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "openingHours": {
    "monday": { "open": "09:00", "close": "22:00" },
    "tuesday": { "open": "09:00", "close": "22:00" },
    "wednesday": { "open": "09:00", "close": "22:00" },
    "thursday": { "open": "09:00", "close": "22:00" },
    "friday": { "open": "09:00", "close": "22:00" },
    "saturday": { "open": "10:00", "close": "20:00" },
    "sunday": null
  }
}
```

#### Step 3: Generate Slots Again

```bash
POST /api/v1/facilities/1/generate-slots
Authorization: Bearer <token>
{
  "slotDuration": 0.5
}
```

### Common Issues

1. **Empty opening hours**: `openingHours: {}` - Add opening hours for at least one day
2. **Wrong format**: Times must be in `"HH:MM"` format (e.g., `"09:00"`, not `"9:00"` or `9`)
3. **All days closed**: All days set to `null` - Configure at least one day
4. **Case sensitivity**: Day names must be lowercase: `"monday"`, not `"Monday"` or `"MONDAY"`

---

## Related Documentation

- [Slot Generation Guide](./SLOT_GENERATION_GUIDE.md) - **Automatic slot generation based on opening hours**
- [API Architecture](./API_ARCHITECTURE.md) - Overall API design
- [MVP Full Roadmap](./MVP_FULL_ROADMAP.md) - Complete MVP implementation plan
- [TimeSlot Model](../MODELS/TimeSlot.md) - Database model documentation
- [Court API Guide](./COURT_API_GUIDE.md) - Court endpoints
- [Facility API Guide](./FACILITY_API_GUIDE.md) - Facility endpoints

---

**Last Updated:** 2025-01-15

