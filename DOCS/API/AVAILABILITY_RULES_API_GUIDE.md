# 📚 Availability Rules API Guide

Complete guide for Availability Rules API endpoints in SportsArena MVP.

**Base URL:** `/api/v1/courts/:id/availability/rules`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
4. [Request/Response Examples](#requestresponse-examples)
5. [Error Handling](#error-handling)
6. [Time Format](#time-format)
7. [Testing](#testing)

---

## Overview

The Availability Rules API allows facility owners to manage availability rules for their courts. Availability rules define when a court is available by day of the week and time ranges.

### Key Concepts

- **Rule-Based Availability**: Availability is defined by rules (day of week + time range), not pre-created slots
- **Day of Week**: Rules apply to specific days (0=Sunday, 1=Monday, ..., 6=Saturday)
- **Time Ranges**: Rules define start and end times (stored as minutes since midnight)
- **Automatic Creation**: Rules are automatically created when a court is created (based on facility opening hours)
- **Manual Management**: Facility owners can edit, add, or delete rules as needed

### Automatic Rule Creation

When a court is created, availability rules are **automatically generated** based on the facility's opening hours. Facility owners can then edit these rules using the API endpoints described below.

---

## Authentication

**All endpoints require:**
- Authentication (JWT token)
- `facility_admin` role
- Facility ownership (must own the facility that owns the court)

Include JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Get Availability Rules for a Court

**`GET /api/v1/courts/:id/availability/rules`**

Retrieve all availability rules for a specific court.

**Authentication:** Required (facility_admin role + facility ownership)

#### URL Parameters

- `id` (number, required): Court ID

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isActive` | boolean | No | Filter by active status (default: all rules) |

#### Example Requests

```
GET /api/v1/courts/1/availability/rules
GET /api/v1/courts/1/availability/rules?isActive=true
GET /api/v1/courts/1/availability/rules?isActive=false
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Availability rules retrieved successfully",
  "data": [
    {
      "id": 1,
      "courtId": 1,
      "dayOfWeek": 1,
      "dayName": "Monday",
      "startTime": 540,
      "endTime": 1080,
      "startTimeFormatted": "09:00",
      "endTimeFormatted": "18:00",
      "isActive": true,
      "pricePerHourOverride": null,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "courtId": 1,
      "dayOfWeek": 2,
      "dayName": "Tuesday",
      "startTime": 540,
      "endTime": 1080,
      "startTimeFormatted": "09:00",
      "endTimeFormatted": "18:00",
      "isActive": true,
      "pricePerHourOverride": null,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
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

**403 Forbidden - Not Facility Owner**
```json
{
  "success": false,
  "message": "You can only view availability rules for courts in your own facilities",
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

### 2. Create Availability Rule

**`POST /api/v1/courts/:id/availability/rules`**

Create a new availability rule for a court.

**Authentication:** Required (facility_admin role + facility ownership)

#### URL Parameters

- `id` (number, required): Court ID

#### Request Body

You can provide times in two formats:
1. **Formatted time strings** (recommended): `"09:00"`, `"18:00"`
2. **Minutes since midnight** (advanced): `540`, `1080`

**Using Formatted Time Strings (Recommended):**
```json
{
  "dayOfWeek": 1,
  "startTimeFormatted": "09:00",
  "endTimeFormatted": "18:00",
  "isActive": true,
  "pricePerHourOverride": null
}
```

**Using Minutes Since Midnight:**
```json
{
  "dayOfWeek": 1,
  "startTime": 540,
  "endTime": 1080,
  "isActive": true,
  "pricePerHourOverride": null
}
```

**Required Fields:**
- `dayOfWeek` (number): Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
- `startTime` OR `startTimeFormatted`: Start time
- `endTime` OR `endTimeFormatted`: End time

**Optional Fields:**
- `isActive` (boolean): Whether rule is active (default: `true`)
- `pricePerHourOverride` (number|null): Override price for this time range (default: `null` = use court's default price)

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Availability rule created successfully",
  "data": {
    "id": 1,
    "courtId": 1,
    "dayOfWeek": 1,
    "dayName": "Monday",
    "startTime": 540,
    "endTime": 1080,
    "startTimeFormatted": "09:00",
    "endTimeFormatted": "18:00",
    "isActive": true,
    "pricePerHourOverride": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "Day of week is required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Time Format**
```json
{
  "success": false,
  "message": "Invalid start time format: Invalid time format: 25:00. Expected HH:MM",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Time Range**
```json
{
  "success": false,
  "message": "End time must be after start time",
  "error_code": "VALIDATION_ERROR"
}
```

**409 Conflict - Rule Already Exists**
```json
{
  "success": false,
  "message": "An availability rule with the same day, start time, and end time already exists",
  "error_code": "RULE_CONFLICT"
}
```

---

### 3. Update Availability Rule

**`PUT /api/v1/courts/:id/availability/rules/:ruleId`**

Update an existing availability rule. Only include fields you want to update.

**Authentication:** Required (facility_admin role + facility ownership)

#### URL Parameters

- `id` (number, required): Court ID
- `ruleId` (number, required): Rule ID

#### Request Body

All fields are optional. Only include fields you want to update:

```json
{
  "dayOfWeek": 1,
  "startTimeFormatted": "10:00",
  "endTimeFormatted": "20:00",
  "isActive": true,
  "pricePerHourOverride": 2000.00
}
```

**Optional Fields:**
- `dayOfWeek` (number): Updated day of week (0-6)
- `startTime` OR `startTimeFormatted`: Updated start time
- `endTime` OR `endTimeFormatted`: Updated end time
- `isActive` (boolean): Whether rule is active
- `pricePerHourOverride` (number|null): Updated price override (use `null` to remove override)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Availability rule updated successfully",
  "data": {
    "id": 1,
    "courtId": 1,
    "dayOfWeek": 1,
    "dayName": "Monday",
    "startTime": 600,
    "endTime": 1200,
    "startTimeFormatted": "10:00",
    "endTimeFormatted": "20:00",
    "isActive": true,
    "pricePerHourOverride": 2000.00,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - No Fields Provided**
```json
{
  "success": false,
  "message": "At least one field must be provided for update",
  "error_code": "VALIDATION_ERROR"
}
```

**404 Not Found - Rule Not Found**
```json
{
  "success": false,
  "message": "Availability rule not found",
  "error_code": "RULE_NOT_FOUND"
}
```

---

### 4. Delete Availability Rule

**`DELETE /api/v1/courts/:id/availability/rules/:ruleId`**

Delete an availability rule for a court.

**Authentication:** Required (facility_admin role + facility ownership)

#### URL Parameters

- `id` (number, required): Court ID
- `ruleId` (number, required): Rule ID

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Availability rule deleted successfully",
  "data": null
}
```

#### Error Responses

**404 Not Found - Rule Not Found**
```json
{
  "success": false,
  "message": "Availability rule not found",
  "error_code": "RULE_NOT_FOUND"
}
```

---

## Time Format

### Day of Week Values

| Value | Day |
|-------|-----|
| `0` | Sunday |
| `1` | Monday |
| `2` | Tuesday |
| `3` | Wednesday |
| `4` | Thursday |
| `5` | Friday |
| `6` | Saturday |

### Time Representation

Times can be provided in two formats:

1. **Formatted Time String** (recommended): `"HH:MM"` format
   - Example: `"09:00"`, `"18:00"`, `"14:30"`
   - Use `startTimeFormatted` and `endTimeFormatted` fields

2. **Minutes Since Midnight** (advanced): Integer (0-1439)
   - Example: `540` (09:00), `1080` (18:00), `870` (14:30)
   - Use `startTime` and `endTime` fields

### Quick Time Conversion

| Time String | Minutes Since Midnight |
|-------------|------------------------|
| 00:00       | 0                      |
| 09:00       | 540                    |
| 10:00       | 600                    |
| 12:00       | 720                    |
| 14:00       | 840                    |
| 14:30       | 870                    |
| 18:00       | 1080                   |
| 20:00       | 1200                   |
| 23:59       | 1439                   |

**Formula:** `minutes = (hours × 60) + minutes`

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
| `RULE_NOT_FOUND` | 404 | Availability rule does not exist |
| `RULE_CONFLICT` | 409 | Rule with same day/time already exists |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Not facility owner or insufficient permissions |
| `UPDATE_FAILED` | 500 | Failed to update rule |
| `DELETE_FAILED` | 500 | Failed to delete rule |

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid input or validation error
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions or not facility owner
- `404 Not Found`: Resource not found
- `409 Conflict`: Rule conflict (duplicate rule)
- `500 Internal Server Error`: Server error

---

## Testing

### Using cURL

#### Get Availability Rules
```bash
curl -X GET http://localhost:3000/api/v1/courts/1/availability/rules \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Active Rules Only
```bash
curl -X GET "http://localhost:3000/api/v1/courts/1/availability/rules?isActive=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Create Availability Rule (Using Formatted Times)
```bash
curl -X POST http://localhost:3000/api/v1/courts/1/availability/rules \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 1,
    "startTimeFormatted": "09:00",
    "endTimeFormatted": "18:00",
    "isActive": true
  }'
```

#### Create Availability Rule (Using Minutes)
```bash
curl -X POST http://localhost:3000/api/v1/courts/1/availability/rules \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 1,
    "startTime": 540,
    "endTime": 1080,
    "isActive": true
  }'
```

#### Update Availability Rule
```bash
curl -X PUT http://localhost:3000/api/v1/courts/1/availability/rules/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startTimeFormatted": "10:00",
    "endTimeFormatted": "20:00"
  }'
```

#### Delete Availability Rule
```bash
curl -X DELETE http://localhost:3000/api/v1/courts/1/availability/rules/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using Postman/Insomnia

1. **Authentication**: Add `Authorization` header with value `Bearer <token>` for all requests
2. **URL Parameters**: Replace `:id` and `:ruleId` with actual court ID and rule ID
3. **Request Body**: Use JSON format for POST/PUT requests
4. **Content-Type**: Set to `application/json` for POST/PUT requests

---

## Usage Examples

### Creating Rules for Weekdays

```javascript
// Frontend example - create rules for Monday to Friday
const courtId = 1;
const weekdays = [1, 2, 3, 4, 5]; // Monday to Friday

for (const dayOfWeek of weekdays) {
  await fetch(`/api/v1/courts/${courtId}/availability/rules`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      dayOfWeek,
      startTimeFormatted: '09:00',
      endTimeFormatted: '18:00',
      isActive: true
    })
  });
}
```

### Updating Weekend Hours

```javascript
// Frontend example - update Saturday and Sunday to longer hours
const courtId = 1;
const weekendDays = [0, 6]; // Sunday and Saturday

for (const dayOfWeek of weekendDays) {
  // First, get existing rules for the day
  const response = await fetch(
    `/api/v1/courts/${courtId}/availability/rules?isActive=true`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  const { data: rules } = await response.json();
  
  const dayRule = rules.find(r => r.dayOfWeek === dayOfWeek);
  if (dayRule) {
    // Update to extended hours
    await fetch(`/api/v1/courts/${courtId}/availability/rules/${dayRule.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startTimeFormatted: '08:00',
        endTimeFormatted: '22:00'
      })
    });
  }
}
```

### Disabling Rules Temporarily

```javascript
// Frontend example - temporarily disable all rules (e.g., for maintenance)
const courtId = 1;
const response = await fetch(
  `/api/v1/courts/${courtId}/availability/rules`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const { data: rules } = await response.json();

// Disable all active rules
for (const rule of rules.filter(r => r.isActive)) {
  await fetch(`/api/v1/courts/${courtId}/availability/rules/${rule.id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      isActive: false
    })
  });
}
```

---

## Data Format Notes

### Availability Rule Object Structure

```json
{
  "id": 1,
  "courtId": 1,
  "dayOfWeek": 1,
  "dayName": "Monday",
  "startTime": 540,
  "endTime": 1080,
  "startTimeFormatted": "09:00",
  "endTimeFormatted": "18:00",
  "isActive": true,
  "pricePerHourOverride": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### Field Descriptions

- **id**: Unique rule identifier
- **courtId**: Court ID this rule belongs to
- **dayOfWeek**: Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
- **dayName**: Human-readable day name (e.g., "Monday")
- **startTime**: Start time in minutes since midnight (0-1439)
- **endTime**: End time in minutes since midnight (0-1439)
- **startTimeFormatted**: Start time formatted as "HH:MM" (e.g., "09:00")
- **endTimeFormatted**: End time formatted as "HH:MM" (e.g., "18:00")
- **isActive**: Whether rule is active
- **pricePerHourOverride**: Optional price override for this time range (null = use court default)
- **createdAt**: Creation timestamp (ISO 8601)
- **updatedAt**: Last update timestamp (ISO 8601)

---

## Notes

- **Automatic Rule Creation**: When a court is created, availability rules are automatically generated based on the facility's opening hours
- **Rule Conflicts**: You cannot create duplicate rules (same court, day, start time, and end time)
- **Price Override**: Use `pricePerHourOverride` to set different prices for specific time ranges (e.g., peak hours)
- **Active Status**: Use `isActive: false` to temporarily disable rules without deleting them
- **Time Validation**: End time must be after start time (no midnight crossover support in MVP)
- All timestamps are in ISO 8601 format (UTC)
- Rules are sorted by day of week and start time in listings

---

## Related Documentation

- [Court API Guide](./COURT_API_GUIDE.md) - Court management endpoints
- [Availability API Guide](./AVAILABILITY_API_GUIDE.md) - Availability query endpoints
- [Setting Up Availability Rules](../Guides/SETUP_AVAILABILITY_RULES.md) - Manual setup guide
- [Rule-Based Availability Architecture](../Architecture/RULE_BASED_AVAILABILITY_ARCHITECTURE.md) - System architecture

---

**Last Updated:** 2025-01-15

