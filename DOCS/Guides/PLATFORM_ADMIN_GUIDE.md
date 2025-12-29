# 🛡️ Platform Admin Guide

Complete guide for platform administrators in SportsArena MVP.

---

## 📋 Overview

Platform administrators (`platform_admin`) have elevated privileges to manage global platform resources that affect all facilities and users.

### Platform Admin Capabilities

- ✅ Create new sports (global/shared resources)
- ✅ Manage platform-wide settings (future)
- ✅ View platform analytics (future)

### Role Hierarchy

1. **`player`** - Regular users who book courts
2. **`facility_admin`** - Facility owners who manage their facilities
3. **`platform_admin`** - Platform administrators who manage global resources

---

## 🏃 Pre-seeded Sports

The database comes with **9 pre-seeded sports** that are automatically available to all facilities:

| ID | Sport Name | Description |
|----|------------|-------------|
| 1 | **Padel** | Racquet sport played in an enclosed court |
| 2 | **Tennis** | Racquet sport played on a rectangular court |
| 3 | **Badminton** | Racquet sport played with shuttlecock |
| 4 | **Football** | Team sport played with a ball |
| 5 | **Cricket** | Bat and ball game |
| 6 | **Basketball** | Team sport played on a rectangular court |
| 7 | **Squash** | Racquet sport played in a four-walled court |
| 8 | **Table Tennis** | Racquet sport played on a table |
| 9 | **Volleyball** | Team sport played with a ball over a net |

**Note:** These sports are automatically available when you run database migrations. Facilities can assign any of these sports to themselves using the FacilitySport API.

---

## 🔐 How to Create a Platform Admin

**Important:** Platform admin accounts cannot be created through the regular signup endpoint. They must be created using a special script for security purposes.

### Step 1: Run the Platform Admin Creation Script

Use the provided script to create a platform admin account:

```bash
npm run create:admin
```

This will start an interactive prompt asking for:
- Email
- Username
- Password (hidden input)
- First Name
- Last Name
- Phone (optional)

**Example:**
```bash
$ npm run create:admin
🛡️  Platform Admin Account Creation

This script will create a platform administrator account.
Platform admins have elevated privileges to manage global resources.

Email: admin@sportsarena.com
Username: platformadmin
Password: ********
First Name: Admin
Last Name: User
Phone (optional, press Enter to skip): +1234567890

📝 Creating platform admin account...

✅ Platform admin account created successfully!

Account Details:
  ID: 1
  Email: admin@sportsarena.com
  Username: platformadmin
  Name: Admin User
  Role: platform_admin
  Created: 2025-01-15T10:30:00.000Z

🔐 Next Steps:
  1. Login using: POST /api/v1/users/login
  2. Use email: admin@sportsarena.com
  3. Use the JWT token to access platform admin endpoints
```

**Alternative: Command Line Arguments**

You can also provide all arguments directly:

```bash
node src/scripts/createPlatformAdmin.js <email> <username> <password> <firstName> <lastName> [phone]
```

**Example:**
```bash
node src/scripts/createPlatformAdmin.js admin@sportsarena.com platformadmin "SecurePass123!" "Admin" "User" "+1234567890"
```

### Step 2: Login to Get JWT Token

```bash
POST /api/v1/users/login
Content-Type: application/json

{
  "email": "admin@sportsarena.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "admin@sportsarena.com",
      "username": "platformadmin",
      "role": "platform_admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Step 3: Use Token for Admin Operations

Include the JWT token in the `Authorization` header for all admin operations:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🎾 Creating New Sports

As a platform admin, you can create new sports that will be available to all facilities.

### Endpoint

```
POST /api/v1/sports
```

### Request

```bash
POST /api/v1/sports
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

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

### Success Response (201 Created)

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

### Error Responses

**403 Forbidden - Not Platform Admin**
```json
{
  "success": false,
  "message": "Access denied. Required role: platform_admin. Your role: player",
  "error_code": "FORBIDDEN"
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

---

## 🔄 Database Migration

To enable the `platform_admin` role, run the database migration:

```bash
npm run migrate
```

This will execute the migration `010_add_platform_admin_role.sql` which adds the `platform_admin` role to the users table.

---

## 📝 Complete Example Workflow

### 1. Run Migrations (if not done)
```bash
npm run migrate
```

### 2. Create Platform Admin Account
```bash
npm run create:admin
```

Follow the interactive prompts, or use command line arguments:
```bash
node src/scripts/createPlatformAdmin.js admin@sportsarena.com platformadmin "SecurePass123!" "Admin" "User" "+1234567890"
```

### 3. Login
```bash
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@sportsarena.com",
    "password": "SecurePass123!"
  }'
```

### 4. Create a New Sport
```bash
curl -X POST http://localhost:3000/api/v1/sports \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hockey",
    "description": "Team sport played with sticks and ball"
  }'
```

### 5. Verify Sport Was Created
```bash
curl -X GET http://localhost:3000/api/v1/sports
```

---

## ⚠️ Important Notes

1. **Security:** Platform admin accounts cannot be created via the public signup endpoint
2. **Script Only:** Use `npm run create:admin` or the script directly to create platform admins
3. **Sports are Global:** New sports created by platform admins are immediately available to all facilities
4. **Facilities Assign Sports:** Facilities don't create sports; they assign existing sports to themselves
5. **Access Control:** Only trusted administrators should have access to run the platform admin creation script

---

## 🔗 Related Documentation

- [Sport API Guide](./API/SPORT_API_GUIDE.md) - Complete sport API documentation
- [User API Guide](./API/USER_API_GUIDE.md) - User authentication and management
- [FacilitySport API Guide](./API/FACILITY_SPORT_API_GUIDE.md) - How facilities assign sports

---

**Last Updated:** 2025-01-15

