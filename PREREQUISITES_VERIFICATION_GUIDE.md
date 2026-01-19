# Prerequisites Verification Guide

## ✅ Current Status Summary

Based on your current setup, here's what's already configured:

### ✅ Already Configured:
1. **Node.js and npm** - ✅ Verified
   - Node.js: v24.4.1
   - npm: 11.4.2

2. **PostgreSQL** - ✅ Verified
   - PostgreSQL 16.11 installed
   - Database credentials in `.env`

3. **AWS Credentials** - ✅ Configured
   - `AWS_ACCESS_KEY_ID` - Present
   - `AWS_SECRET_ACCESS_KEY` - Present
   - `AWS_REGION` - Present

4. **SES Configuration Variables** - ✅ Configured
   - `SES_FROM_EMAIL` - Present
   - `SES_FROM_NAME` - Present (SportsArena)

5. **Database Setup** - ✅ Configured
   - Database credentials present
   - Migration scripts available

6. **AWS SDK** - ✅ Installed
   - `@aws-sdk/client-s3` already installed
   - Can use same pattern for SES

---

## ⚠️ Items That Need Manual Verification

These items require you to check your AWS Console:

### 1. AWS Account with SES Access
**Action:** Verify you can access SES in AWS Console

**Steps:**
1. Go to: https://console.aws.amazon.com
2. Search for "SES" in the services search bar
3. Click "Amazon Simple Email Service"
4. If you can see the SES dashboard → ✅ You have access
5. If you get an error → ❌ Need to enable SES

**Note:** If SES is not available in your current region, you may need to switch regions or choose a different region that supports SES.

---

### 2. SES Account Status (Sandbox vs Production)
**Action:** Check if your SES account is in Sandbox or Production mode

**Steps:**
1. In AWS SES Console, look at the left sidebar
2. Click "Account dashboard" or look at the main page
3. Check for "Account status" or "Sending limits"

**What to Look For:**

**Sandbox Mode:**
- Limited to 200 emails per day
- Limited to 1 email per second
- Can only send to verified email addresses
- Message: "Your account is in the Amazon SES sandbox"

**Production Mode:**
- Higher sending limits (based on your request)
- Can send to any email address
- Message: "Your account is out of the Amazon SES sandbox"

**If in Sandbox (for development):**
- ✅ This is fine for development
- You'll need to verify recipient email addresses
- Go to "Verified identities" → Add test emails

**If in Production:**
- ✅ Ready for production use
- Still need to verify your "From" email address

**To Request Production Access:**
1. SES Console → Account dashboard
2. Click "Request production access"
3. Fill out the form (use case, expected volume, etc.)
4. Wait for approval (usually 24-48 hours)

---

### 3. Verify Your "From" Email Address
**Action:** Ensure the email in `SES_FROM_EMAIL` is verified in SES

**Steps:**
1. Check what email is in your `.env` file for `SES_FROM_EMAIL`
2. Go to AWS SES Console → "Verified identities"
3. Look for your email address in the list
4. Check if status is "Verified" ✅ or "Pending verification" ⚠️

**If Not Verified:**
1. Click "Create identity"
2. Choose "Email address"
3. Enter the email from your `SES_FROM_EMAIL`
4. Click "Create identity"
5. Check your email inbox for verification email
6. Click the verification link
7. Status should change to "Verified"

**If Already Verified:**
- ✅ You're good to go!

**Important Notes:**
- The email must be verified before you can send emails
- If in Sandbox mode, you can only send TO verified emails too
- For production, you can send to any email, but FROM must be verified

---

### 4. IAM Permissions Check
**Action:** Verify your AWS user has SES permissions

**Steps:**
1. Go to AWS Console → IAM → Users
2. Find the user associated with your `AWS_ACCESS_KEY_ID`
3. Click on the user → "Permissions" tab
4. Check if there's a policy with SES permissions

**Required Permissions:**
- `ses:SendEmail`
- `ses:SendRawEmail`

**If Permissions Missing:**
1. IAM → Users → Your User → "Add permissions"
2. Choose "Attach policies directly"
3. Search for "AmazonSESFullAccess" (or create custom policy with just SendEmail)
4. Attach the policy

**Security Best Practice:**
- Instead of full access, create a custom policy with only:
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

---

## 🧪 Quick Verification Test

Once you've verified the above, you can test SES access with this simple Node.js script:

**Create a test file:** `test-ses-access.js`
```javascript
require('dotenv').config();
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function testSES() {
  try {
    // Just test if we can create the client and access SES
    console.log('✅ SES Client created successfully');
    console.log(`✅ Region: ${process.env.AWS_REGION}`);
    console.log(`✅ From Email: ${process.env.SES_FROM_EMAIL}`);
    console.log('✅ Configuration looks good!');
    
    // Note: We're not sending an email here, just testing access
    console.log('\n📝 Next: Verify your email in SES Console');
    console.log('📝 Then: Install @aws-sdk/client-ses package');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSES();
```

**Run the test:**
```bash
node test-ses-access.js
```

**Note:** This won't actually send an email, just verify configuration.

---

## 📋 Verification Checklist

Use this checklist to track your progress:

### AWS Console Verification:
- [ ] Can access AWS SES Console
- [ ] Checked SES account status (Sandbox/Production)
- [ ] Verified `SES_FROM_EMAIL` in SES Console
- [ ] Checked IAM permissions for SES

### Environment Variables:
- [x] `AWS_ACCESS_KEY_ID` - ✅ Present
- [x] `AWS_SECRET_ACCESS_KEY` - ✅ Present
- [x] `AWS_REGION` - ✅ Present
- [x] `SES_FROM_EMAIL` - ✅ Present
- [x] `SES_FROM_NAME` - ✅ Present

### System Requirements:
- [x] Node.js installed - ✅ v24.4.1
- [x] npm installed - ✅ 11.4.2
- [x] PostgreSQL installed - ✅ 16.11
- [x] Database credentials configured - ✅ Present

---

## 🎯 Next Steps

Once you've verified all items above:

1. **If SES is in Sandbox:**
   - Verify at least 2-3 test email addresses
   - These will be the emails you can send TO during development

2. **If SES is in Production:**
   - You're ready to send to any email
   - Still verify your FROM email

3. **Install SES SDK:**
   ```bash
   npm install @aws-sdk/client-ses
   ```

4. **Proceed to Phase 1: AWS SES Setup and Configuration**

---

## ❓ Common Questions

**Q: Can I use the same AWS credentials for SES as I use for S3?**
A: Yes! If your S3 is working, the same credentials will work for SES (assuming proper IAM permissions).

**Q: Do I need a separate AWS account for SES?**
A: No, SES is a service within your existing AWS account.

**Q: How long does email verification take?**
A: Usually instant, but can take a few minutes. Check your spam folder if you don't see it.

**Q: Can I change my FROM email later?**
A: Yes, but you'll need to verify the new email address in SES.

**Q: What if SES is not available in my region?**
A: Choose a region that supports SES (us-east-1, us-west-2, eu-west-1, etc.) and update your `AWS_REGION`.

---

## 📞 Need Help?

If you encounter issues:

1. **SES Console Access Issues:**
   - Check if you're in the correct AWS account
   - Verify your user has console access
   - Try a different browser or incognito mode

2. **Email Verification Issues:**
   - Check spam/junk folder
   - Verify email address is correct
   - Try resending verification email
   - Wait a few minutes and check again

3. **Permission Issues:**
   - Verify IAM user has SES permissions
   - Check if access keys are correct
   - Verify region supports SES

---

**Ready to proceed?** Once all items are verified, move to **Phase 1: AWS SES Setup and Configuration** in the main implementation plan.

