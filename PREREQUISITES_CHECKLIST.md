# Email Verification Prerequisites Checklist

## ✅ Verification Status

### 1. AWS Account with SES Access
**Status:** ⚠️ Needs Verification

**Action Required:**
1. Log into AWS Console: https://console.aws.amazon.com
2. Navigate to Amazon SES service
3. Verify you can access the SES dashboard
4. Check your AWS account status

**How to Verify:**
- Go to AWS Console → Search "SES" → Click "Amazon Simple Email Service"
- If you can see the SES dashboard, you have access
- If you get an error, you may need to enable SES in your region

**Notes:**
- SES is available in specific regions (us-east-1, us-west-2, eu-west-1, etc.)
- Some regions require account verification before first use

---

### 2. SES Account Status (Sandbox vs Production)
**Status:** ⚠️ Needs Verification

**Action Required:**
1. In AWS SES Console, check your account status
2. Look for "Account dashboard" or "Sending statistics"
3. Check if you see "Sandbox" or "Production" status

**How to Check:**
- AWS Console → SES → Account dashboard
- Look for "Account status" or "Sending limits"
- **Sandbox:** Limited to 200 emails/day, 1 email/second, only verified emails
- **Production:** Can send to any email address (after request approval)

**If in Sandbox:**
- You MUST verify recipient email addresses before sending
- Go to "Verified identities" → "Create identity" → "Email address"
- Add test email addresses you'll use for development

**If in Production:**
- You can send to any email address
- Still need to verify your "From" email address

**Important:** For development, sandbox is fine. For production, request production access.

---

### 3. Sending Email Address/Domain Verified in SES
**Status:** ⚠️ Needs Verification

**Action Required:**
1. Verify the email address you'll send FROM
2. This is the email that appears in the "From" field
3. Example: noreply@sportsarena.com or verification@sportsarena.com

**How to Verify Email Address:**
1. AWS Console → SES → Verified identities → Create identity
2. Choose "Email address"
3. Enter your email (e.g., noreply@yourdomain.com)
4. Click "Create identity"
5. Check your email inbox for verification email
6. Click the verification link
7. Status should change to "Verified"

**How to Verify Domain (Recommended for Production):**
1. AWS Console → SES → Verified identities → Create identity
2. Choose "Domain"
3. Enter your domain (e.g., yourdomain.com)
4. Follow DNS configuration instructions:
   - Add SPF record
   - Add DKIM records (3 CNAME records)
   - Add DMARC record (optional but recommended)
5. Wait for verification (can take up to 72 hours)

**Current Configuration:**
- Based on your .env file, you have: `SES_FROM_NAME=SportsArena`
- You still need: `SES_FROM_EMAIL` (the verified email address)

---

### 4. AWS Credentials Configured
**Status:** ✅ Likely Configured (S3 is working)

**Action Required:**
1. Verify these environment variables exist in your `.env` file:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`

**How to Verify:**
- Check your `.env` file for these variables
- If they exist and S3 is working, they should work for SES too
- SES uses the same AWS credentials as S3

**If Missing:**
1. Go to AWS Console → IAM → Users → Your User
2. Go to "Security credentials" tab
3. Create "Access key" if needed
4. Copy Access Key ID and Secret Access Key
5. Add to `.env` file

**Security Note:**
- Never commit `.env` file to git (already in .gitignore ✅)
- Use IAM user with least privilege permissions
- Consider using IAM roles in production (EC2, Lambda, etc.)

---

### 5. AWS_REGION Environment Variable Set
**Status:** ✅ Likely Set (S3 is working)

**Action Required:**
1. Verify `AWS_REGION` is set in your `.env` file
2. Common regions: `us-east-1`, `us-west-2`, `eu-west-1`, `ap-southeast-1`

**How to Verify:**
- Check your `.env` file
- If S3 is working, this is likely already set

**Important for SES:**
- SES is available in specific regions
- Use the same region as your S3 bucket for consistency
- If your region doesn't support SES, choose the closest one that does

**SES Available Regions:**
- us-east-1 (N. Virginia)
- us-west-2 (Oregon)
- eu-west-1 (Ireland)
- ap-southeast-1 (Singapore)
- And others...

---

### 6. Database Migrations Can Be Run
**Status:** ✅ Verified (PostgreSQL 16.11 installed)

**Action Required:**
1. Verify database connection works
2. Test running a migration

**How to Verify:**
```bash
# Test database connection
npm run migrate

# Or check if migrations have been run
# Look in your database for existing tables
```

**Current Status:**
- PostgreSQL 16.11 is installed ✅
- Migration scripts exist in `src/db/migrations/` ✅
- Migration runner exists: `src/db/runMigrations.js` ✅

**If Issues:**
- Check `.env` file for database credentials
- Verify PostgreSQL is running: `pg_isready`
- Check database exists: `psql -l | grep sportsarena`

---

### 7. Node.js and npm Working
**Status:** ✅ Verified

**Current Versions:**
- Node.js: v24.4.1 ✅
- npm: 11.4.2 ✅

**Both are installed and working!**

---

## 📋 Quick Verification Commands

Run these commands to verify your setup:

```bash
# 1. Check Node.js and npm
node --version
npm --version

# 2. Check PostgreSQL
psql --version

# 3. Check AWS SDK installed
npm list @aws-sdk/client-s3

# 4. Test database connection (if configured)
npm run migrate

# 5. Check environment variables (don't show values)
grep -E "AWS_|SES_|DB_" .env | cut -d'=' -f1
```

---

## 🎯 Next Steps After Verification

Once all prerequisites are verified:

1. **If SES is in Sandbox:**
   - Verify test email addresses you'll use
   - Document which emails are verified

2. **If SES is in Production:**
   - You're ready to send to any email
   - Still verify your "From" email address

3. **Verify Your From Email:**
   - Add `SES_FROM_EMAIL` to `.env` file
   - Verify this email in SES console
   - Example: `SES_FROM_EMAIL=noreply@yourdomain.com`

4. **Check IAM Permissions:**
   - Ensure your AWS user/role has SES permissions
   - Minimum: `ses:SendEmail`, `ses:SendRawEmail`

---

## ⚠️ Common Issues

### Issue: "SES is not available in my region"
**Solution:** Choose a region that supports SES (us-east-1, us-west-2, etc.)

### Issue: "Cannot verify email address"
**Solution:** 
- Check spam folder for verification email
- Ensure email address is correct
- Try resending verification email

### Issue: "Account is in sandbox"
**Solution:** 
- For development: Verify test email addresses
- For production: Request production access in SES console

### Issue: "Access denied when sending email"
**Solution:**
- Check IAM permissions
- Ensure user has `ses:SendEmail` permission
- Verify email address is verified in SES

---

## ✅ Checklist Summary

- [ ] AWS Account with SES Access
- [ ] SES Account Status Verified (Sandbox/Production)
- [ ] Sending Email Address Verified in SES
- [ ] AWS Credentials Configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
- [ ] AWS_REGION Environment Variable Set
- [ ] Database Migrations Can Be Run
- [ ] Node.js and npm Working

---

**Status Legend:**
- ✅ Verified/Complete
- ⚠️ Needs Verification
- ❌ Not Configured

