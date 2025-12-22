# 📚 FacilitySport API Guide

Complete guide for FacilitySport API endpoints in SportsArena MVP.

**Base URL:** `/api/v1/facilities/:id/sports`

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

The FacilitySport API manages the relationship between facilities and sports. It allows facilities to offer multiple sports and enables users to search facilities by sport type.

### Key Concepts

- **Many-to-Many Relationship**: A facility can offer multiple sports, and a sport can be available at multiple facilities
- **Nested Routes**: These endpoints are nested under facilities (`/facilities/:id/sports`)
- **Ownership**: Only facility owners can assign sports to their facilities

---

## Authentication

- **GET** `/facilities/:id/sports` - Public (no authentication required)
- **POST** `/facilities/:id/sports` - Requires authentication + `facility_admin` role + facility ownership

For protected endpoints, include JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Get Sports Offered by a Facility

**`GET /api/v1/facilities/:id/sports`**

Retrieve all sports offered by a specific facility.

**Authentication:** Not required (public endpoint)

#### URL Parameters

- `id` (number, required): Facility ID

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isActive` | boolean | No | Filter by active status (default: `true`) |

#### Example Requests

```
GET /api/v1/facilities/1/sports
GET /api/v1/facilities/1/sports?isActive=true
GET /api/v1/facilities/1/sports?isActive=false
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Facility sports retrieved successfully",
  "data": [
    {
      "id": 1,
      "facilityId": 1,
      "sportId": 5,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z",
      "sport": {
        "id": 5,
        "name": "Padel",
        "description": "Racquet sport similar to tennis",
        "iconUrl": "https://example.com/padel-icon.png"
      }
    },
    {
      "id": 2,
      "facilityId": 1,
      "sportId": 1,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z",
      "sport": {
        "id": 1,
        "name": "Tennis",
        "description": "Racquet sport played on a court",
        "iconUrl": "https://example.com/tennis-icon.png"
      }
    }
  ]
}
```

**Note:** Results are sorted alphabetically by sport name.

#### Error Responses

**400 Bad Request - Invalid Facility ID**
```json
{
  "success": false,
  "message": "Invalid facility ID",
  "error_code": "VALIDATION_ERROR"
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

### 2. Assign Sport to Facility

**`POST /api/v1/facilities/:id/sports`**

Assign a sport to a facility. Only the facility owner can assign sports to their facilities.

**Authentication:** Required (facility_admin role + facility ownership)

#### URL Parameters

- `id` (number, required): Facility ID

#### Request Body

```json
{
  "sportId": 5
}
```

**Required Fields:**
- `sportId` (number): Sport ID to assign to the facility

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Sport assigned to facility successfully",
  "data": {
    "id": 1,
    "facilityId": 1,
    "sportId": 5,
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Note:** If the sport is already assigned to the facility (but inactive), it will be reactivated automatically.

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "Sport ID is required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Sport ID**
```json
{
  "success": false,
  "message": "Invalid sport ID",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Sport Inactive**
```json
{
  "success": false,
  "message": "Cannot assign inactive sport to facility",
  "error_code": "SPORT_INACTIVE"
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
  "message": "You can only manage sports for your own facilities",
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

**404 Not Found - Sport Not Found**
```json
{
  "success": false,
  "message": "Sport not found",
  "error_code": "SPORT_NOT_FOUND"
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
| `SPORT_NOT_FOUND` | 404 | Sport does not exist |
| `SPORT_INACTIVE` | 400 | Cannot assign inactive sport |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Not facility owner or insufficient permissions |

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

#### Get Sports for a Facility
```bash
curl -X GET http://localhost:3000/api/v1/facilities/1/sports
```

#### Get Sports (Including Inactive)
```bash
curl -X GET "http://localhost:3000/api/v1/facilities/1/sports?isActive=false"
```

#### Assign Sport to Facility
```bash
curl -X POST http://localhost:3000/api/v1/facilities/1/sports \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sportId": 5
  }'
```

### Using Postman/Insomnia

1. **Public Endpoints**: No authentication needed for GET requests
2. **Protected Endpoints**: Add `Authorization` header with value `Bearer <token>` for POST requests
3. **URL Parameters**: Replace `:id` with actual facility ID
4. **Request Body**: Use JSON format for POST requests

---

## Usage Examples

### Getting Sports for Facility Details Page

When displaying a facility's details, fetch its sports:

```javascript
// Frontend example
const facilityId = 1;
const response = await fetch(`/api/v1/facilities/${facilityId}/sports`);
const { data: sports } = await response.json();

// Display sports
sports.forEach(facilitySport => {
  console.log(`${facilitySport.sport.name} - ${facilitySport.sport.description}`);
});
```

### Assigning Multiple Sports During Facility Setup

When a facility owner creates a facility, they can assign sports:

```javascript
// Frontend example - assign multiple sports
const facilityId = 1;
const sportIds = [1, 5, 7]; // Tennis, Padel, Squash

for (const sportId of sportIds) {
  await fetch(`/api/v1/facilities/${facilityId}/sports`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sportId })
  });
}
```

### Filtering Facilities by Sport

The FacilitySport relationship enables filtering facilities by sport:

```bash
# Get all facilities offering Padel (sport ID 5)
curl -X GET "http://localhost:3000/api/v1/facilities?sportId=5"
```

---

## Data Format Notes

### FacilitySport Object Structure

```json
{
  "id": 1,
  "facilityId": 1,
  "sportId": 5,
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z",
  "sport": {
    "id": 5,
    "name": "Padel",
    "description": "Racquet sport similar to tennis",
    "iconUrl": "https://example.com/padel-icon.png"
  }
}
```

### Field Descriptions

- **id**: Unique relationship identifier
- **facilityId**: Facility ID
- **sportId**: Sport ID
- **isActive**: Whether relationship is active (for soft delete)
- **createdAt**: Creation timestamp (ISO 8601)
- **updatedAt**: Last update timestamp (ISO 8601)
- **sport**: Full sport object with details (included in GET responses)

---

## Notes

- FacilitySport relationships use soft delete (`is_active` flag)
- Duplicate assignments are handled gracefully (reactivates if exists)
- Only active sports can be assigned to facilities
- Only facility owners can manage sports for their facilities
- Sports are sorted alphabetically by name in listings
- The relationship is automatically included in facility details endpoint (`GET /facilities/:id`)
- All timestamps are in ISO 8601 format (UTC)

---

## Related Documentation

- [API Architecture](./API_ARCHITECTURE.md) - Overall API design
- [MVP Full Roadmap](./MVP_FULL_ROADMAP.md) - Complete MVP implementation plan
- [FacilitySport Model](../MODELS/FacilitySport.md) - Database model documentation
- [Facility API Guide](./FACILITY_API_GUIDE.md) - Facility endpoints
- [Sport API Guide](./SPORT_API_GUIDE.md) - Sport endpoints

---

**Last Updated:** 2025-01-15

