# 📮 Postman Guide: Upload Facility Image

Complete step-by-step guide for testing facility image upload using Postman.

---

## 📋 Prerequisites

Before you start, ensure you have:

1. ✅ Backend server running on `http://localhost:3000`
2. ✅ Valid JWT authentication token (from login endpoint)
3. ✅ Facility exists with ID = 1 (or use your facility ID)
4. ✅ Image file ready (JPEG, PNG, or WebP, max 5MB)

---

## 🔑 Step 0: Get Authentication Token

First, you need to authenticate and get a JWT token.

**Request:**
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/v1/auth/login`
- **Headers:**
  ```
  Content-Type: application/json
  ```
- **Body (raw JSON):**
  ```json
  {
    "email": "facility_owner@example.com",
    "password": "your_password"
  }
  ```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

**📌 Copy the `token` value - you'll need it for all subsequent requests!**

---

## 📸 Step 1: Register Image Intent

Create an image record in the database before uploading.

**Request:**
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/v1/images`
- **Headers:**
  ```
  Authorization: Bearer YOUR_TOKEN_HERE
  Content-Type: application/json
  ```
- **Body (raw JSON):**
  ```json
  {
    "entityType": "facility",
    "entityId": 1,
    "imageType": "gallery",
    "displayOrder": 0
  }
  ```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Image record created successfully. Ready for file upload.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "entityType": "facility",
    "entityId": 1,
    "imageType": "gallery",
    "s3Key": null,
    "publicUrl": null,
    "variants": {
      "thumb": null,
      "medium": null,
      "full": null
    },
    "uploadStatus": "pending",
    "createdAt": "2025-01-20T10:00:00.000Z"
  }
}
```

**📌 Copy the `id` (imageId) - you'll need it for the next steps!**

---

## 🔗 Step 2: Get Pre-Signed Upload URL

Request a temporary URL for uploading directly to S3.

**Request:**
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/v1/images/id/{imageId}/presign`
  - Replace `{imageId}` with the ID from Step 1
  - Example: `http://localhost:3000/api/v1/images/id/550e8400-e29b-41d4-a716-446655440000/presign`
- **Headers:**
  ```
  Authorization: Bearer YOUR_TOKEN_HERE
  Content-Type: application/json
  ```
- **Body (raw JSON):**
  ```json
  {
    "contentType": "image/jpeg"
  }
  ```
  
  **Note:** Use the MIME type matching your image file:
  - `image/jpeg` for `.jpg` files
  - `image/png` for `.png` files
  - `image/webp` for `.webp` files

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Pre-signed URL generated successfully",
  "data": {
    "uploadUrl": "https://sportsarena-images-prod.s3.us-east-1.amazonaws.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
    "s3Key": "facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "publicUrl": "https://d3s74c2mbhezp6.cloudfront.net/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "expiresIn": 300,
    "maxFileSize": 5242880
  }
}
```

**📌 Copy the `uploadUrl` - you'll upload your file to this URL in the next step!**

---

## ☁️ Step 3: Upload File Directly to S3

**⚠️ CRITICAL: This upload goes DIRECTLY to S3, NOT to the backend!**

**Request:**
- **Method:** `PUT`
- **URL:** Paste the `uploadUrl` from Step 2
  - **⚠️ IMPORTANT:** Use the EXACT URL from Step 2 response - do NOT modify it or add any query parameters!
  - Example: `https://sportsarena-images-prod.s3.eu-north-1.amazonaws.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg?X-Amz-Algorithm=...`
- **Headers:**
  ```
  Content-Type: image/jpeg
  ```
  - Use the same `Content-Type` as in Step 2 (e.g., `image/jpeg`, `image/png`, `image/webp`)
  - **⚠️ CRITICAL:** Only include `Content-Type` header - no other headers!
  - **⚠️ DO NOT include `Authorization` header!** The pre-signed URL already contains authentication.
  - **⚠️ DO NOT add checksum headers** (`x-amz-checksum-*`, `x-amz-sdk-*`, etc.)
  - **⚠️ DO NOT modify the URL** - use it exactly as returned from Step 2
- **Body:**
  - Select **"binary"** or **"file"** tab
  - Click **"Select File"** and choose your image file
  - **DO NOT** use `multipart/form-data` - use raw binary!
  - **DO NOT** enable any automatic checksums or compression in Postman

**Expected Response (200 OK):**
- HTTP Status: `200 OK`
- Empty response body

**⚠️ Common Error: "Only one auth mechanism allowed"**
- **Cause:** Postman is sending `Authorization: Bearer {token}` header automatically
- **Solution:** Remove the Authorization header from this request
  - In Postman: Go to Headers tab → Delete the `Authorization` header
  - Or: Create a separate request (not inheriting collection auth) for S3 uploads

**⚠️ Common Error: "SignatureDoesNotMatch"**
- **Cause:** Postman or client is adding extra headers/query parameters that weren't in the signature
- **Common culprits:**
  - Automatic checksum headers (`x-amz-checksum-*`)
  - SDK headers (`x-amz-sdk-*`)
  - Modified URL query parameters
- **Solution:**
  1. Use the **exact URL** from Step 2 - don't modify it
  2. **Only include `Content-Type` header** - remove all other headers
  3. In Postman: Disable automatic checksums/compression in settings
  4. Make sure you're using **raw binary/file** body type, not form-data
  5. Copy the URL exactly as returned - don't add/remove query parameters

**💡 Tip:** If you get a 403 error, the pre-signed URL may have expired (they expire in 5 minutes). Go back to Step 2 and get a new URL.

---

## ✅ Step 4: Confirm Upload Completion

Notify the backend that the upload was successful.

**Request:**
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/v1/images/id/{imageId}/confirm-upload`
  - Replace `{imageId}` with the ID from Step 1
  - Example: `http://localhost:3000/api/v1/images/id/550e8400-e29b-41d4-a716-446655440000/confirm-upload`
- **Headers:**
  ```
  Authorization: Bearer YOUR_TOKEN_HERE
  Content-Type: application/json
  ```
- **Body (raw JSON):**
  ```json
  {
    "fileSize": 245678,
    "contentType": "image/jpeg"
  }
  ```
  - `fileSize`: Size of your uploaded file in bytes
  - `contentType`: Same MIME type as Step 2

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Image upload confirmed successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "entityType": "facility",
    "entityId": 1,
    "imageType": "gallery",
    "s3Key": "facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "publicUrl": "https://d3s74c2mbhezp6.cloudfront.net/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "variants": {
      "thumb": "https://d3s74c2mbhezp6.cloudfront.net/facility/1/550e8400-e29b-41d4-a716-446655440000_thumb.jpg",
      "medium": "https://d3s74c2mbhezp6.cloudfront.net/facility/1/550e8400-e29b-41d4-a716-446655440000_medium.jpg",
      "full": "https://d3s74c2mbhezp6.cloudfront.net/facility/1/550e8400-e29b-41d4-a716-446655440000_full.jpg"
    },
    "uploadStatus": "uploaded",
    "uploadedAt": "2025-01-20T10:05:00.000Z",
    "fileSize": 245678,
    "contentType": "image/jpeg"
  }
  }
}
```

**🎉 Success! Your image is now uploaded and confirmed.**

---

## 🔍 Step 5: Verify Image (Optional)

Get the uploaded image to verify it's available.

**Request:**
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/v1/images/id/{imageId}`
  - Replace `{imageId}` with the ID from Step 1
- **Headers:**
  ```
  Authorization: Bearer YOUR_TOKEN_HERE
  ```

**Expected Response (200 OK):**
Same as Step 4 response, confirming the image is stored and has a CDN URL.

---

## 📋 Quick Reference: Complete Flow

```
1. POST /api/v1/images
   → Get imageId

2. POST /api/v1/images/id/{imageId}/presign
   → Get uploadUrl

3. PUT {uploadUrl} (directly to S3)
   → Upload file binary

4. POST /api/v1/images/id/{imageId}/confirm-upload
   → Confirm completion
```

---

## 🐛 Common Issues & Solutions

### Issue: 401 Unauthorized

**Cause:** Invalid or expired JWT token

**Solution:**
- Get a new token from login endpoint (Step 0)
- Ensure token is in `Authorization: Bearer {token}` header format

---

### Issue: 403 Forbidden

**Cause:** User doesn't have permission to upload for this facility

**Solution:**
- Ensure you're logged in as the facility owner
- Check that `entityId` matches a facility you own

---

### Issue: 400 Bad Request - Image Limit Reached

**Cause:** Facility already has maximum number of gallery images (20)

**Solution:**
- Delete existing images first, or
- Use a different image type (e.g., `cover` instead of `gallery`)

---

### Issue: 403 on S3 Upload (Step 3) - "Only one auth mechanism allowed"

**Cause:** Authorization header is being sent with the pre-signed URL request

**Solution:**
- **Remove the `Authorization` header** from Step 3 request
- Pre-signed URLs already contain authentication in the query string
- In Postman: Delete the Authorization header manually for this request
- Or: Don't inherit auth from collection/environment for Step 3

### Issue: 403 on S3 Upload (Step 3) - URL Expired

**Cause:** Pre-signed URL expired (they expire in 5 minutes)

**Solution:**
- Go back to Step 2 and get a new pre-signed URL
- Upload immediately after getting the URL

---

### Issue: Wrong Content-Type

**Cause:** Content-Type header doesn't match file type

**Solution:**
- Use `image/jpeg` for `.jpg` files
- Use `image/png` for `.png` files
- Use `image/webp` for `.webp` files
- Ensure Content-Type matches in Step 2 and Step 3

---

### Issue: File Too Large

**Cause:** File exceeds 5MB limit

**Solution:**
- Compress or resize your image
- Maximum file size: 5MB (5,242,880 bytes)

---

## 🎯 Postman Collection Tips

### Use Environment Variables

Create a Postman environment with:
- `base_url`: `http://localhost:3000`
- `token`: Your JWT token
- `imageId`: Image ID (set after Step 1)

Then use: `{{base_url}}/api/v1/images` and `{{token}}` in headers.

### Save as Collection

1. Create a new Collection: "SportsArena Image Upload"
2. Add all 5 requests as separate requests
3. Set collection-level auth (Bearer Token) using `{{token}}` for Steps 1, 2, 4, 5
4. **For Step 3 (S3 upload):** Override collection auth and remove Authorization header
   - Right-click Step 3 request → Edit
   - Go to Authorization tab → Select "Inherit auth from parent" → **Turn OFF**
   - Remove any Authorization header manually
5. Save for easy reuse

### Pre-request Scripts (Optional)

For Step 4, you can automatically get file size:

```javascript
// In Step 4 pre-request script:
const fileSize = pm.environment.get("file_size") || 0;
pm.request.body.raw = JSON.stringify({
  fileSize: parseInt(fileSize),
  contentType: "image/jpeg"
});
```

---

## 📝 Example: Upload Facility Cover Image

Instead of `gallery`, upload a `cover` image (facility cover photo):

**Step 1 Body:**
```json
{
  "entityType": "facility",
  "entityId": 1,
  "imageType": "cover"
}
```

**Note:** `cover` images are single-image types, so only 1 cover image is allowed per facility. If one exists, delete it first or update it.

---

## ✅ Verification Checklist

After completing all steps:

- [ ] Image record created in database
- [ ] Pre-signed URL generated successfully
- [ ] File uploaded to S3 (200 OK response)
- [ ] Upload confirmed (uploadStatus = "uploaded")
- [ ] publicUrl contains CDN domain
- [ ] Variant URLs generated correctly
- [ ] Image accessible via GET endpoint

---

## 🎉 Success!

If you see the final response with `uploadStatus: "uploaded"` and a valid `publicUrl`, your image upload is complete!

You can now use the `publicUrl` or variant URLs (`thumb`, `medium`, `full`) to display the image in your frontend application.

---

**Need Help?** Check the [Image Upload API Guide](./API/IMAGE_UPLOAD_API_GUIDE.md) for more details.

