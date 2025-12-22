# 🔧 Admin Scripts

This directory contains administrative scripts for managing the SportsArena platform.

---

## 📋 Available Scripts

### `createPlatformAdmin.js`

Creates a platform administrator account with elevated privileges.

**Why a script?** Platform admin accounts cannot be created via the public signup endpoint for security reasons. This script ensures only authorized administrators can create platform admin accounts.

#### Usage

**Interactive Mode (Recommended):**
```bash
npm run create:admin
```

This will prompt you for:
- Email
- Username
- Password (hidden input)
- First Name
- Last Name
- Phone (optional)

**Command Line Mode:**
```bash
node src/scripts/createPlatformAdmin.js <email> <username> <password> <firstName> <lastName> [phone]
```

**Example:**
```bash
node src/scripts/createPlatformAdmin.js admin@sportsarena.com platformadmin "SecurePass123!" "Admin" "User" "+1234567890"
```

#### Requirements

- Database must be set up and migrations must be run
- Email and username must be unique
- Password must meet security requirements (min 8 characters)
- User must have database access

#### Security Notes

- ⚠️ **Never commit platform admin credentials to version control**
- ⚠️ **Only run this script in secure environments**
- ⚠️ **Limit access to this script to trusted administrators**
- ✅ **Use interactive mode when possible to avoid password in command history**

---

## 🔐 Platform Admin Capabilities

Platform administrators can:
- Create new sports (global/shared resources)
- Manage platform-wide settings (future)
- View platform analytics (future)

---

## 📚 Related Documentation

- [Platform Admin Guide](../../DOCS/PLATFORM_ADMIN_GUIDE.md) - Complete guide for platform admins
- [User API Guide](../../DOCS/API/USER_API_GUIDE.md) - User authentication endpoints
- [Sport API Guide](../../DOCS/API/SPORT_API_GUIDE.md) - Sport management endpoints

---

**Last Updated:** 2025-01-15

