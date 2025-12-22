# Postman S3 Upload Troubleshooting Guide

## ✅ Correct Way to Upload to Pre-Signed URL

### Step-by-Step Instructions

1. **Copy the ENTIRE URL** from Step 2 response (the `uploadUrl` field)
   - Include ALL query parameters
   - Don't modify or remove anything

2. **In Postman, create a NEW request:**
   - **Method:** `PUT`
   - **URL:** Paste the COMPLETE URL in the URL field (all query parameters included)
   - **⚠️ IMPORTANT:** When you paste the URL, Postman will automatically parse query parameters and show them in the "Params" tab - THIS IS OKAY! Don't modify them, just leave them as-is.

3. **Params Tab (Auto-populated):**
   - Postman will automatically show query parameters like:
     - `X-Amz-Algorithm`
     - `X-Amz-Content-Sha256`
     - `X-Amz-Credential`
     - etc.
   - **✅ DO NOTHING** - Leave them exactly as Postman parsed them
   - **✅ DO NOT** delete, modify, or add any parameters
   - These will be sent correctly as part of the URL

4. **Headers Tab:**
   - **ONLY add ONE header manually:**
     - Key: `Content-Type`
     - Value: `image/jpeg` (or `image/png` or `image/webp` - match what you used in Step 2)
   - **✅ Hidden headers are OK:** Postman automatically adds:
     - `Content-Length` (calculated from file size) ✅
     - `host` (from URL) ✅
     - `user-agent` (Postman identifier) ✅
     - `accept` (default) ✅
   - **❌ Delete/Remove these if present:**
     - `Authorization` ❌ (MUST NOT be present)
     - Any `x-amz-*` headers (except ones from URL params) ❌

5. **Authorization Tab:**
   - **Select "No Auth"** (don't inherit from collection/environment)
   - This prevents `Authorization` header from being added

6. **Body Tab:**
   - Select **"binary"** (NOT form-data, NOT raw, NOT x-www-form-urlencoded)
   - Click **"Select File"**
   - Choose your image file

7. **Send the request**

---

## ❌ Common Mistakes That Cause "SignatureDoesNotMatch"

### Mistake 1: Adding Authorization Header
```
❌ WRONG:
Headers:
  Authorization: Bearer eyJhbGci...
  Content-Type: image/jpeg

✅ CORRECT:
Headers:
  Content-Type: image/jpeg
```

### Mistake 2: Modifying Query Parameters in Params Tab
```
❌ WRONG:
After pasting URL, you go to "Params" tab and delete/modify parameters

✅ CORRECT:
Leave Params tab exactly as Postman parsed them from the URL
Postman will send them correctly as query parameters in the URL
```

### Mistake 3: Using Wrong Body Type
```
❌ WRONG:
Body: form-data with file field
Body: raw JSON
Body: x-www-form-urlencoded

✅ CORRECT:
Body: binary (then select file)
```

### Mistake 4: Postman Auto-Adding Headers
Postman might automatically add headers. To prevent this:

1. Go to **Postman Settings** (gear icon)
2. Under **"General"** tab:
   - Turn OFF "Send Postman Token header"
   - Turn OFF any automatic compression/checksums
3. For THIS specific request:
   - Go to **Authorization** tab
   - Select **"No Auth"** (don't inherit from collection)
   - This prevents Authorization header from being added

---

## 🔍 How to Verify Your Request is Correct

### Before Sending, Check:

1. **URL:** Does it match exactly what you copied from Step 2?
2. **Headers:** Do you see ONLY `Content-Type` header?
3. **Body:** Is it set to "binary" with a file selected?
4. **Method:** Is it `PUT` (not POST, not GET)?

### Example of Correct Request:

```
PUT https://sportsarena-images-prod.s3.eu-north-1.amazonaws.com/facility/5/e27d81d6-98f3-4ddf-8e5e-f814c289693a.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=...&X-Amz-Date=...&X-Amz-Expires=300&X-Amz-Signature=...&X-Amz-SignedHeaders=host%3Bx-amz-server-side-encryption&x-amz-checksum-crc32=...&x-amz-meta-entity-id=5&x-amz-meta-entity-type=facility&x-amz-meta-image-id=...&x-amz-meta-uploaded-by=2&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject

Headers:
  Content-Type: image/jpeg

Body:
  [binary] [your-image.jpg selected]
```

---

## 🐛 Error: "SignatureDoesNotMatch"

If you still get this error after following all steps:

1. **Check the timestamp:**
   - Pre-signed URLs expire after 5 minutes (300 seconds)
   - Get a NEW pre-signed URL from Step 2 if it's been more than 5 minutes

2. **Check your system clock:**
   - Your computer's clock must be synchronized
   - If your clock is wrong, AWS will reject the signature

3. **Try a different tool:**
   - Use `curl` to test if Postman is the issue:
   ```bash
   curl -X PUT \
     -H "Content-Type: image/jpeg" \
     --data-binary @/path/to/your/image.jpg \
     "YOUR_PRESIGNED_URL_HERE"
   ```

4. **Verify AWS credentials:**
   - Make sure `AWS_REGION` matches your bucket region (`eu-north-1`)
   - Verify AWS credentials are correct in backend `.env` file

---

## 📝 Quick Checklist

Before uploading, verify:
- [ ] URL is copied COMPLETELY (all query params)
- [ ] Method is `PUT`
- [ ] Only `Content-Type` header is present
- [ ] No `Authorization` header
- [ ] Body type is "binary" (file selected)
- [ ] URL is less than 5 minutes old
- [ ] Content-Type matches what you sent in Step 2

---

## 💡 Pro Tip: Create a Dedicated Request

1. Create a new request called "S3 Upload (Step 3)"
2. Set Authorization to "No Auth" (don't inherit)
3. Don't save it in a collection that has Authorization set
4. Save it as a standalone request

This prevents Postman from automatically adding headers.

