# 🚨 Railway Troubleshooting Guide

Quick reference for common Railway deployment issues.

---

## Database Connection Issues

### Problem: `ECONNREFUSED` Error

**Symptoms:**
```
Error: connect ECONNREFUSED ::1:5432
📦 Using individual DB variables for database connection
```

**Cause:** Railway's `DATABASE_URL` is not being detected.

**Solutions:**

1. **Verify PostgreSQL Service is Added**
   - Go to Railway dashboard
   - Check if PostgreSQL service exists
   - If not, add it: "+ New" → "Database" → "Add PostgreSQL"

2. **Check DATABASE_URL is Set**
   - In Railway dashboard, go to your service
   - Click "Variables" tab
   - Look for `DATABASE_URL` (Railway auto-sets this)
   - If missing, the PostgreSQL service might not be linked

3. **Link PostgreSQL to Your Service**
   - In Railway dashboard, go to your service
   - Click "Settings" → "Service Connections"
   - Ensure PostgreSQL service is connected
   - Railway automatically sets `DATABASE_URL` when connected

4. **Verify Environment Variables**
   - Check Railway logs for: `📦 Using DATABASE_URL for database connection`
   - If you see `📦 Using individual DB variables`, `DATABASE_URL` is not set

5. **Manual Check (via Railway CLI)**
   ```bash
   railway run env | grep DATABASE_URL
   ```
   Should show: `DATABASE_URL=postgresql://...`

---

## Rate Limiter IPv6 Warning

**Fixed!** The rate limiter now uses default IP detection which handles IPv4 and IPv6 correctly.

---

## Migration Issues

### Problem: Migrations Fail on Startup

**Check:**
1. Database connection is working (see above)
2. All migration files are in repository
3. Check Railway logs for specific migration error

**Debug:**
```bash
railway run npm run migrate
```

---

## Environment Variables Not Loading

### Problem: Variables Not Available

**Solutions:**
1. **Check Variable Names**
   - Case-sensitive: `JWT_SECRET` not `jwt_secret`
   - No typos

2. **Restart Service**
   - After adding variables, restart the service
   - Railway dashboard → Service → "Redeploy"

3. **Verify in Logs**
   - Check startup logs for variable values (be careful with secrets)
   - Use Railway CLI: `railway run env`

---

## Quick Debug Commands

### Check Environment Variables
```bash
railway run env
```

### Test Database Connection
```bash
railway run node -e "require('./src/config/database').testConnection()"
```

### Run Migrations Manually
```bash
railway run npm run migrate
```

### View Logs
```bash
railway logs
```

---

## Common Railway Setup Checklist

- [ ] PostgreSQL service added
- [ ] PostgreSQL linked to your service
- [ ] `DATABASE_URL` appears in variables (auto-set)
- [ ] `JWT_SECRET` set manually
- [ ] `GOOGLE_CLIENT_ID` set manually
- [ ] AWS credentials set (if using S3)
- [ ] Service restarted after adding variables
- [ ] Logs show: `📦 Using DATABASE_URL for database connection`

---

## Still Having Issues?

1. Check Railway logs for error messages
2. Verify all environment variables are set
3. Ensure PostgreSQL service is running
4. Check service connections in Railway dashboard
5. Try redeploying the service

---

**Last Updated:** 2025-01-15

