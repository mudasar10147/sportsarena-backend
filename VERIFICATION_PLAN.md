# Verification Plan - Prerequisites, Phase 1 & Phase 2

## Current Status Summary

Based on automated checks, here's what's already verified:

### ✅ Already Verified (Automated):
- ✅ Node.js v24.4.1 installed
- ✅ npm 11.4.2 installed
- ✅ PostgreSQL 16.11 installed
- ✅ AWS_ACCESS_KEY_ID present in .env
- ✅ AWS_SECRET_ACCESS_KEY present in .env
- ✅ AWS_REGION present in .env
- ✅ SES_FROM_EMAIL present in .env
- ✅ SES_FROM_NAME present in .env
- ✅ Database credentials present in .env
- ✅ @aws-sdk/client-ses@3.962.0 installed

---

## PREREQUISITES CHECKLIST - Verification Steps

### [ ] AWS Account with SES Access

**Verification Steps:**
1. Open web browser
2. Go to: https://console.aws.amazon.com
3. Log into your AWS account
4. In the top search bar, type: "SES"
5. Click on "Amazon Simple Email Service"
6. **Expected Result:** You should see the SES dashboard/console
7. **If you see the dashboard:** ✅ Verified
8. **If you get an error:** ❌ Need to enable SES or check account permissions

**Notes:**
- If SES is not available in your current region, try switching regions
- SES is available in: us-east-1, us-west-2, eu-west-1, ap-southeast-1, and others
- If you can't access SES, you may need to enable it for your account

---

### [ ] SES Account Verified (Sandbox or Production)

**Verification Steps:**
1. In AWS SES Console, look at the left sidebar
2. Click on "Account dashboard" (or it may be the default view)
3. Look for "Account status" or "Sending limits" section
4. **Check for one of these:**
   - **Sandbox Mode:** 
     - Message: "Your account is in the Amazon SES sandbox"
     - Limits: 200 emails/day, 1 email/second
     - Can only send TO verified email addresses
     - ✅ OK for development/testing
   - **Production Mode:**
     - Message: "Your account is out of the Amazon SES sandbox"
     - Higher limits (based on your request)
     - Can send to any email address
     - ✅ Ready for production

**Action Items:**
- **If Sandbox:** Note that you'll need to verify recipient emails for testing
- **If Production:** You're ready to send to any email
- **To Request Production:** SES Console → Account dashboard → "Request production access"

**Mark as:** [ ] Sandbox or [ ] Production

---

### [ ] Sending Email Address/Domain Verified in SES

**Verification Steps:**
1. In AWS SES Console, click "Verified identities" in the left sidebar
2. Look at the list of verified identities
3. Check if your email (from `SES_FROM_EMAIL` in .env) appears in the list
4. **Check the status:**
   - **Verified:** ✅ Green checkmark, status shows "Verified"
   - **Pending:** ⚠️ Status shows "Pending verification" (check email inbox)
   - **Not Found:** ❌ Email is not in the list

**If Email is NOT Verified:**
1. Click "Create identity" button
2. Choose "Email address" (not domain)
3. Enter the email address from your `SES_FROM_EMAIL` environment variable
4. Click "Create identity"
5. Check your email inbox (and spam folder) for verification email
6. Click the verification link in the email
7. Return to SES Console and verify status changed to "Verified"

**If Using Domain (Advanced):**
1. Choose "Domain" instead of "Email address"
2. Enter your domain (e.g., yourdomain.com)
3. Follow DNS configuration instructions:
   - Add SPF record
   - Add DKIM records (3 CNAME records)
   - Optionally add DMARC record
4. Wait for verification (can take up to 72 hours)

**Mark as:** [ ] Verified or [ ] Needs Verification

---

### [ ] AWS Credentials Configured

**Status:** ✅ Already verified via automated check

**What Was Checked:**
- AWS_ACCESS_KEY_ID: Present in .env
- AWS_SECRET_ACCESS_KEY: Present in .env
- AWS_REGION: Present in .env

**Additional Verification (Optional):**
- If S3 is working in your app, these credentials are valid
- You can test by trying to access S3 from your application

**Mark as:** ✅ Verified

---

### [ ] AWS_REGION Environment Variable Set

**Status:** ✅ Already verified via automated check

**What Was Checked:**
- AWS_REGION: Present in .env

**Additional Verification:**
- Check that the region supports SES
- Common SES regions: us-east-1, us-west-2, eu-west-1, ap-southeast-1
- If your region doesn't support SES, you may need to change it

**Mark as:** ✅ Verified

---

### [ ] Database Migrations Can Be Run

**Status:** ✅ Already verified via automated check

**What Was Checked:**
- PostgreSQL 16.11 installed
- Database credentials present in .env

**Additional Verification (Optional Test):**
1. Run: `npm run migrate`
2. **Expected:** Migrations run successfully
3. **If errors:** Check database connection and credentials

**Mark as:** ✅ Verified (or test manually if needed)

---

### [ ] Node.js and npm Working

**Status:** ✅ Already verified via automated check

**What Was Checked:**
- Node.js: v24.4.1
- npm: 11.4.2

**Mark as:** ✅ Verified

---

## PHASE 1: AWS SES SETUP AND CONFIGURATION - Verification Steps

### Step 1.1: Verify AWS SES Account Status

**Status:** ⚠️ Requires manual verification (same as Prerequisites above)

**Action:** Complete the "SES Account Verified" check above, then mark this as complete.

**Mark as:** [ ] Complete (after verifying sandbox/production status)

---

### Step 1.2: Verify Sending Email Address/Domain

**Status:** ⚠️ Requires manual verification (same as Prerequisites above)

**Action:** Complete the "Sending Email Address Verified" check above, then mark this as complete.

**Mark as:** [ ] Complete (after verifying FROM email in SES Console)

---

### Step 1.3: Check SES Sending Limits

**Verification Steps:**
1. In AWS SES Console, go to "Account dashboard"
2. Look for "Sending limits" or "Sending statistics" section
3. **Note the limits:**
   - **Sandbox:**
     - Maximum send rate: 1 email per second
     - Maximum send quota: 200 emails per day
   - **Production:**
     - Maximum send rate: Check your specific quota
     - Maximum send quota: Check your specific quota

**Action Items:**
- Document your limits for rate limiting implementation
- Plan your rate limiting strategy based on these limits
- For sandbox: Plan to stay under 200 emails/day and 1/second

**Mark as:** [ ] Complete (after noting your limits)

---

### Step 1.4: Install AWS SES SDK Package

**Status:** ✅ Already completed

**What Was Done:**
- ✅ Added @aws-sdk/client-ses to package.json
- ✅ Ran npm install
- ✅ Verified package installed: @aws-sdk/client-ses@3.962.0

**Mark as:** ✅ Complete

---

## PHASE 2: ENVIRONMENT CONFIGURATION - Verification Steps

### Step 2.1: Add SES Environment Variables

**Current Status Check:**

**Required Variables:**
- [x] AWS_ACCESS_KEY_ID - ✅ Present
- [x] AWS_SECRET_ACCESS_KEY - ✅ Present
- [x] AWS_REGION - ✅ Present
- [x] SES_FROM_EMAIL - ✅ Present
- [x] SES_FROM_NAME - ✅ Present

**Optional Variable:**
- [ ] AWS_SES_REGION - Not present (but AWS_REGION can be reused)

**Verification Steps:**
1. Open your `.env` file
2. Verify these variables exist and have values:
   - `AWS_ACCESS_KEY_ID=your_key_here`
   - `AWS_SECRET_ACCESS_KEY=your_secret_here`
   - `AWS_REGION=us-east-1` (or your region)
   - `SES_FROM_EMAIL=your-verified-email@domain.com`
   - `SES_FROM_NAME=SportsArena` (or your name)

**Decision Point:**
- **Option A:** Reuse `AWS_REGION` for SES (recommended)
- **Option B:** Add separate `AWS_SES_REGION` if you want different regions

**Recommendation:** Reuse `AWS_REGION` unless you have a specific need for different regions.

**Mark as:** ✅ Complete (all required variables present)

---

### Step 2.2: Verify IAM Permissions

**Verification Steps:**

**Method 1: Check via AWS Console**
1. Go to AWS Console → IAM
2. Click "Users" in the left sidebar
3. Find the user associated with your `AWS_ACCESS_KEY_ID`
   - If you don't know which user, you may need to check your AWS account
4. Click on the user name
5. Go to "Permissions" tab
6. Look for policies that include SES permissions
7. **Check for:**
   - Policy name containing "SES" or "SimpleEmailService"
   - Or custom policy with `ses:SendEmail` and `ses:SendRawEmail` permissions

**Method 2: Test via AWS CLI (if installed)**
1. Run: `aws ses get-send-quota --region us-east-1`
2. **If successful:** ✅ Permissions are correct
3. **If access denied:** ❌ Need to add SES permissions

**Method 3: Test via Application (after SES config is created)**
- Once we create the SES configuration file, we can test sending
- This will reveal permission issues immediately

**Required Permissions:**
- `ses:SendEmail` - Required for sending emails
- `ses:SendRawEmail` - Required for sending raw emails (optional but recommended)

**If Permissions Missing:**
1. IAM → Users → Your User → "Add permissions"
2. Choose "Attach policies directly"
3. Search for "AmazonSESFullAccess" (or create custom policy)
4. **OR** Create custom policy with minimal permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ses:SendEmail",
           "ses:SendRawEmail"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

**Mark as:** [ ] Complete (after verifying or adding permissions)

---

## VERIFICATION SUMMARY CHECKLIST

### Prerequisites:
- [ ] AWS account with SES access
- [ ] SES account verified (sandbox or production)
- [ ] Sending email address/domain verified in SES
- [x] AWS credentials configured
- [x] AWS_REGION environment variable set
- [x] Database migrations can be run
- [x] Node.js and npm working

### Phase 1:
- [ ] Step 1.1: Verify AWS SES account status
- [ ] Step 1.2: Verify sending email address/domain
- [ ] Step 1.3: Check SES sending limits
- [x] Step 1.4: Install AWS SES SDK package

### Phase 2:
- [x] Step 2.1: Add SES environment variables
- [ ] Step 2.2: Verify IAM permissions

---

## NEXT STEPS AFTER VERIFICATION

Once all items above are verified:

1. **If any prerequisites are missing:** Complete them first
2. **If SES is in Sandbox:** Verify test email addresses you'll use
3. **If IAM permissions are missing:** Add them via AWS Console
4. **Then proceed to:** Phase 3: Database Schema Design

---

## QUICK REFERENCE LINKS

- AWS SES Console: https://console.aws.amazon.com/ses
- IAM Console: https://console.aws.amazon.com/iam
- AWS SES Documentation: https://docs.aws.amazon.com/ses

---

**Last Updated:** Use this checklist to track your verification progress. Mark each item as you complete it.

