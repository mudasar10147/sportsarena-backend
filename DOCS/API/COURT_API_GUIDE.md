# 📚 Court API Guide

Complete guide for Court API endpoints in SportsArena MVP.

**Base URLs:**
- `/api/v1/facilities/:id/courts` (nested routes)
- `/api/v1/courts/:id` (standalone route)

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

The Court API manages individual courts/grounds at facilities. Each court belongs to a facility and is designed for a specific sport, with pricing and indoor/outdoor classification.

### Key Concepts

- **Court-Facility Relationship**: Each court belongs to one facility
- **Court-Sport Relationship**: Each court is designed for one sport
- **Pricing**: Price per hour in PKR (Pakistani Rupees)
- **Indoor/Outdoor**: Courts can be classified as indoor or outdoor
- **Ownership**: Only facility owners can manage courts in their facilities

---

## Authentication

- **GET** `/facilities/:id/courts` - Public (no authentication required)
- **POST** `/facilities/:id/courts` - Requires authentication + `facility_admin` role + facility ownership
- **PUT** `/courts/:id` - Requires authentication + `facility_admin` role + facility ownership

For protected endpoints, include JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Get Courts for a Facility

**`GET /api/v1/facilities/:id/courts`**

Retrieve all courts for a specific facility.

**Authentication:** Not required (public endpoint)

#### URL Parameters

- `id` (number, required): Facility ID

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isActive` | boolean | No | Filter by active status (default: `true`) |

#### Example Requests

```
GET /api/v1/facilities/1/courts
GET /api/v1/facilities/1/courts?isActive=true
GET /api/v1/facilities/1/courts?isActive=false
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Facility courts retrieved successfully",
  "data": [
    {
      "id": 1,
      "facilityId": 1,
      "sportId": 5,
      "name": "Court 1",
      "description": "Premium indoor court with air conditioning",
      "pricePerHour": 1500.00,
      "isIndoor": true,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "facilityId": 1,
      "sportId": 5,
      "name": "Court 2",
      "description": "Outdoor court with floodlights",
      "pricePerHour": 1200.00,
      "isIndoor": false,
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

**Note:** 
- Results are sorted alphabetically by court name
- Time slots are automatically generated when courts are created (if facility has opening hours)

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

### 2. Create Court for a Facility

**`POST /api/v1/facilities/:id/courts`**

Create a new court for a facility. Only the facility owner can create courts.

**Note:** Time slots are **automatically generated** for new courts if the facility has opening hours configured. No manual slot creation needed!

**Authentication:** Required (facility_admin role + facility ownership)

#### URL Parameters

- `id` (number, required): Facility ID

#### Request Body

```json
{
  "sportId": 5,
  "name": "Court 1",
  "pricePerHour": 1500.00,
  "description": "Premium indoor court with air conditioning",
  "isIndoor": true
}
```

**Required Fields:**
- `sportId` (number): Sport ID this court is designed for
- `name` (string): Court name/number (e.g., "Court 1", "Padel Court A")
- `pricePerHour` (number): Price per hour in PKR (must be > 0)

**Optional Fields:**
- `description` (string): Court description
- `isIndoor` (boolean): Whether court is indoor (default: `true`)

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Court created successfully",
  "data": {
    "id": 1,
    "facilityId": 1,
    "sportId": 5,
    "name": "Court 1",
    "description": "Premium indoor court with air conditioning",
    "pricePerHour": 1500.00,
    "isIndoor": true,
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
  "message": "Sport ID, name, and price per hour are required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Price**
```json
{
  "success": false,
  "message": "Price per hour must be a positive number",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Sport Inactive**
```json
{
  "success": false,
  "message": "Cannot create court for inactive sport",
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
  "message": "You can only add courts to your own facilities",
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

### 3. Update Court Details

**`PUT /api/v1/courts/:id`**

Update court information. Only the facility owner can update courts in their facilities.

**Authentication:** Required (facility_admin role + facility ownership)

#### URL Parameters

- `id` (number, required): Court ID

#### Request Body

All fields are optional. Only include fields you want to update:

```json
{
  "name": "Court 1 - Premium",
  "description": "Updated description",
  "pricePerHour": 1800.00,
  "isIndoor": true,
  "isActive": true
}
```

**Optional Fields:**
- `name` (string): Updated court name
- `description` (string): Updated court description
- `pricePerHour` (number): Updated price per hour in PKR (must be > 0)
- `isIndoor` (boolean): Whether court is indoor
- `isActive` (boolean): Whether court is active

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Court updated successfully",
  "data": {
    "id": 1,
    "facilityId": 1,
    "sportId": 5,
    "name": "Court 1 - Premium",
    "description": "Updated description",
    "pricePerHour": 1800.00,
    "isIndoor": true,
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

**400 Bad Request - Invalid Price**
```json
{
  "success": false,
  "message": "Price per hour must be a positive number",
  "error_code": "VALIDATION_ERROR"
}
```

**403 Forbidden - Not Facility Owner**
```json
{
  "success": false,
  "message": "You can only update courts in your own facilities",
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
| `COURT_NOT_FOUND` | 404 | Court does not exist |
| `SPORT_NOT_FOUND` | 404 | Sport does not exist |
| `SPORT_INACTIVE` | 400 | Cannot create court for inactive sport |
| `INVALID_PRICE` | 400 | Price must be greater than 0 |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Not facility owner or insufficient permissions |
| `UPDATE_FAILED` | 500 | Failed to update court |

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

#### Get Courts for a Facility
```bash
curl -X GET http://localhost:3000/api/v1/facilities/1/courts
```

#### Get Courts (Including Inactive)
```bash
curl -X GET "http://localhost:3000/api/v1/facilities/1/courts?isActive=false"
```

#### Create Court
```bash
curl -X POST http://localhost:3000/api/v1/facilities/1/courts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sportId": 5,
    "name": "Court 1",
    "pricePerHour": 1500.00,
    "description": "Premium indoor court",
    "isIndoor": true
  }'
```

#### Update Court
```bash
curl -X PUT http://localhost:3000/api/v1/courts/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Court 1 - Premium",
    "pricePerHour": 1800.00
  }'
```

### Using Postman/Insomnia

1. **Public Endpoints**: No authentication needed for GET requests
2. **Protected Endpoints**: Add `Authorization` header with value `Bearer <token>` for POST/PUT requests
3. **URL Parameters**: Replace `:id` with actual facility/court ID
4. **Request Body**: Use JSON format for POST/PUT requests

---

## Usage Examples

### Getting Courts for Facility Details Page

When displaying a facility's details, fetch its courts:

```javascript
// Frontend example
const facilityId = 1;
const response = await fetch(`/api/v1/facilities/${facilityId}/courts`);
const { data: courts } = await response.json();

// Display courts
courts.forEach(court => {
  console.log(`${court.name} - PKR ${court.pricePerHour}/hour`);
});
```

### Creating Multiple Courts During Facility Setup

When a facility owner sets up their facility, they can create multiple courts:

```javascript
// Frontend example - create multiple courts
const facilityId = 1;
const courts = [
  { sportId: 5, name: "Court 1", pricePerHour: 1500, isIndoor: true },
  { sportId: 5, name: "Court 2", pricePerHour: 1200, isIndoor: false }
];

for (const court of courts) {
  await fetch(`/api/v1/facilities/${facilityId}/courts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(court)
  });
}
```

### Filtering Courts by Price Range

Courts are automatically included in facility details, but you can filter them:

```javascript
// Frontend example - filter courts by price
const courts = facility.courts.filter(court => 
  court.pricePerHour >= 1000 && court.pricePerHour <= 2000
);
```

---

## Data Format Notes

### Court Object Structure

```json
{
  "id": 1,
  "facilityId": 1,
  "sportId": 5,
  "name": "Court 1",
  "description": "Premium indoor court with air conditioning",
  "pricePerHour": 1500.00,
  "isIndoor": true,
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### Field Descriptions

- **id**: Unique court identifier
- **facilityId**: Facility ID this court belongs to
- **sportId**: Sport ID this court is designed for
- **name**: Court name/number
- **description**: Optional court description
- **pricePerHour**: Price per hour in PKR (decimal)
- **isIndoor**: Whether court is indoor (`true`) or outdoor (`false`)
- **isActive**: Whether court is active (for soft delete)
- **createdAt**: Creation timestamp (ISO 8601)
- **updatedAt**: Last update timestamp (ISO 8601)

---

## Notes

- **Automatic Slot Generation**: When a court is created, time slots are automatically generated for the next 7 days (if facility has opening hours configured)
- **Existing Courts**: For existing courts without slots, use `POST /api/v1/facilities/:id/generate-slots` to generate slots for all courts
- Courts use soft delete (`is_active` flag)
- Price is stored as decimal for precise currency handling (PKR)
- Only facility owners can manage courts in their facilities
- Courts are sorted alphabetically by name in listings
- Courts are automatically included in facility details endpoint (`GET /facilities/:id`)
- Price must be greater than 0
- All timestamps are in ISO 8601 format (UTC)
- Court name cannot be empty when updating

---

## Related Documentation

- [API Architecture](./API_ARCHITECTURE.md) - Overall API design
- [MVP Full Roadmap](./MVP_FULL_ROADMAP.md) - Complete MVP implementation plan
- [Court Model](../MODELS/Court.md) - Database model documentation
- [Facility API Guide](./FACILITY_API_GUIDE.md) - Facility endpoints
- [Sport API Guide](./SPORT_API_GUIDE.md) - Sport endpoints

---

**Last Updated:** 2025-01-15

