# 📅 Availability API Guide

Complete guide for Availability API endpoints in SportsArena. This API provides dynamic availability generation using a rule-based system (no pre-created time slots).

**Base URL:** `/api/v1/courts/:id/availability`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
4. [Request/Response Examples](#requestresponse-examples)
5. [Error Handling](#error-handling)
6. [Time Format](#time-format)
7. [Pagination & Date Ranges](#pagination--date-ranges)
8. [Testing](#testing)

---

## Overview

The Availability API generates court availability dynamically from availability rules. Unlike traditional slot-based systems, this API:

- **Generates slots on-demand** from availability rules
- **No pre-created slots** - slots are computed in real-time
- **Rule-based** - Availability defined by day-of-week rules
- **Flexible durations** - Supports any duration (30 min, 90 min, 2.5 hours, etc.)
- **Real-time accuracy** - Always reflects current bookings and blocks

### Key Concepts

- **Availability Rules**: Court availability defined by day-of-week and time ranges
- **Base Blocks**: 30-minute granularity blocks generated from rules
- **Filtered Blocks**: Base blocks minus bookings and blocked time ranges
- **Duration-Based Slots**: Composed from filtered blocks for specific durations
- **Time Normalization**: All times represented as minutes since midnight (0-1439)

### System Architecture

```
Availability Rules → Base Blocks (30-min) → Filter (remove bookings/blocks) → Compose (duration-based slots)
```

---

## Authentication

Most availability endpoints are **public** (no authentication required) to allow users to browse availability. However, some endpoints may require authentication for admin operations.

**Public Endpoints:**
- `GET /courts/:id/availability` - Get availability for a date
- `GET /courts/:id/availability/range` - Get availability for date range
- `GET /courts/:id/availability/slots` - Get duration-based slots

**Protected Endpoints:**
- `GET /courts/:id/availability/rules` - View availability rules (admin)
- `POST /courts/:id/availability/rules` - Create availability rule (admin)
- `PUT /courts/:id/availability/rules/:ruleId` - Update availability rule (admin)
- `DELETE /courts/:id/availability/rules/:ruleId` - Delete availability rule (admin)

For protected endpoints, include JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### 1. Get Availability for Single Date

Get available time blocks for a court on a specific date.

**Endpoint:** `GET /api/v1/courts/:id/availability`

**Parameters:**
- `id` (path) - Court ID
- `date` (query, required) - Date in YYYY-MM-DD format
- `includeBookings` (query, optional) - Include booking information (default: false)
- `duration` (query, optional) - Compose slots for specific duration in minutes (e.g., 90, 150)

**Response:** 200 OK

```json
{
  "success": true,
  "data": {
    "courtId": 5,
    "date": "2024-01-15",
    "dayOfWeek": 1,
    "policy": {
      "maxAdvanceBookingDays": 30,
      "minBookingDurationMinutes": 30,
      "maxBookingDurationMinutes": 480
    },
    "blocks": [
      {
        "startTime": 600,
        "endTime": 630,
        "startTimeFormatted": "10:00",
        "endTimeFormatted": "10:30"
      },
      {
        "startTime": 630,
        "endTime": 660,
        "startTimeFormatted": "10:30",
        "endTimeFormatted": "11:00"
      }
    ],
    "bookings": [],
    "blockedRanges": [],
    "metadata": {
      "totalBlocks": 16,
      "totalHoursAvailable": 8.0,
      "requestedDuration": null
    }
  }
}
```

**With Duration Composition:**

Request: `GET /api/v1/courts/5/availability?date=2024-01-15&duration=90`

Response includes `slots` array:

```json
{
  "success": true,
  "data": {
    "courtId": 5,
    "date": "2024-01-15",
    "blocks": [...],
    "slots": [
      {
        "startTime": 600,
        "endTime": 690,
        "startTimeFormatted": "10:00",
        "endTimeFormatted": "11:30",
        "durationMinutes": 90
      },
      {
        "startTime": 630,
        "endTime": 720,
        "startTimeFormatted": "10:30",
        "endTimeFormatted": "12:00",
        "durationMinutes": 90
      }
    ],
    "metadata": {
      "requestedDuration": 90,
      "slotsGenerated": 12
    }
  }
}
```

---

### 2. Get Availability for Date Range

Get availability for multiple dates (e.g., 7 days for pagination).

**Endpoint:** `GET /api/v1/courts/:id/availability/range`

**Parameters:**
- `id` (path) - Court ID
- `startDate` (query, required) - Start date in YYYY-MM-DD format
- `endDate` (query, required) - End date in YYYY-MM-DD format
- `duration` (query, optional) - Compose slots for specific duration in minutes
- `includeBookings` (query, optional) - Include booking information (default: false)

**Response:** 200 OK

```json
{
  "success": true,
  "data": {
    "courtId": 5,
    "dateRange": {
      "startDate": "2024-01-15",
      "endDate": "2024-01-21"
    },
    "availability": [
      {
        "date": "2024-01-15",
        "dayOfWeek": 1,
        "dayName": "Monday",
        "blocks": [
          {
            "startTime": 600,
            "endTime": 630,
            "startTimeFormatted": "10:00",
            "endTimeFormatted": "10:30"
          }
        ],
        "slots": [],
        "totalHoursAvailable": 8.0,
        "totalBlocks": 16
      },
      {
        "date": "2024-01-16",
        "dayOfWeek": 2,
        "dayName": "Tuesday",
        "blocks": [...],
        "slots": [],
        "totalHoursAvailable": 6.0,
        "totalBlocks": 12
      }
      // ... 5 more days
    ],
    "metadata": {
      "totalDays": 7,
      "requestedDuration": null
    }
  }
}
```

**With Duration Composition:**

Request: `GET /api/v1/courts/5/availability/range?startDate=2024-01-15&endDate=2024-01-21&duration=90`

Each date object in `availability` array includes `slots` array with duration-based slots.

---

### 3. Get Duration-Based Slots

Get composed slots for a specific duration from available blocks.

**Endpoint:** `GET /api/v1/courts/:id/availability/slots`

**Parameters:**
- `id` (path) - Court ID
- `date` (query, required) - Date in YYYY-MM-DD format
- `duration` (query, required) - Duration in minutes (must be multiple of 30)
- `multipleDurations` (query, optional) - Comma-separated list of durations (e.g., "90,120,150")

**Response:** 200 OK

```json
{
  "success": true,
  "data": {
    "courtId": 5,
    "date": "2024-01-15",
    "slots": [
      {
        "startTime": 600,
        "endTime": 690,
        "startTimeFormatted": "10:00",
        "endTimeFormatted": "11:30",
        "durationMinutes": 90
      },
      {
        "startTime": 630,
        "endTime": 720,
        "startTimeFormatted": "10:30",
        "endTimeFormatted": "12:00",
        "durationMinutes": 90
      }
    ],
    "metadata": {
      "requestedDuration": 90,
      "slotsGenerated": 12,
      "totalFreeBlocks": 16
    }
  }
}
```

**Multiple Durations:**

Request: `GET /api/v1/courts/5/availability/slots?date=2024-01-15&multipleDurations=90,120,150`

Response:

```json
{
  "success": true,
  "data": {
    "courtId": 5,
    "date": "2024-01-15",
    "slotsByDuration": {
      "90": [
        {
          "startTime": 600,
          "endTime": 690,
          "startTimeFormatted": "10:00",
          "endTimeFormatted": "11:30",
          "durationMinutes": 90
        }
      ],
      "120": [
        {
          "startTime": 600,
          "endTime": 720,
          "startTimeFormatted": "10:00",
          "endTimeFormatted": "12:00",
          "durationMinutes": 120
        }
      ],
      "150": [
        {
          "startTime": 600,
          "endTime": 750,
          "startTimeFormatted": "10:00",
          "endTimeFormatted": "12:30",
          "durationMinutes": 150
        }
      ]
    },
    "metadata": {
      "requestedDurations": [90, 120, 150],
      "totalSlotsGenerated": 25
    }
  }
}
```

---

### 4. Get Availability Rules (Admin)

Get all availability rules for a court.

**Endpoint:** `GET /api/v1/courts/:id/availability/rules`

**Authentication:** Required (Facility Admin)

**Parameters:**
- `id` (path) - Court ID
- `dayOfWeek` (query, optional) - Filter by day of week (0=Sunday, 6=Saturday)
- `isActive` (query, optional) - Filter by active status (default: true)

**Response:** 200 OK

```json
{
  "success": true,
  "data": {
    "courtId": 5,
    "rules": [
      {
        "id": 1,
        "courtId": 5,
        "dayOfWeek": 1,
        "dayName": "Monday",
        "startTime": 540,
        "endTime": 1080,
        "startTimeFormatted": "09:00",
        "endTimeFormatted": "18:00",
        "pricePerHourOverride": null,
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "metadata": {
      "totalRules": 7
    }
  }
}
```

---

### 5. Create Availability Rule (Admin)

Create a new availability rule for a court.

**Endpoint:** `POST /api/v1/courts/:id/availability/rules`

**Authentication:** Required (Facility Admin)

**Request Body:**

```json
{
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "18:00",
  "pricePerHourOverride": null
}
```

**Fields:**
- `dayOfWeek` (number, required) - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
- `startTime` (string, required) - Start time in HH:MM format (e.g., "09:00")
- `endTime` (string, required) - End time in HH:MM format (e.g., "18:00")
- `pricePerHourOverride` (number, optional) - Override court price for this rule

**Response:** 201 Created

```json
{
  "success": true,
  "message": "Availability rule created successfully",
  "data": {
    "id": 1,
    "courtId": 5,
    "dayOfWeek": 1,
    "dayName": "Monday",
    "startTime": 540,
    "endTime": 1080,
    "startTimeFormatted": "09:00",
    "endTimeFormatted": "18:00",
    "pricePerHourOverride": null,
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### 6. Update Availability Rule (Admin)

Update an existing availability rule.

**Endpoint:** `PUT /api/v1/courts/:id/availability/rules/:ruleId`

**Authentication:** Required (Facility Admin)

**Parameters:**
- `id` (path) - Court ID
- `ruleId` (path) - Availability rule ID

**Request Body:**

```json
{
  "startTime": "10:00",
  "endTime": "20:00",
  "pricePerHourOverride": 2000,
  "isActive": true
}
```

**Response:** 200 OK

```json
{
  "success": true,
  "message": "Availability rule updated successfully",
  "data": {
    "id": 1,
    "courtId": 5,
    "dayOfWeek": 1,
    "startTime": 600,
    "endTime": 1200,
    "startTimeFormatted": "10:00",
    "endTimeFormatted": "20:00",
    "pricePerHourOverride": 2000,
    "isActive": true,
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

### 7. Delete Availability Rule (Admin)

Delete (deactivate) an availability rule.

**Endpoint:** `DELETE /api/v1/courts/:id/availability/rules/:ruleId`

**Authentication:** Required (Facility Admin)

**Parameters:**
- `id` (path) - Court ID
- `ruleId` (path) - Availability rule ID

**Response:** 200 OK

```json
{
  "success": true,
  "message": "Availability rule deleted successfully"
}
```

**Note:** This typically soft-deletes (sets `isActive` to false) rather than hard-deleting.

---

## Request/Response Examples

### Example 1: Get Today's Availability

**Request:**
```
GET /api/v1/courts/5/availability?date=2024-01-15
```

**Response:**
```json
{
  "success": true,
  "data": {
    "courtId": 5,
    "date": "2024-01-15",
    "dayOfWeek": 1,
    "blocks": [
      {
        "startTime": 600,
        "endTime": 630,
        "startTimeFormatted": "10:00",
        "endTimeFormatted": "10:30"
      },
      {
        "startTime": 630,
        "endTime": 660,
        "startTimeFormatted": "10:30",
        "endTimeFormatted": "11:00"
      }
    ],
    "metadata": {
      "totalBlocks": 16,
      "totalHoursAvailable": 8.0
    }
  }
}
```

---

### Example 2: Get 7-Day Availability Range

**Request:**
```
GET /api/v1/courts/5/availability/range?startDate=2024-01-15&endDate=2024-01-21
```

**Response:**
```json
{
  "success": true,
  "data": {
    "courtId": 5,
    "dateRange": {
      "startDate": "2024-01-15",
      "endDate": "2024-01-21"
    },
    "availability": [
      {
        "date": "2024-01-15",
        "dayOfWeek": 1,
        "dayName": "Monday",
        "blocks": [...],
        "totalHoursAvailable": 8.0
      },
      {
        "date": "2024-01-16",
        "dayOfWeek": 2,
        "dayName": "Tuesday",
        "blocks": [...],
        "totalHoursAvailable": 6.0
      }
      // ... 5 more days
    ]
  }
}
```

---

### Example 3: Get 90-Minute Slots

**Request:**
```
GET /api/v1/courts/5/availability/slots?date=2024-01-15&duration=90
```

**Response:**
```json
{
  "success": true,
  "data": {
    "courtId": 5,
    "date": "2024-01-15",
    "slots": [
      {
        "startTime": 600,
        "endTime": 690,
        "startTimeFormatted": "10:00",
        "endTimeFormatted": "11:30",
        "durationMinutes": 90
      },
      {
        "startTime": 630,
        "endTime": 720,
        "startTimeFormatted": "10:30",
        "endTimeFormatted": "12:00",
        "durationMinutes": 90
      }
    ],
    "metadata": {
      "requestedDuration": 90,
      "slotsGenerated": 12
    }
  }
}
```

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "errorCode": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Error Code | Status | Description |
|-----------|--------|-------------|
| `COURT_NOT_FOUND` | 404 | Court does not exist |
| `INVALID_DATE` | 400 | Invalid date format or past date |
| `DATE_TOO_FAR_ADVANCE` | 400 | Date exceeds maximum advance booking window |
| `INVALID_DURATION` | 400 | Duration must be multiple of 30 minutes |
| `NO_AVAILABILITY_RULES` | 404 | No availability rules configured for this court |
| `INVALID_TIME_RANGE` | 400 | Start time must be before end time |
| `OVERLAPPING_RULE` | 409 | Availability rule overlaps with existing rule |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Facility admin access required |

### Error Examples

**404 Court Not Found:**
```json
{
  "success": false,
  "error": "Court not found",
  "errorCode": "COURT_NOT_FOUND"
}
```

**400 Invalid Date:**
```json
{
  "success": false,
  "error": "Date exceeds maximum advance booking window (30 days)",
  "errorCode": "DATE_TOO_FAR_ADVANCE"
}
```

**400 Invalid Duration:**
```json
{
  "success": false,
  "error": "Duration must be a multiple of 30 minutes",
  "errorCode": "INVALID_DURATION"
}
```

---

## Time Format

### Time Representation

All times are represented as **minutes since midnight** (0-1439):
- `0` = 00:00 (midnight)
- `600` = 10:00 (10 AM)
- `1440` = 24:00 (next midnight)

### Time Formatting

Responses include both:
- **Raw format**: `startTime: 600` (minutes since midnight)
- **Formatted format**: `startTimeFormatted: "10:00"` (HH:MM string)

### Time Conversion

**Frontend can convert:**
- Minutes → HH:MM: `Math.floor(minutes / 60) + ':' + (minutes % 60).toString().padStart(2, '0')`
- HH:MM → Minutes: `parseInt(hours) * 60 + parseInt(minutes)`

---

## Pagination & Date Ranges

### 7-Day Pagination Flow

**Initial Load:**
1. Frontend calculates: `startDate = today`, `endDate = today + 6 days`
2. Request: `GET /courts/5/availability/range?startDate=2024-01-15&endDate=2024-01-21`
3. Backend returns availability for all 7 days

**Next 7 Days:**
1. Frontend calculates: `startDate = lastDate + 1`, `endDate = startDate + 6 days`
2. Request: `GET /courts/5/availability/range?startDate=2024-01-22&endDate=2024-01-28`
3. Backend returns next 7 days

**Previous 7 Days:**
1. Frontend calculates: `endDate = firstDate - 1`, `startDate = endDate - 6 days`
2. Request: `GET /courts/5/availability/range?startDate=2024-01-08&endDate=2024-01-14`
3. Backend returns previous 7 days

### Date Range Limits

- **Maximum range**: Typically 30 days (configurable per facility)
- **Past dates**: Automatically filtered out
- **Future dates**: Limited by `max_advance_booking_days` policy

---

## Testing

### Using cURL

**Get availability for single date:**
```bash
curl -X GET "http://localhost:3000/api/v1/courts/5/availability?date=2024-01-15"
```

**Get availability for date range:**
```bash
curl -X GET "http://localhost:3000/api/v1/courts/5/availability/range?startDate=2024-01-15&endDate=2024-01-21"
```

**Get 90-minute slots:**
```bash
curl -X GET "http://localhost:3000/api/v1/courts/5/availability/slots?date=2024-01-15&duration=90"
```

**Create availability rule (admin):**
```bash
curl -X POST "http://localhost:3000/api/v1/courts/5/availability/rules" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 1,
    "startTime": "09:00",
    "endTime": "18:00"
  }'
```

### Using Postman

1. **Collection Setup:**
   - Base URL: `http://localhost:3000/api/v1`
   - Add authentication token to collection variables

2. **Test Cases:**
   - Get availability for today
   - Get 7-day range
   - Get duration-based slots
   - Create/update/delete availability rules (admin)

---

## Related Documentation

- [Booking API Guide](./BOOKING_API_GUIDE.md) - Create bookings from available slots
- [Court API Guide](./COURT_API_GUIDE.md) - Court management
- [Rule-Based Availability Architecture](../Architecture/RULE_BASED_AVAILABILITY_ARCHITECTURE.md) - System architecture
- [Time Normalization Architecture](../Architecture/TIME_NORMALIZATION_ARCHITECTURE.md) - Time handling

---

**Last Updated:** 2025-01-15

