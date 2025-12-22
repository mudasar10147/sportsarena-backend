# 📚 Facility API Guide

Complete guide for Facility API endpoints in SportsArena MVP.

**Base URL:** `/api/v1/facilities`

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

The Facility API handles facility listing, details retrieval, creation, and updates. Facilities represent sports venues where users can book courts. All endpoints follow REST API conventions and return consistent JSON responses.

### Key Features

- **Public Access**: Listing and viewing facilities (no authentication required)
- **Filtering**: By city, sport, and location (radius-based search)
- **Pagination**: For large result sets
- **Protected Operations**: Creating and updating facilities require facility_admin role

---

## Authentication

Most endpoints are **public** (no authentication required). However:
- **POST** `/facilities` - Requires authentication + `facility_admin` role
- **PUT** `/facilities/:id` - Requires authentication + `facility_admin` role (must be owner)

For protected endpoints, include JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. List All Facilities

**`GET /api/v1/facilities`**

Retrieve a paginated list of all active facilities with optional filtering.

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
| `radiusKm` | number | No | Radius in kilometers for location search |

**Note:** For location-based search, all three parameters (`latitude`, `longitude`, `radiusKm`) must be provided together.

#### Example Requests

```
GET /api/v1/facilities
GET /api/v1/facilities?city=Karachi&page=1&limit=20
GET /api/v1/facilities?sportId=1&page=1&limit=10
GET /api/v1/facilities?latitude=24.8607&longitude=67.0011&radiusKm=5
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
        "tuesday": { "open": "09:00", "close": "22:00" },
        "sunday": null
      },
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z",
      "distanceKm": 2.5
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

**Note:** `distanceKm` is only included when using location-based search.

---

### 2. Get Facility Details

**`GET /api/v1/facilities/:id`**

Get detailed information about a specific facility, including its courts and available sports.

**Authentication:** Not required (public endpoint)

#### URL Parameters

- `id` (number, required): Facility ID

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Facility details retrieved successfully",
  "data": {
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
      "tuesday": { "open": "09:00", "close": "22:00" },
      "sunday": null
    },
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z",
    "courts": [
      {
        "id": 1,
        "facilityId": 1,
        "sportId": 1,
        "name": "Court 1",
        "description": "Indoor court with premium flooring",
        "pricePerHour": 1500.00,
        "isIndoor": true,
        "isActive": true,
        "createdAt": "2025-01-15T10:35:00.000Z",
        "updatedAt": "2025-01-15T10:35:00.000Z"
      }
    ],
    "sports": [
      {
        "id": 1,
        "name": "Padel",
        "description": "Racquet sport",
        "iconUrl": "https://example.com/padel-icon.png"
      }
    ]
  }
}
```

#### Error Responses

**404 Not Found**
```json
{
  "success": false,
  "message": "Facility not found",
  "error_code": "FACILITY_NOT_FOUND"
}
```

---

### 3. Create Facility

**`POST /api/v1/facilities`**

Create a new facility. Only users with `facility_admin` role can create facilities.

**Authentication:** Required (facility_admin role)

#### Request Body

```json
{
  "name": "Elite Sports Center",
  "address": "Plot, next to DHA security office, Block M Phase 5 D.H.A, Lahore, 54000, Pakistan",
  "description": "Premium padel sports facility featuring 3 state-of-the-art courts, a modern food court, and Bellinturf. Recently opened, with 1 black court and 2 blue courts, designed for an exceptional playing experience.",
  "city": "Karachi",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "contactPhone": "+923357754999",
  "contactEmail": "info@acepadel.com",
  "photos": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg"
  ],
  "openingHours": {
    "monday": { "open": "09:00", "close": "22:00" },
    "tuesday": { "open": "09:00", "close": "22:00" },
    "wednesday": { "open": "09:00", "close": "22:00" },
    "thursday": { "open": "09:00", "close": "22:00" },
    "friday": { "open": "09:00", "close": "22:00" },
    "saturday": { "open": "09:00", "close": "22:00" },
    "sunday": null
  }
}
```

**Required Fields:**
- `name` (string): Facility name
- `address` (string): Full address

**Optional Fields:**
- `description` (string): Facility description
- `city` (string): City name
- `latitude` (number): Latitude coordinate (-90 to 90)
- `longitude` (number): Longitude coordinate (-180 to 180)
- `contactPhone` (string): Contact phone number
- `contactEmail` (string): Contact email
- `photos` (array): Array of photo URLs (3-5 photos recommended)
- `openingHours` (object): Opening hours by day

**Opening Hours Format:**
```json
{
  "monday": { "open": "09:00", "close": "22:00" },
  "tuesday": { "open": "09:00", "close": "22:00" },
  "sunday": null  // Closed
}
```

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Facility created successfully",
  "data": {
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
      "monday": { "open": "09:00", "close": "22:00" }
    },
    "isActive": true,
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
  "message": "Name and address are required",
  "error_code": "VALIDATION_ERROR"
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

**403 Forbidden - Insufficient Permissions**
```json
{
  "success": false,
  "message": "Access denied. Required role: facility_admin. Your role: player",
  "error_code": "FORBIDDEN"
}
```

---

### 4. Update Facility

**`PUT /api/v1/facilities/:id`**

Update facility details. Only the facility owner (facility_admin) can update their facilities.

**Authentication:** Required (facility_admin role, must be owner)

#### URL Parameters

- `id` (number, required): Facility ID

#### Request Body

All fields are optional. Only include fields you want to update:

```json
{
  "name": "Updated Facility Name",
  "description": "Updated description",
  "contactPhone": "+923009876543",
  "photos": [
    "https://example.com/new-photo1.jpg",
    "https://example.com/new-photo2.jpg"
  ],
  "openingHours": {
    "monday": { "open": "10:00", "close": "23:00" }
  }
}
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Facility updated successfully",
  "data": {
    "id": 1,
    "name": "Updated Facility Name",
    "description": "Updated description",
    "address": "123 Sports Street, Karachi",
    "city": "Karachi",
    "latitude": 24.8607,
    "longitude": 67.0011,
    "contactPhone": "+923009876543",
    "contactEmail": "info@elitesports.com",
    "ownerId": 5,
    "photos": [
      "https://example.com/new-photo1.jpg",
      "https://example.com/new-photo2.jpg"
    ],
    "openingHours": {
      "monday": { "open": "10:00", "close": "23:00" }
    },
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "At least one field must be provided for update",
  "error_code": "VALIDATION_ERROR"
}
```

**403 Forbidden - Not Owner**
```json
{
  "success": false,
  "message": "You can only update your own facilities",
  "error_code": "FORBIDDEN"
}
```

**404 Not Found**
```json
{
  "success": false,
  "message": "Facility not found",
  "error_code": "FACILITY_NOT_FOUND"
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
| `FACILITY_NOT_FOUND` | 404 | Facility does not exist |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions or not owner |
| `UPDATE_FAILED` | 500 | Failed to update facility |

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

#### List Facilities
```bash
curl -X GET "http://localhost:3000/api/v1/facilities?city=Karachi&page=1&limit=10"
```

#### List Facilities by Sport
```bash
curl -X GET "http://localhost:3000/api/v1/facilities?sportId=1&page=1&limit=10"
```

#### Location-Based Search
```bash
curl -X GET "http://localhost:3000/api/v1/facilities?latitude=24.8607&longitude=67.0011&radiusKm=5"
```

#### Get Facility Details
```bash
curl -X GET http://localhost:3000/api/v1/facilities/1
```

#### Create Facility
```bash
curl -X POST http://localhost:3000/api/v1/facilities \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Elite Sports Center",
    "address": "123 Sports Street, Karachi",
    "city": "Karachi",
    "latitude": 24.8607,
    "longitude": 67.0011,
    "contactPhone": "+923001234567",
    "photos": ["https://example.com/photo1.jpg"]
  }'
```

#### Update Facility
```bash
curl -X PUT http://localhost:3000/api/v1/facilities/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Facility Name",
    "contactPhone": "+923009876543"
  }'
```

### Using Postman/Insomnia

1. **Public Endpoints**: No authentication needed
2. **Protected Endpoints**: Add `Authorization` header with value `Bearer <token>`
3. **Query Parameters**: Add filters in URL for GET requests
4. **Request Body**: Use JSON format for POST/PUT requests

---

## Data Format Notes

### Photos
Array of URL strings (3-5 photos recommended for MVP):
```json
[
  "https://example.com/photo1.jpg",
  "https://example.com/photo2.jpg",
  "https://example.com/photo3.jpg"
]
```

### Opening Hours
Object with day keys. Each day can have `open` and `close` times, or `null` if closed:
```json
{
  "monday": { "open": "09:00", "close": "22:00" },
  "tuesday": { "open": "09:00", "close": "22:00" },
  "wednesday": { "open": "09:00", "close": "22:00" },
  "thursday": { "open": "09:00", "close": "22:00" },
  "friday": { "open": "09:00", "close": "22:00" },
  "saturday": { "open": "09:00", "close": "22:00" },
  "sunday": null
}
```

Time format: `HH:MM` in 24-hour format.

### Coordinates
- **Latitude**: Decimal number between -90 and 90
- **Longitude**: Decimal number between -180 and 180

---

## Notes

- Facilities use soft delete (`is_active` flag)
- Only active facilities are returned in listings (unless explicitly filtered)
- Location-based search uses Haversine formula for distance calculation
- Facility owner is automatically set to the authenticated user creating the facility
- Photos are stored as URLs (not binary) for MVP simplicity
- All timestamps are in ISO 8601 format (UTC)

---

## Related Documentation

- [API Architecture](./API_ARCHITECTURE.md) - Overall API design
- [MVP Full Roadmap](./MVP_FULL_ROADMAP.md) - Complete MVP implementation plan
- [Facility Model](../MODELS/Facility.md) - Database model documentation
- [User API Guide](./USER_API_GUIDE.md) - User authentication endpoints

---

**Last Updated:** 2025-01-15

