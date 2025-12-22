# 📚 SportsArena Models Guide

This guide documents all database models in the SportsArena MVP backend.

---

## 🟦 User Model

### Overview
The `User` model stores all user accounts for both players and facility owners. It handles authentication, profile information, and role management.

### Database Schema
**Table:** `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing user ID |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | User email address (used for login) |
| `password_hash` | VARCHAR(255) | NOT NULL | Hashed password (never returned in queries) |
| `first_name` | VARCHAR(100) | NOT NULL | User's first name |
| `last_name` | VARCHAR(100) | NOT NULL | User's last name |
| `phone` | VARCHAR(20) | NULL | Optional phone number |
| `role` | VARCHAR(20) | NOT NULL, DEFAULT 'player' | User role: 'player' or 'facility_admin' |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether account is active (soft delete) |
| `email_verified` | BOOLEAN | DEFAULT FALSE | Whether email is verified |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_users_email` - Fast email lookups
- `idx_users_role` - Filter by role
- `idx_users_is_active` - Filter active users

### Model Methods

#### `User.create(userData)`
Creates a new user account.
- **Parameters:** `{ email, passwordHash, firstName, lastName, phone?, role? }`
- **Returns:** User object (without password)
- **Throws:** Error if email already exists

#### `User.findById(userId)`
Finds user by ID.
- **Parameters:** `userId` (number)
- **Returns:** User object or `null`

#### `User.findByEmail(email, includePassword?)`
Finds user by email (for authentication).
- **Parameters:** `email` (string), `includePassword` (boolean, default: false)
- **Returns:** User object (with/without password based on flag)

#### `User.update(userId, updateData)`
Updates user information.
- **Parameters:** `userId` (number), `updateData` (object)
- **Allowed fields:** `firstName`, `lastName`, `phone`, `isActive`, `emailVerified`
- **Returns:** Updated user object or `null`

#### `User.updatePassword(userId, newPasswordHash)`
Updates user password.
- **Parameters:** `userId` (number), `newPasswordHash` (string)
- **Returns:** `true` if successful

#### `User.emailExists(email)`
Checks if email is already registered.
- **Parameters:** `email` (string)
- **Returns:** `true` if exists, `false` otherwise

#### `User.findAll(options?)`
Gets all users with optional filtering and pagination.
- **Parameters:** `{ limit?, offset?, role?, isActive? }`
- **Returns:** `{ users: [], total: number, limit: number, offset: number }`

#### `User.delete(userId)`
Soft deletes user (sets `is_active` to false).
- **Parameters:** `userId` (number)
- **Returns:** `true` if successful

### Usage Examples

```javascript
const User = require('./models/User');

// Create a new player
const player = await User.create({
  email: 'john@example.com',
  passwordHash: hashedPassword,
  firstName: 'John',
  lastName: 'Doe',
  phone: '+1234567890',
  role: 'player'
});

// Find user for login
const user = await User.findByEmail('john@example.com', true);
// Returns user with password_hash for verification

// Update profile
await User.update(userId, {
  firstName: 'Jane',
  phone: '+9876543210'
});

// Get all facility admins
const { users } = await User.findAll({
  role: 'facility_admin',
  isActive: true,
  limit: 20
});
```

### Security Notes
- Passwords are never returned in queries (except `findByEmail` with `includePassword=true`)
- Use soft deletes (`is_active = false`) instead of hard deletes
- Email verification status tracked separately
- Role-based access control via `role` field

---

## 📝 Model Development Status

| Model | Status | Created Date |
|-------|--------|--------------|
| User | ✅ Complete | 2025-01-XX |
| Facility | ⏳ Pending | - |
| Sport | ⏳ Pending | - |
| FacilitySport | ⏳ Pending | - |
| Court | ⏳ Pending | - |
| TimeSlot | ⏳ Pending | - |
| Booking | ⏳ Pending | - |
| PaymentTransaction | ⏳ Pending | - |

---

## 🔄 Migration Instructions

To create the User table, run:
```bash
psql -d sportsarena -f src/db/migrations/001_create_users_table.sql
```

Or use the migration file directly in your database setup script.

