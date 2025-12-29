# 🚂 Railway Deployment Guide

Complete guide for deploying SportsArena backend on Railway.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Steps](#deployment-steps)
4. [Database Migrations](#database-migrations)
5. [Environment Variables](#environment-variables)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Overview

Railway automatically:
- Detects your Node.js application
- Sets up PostgreSQL database
- Provides `DATABASE_URL` environment variable
- Handles SSL connections

Your app is already configured to use `DATABASE_URL` automatically.

---

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your code should be in a Git repository
3. **Node.js Version**: Railway auto-detects from `package.json` or `.nvmrc`

---

## Deployment Steps

### 1. Create New Project on Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your SportsArena repository
5. Railway will auto-detect it's a Node.js app

### 2. Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway automatically creates a PostgreSQL instance
4. Railway automatically sets `DATABASE_URL` environment variable

### 3. Configure Environment Variables

Add these environment variables in Railway:

**Required:**
```
JWT_SECRET=your_secure_random_string_here
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

**AWS S3 (for image uploads):**
```
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your_bucket_name
CDN_BASE_URL=https://your_cdn_domain.com
```

**Optional:**
```
NODE_ENV=production
PORT=3000
JWT_EXPIRES_IN=7d
```

**Note:** `DATABASE_URL` is automatically set by Railway - don't add it manually!

### 4. Run Database Migrations

See [Database Migrations](#database-migrations) section below.

### 5. Deploy

Railway automatically:
- Installs dependencies (`npm install`)
- Builds your app (if needed)
- Starts your server (`npm start`)

---

## Database Migrations

Railway needs to run migrations to set up your database schema. You have **3 options**:

### Option 1: Pre-Start Migration (Recommended) ✅

Run migrations automatically before the server starts.

**Update `package.json` start script:**

```json
{
  "scripts": {
    "start": "node -e \"require('./src/db/runMigrations.js').then(() => require('./src/server.js'))\" || node src/server.js"
  }
}
```

**Better approach - Create a startup script:**

Create `src/start.js`:
```javascript
const runMigrations = require('./db/runMigrations');
const server = require('./server');

async function start() {
  try {
    console.log('🔄 Running database migrations...');
    await runMigrations();
    console.log('✅ Migrations complete, starting server...');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

start();
```

Then update `package.json`:
```json
{
  "scripts": {
    "start": "node src/start.js"
  }
}
```

**Pros:**
- Migrations run automatically on every deploy
- Ensures database is always up-to-date
- No manual intervention needed

**Cons:**
- Slightly slower startup (migrations run every time)
- If migrations fail, server won't start (this is actually good!)

### Option 2: Railway Post-Deploy Hook

Use Railway's post-deploy command to run migrations after deployment.

**In Railway dashboard:**
1. Go to your service settings
2. Add **"Post Deploy Command"**:
   ```
   npm run migrate
   ```

**Pros:**
- Migrations run after deployment
- Server can start even if migrations fail (not ideal)

**Cons:**
- Requires Railway Pro plan (paid feature)
- Migrations might fail silently

### Option 3: Manual Migration via Railway CLI

Run migrations manually using Railway CLI.

**Install Railway CLI:**
```bash
npm i -g @railway/cli
```

**Login:**
```bash
railway login
```

**Link to your project:**
```bash
railway link
```

**Run migrations:**
```bash
railway run npm run migrate
```

**Pros:**
- Full control over when migrations run
- Can run migrations independently of deployments

**Cons:**
- Requires manual intervention
- Easy to forget to run migrations

---

## Recommended Approach

**Use Option 1 (Pre-Start Migration)** because:
1. ✅ Migrations always run before server starts
2. ✅ Database schema is always up-to-date
3. ✅ Server won't start with incomplete schema
4. ✅ No manual steps required
5. ✅ Works on free Railway plan

### Implementation

I'll create a startup script that runs migrations then starts the server:

```javascript
// src/start.js
require('dotenv').config();
const { pool } = require('./config/database');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'db', 'migrations');
const migrationFiles = [
  '001_create_users_table.sql',
  '002_create_facilities_table.sql',
  '003_create_sports_table.sql',
  '004_create_facility_sports_table.sql',
  '005_create_courts_table.sql',
  '007_create_bookings_table.sql',
  '008_create_payment_transactions_table.sql',
  '010_add_platform_admin_role.sql',
  '011_add_rejected_status_to_bookings.sql',
  '012_create_images_table.sql',
  '013_add_upload_fields_to_images.sql',
  '014_add_moderation_and_soft_delete.sql',
  '015_add_google_auth_support.sql'
];

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migrations...\n');
    
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const filename of migrationFiles) {
      const filePath = path.join(migrationsDir, filename);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping ${filename} - file not found`);
        continue;
      }

      const checkResult = await client.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if (checkResult.rows.length > 0) {
        console.log(`⏭️  Skipping ${filename} - already executed`);
        continue;
      }

      console.log(`📄 Running ${filename}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`✅ Successfully executed ${filename}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('✨ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function start() {
  try {
    // Run migrations first
    await runMigrations();
    
    // Then start the server
    console.log('🚀 Starting server...\n');
    require('./server');
  } catch (error) {
    console.error('💥 Startup failed:', error);
    process.exit(1);
  }
}

start();
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Railway |
| `JWT_SECRET` | Secret for JWT token signing | `your_random_secret_here` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123.apps.googleusercontent.com` |

### AWS S3 Variables (for image uploads)

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket name | `sportsarena-images-prod` |
| `CDN_BASE_URL` | CloudFront/CDN URL | `https://cdn.sportsarena.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` (Railway sets this) |
| `JWT_EXPIRES_IN` | JWT expiration | `7d` |

### How to Add Variables in Railway

1. Go to your Railway project
2. Click on your service
3. Go to **"Variables"** tab
4. Click **"+ New Variable"**
5. Add each variable

**Note:** Railway automatically provides:
- `DATABASE_URL` (from PostgreSQL service)
- `PORT` (Railway sets this)
- `RAILWAY_ENVIRONMENT` (production/staging)

---

## Post-Deployment

### 1. Verify Deployment

1. Check Railway logs for:
   - ✅ "Connected to PostgreSQL database"
   - ✅ "All migrations completed successfully"
   - ✅ "SportsArena backend server running on port X"

2. Test health endpoint:
   ```bash
   curl https://your-app.railway.app/health
   ```

### 2. Create Platform Admin

Run the admin creation script:

```bash
railway run npm run create:admin
```

Or manually via Railway CLI:
```bash
railway run node src/scripts/createPlatformAdmin.js
```

### 3. Test API Endpoints

Test key endpoints:
- `GET /health` - Health check
- `GET /api/v1` - API info
- `POST /api/v1/auth/google` - Google auth (with valid token)

---

## Troubleshooting

### Migration Issues

**Problem:** Migrations fail on Railway

**Solutions:**
1. Check Railway logs for error messages
2. Verify `DATABASE_URL` is set correctly
3. Ensure all migration files are in the repository
4. Check if migrations table exists

**Debug:**
```bash
railway run npm run migrate
```

### Connection Issues

**Problem:** "Connection refused" or "Database not found"

**Solutions:**
1. Verify PostgreSQL service is running in Railway
2. Check `DATABASE_URL` is set (Railway auto-sets this)
3. Verify SSL is enabled for production (already handled in code)

### Port Issues

**Problem:** Server not starting

**Solutions:**
1. Railway automatically sets `PORT` - don't hardcode it
2. Your code should use `process.env.PORT || 3000`
3. Check Railway logs for port binding errors

### Environment Variable Issues

**Problem:** Variables not loading

**Solutions:**
1. Verify variables are set in Railway dashboard
2. Check variable names match exactly (case-sensitive)
3. Restart service after adding variables
4. Verify `.env` file is not being used (Railway uses its own env)

---

## Migration Best Practices

1. **Idempotent Migrations**: Your migrations use `IF NOT EXISTS` - good!
2. **Migration Tracking**: `schema_migrations` table tracks executed migrations
3. **Transaction Safety**: Each migration runs in a transaction
4. **Rollback Support**: Failed migrations roll back automatically

### Adding New Migrations

1. Create new SQL file: `016_your_migration_name.sql`
2. Add to `migrationFiles` array in `runMigrations.js`
3. Deploy - migrations run automatically

---

## Railway-Specific Features

### Automatic Deployments

- Railway auto-deploys on every `git push` to main branch
- You can disable this in settings
- Manual deployments available via dashboard

### Logs

- View logs in Railway dashboard
- Real-time log streaming
- Log retention (varies by plan)

### Custom Domains

1. Go to service settings
2. Click **"Generate Domain"** or add custom domain
3. Railway handles SSL automatically

### Scaling

- Railway auto-scales based on traffic
- Can set resource limits in settings
- Pay-as-you-go pricing

---

## Summary

**Quick Deployment Checklist:**

- [ ] Push code to GitHub
- [ ] Create Railway project
- [ ] Add PostgreSQL database
- [ ] Set environment variables
- [ ] Deploy (automatic or manual)
- [ ] Migrations run automatically (if using Option 1)
- [ ] Verify health endpoint
- [ ] Create platform admin
- [ ] Test API endpoints

**Your app is Railway-ready!** 🚀

---

**Last Updated:** 2025-01-15

