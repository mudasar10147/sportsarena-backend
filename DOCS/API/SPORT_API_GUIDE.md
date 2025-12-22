# 📚 Sport API Guide

Complete guide for Sport API endpoints in SportsArena MVP.

**Base URL:** `/api/v1/sports`

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

The Sport API handles sport listing and details retrieval. Sports represent the types of activities available at facilities (e.g., Padel, Tennis, Badminton, Football).

**Note:** For MVP, sports are mostly static and pre-seeded in the database. The create endpoint is provided but optional, as sports typically don't change frequently.

### Pre-seeded Sports

The database comes with initial sports:
- Padel
- Tennis
- Badminton
- Football
- Cricket
- Basketball
- Squash
- Table Tennis
- Volleyball

---

## Authentication

Most endpoints are **public** (no authentication required):
- **GET** `/sports` - Public
- **GET** `/sports/:id` - Public

The create endpoint requires authentication:
- **POST** `/sports` - Requires authentication + `platform_admin` role

For protected endpoints, include JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### How to Become a Platform Admin

To create sports, you need a user account with the `platform_admin` role. **Platform admin accounts cannot be created via the public signup endpoint** - they must be created using a special script.

1. **Create platform admin account using the script:**
   ```bash
   npm run create:admin
   ```
   
   Or with command line arguments:
   ```bash
   node src/scripts/createPlatformAdmin.js admin@sportsarena.com platformadmin "SecurePass123!" "Admin" "User" "+1234567890"
   ```

2. **Login to get JWT token:**
   ```bash
   POST /api/v1/users/login
   {
     "email": "admin@sportsarena.com",
     "password": "SecurePass123!"
   }
   ```

3. **Use the token to create sports:**
   ```bash
   POST /api/v1/sports
   Authorization: Bearer <your-jwt-token>
   {
     "name": "Hockey",
     "description": "Team sport played with sticks and ball"
   }
   ```

**Note:** See [Platform Admin Guide](../PLATFORM_ADMIN_GUIDE.md) for complete instructions on creating platform admin accounts.

---

## Endpoints

### 1. List All Sports

**`GET /api/v1/sports`**

Retrieve a list of all active sports, sorted alphabetically by name.

**Authentication:** Not required (public endpoint)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isActive` | boolean | No | Filter by active status (default: `true`) |

#### Example Requests

```
GET /api/v1/sports
GET /api/v1/sports?isActive=true
GET /api/v1/sports?isActive=false
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Sports retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "Badminton",
      "description": "Racquet sport played with racquets and shuttlecock",
      "iconUrl": "https://example.com/badminton-icon.png",
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": 2,
      "name": "Basketball",
      "description": "Team sport played with a ball and hoops",
      "iconUrl": "https://example.com/basketball-icon.png",
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": 3,
      "name": "Cricket",
      "description": "Bat-and-ball game",
      "iconUrl": "https://example.com/cricket-icon.png",
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": 4,
      "name": "Football",
      "description": "Team sport played with a ball",
      "iconUrl": "https://example.com/football-icon.png",
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": 5,
      "name": "Padel",
      "description": "Racquet sport similar to tennis",
      "iconUrl": "https://example.com/padel-icon.png",
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

**Note:** Results are sorted alphabetically by name.

---

### 2. Get Sport Details

**`GET /api/v1/sports/:id`**

Get detailed information about a specific sport.

**Authentication:** Not required (public endpoint)

#### URL Parameters

- `id` (number, required): Sport ID

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Sport details retrieved successfully",
  "data": {
    "id": 5,
    "name": "Padel",
    "description": "Racquet sport similar to tennis, played in an enclosed court",
    "iconUrl": "https://example.com/padel-icon.png",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - Invalid ID**
```json
{
  "success": false,
  "message": "Invalid sport ID",
  "error_code": "VALIDATION_ERROR"
}
```

**404 Not Found**
```json
{
  "success": false,
  "message": "Sport not found",
  "error_code": "SPORT_NOT_FOUND"
}
```

---

### 3. Create Sport

**`POST /api/v1/sports`**

Create a new sport. Only users with `platform_admin` role can create sports.

**Note:** For MVP, this endpoint is optional as sports are mostly static and pre-seeded. Use this only if you need to add new sports dynamically.

**Why Platform Admin?** Sports are global/shared resources used by all facilities. Only platform administrators can create new sports to maintain consistency across the platform.

**Authentication:** Required (platform_admin role)

#### Request Body

```json
{
  "name": "Hockey",
  "description": "Team sport played with sticks and ball",
  "iconUrl": "https://example.com/hockey-icon.png"
}
```

**Required Fields:**
- `name` (string): Sport name (must be unique, case-insensitive)

**Optional Fields:**
- `description` (string): Sport description
- `iconUrl` (string): URL to sport icon/image

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Sport created successfully",
  "data": {
    "id": 10,
    "name": "Hockey",
    "description": "Team sport played with sticks and ball",
    "iconUrl": "https://example.com/hockey-icon.png",
    "isActive": true,
    "createdAt": "2025-01-15T11:00:00.000Z",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request - Validation Error**
```json
{
  "success": false,
  "message": "Sport name is required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Name Already Exists**
```json
{
  "success": false,
  "message": "Sport name already exists",
  "error_code": "SPORT_NAME_EXISTS"
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
  "message": "Access denied. Required role: platform_admin. Your role: player",
  "error_code": "FORBIDDEN"
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
| `SPORT_NOT_FOUND` | 404 | Sport does not exist |
| `SPORT_NAME_EXISTS` | 400 | Sport name already exists |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |

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

#### List All Sports
```bash
curl -X GET http://localhost:3000/api/v1/sports
```

#### List All Sports (Including Inactive)
```bash
curl -X GET "http://localhost:3000/api/v1/sports?isActive=false"
```

#### Get Sport Details
```bash
curl -X GET http://localhost:3000/api/v1/sports/5
```

#### Create Sport (Platform Admin Only)
```bash
# First, login as platform_admin to get token
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@sportsarena.com",
    "password": "SecurePass123!"
  }'

# Then use the token to create a sport
curl -X POST http://localhost:3000/api/v1/sports \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hockey",
    "description": "Team sport played with sticks and ball",
    "iconUrl": "https://example.com/hockey-icon.png"
  }'
```

### Using Postman/Insomnia

1. **Public Endpoints**: No authentication needed for GET requests
2. **Protected Endpoints**: Add `Authorization` header with value `Bearer <token>` for POST requests
3. **Query Parameters**: Add `isActive` parameter in URL for filtering
4. **Request Body**: Use JSON format for POST requests

---

## Usage Examples

### Filtering Facilities by Sport

Sports are primarily used to filter facilities. Here's how to use the sport ID:

```bash
# Get all facilities offering Padel (sport ID 5)
curl -X GET "http://localhost:3000/api/v1/facilities?sportId=5"
```

### Getting Sport List for Dropdown

Use the list endpoint to populate sport selection dropdowns:

```javascript
// Frontend example
const response = await fetch('/api/v1/sports');
const { data: sports } = await response.json();

// Render sports in dropdown
sports.forEach(sport => {
  console.log(`${sport.id}: ${sport.name}`);
});
```

---

## Data Format Notes

### Sport Object Structure

```json
{
  "id": 5,
  "name": "Padel",
  "description": "Racquet sport similar to tennis",
  "iconUrl": "https://example.com/padel-icon.png",
  "isActive": true,
  "createdAt": "2025-01-15T10:00:00.000Z",
  "updatedAt": "2025-01-15T10:00:00.000Z"
}
```

### Field Descriptions

- **id**: Unique sport identifier
- **name**: Sport name (unique, case-insensitive)
- **description**: Optional description of the sport
- **iconUrl**: Optional URL to sport icon/image
- **isActive**: Whether sport is active (for soft delete)
- **createdAt**: Creation timestamp (ISO 8601)
- **updatedAt**: Last update timestamp (ISO 8601)

---

## Notes

- Sports use soft delete (`is_active` flag)
- Sport names must be unique (case-insensitive check)
- For MVP, sports are mostly static and pre-seeded
- The create endpoint is optional and provided for admin use
- Sports are sorted alphabetically by name in listings
- Icon URL is optional but recommended for better UI
- All timestamps are in ISO 8601 format (UTC)

---

## Related Documentation

- [API Architecture](./API_ARCHITECTURE.md) - Overall API design
- [MVP Full Roadmap](./MVP_FULL_ROADMAP.md) - Complete MVP implementation plan
- [Sport Model](../MODELS/Sport.md) - Database model documentation
- [Facility API Guide](./FACILITY_API_GUIDE.md) - How to filter facilities by sport
- [User API Guide](./USER_API_GUIDE.md) - User authentication endpoints

---

**Last Updated:** 2025-01-15

