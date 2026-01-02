# Explore Page API Guide

Complete API reference for the Explore Page implementation.

**Base URL:** `/api/v1`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Existing Endpoints](#existing-endpoints)
3. [New Endpoints](#new-endpoints)
4. [Response Formats](#response-formats)
5. [Frontend Integration](#frontend-integration)

---

## Overview

The Explore Page requires the following API endpoints:

1. ✅ **GET /facilities** - List facilities with filters (already exists)
2. ✅ **GET /sports** - List sports for filter dropdown (already exists)
3. ❌ **GET /facilities/cities** - List unique cities (needs to be created)

---

## Existing Endpoints

### 1. List Facilities ✅

**`GET /api/v1/facilities`**

Retrieve paginated list of facilities with filtering support.

**Authentication:** Not required (public endpoint)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 10, max: 100) |
| `city` | string | No | Filter by city name |
| `sportId` | number | No | Filter by sport ID |
| `latitude` | number | No | Latitude for location-based search |
| `longitude` | number | No | Longitude for location-based search |
| `radiusKm` | number | No | Radius in kilometers (required with lat/lng) |
| `date` | string | No | Date for availability check (YYYY-MM-DD format) |
| `startTime` | string | No | Start time for availability check (HH:MM format) |
| `endTime` | string | No | End time for availability check (HH:MM format) |

**Notes:**
- For location-based search, all three parameters (`latitude`, `longitude`, `radiusKm`) must be provided together.
- For availability filtering, all three parameters (`date`, `startTime`, `endTime`) must be provided together.
- Availability filter only returns facilities that have at least one court available for the specified time slot.

#### Example Requests

```bash
# Get all facilities (page 1)
GET /api/v1/facilities?page=1&limit=20

# Filter by city
GET /api/v1/facilities?city=Karachi&page=1&limit=20

# Filter by sport
GET /api/v1/facilities?sportId=1&page=1&limit=20

# Location-based search (within 5km)
GET /api/v1/facilities?latitude=24.8607&longitude=67.0011&radiusKm=5&page=1&limit=20

# Combined filters
GET /api/v1/facilities?city=Karachi&sportId=1&page=1&limit=20

# Filter by availability (Dec 31, 2025 from 1pm to 4pm)
GET /api/v1/facilities?date=2025-12-31&startTime=13:00&endTime=16:00&page=1&limit=20

# Combined: City, Sport, and Availability
GET /api/v1/facilities?city=Karachi&sportId=1&date=2025-12-31&startTime=13:00&endTime=16:00&page=1&limit=20
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Facilities retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Elite Sports Center",
      "description": "Premium sports facility with multiple courts",
      "address": "123 Sports Street, Karachi",
      "city": "Karachi",
      "latitude": 24.8607,
      "longitude": 67.0011,
      "contactPhone": "+923001234567",
      "contactEmail": "info@elitesports.com",
      "ownerId": 5,
      "photos": [
        "https://example.com/photo1.jpg",
        "https://example.com/photo2.jpg"
      ],
      "openingHours": {
        "monday": { "open": "09:00", "close": "22:00" },
        "tuesday": { "open": "09:00", "close": "22:00" }
      },
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z",
      "minPricePerHour": 1500.00,
      "sports": [
        {
          "id": 1,
          "name": "Padel"
        },
        {
          "id": 2,
          "name": "Tennis"
        }
      ],
      "distanceKm": 2.5,
      "availableCourtsCount": 3
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Response with Availability Filter:**
When using `date`, `startTime`, and `endTime` parameters, the response includes `availableCourtsCount`:

```json
{
  "success": true,
  "message": "Facilities retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Elite Sports Center",
      "minPricePerHour": 1500.00,
      "sports": [...],
      "availableCourtsCount": 3
    }
  ],
  "pagination": {...}
}
```

**Response Fields:**
- `minPricePerHour` - Minimum price from all active courts (null if no courts)
- `sports` - Array of sports offered by facility (empty array if none)
- `distanceKm` - Distance in kilometers (only included when using location search)
- `availableCourtsCount` - Number of courts available for the requested time slot (only included when using availability filter)

---

### 2. List Sports ✅

**`GET /api/v1/sports`**

Retrieve list of all active sports for filter dropdown.

**Authentication:** Not required (public endpoint)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isActive` | boolean | No | Filter by active status (default: true) |

#### Example Request

```bash
GET /api/v1/sports?isActive=true
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Sports retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Padel",
      "description": "Racquet sport",
      "iconUrl": "https://example.com/padel-icon.png",
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "name": "Tennis",
      "description": "Classic racquet sport",
      "iconUrl": "https://example.com/tennis-icon.png",
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

## New Endpoints

### 3. List Cities ❌ (Needs Implementation)

**`GET /api/v1/facilities/cities`**

Retrieve list of unique cities where facilities exist. Used for city filter dropdown.

**Authentication:** Not required (public endpoint)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isActive` | boolean | No | Only include cities with active facilities (default: true) |

#### Example Request

```bash
GET /api/v1/facilities/cities?isActive=true
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Cities retrieved successfully",
  "data": [
    {
      "city": "Karachi",
      "facilityCount": 15
    },
    {
      "city": "Lahore",
      "facilityCount": 8
    },
    {
      "city": "Islamabad",
      "facilityCount": 5
    }
  ]
}
```

**Response Fields:**
- `city` - City name (string)
- `facilityCount` - Number of active facilities in this city (number)

**Note:** Cities are sorted alphabetically by name.

---

## Response Formats

### Pagination Format

All paginated endpoints return pagination metadata:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Error Format

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error_code": "ERROR_CODE"
}
```

---

## Frontend Integration

### Filter Mapping

| Frontend Filter | API Parameter | Endpoint |
|----------------|---------------|----------|
| Sport | `sportId` | `GET /facilities` |
| City | `city` | `GET /facilities` |
| Location | `latitude`, `longitude`, `radiusKm` | `GET /facilities` |
| Availability | `date`, `startTime`, `endTime` | `GET /facilities` |
| Price | ❌ Not in API | Client-side filtering on `minPricePerHour` |

### Implementation Notes

1. **Price Filter**: Not supported by API. Filter client-side using `minPricePerHour` field.

2. **Availability Filter**: ✅ **Now supported by API!**
   - Provide `date` (YYYY-MM-DD), `startTime` (HH:MM), and `endTime` (HH:MM)
   - API checks availability rules, bookings, and blocked time ranges
   - Only returns facilities with at least one available court
   - Response includes `availableCourtsCount` field

3. **Sports List**: Use `GET /sports` to populate sport filter dropdown.

4. **Cities List**: Use `GET /facilities/cities` to populate city filter dropdown.

5. **Pagination**: Use `pagination.hasNextPage` to determine if more results are available.

### Example Frontend Code

```dart
// Load facilities with filters
final response = await facilitiesRepository.getFacilities(
  page: currentPage,
  limit: 20,
  city: selectedCity,
  sportId: selectedSportId,
  latitude: userLatitude,
  longitude: userLongitude,
  radiusKm: searchRadius,
);

// Load sports for filter dropdown
final sports = await sportsRepository.getAllSports(isActive: true);

// Load cities for filter dropdown
final cities = await apiClient.get('/facilities/cities?isActive=true');
```

---

## Missing Features

The following features are **not** supported by the API and should be handled client-side:

1. **Price Range Filtering**: Filter facilities by `minPricePerHour` in frontend
2. **Rating Display**: API doesn't include rating field (remove from UI or add to API)

---

**Last Updated:** 2025-01-15

