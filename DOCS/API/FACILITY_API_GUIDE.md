# 📚 Facility API Guide

Complete guide for Facility API endpoints in SportsArena MVP.

**Base URL:** `/api/v1/facilities`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
4. [Amenities](#amenities)
5. [Images](#images)
6. [Request/Response Examples](#requestresponse-examples)
7. [Error Handling](#error-handling)
8. [Testing](#testing)

---

## Overview

The Facility API handles facility listing, details retrieval, creation, and updates. Facilities represent sports venues where users can book courts. All endpoints follow REST API conventions and return consistent JSON responses.

### Key Features

- **Public Access**: Listing and viewing facilities (no authentication required)
- **Filtering**: By city, sport, and location (radius-based search)
- **Pagination**: For large result sets
- **Protected Operations**: Creating and updating facilities require facility_admin role
- **Amenities**: Support for up to 8 facility features (parking, wifi, etc.)
- **Images**: Cover image + up to 10 gallery images via S3 upload

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
      "address": "123 Sports Street, Lahore",
      "city": "Lahore",
      "latitude": 31.5204,
      "longitude": 74.3587,
      "contactPhone": "+923001234567",
      "contactEmail": "info@elitesports.com",
      "ownerId": 5,
      "amenities": ["parking", "wifi", "restroom", "lighting"],
      "openingHours": {
        "monday": { "open": "09:00", "close": "22:00" },
        "tuesday": { "open": "09:00", "close": "22:00" },
        "sunday": null
      },
      "coverImage": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "url": "https://cdn.example.com/facilities/1/cover.jpg",
        "variants": {
          "thumb": "https://cdn.example.com/facilities/1/thumb/cover.jpg",
          "medium": "https://cdn.example.com/facilities/1/medium/cover.jpg",
          "full": "https://cdn.example.com/facilities/1/full/cover.jpg"
        }
      },
      "isActive": true,
      "createdAt": "2025-01-20T10:30:00.000Z",
      "updatedAt": "2025-01-20T10:30:00.000Z",
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

**Notes:**
- `distanceKm` is only included when using location-based search
- `coverImage` is included for each facility (null if no cover image uploaded)
- List endpoints include cover image only; use Get Details for full gallery

---

### 2. Get Closest Arenas

**`GET /api/v1/facilities/closest`**

Retrieve the closest arenas (facilities) to a given location based on latitude and longitude coordinates. Results are paginated, returning 7 facilities per page (default), with a maximum of 28 total facilities (4 pages).

**Authentication:** Not required (public endpoint)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `latitude` | number | Yes | Latitude coordinate (-90 to 90) |
| `longitude` | number | Yes | Longitude coordinate (-180 to 180) |
| `page` | number | No | Page number (default: 1, max: 4) |
| `limit` | number | No | Number of facilities per page (default: 7) |

**Pagination Details:**
- Default: 7 facilities per page
- Maximum total facilities: 28 (across all pages)
- Maximum pages: 4 (when using default limit of 7)
- Results are ordered by distance (closest first)

#### Example Requests

```
GET /api/v1/facilities/closest?latitude=24.8607&longitude=67.0011
GET /api/v1/facilities/closest?latitude=24.8607&longitude=67.0011&page=1
GET /api/v1/facilities/closest?latitude=24.8607&longitude=67.0011&page=2
GET /api/v1/facilities/closest?latitude=24.8607&longitude=67.0011&page=1&limit=7
```

#### Success Response (200 OK)

**Page 1 Example:**
```json
{
  "success": true,
  "message": "Closest arenas retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Elite Sports Center",
      "description": "Premium sports facility with multiple courts",
      "address": "123 Sports Street, Lahore",
      "city": "Lahore",
      "latitude": 31.5204,
      "longitude": 74.3587,
      "contactPhone": "+923001234567",
      "contactEmail": "info@elitesports.com",
      "ownerId": 5,
      "amenities": ["parking", "wifi", "restroom", "lighting"],
      "openingHours": {
        "monday": { "open": "06:00", "close": "23:00" },
        "tuesday": { "open": "06:00", "close": "23:00" }
      },
      "coverImage": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "url": "https://cdn.example.com/facilities/1/cover.jpg",
        "variants": {
          "thumb": "https://cdn.example.com/facilities/1/thumb/cover.jpg",
          "medium": "https://cdn.example.com/facilities/1/medium/cover.jpg",
          "full": "https://cdn.example.com/facilities/1/full/cover.jpg"
        }
      },
      "isActive": true,
      "createdAt": "2025-01-20T10:30:00.000Z",
      "updatedAt": "2025-01-20T10:30:00.000Z",
      "distanceKm": 0.5,
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
      ]
    },
    {
      "id": 2,
      "name": "Ace Padel",
      "description": "Modern padel facility",
      "address": "456 Game Avenue, Lahore",
      "city": "Lahore",
      "latitude": 31.5300,
      "longitude": 74.3600,
      "contactPhone": "+923009876543",
      "contactEmail": "info@acepadel.com",
      "ownerId": 6,
      "amenities": ["parking", "wifi", "lighting"],
      "openingHours": {},
      "coverImage": null,
      "isActive": true,
      "createdAt": "2025-01-20T11:00:00.000Z",
      "updatedAt": "2025-01-20T11:00:00.000Z",
      "distanceKm": 1.2,
      "minPricePerHour": 2000.00,
      "sports": [
        {
          "id": 1,
          "name": "Padel"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 7,
    "total": 28,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Page 2 Example:**
```json
{
  "success": true,
  "message": "Closest arenas retrieved successfully",
  "data": [
    {
      "id": 8,
      "name": "Sports Hub",
      "distanceKm": 3.5,
      ...
    },
    ...
  ],
  "pagination": {
    "page": 2,
    "limit": 7,
    "total": 28,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

**Notes:** 
- Results are ordered by distance (closest first)
- `distanceKm` shows the distance in kilometers from the provided coordinates
- Only active facilities with valid coordinates are included
- The response includes `minPricePerHour`, `sports`, and `coverImage` for each facility
- `coverImage` is null if no cover image has been uploaded
- Maximum of 28 facilities total will be returned across all pages
- Use the `page` parameter to get the next set of facilities

#### Error Responses

**400 Bad Request - Missing Parameters**
```json
{
  "success": false,
  "message": "Both latitude and longitude are required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Coordinates**
```json
{
  "success": false,
  "message": "Invalid latitude. Must be between -90 and 90",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Page Exceeds Maximum**
```json
{
  "success": false,
  "message": "Page number exceeds maximum. Maximum page is 4 (28 total facilities)",
  "error_code": "VALIDATION_ERROR"
}
```

---

### 3. Get Facility Details

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
    "address": "123 Sports Street, Lahore",
    "city": "Lahore",
    "latitude": 31.5204,
    "longitude": 74.3587,
    "contactPhone": "+923001234567",
    "contactEmail": "info@elitesports.com",
    "ownerId": 5,
    "amenities": ["parking", "wifi", "restroom", "cafeteria", "lighting", "water", "seating", "pro_shop"],
    "openingHours": {
      "monday": { "open": "06:00", "close": "23:00" },
      "tuesday": { "open": "06:00", "close": "23:00" },
      "sunday": { "open": "08:00", "close": "22:00" }
    },
    "coverImage": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://cdn.example.com/facilities/1/cover.jpg",
      "variants": {
        "thumb": "https://cdn.example.com/facilities/1/thumb/cover.jpg",
        "medium": "https://cdn.example.com/facilities/1/medium/cover.jpg",
        "full": "https://cdn.example.com/facilities/1/full/cover.jpg"
      }
    },
    "galleryImages": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "url": "https://cdn.example.com/facilities/1/gallery-1.jpg",
        "variants": {
          "thumb": "https://cdn.example.com/facilities/1/thumb/gallery-1.jpg",
          "medium": "https://cdn.example.com/facilities/1/medium/gallery-1.jpg",
          "full": "https://cdn.example.com/facilities/1/full/gallery-1.jpg"
        },
        "displayOrder": 0
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "url": "https://cdn.example.com/facilities/1/gallery-2.jpg",
        "variants": {
          "thumb": "https://cdn.example.com/facilities/1/thumb/gallery-2.jpg",
          "medium": "https://cdn.example.com/facilities/1/medium/gallery-2.jpg",
          "full": "https://cdn.example.com/facilities/1/full/gallery-2.jpg"
        },
        "displayOrder": 1
      }
    ],
    "isActive": true,
    "createdAt": "2025-01-20T10:30:00.000Z",
    "updatedAt": "2025-01-20T10:30:00.000Z",
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
        "createdAt": "2025-01-20T10:35:00.000Z",
        "updatedAt": "2025-01-20T10:35:00.000Z"
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

**Notes:**
- `coverImage` contains the facility's cover image (null if not uploaded)
- `galleryImages` contains up to 10 gallery images sorted by display order
- Each image includes `variants` with thumbnail, medium, and full-size URLs

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

### 4. Create Facility

**`POST /api/v1/facilities`**

Create a new facility. Only users with `facility_admin` role can create facilities.

**Authentication:** Required (facility_admin role)

#### Request Body

```json
{
  "name": "Elite Sports Center",
  "address": "Plot, next to DHA security office, Block M Phase 5 D.H.A, Lahore, 54000, Pakistan",
  "description": "Premium padel sports facility featuring 3 state-of-the-art courts, a modern food court, and Bellinturf.",
  "city": "Lahore",
  "latitude": 31.5204,
  "longitude": 74.3587,
  "contactPhone": "+923357754999",
  "contactEmail": "info@elitesports.com",
  "amenities": ["parking", "wifi", "restroom", "cafeteria", "lighting", "water", "seating", "pro_shop"],
  "openingHours": {
    "monday": { "open": "06:00", "close": "23:00" },
    "tuesday": { "open": "06:00", "close": "23:00" },
    "wednesday": { "open": "06:00", "close": "23:00" },
    "thursday": { "open": "06:00", "close": "23:00" },
    "friday": { "open": "06:00", "close": "23:00" },
    "saturday": { "open": "08:00", "close": "22:00" },
    "sunday": { "open": "08:00", "close": "22:00" }
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
- `amenities` (array): Array of amenity strings (max 8) - see [Amenities](#amenities) section
- `openingHours` (object): Opening hours by day

**Note:** Images (cover and gallery) should be uploaded separately after facility creation using the Image Upload API. See [Images](#images) section.

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
    "address": "123 Sports Street, Lahore",
    "city": "Lahore",
    "latitude": 31.5204,
    "longitude": 74.3587,
    "contactPhone": "+923001234567",
    "contactEmail": "info@elitesports.com",
    "ownerId": 5,
    "photos": [],
    "amenities": ["parking", "wifi", "restroom", "cafeteria", "lighting", "water", "seating", "pro_shop"],
    "openingHours": {
      "monday": { "open": "06:00", "close": "23:00" }
    },
    "isActive": true,
    "createdAt": "2025-01-20T10:30:00.000Z",
    "updatedAt": "2025-01-20T10:30:00.000Z"
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

**400 Bad Request - Invalid Amenities**
```json
{
  "success": false,
  "message": "Invalid amenities: swimming_pool. Valid options: parking, wifi, restroom, cafeteria, lighting, water, seating, pro_shop, locker_room, shower, air_conditioning, first_aid, equipment_rental, coaching, spectator_area, wheelchair_accessible",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Too Many Amenities**
```json
{
  "success": false,
  "message": "Maximum 8 amenities allowed",
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

### 5. Update Facility

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
  "amenities": ["parking", "wifi", "restroom", "lighting"],
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
    "address": "123 Sports Street, Lahore",
    "city": "Lahore",
    "latitude": 31.5204,
    "longitude": 74.3587,
    "contactPhone": "+923009876543",
    "contactEmail": "info@elitesports.com",
    "ownerId": 5,
    "photos": [],
    "amenities": ["parking", "wifi", "restroom", "lighting"],
    "openingHours": {
      "monday": { "open": "10:00", "close": "23:00" }
    },
    "isActive": true,
    "createdAt": "2025-01-20T10:30:00.000Z",
    "updatedAt": "2025-01-20T11:00:00.000Z"
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

## Amenities

Facilities can have up to **8 amenities** that describe available features and services.

### Valid Amenities

| Value | Description |
|-------|-------------|
| `parking` | Parking available |
| `wifi` | WiFi connectivity |
| `restroom` | Restroom facilities |
| `cafeteria` | Food and beverage service |
| `lighting` | Court/facility lighting |
| `water` | Drinking water available |
| `seating` | Seating area for spectators |
| `pro_shop` | Pro shop for equipment |
| `locker_room` | Locker room facilities |
| `shower` | Shower facilities |
| `air_conditioning` | Air conditioning |
| `first_aid` | First aid available |
| `equipment_rental` | Equipment rental service |
| `coaching` | Coaching/training available |
| `spectator_area` | Dedicated spectator area |
| `wheelchair_accessible` | Wheelchair accessible |

### Example

```json
{
  "amenities": ["parking", "wifi", "restroom", "cafeteria", "lighting", "water", "seating", "pro_shop"]
}
```

### Validation Rules

- Maximum **8 amenities** per facility
- Only valid amenity values accepted (see table above)
- Duplicates are automatically removed

---

## Images

Facility images are managed separately via the Image Upload API. Images are uploaded to S3 and served via CDN.

### Image Types

| Type | Limit | Description | Recommended Size |
|------|-------|-------------|------------------|
| `cover` | 1 | Cover image (Facebook-style, mobile optimized) | 1200x630px |
| `gallery` | 10 | Gallery images | 1200x800px (3:2 ratio) |

### Upload Cover Image

```
POST /api/v1/images/upload
Content-Type: multipart/form-data

Fields:
- file: Image file (JPEG, PNG, WebP)
- entityType: "facility"
- entityId: <facility_id>
- imageType: "cover"
```

### Upload Gallery Image

```
POST /api/v1/images/upload
Content-Type: multipart/form-data

Fields:
- file: Image file (JPEG, PNG, WebP)
- entityType: "facility"
- entityId: <facility_id>
- imageType: "gallery"
```

### Get Facility Images

```
GET /api/v1/images/entity/facility/:facilityId
```

### Delete Image

```
DELETE /api/v1/images/id/:imageId
```

### Example Response (Get Images)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "imageType": "cover",
      "url": "https://cdn.example.com/facilities/1/cover.jpg",
      "isPrimary": true
    },
    {
      "id": "uuid-2",
      "imageType": "gallery",
      "url": "https://cdn.example.com/facilities/1/gallery-1.jpg",
      "isPrimary": false
    }
  ]
}
```

**Note:** See [Image Upload API Guide](./Image/IMAGE_UPLOAD_API_GUIDE.md) for detailed documentation.

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

#### Get Closest Arenas (Page 1)
```bash
curl -X GET "http://localhost:3000/api/v1/facilities/closest?latitude=24.8607&longitude=67.0011"
```

#### Get Closest Arenas (Page 2)
```bash
curl -X GET "http://localhost:3000/api/v1/facilities/closest?latitude=24.8607&longitude=67.0011&page=2"
```

#### Get Closest Arenas (Page 3)
```bash
curl -X GET "http://localhost:3000/api/v1/facilities/closest?latitude=24.8607&longitude=67.0011&page=3"
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
    "address": "123 Sports Street, Lahore",
    "city": "Lahore",
    "latitude": 31.5204,
    "longitude": 74.3587,
    "contactPhone": "+923001234567",
    "amenities": ["parking", "wifi", "restroom", "cafeteria", "lighting", "water"]
  }'
```

#### Update Facility
```bash
curl -X PUT http://localhost:3000/api/v1/facilities/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Facility Name",
    "contactPhone": "+923009876543",
    "amenities": ["parking", "wifi", "restroom", "lighting"]
  }'
```

#### Upload Cover Image
```bash
curl -X POST http://localhost:3000/api/v1/images/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/cover.jpg" \
  -F "entityType=facility" \
  -F "entityId=1" \
  -F "imageType=cover"
```

#### Upload Gallery Image
```bash
curl -X POST http://localhost:3000/api/v1/images/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/gallery1.jpg" \
  -F "entityType=facility" \
  -F "entityId=1" \
  -F "imageType=gallery"
```

#### Get Facility Images
```bash
curl -X GET http://localhost:3000/api/v1/images/entity/facility/1
```

### Using Postman/Insomnia

1. **Public Endpoints**: No authentication needed
2. **Protected Endpoints**: Add `Authorization` header with value `Bearer <token>`
3. **Query Parameters**: Add filters in URL for GET requests
4. **Request Body**: Use JSON format for POST/PUT requests

---

## Data Format Notes

### Amenities
Array of valid amenity strings (max 8):
```json
["parking", "wifi", "restroom", "cafeteria", "lighting", "water", "seating", "pro_shop"]
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
- Images are uploaded via S3 and served via CDN (see [Images](#images) section)
- Maximum 8 amenities per facility (see [Amenities](#amenities) section)
- All timestamps are in ISO 8601 format (UTC)

---

## Related Documentation

- [API Architecture](./API_ARCHITECTURE.md) - Overall API design
- [MVP Full Roadmap](./MVP_FULL_ROADMAP.md) - Complete MVP implementation plan
- [Facility Model](../MODELS/Facility.md) - Database model documentation
- [User API Guide](./USER_API_GUIDE.md) - User authentication endpoints
- [Image Upload API Guide](./Image/IMAGE_UPLOAD_API_GUIDE.md) - Image upload documentation
- [Facility Registration Guide](./Fronend%20Request/facility_registration_guide.md) - Frontend integration guide

---

**Last Updated:** 2025-01-20

