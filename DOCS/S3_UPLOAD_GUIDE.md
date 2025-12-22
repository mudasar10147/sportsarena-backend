# 🚀 S3 Pre-Signed URL Upload Guide

Complete guide for frontend developers on how to upload images using pre-signed URLs.

---

## Overview

The SportsArena backend uses **AWS S3 pre-signed URLs** for image uploads. This means:

- ✅ **No backend file handling** - Images upload directly to S3
- ✅ **Secure** - Pre-signed URLs expire in 5 minutes
- ✅ **Fast** - Direct client-to-S3 upload (no backend bottleneck)
- ✅ **Scalable** - Backend never processes binary data

---

## Upload Flow

```
┌─────────┐     1. POST /images          ┌─────────┐
│ Client  │ ──────────────────────────► │ Backend │
└─────────┘                              └────┬────┘
     │                                        │
     │     2. Returns imageId                 │
     │ ◄──────────────────────────────────────┘
     │
     │     3. POST /images/id/:imageId/presign
     │ ───────────────────────────────────────►
     │                                        │
     │     4. Returns pre-signed URL          │
     │ ◄──────────────────────────────────────┘
     │
     │     5. PUT <pre-signed-url>
     │ ───────────────────────────────────────►
     │                                        │
     │                                        │
     │                                        ▼
     │                                  ┌─────────┐
     │                                  │   S3    │
     │                                  └─────────┘
     │
     │     6. POST /images/id/:imageId/confirm-upload (REQUIRED)
     │ ───────────────────────────────────────►
     │                                        │
     │     7. Returns updated image           │
     │ ◄──────────────────────────────────────┘
```

---

## Step-by-Step Implementation

### Step 1: Register Image Intent

First, create an image record in the database:

```javascript
const createImage = async (entityType, entityId, imageType, token) => {
  const response = await fetch('/api/v1/images', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      entityType,      // 'user', 'facility', 'court', etc.
      entityId,        // Entity ID (number)
      imageType,       // 'profile', 'gallery', 'cover', etc.
      displayOrder: 0  // Optional: for gallery images
    })
  });

  if (!response.ok) {
    throw new Error('Failed to create image record');
  }

  const { data } = await response.json();
  return data; // Contains imageId
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "entityType": "facility",
    "entityId": 1,
    "imageType": "gallery",
    "storageKey": null,
    "url": null,
    ...
  }
}
```

---

### Step 2: Get Pre-Signed URL

Request a pre-signed URL for the image:

```javascript
const getPresignedUrl = async (imageId, contentType, token) => {
  const response = await fetch(`/api/v1/images/id/${imageId}/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contentType  // 'image/jpeg', 'image/png', or 'image/webp'
    })
  });

  if (!response.ok) {
    throw new Error('Failed to get pre-signed URL');
  }

  const { data } = await response.json();
  return data;
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://bucket.s3.region.amazonaws.com/...?X-Amz-Algorithm=...",
    "s3Key": "facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "s3Url": "https://bucket.s3.region.amazonaws.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "expiresIn": 300,
    "maxFileSize": 5242880
  }
}
```

**Important Notes:**
- ⏰ URL expires in **5 minutes** (300 seconds)
- 📏 Maximum file size: **5MB** (5242880 bytes)
- ✅ Allowed types: `image/jpeg`, `image/png`, `image/webp`

---

### Step 3: Upload File to S3

Upload the file **directly to S3** using the pre-signed URL:

```javascript
const uploadToS3 = async (file, presignedUrl, contentType) => {
  // Validate file size
  if (file.size > 5242880) { // 5MB
    throw new Error('File size exceeds 5MB limit');
  }

  // Validate file type
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
  }

  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType  // Must match the contentType used in presign request
    },
    body: file  // File object (Blob)
  });

  if (!response.ok) {
    throw new Error('Failed to upload to S3');
  }

  return true;
};
```

**Critical:**
- ✅ Use **PUT** method (not POST)
- ✅ Set **Content-Type** header to match the `contentType` from presign request
- ✅ Send file as **body** (not FormData)
- ✅ **Do NOT** add any other headers

---

### Step 4: Confirm Upload (REQUIRED)

**⚠️ REQUIRED:** After successful S3 upload, you MUST confirm the upload to finalize the image record.

```javascript
const confirmUpload = async (imageId, fileSize, contentType, token) => {
  const response = await fetch(`/api/v1/images/id/${imageId}/confirm-upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileSize: fileSize,      // Required: File size in bytes
      contentType: contentType // Required: MIME type (must match Step 2)
    })
  });

  if (!response.ok) {
    throw new Error('Failed to confirm upload');
  }

  return response.json();
};
```

**Important Notes:**
- ✅ **This step is REQUIRED** - Image remains in 'pending' status until confirmed
- ✅ **fileSize and contentType are required** - Must match actual uploaded file
- ✅ **Upload status changes** - From 'pending' → 'uploaded'
- ✅ **Timestamp recorded** - `uploadedAt` is set to current time

---

## Complete Example

```javascript
async function uploadImage(file, entityType, entityId, imageType, token) {
  try {
    // Step 1: Create image record
    const image = await createImage(entityType, entityId, imageType, token);
    console.log('Image record created:', image.id);

    // Step 2: Get pre-signed URL
    const presignData = await getPresignedUrl(image.id, file.type, token);
    console.log('Pre-signed URL received, expires in:', presignData.expiresIn, 'seconds');

    // Step 3: Upload to S3
    await uploadToS3(file, presignData.uploadUrl, file.type);
    console.log('File uploaded to S3 successfully');

    // Step 4: Confirm upload (REQUIRED)
    await confirmUpload(image.id, file.size, file.type, token);

    console.log('Upload complete! Image URL:', presignData.s3Url);
    return presignData.s3Url;

  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Helper function to get image dimensions
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Usage
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      const imageUrl = await uploadImage(
        file,
        'facility',
        1,
        'gallery',
        userToken
      );
      console.log('Image available at:', imageUrl);
    } catch (error) {
      alert('Upload failed: ' + error.message);
    }
  }
});
```

---

## Error Handling

### Common Errors

**1. Invalid Content Type**
```json
{
  "success": false,
  "message": "Invalid content type. Allowed types: image/jpeg, image/png, image/webp",
  "error_code": "INVALID_CONTENT_TYPE"
}
```
**Solution:** Ensure file is JPEG, PNG, or WebP.

---

**2. Image Already Uploaded**
```json
{
  "success": false,
  "message": "Image has already been uploaded",
  "error_code": "IMAGE_ALREADY_UPLOADED"
}
```
**Solution:** Create a new image record if you need to upload again.

---

**3. Pre-Signed URL Expired**
```
403 Forbidden
```
**Solution:** Request a new pre-signed URL (they expire in 5 minutes).

---

**4. File Too Large**
```
413 Payload Too Large
```
**Solution:** Compress image or reduce file size (max 5MB).

---

**5. Permission Denied**
```json
{
  "success": false,
  "message": "You do not have permission to upload this image",
  "error_code": "FORBIDDEN"
}
```
**Solution:** Ensure you own the entity or have appropriate role.

---

## Best Practices

1. **Validate on Client Side:**
   - Check file size before upload
   - Validate file type
   - Show user-friendly error messages

2. **Handle Expiration:**
   - Request pre-signed URL just before upload
   - Don't cache pre-signed URLs
   - Request new URL if upload fails due to expiration

3. **Progress Tracking:**
   - Use `XMLHttpRequest` or `fetch` with progress tracking
   - Show upload progress to user

4. **Error Recovery:**
   - Retry failed uploads
   - Clean up failed image records if needed

5. **Image Optimization:**
   - Compress images before upload
   - Consider converting to WebP for better compression
   - Resize large images to reasonable dimensions

---

## Security Notes

- ✅ **Never expose AWS credentials** - All credentials are server-side only
- ✅ **Pre-signed URLs are temporary** - They expire in 5 minutes
- ✅ **Content-Type is enforced** - Only specified MIME types are allowed
- ✅ **File size limits** - 5MB maximum enforced
- ✅ **Role-based access** - Users can only upload images for entities they own

---

## Testing

### Using cURL

```bash
# 1. Create image record
curl -X POST http://localhost:3000/api/v1/images \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "facility",
    "entityId": 1,
    "imageType": "gallery"
  }'

# 2. Get pre-signed URL
curl -X POST http://localhost:3000/api/v1/images/id/IMAGE_ID/presign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "image/jpeg"
  }'

# 3. Upload to S3 (use the uploadUrl from step 2)
curl -X PUT "PRESIGNED_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @image.jpg
```

---

## Summary

- ✅ **3-step process:** Create record → Get URL → Upload to S3
- ✅ **No backend file handling** - Direct client-to-S3
- ✅ **Secure** - Pre-signed URLs with expiration
- ✅ **Fast** - No backend bottleneck
- ✅ **Scalable** - Backend never processes binary data

The system is production-ready and optimized for performance and security.

