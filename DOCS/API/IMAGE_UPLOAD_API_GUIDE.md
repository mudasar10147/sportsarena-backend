# 📸 Image Upload API Guide for Frontend Developers

Complete guide for frontend developers on how to upload images to SportsArena backend.

**⚠️ CRITICAL: Frontend must upload images DIRECTLY to AWS S3, NOT to the backend.**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Upload Lifecycle](#upload-lifecycle)
3. [Sequence Diagram](#sequence-diagram)
4. [Step-by-Step Guide](#step-by-step-guide)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

---

## Overview

### Key Principles

- ✅ **Direct S3 Upload**: Frontend uploads images directly to AWS S3 using pre-signed URLs
- ❌ **NO Backend Upload**: Backend does NOT accept `multipart/form-data` or binary image data
- ✅ **Metadata Only**: Backend only tracks image metadata and upload status
- ✅ **Secure**: Pre-signed URLs expire in 5 minutes and are scoped to specific images

### Upload Flow Summary

```
1. Frontend → Backend: Register image intent
2. Frontend → Backend: Request pre-signed URL
3. Frontend → S3: Upload image file (direct)
4. Frontend → Backend: Confirm upload completion
```

---

## Upload Lifecycle

### Complete Upload Process

The image upload process consists of **4 sequential steps**:

1. **Image Registration** - Create image record in database
2. **Pre-Signed URL Generation** - Get temporary upload URL from backend
3. **Direct S3 Upload** - Upload file directly to S3 (bypasses backend)
4. **Upload Confirmation** - Notify backend of successful upload

Each step must complete successfully before proceeding to the next.

---

## Sequence Diagram

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│Frontend │         │ Backend │         │   S3    │
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     │ 1. POST /images   │                   │
     │    (register)     │                   │
     │──────────────────►│                   │
     │                   │                   │
     │ 2. Returns        │                   │
     │    imageId        │                   │
     │◄──────────────────│                   │
     │                   │                   │
     │ 3. POST /images/  │                   │
     │    id/:id/presign │                   │
     │──────────────────►│                   │
     │                   │                   │
     │ 4. Returns         │                   │
     │    pre-signed URL  │                   │
     │◄──────────────────│                   │
     │                   │                   │
     │ 5. PUT <pre-signed-url>               │
     │    [Binary Image] │                   │
     │──────────────────────────────────────►│
     │                   │                   │
     │ 6. 200 OK         │                   │
     │◄──────────────────────────────────────│
     │                   │                   │
     │ 7. POST /images/  │                   │
     │    id/:id/confirm │                   │
     │──────────────────►│                   │
     │                   │                   │
     │ 8. Returns         │                   │
     │    updated image  │                   │
     │◄──────────────────│                   │
     │                   │                   │
```

---

## Step-by-Step Guide

### Step 1: Register Image Intent

**Purpose:** Create an image record in the database before uploading.

**Endpoint:** `POST /api/v1/images`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "entityType": "facility",
  "entityId": 1,
  "imageType": "gallery",
  "displayOrder": 0
}
```

**Required Fields:**
- `entityType` (string): `"user"`, `"facility"`, `"court"`, `"sport"`, or `"review"`
- `entityId` (number): ID of the entity
- `imageType` (string): `"profile"`, `"cover"`, `"gallery"`, `"icon"`, `"banner"`, or `"main"`

**Optional Fields:**
- `displayOrder` (number): Order for gallery images (default: 0)

**Success Response (201 Created):**
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
    "url": null,
    "variants": {
      "thumb": null,
      "medium": null,
      "full": null
    },
    "uploadStatus": "pending",
    "createdBy": 5,
    "isPrimary": false,
    "isActive": true,
    "displayOrder": 0,
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-20T10:00:00.000Z"
  }
}
```

**Success Criteria:**
- ✅ HTTP status: `201 Created`
- ✅ Response contains `imageId` (UUID)
- ✅ `uploadStatus` is `"pending"`

**Common Errors:**

**400 Bad Request - Missing Required Fields**
```json
{
  "success": false,
  "message": "Missing required fields: entityType, entityId, imageType",
  "error_code": "VALIDATION_ERROR"
}
```

**403 Forbidden - No Permission**
```json
{
  "success": false,
  "message": "You can only upload images for facilities you own",
  "error_code": "FORBIDDEN"
}
```

**400 Bad Request - Image Limit Reached**
```json
{
  "success": false,
  "message": "Image limit reached. Maximum 20 Gallery images allowed per Facility. Please delete an existing gallery image before uploading a new one.",
  "error_code": "IMAGE_LIMIT_REACHED",
  "details": {
    "entityType": "facility",
    "entityId": 1,
    "imageType": "gallery",
    "limit": 20,
    "currentCount": 20
  }
}
```

**Solution:** Delete an existing image of the same type before uploading a new one, or use a different image type if applicable.

---

### Step 2: Get Pre-Signed Upload URL

**Purpose:** Obtain a temporary, secure URL for uploading directly to S3.

**Endpoint:** `POST /api/v1/images/id/:imageId/presign`

**Authentication:** Required (JWT token)

**URL Parameters:**
- `imageId` (string, required): Image UUID from Step 1

**Request Body:**
```json
{
  "contentType": "image/jpeg"
}
```

**Required Fields:**
- `contentType` (string): Must be `"image/jpeg"`, `"image/png"`, or `"image/webp"`

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Pre-signed URL generated successfully",
  "data": {
    "uploadUrl": "https://your-bucket.s3.us-east-1.amazonaws.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
    "s3Key": "facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "s3Url": "https://your-bucket.s3.us-east-1.amazonaws.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "expiresIn": 300,
    "maxFileSize": 5242880
  }
}
```

**Success Criteria:**
- ✅ HTTP status: `200 OK`
- ✅ Response contains `uploadUrl` (pre-signed S3 URL)
- ✅ `expiresIn` is `300` (5 minutes)
- ✅ `maxFileSize` is `5242880` (5MB)

**Important Notes:**
- ⏰ **URL expires in 5 minutes** - Upload immediately after receiving URL
- 📏 **Maximum file size: 5MB** - Validate file size before upload
- ✅ **Content-Type enforced** - Must match the `contentType` in request

**Common Errors:**

**400 Bad Request - Invalid Content Type**
```json
{
  "success": false,
  "message": "Invalid content type. Allowed types: image/jpeg, image/png, image/webp",
  "error_code": "INVALID_CONTENT_TYPE"
}
```

**400 Bad Request - Image Already Uploaded**
```json
{
  "success": false,
  "message": "Image has already been uploaded",
  "error_code": "IMAGE_ALREADY_UPLOADED"
}
```

**403 Forbidden - No Permission**
```json
{
  "success": false,
  "message": "You do not have permission to upload this image",
  "error_code": "FORBIDDEN"
}
```

---

### Step 3: Upload File Directly to S3

**⚠️ CRITICAL: This step uploads directly to S3, NOT to the backend.**

**Purpose:** Upload the actual image file to AWS S3 using the pre-signed URL.

**Endpoint:** `<uploadUrl>` (from Step 2)

**Method:** `PUT`

**Authentication:** NOT required (pre-signed URL contains authentication)

**Headers:**
```
Content-Type: image/jpeg
```

**Important:** 
- ✅ Use the **exact** `Content-Type` from Step 2 request
- ✅ Send file as **raw binary** (not FormData)
- ✅ Use **PUT** method (not POST)

**Request Body:**
```
[Binary image file data]
```

**Success Response (200 OK):**
```
HTTP/1.1 200 OK
```

**Success Criteria:**
- ✅ HTTP status: `200 OK`
- ✅ No error response from S3

**Common Errors:**

**403 Forbidden - URL Expired**
```
HTTP/1.1 403 Forbidden
```
**Solution:** Request a new pre-signed URL (they expire in 5 minutes)

**413 Payload Too Large**
```
HTTP/1.1 413 Payload Too Large
```
**Solution:** Compress image or reduce file size (max 5MB)

**400 Bad Request - Invalid Content-Type**
```
HTTP/1.1 400 Bad Request
```
**Solution:** Ensure Content-Type header matches the contentType from Step 2

**Important Notes:**
- ❌ **DO NOT** send `multipart/form-data` - Backend will reject it
- ❌ **DO NOT** upload to backend endpoint - Upload directly to S3 URL
- ✅ **DO** validate file size before upload (max 5MB)
- ✅ **DO** validate file type before upload (JPEG, PNG, WebP only)

---

### Step 4: Confirm Upload Completion

**Purpose:** Notify backend that upload was successful and finalize image record.

**⚠️ REQUIRED:** This step must be called after successful S3 upload.

**Endpoint:** `POST /api/v1/images/id/:imageId/confirm-upload`

**Authentication:** Required (JWT token)

**URL Parameters:**
- `imageId` (string, required): Image UUID from Step 1

**Request Body:**
```json
{
  "fileSize": 245678,
  "contentType": "image/webp"
}
```

**Required Fields:**
- `fileSize` (number): File size in bytes
- `contentType` (string): MIME type - must match the contentType from Step 2

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Image upload confirmed successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "entityType": "facility",
    "entityId": 1,
    "imageType": "gallery",
    "s3Key": "facility/1/550e8400-e29b-41d4-a716-446655440000.webp",
    "publicUrl": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000.webp",
    "url": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000.webp",
    "variants": {
      "thumb": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_thumb.webp",
      "medium": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_medium.webp",
      "full": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_full.webp"
    },
    "uploadStatus": "uploaded",
    "uploadedAt": "2025-01-20T10:05:00.000Z",
    "fileSize": 245678,
    "contentType": "image/webp",
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-20T10:05:00.000Z"
  }
}
```

**Success Criteria:**
- ✅ HTTP status: `200 OK`
- ✅ `uploadStatus` is `"uploaded"`
- ✅ `uploadedAt` is set to current timestamp
- ✅ `fileSize` and `contentType` are stored

**Common Errors:**

**400 Bad Request - Invalid Upload Status**
```json
{
  "success": false,
  "message": "Image upload status is 'uploaded'. Only images with 'pending' status can be confirmed.",
  "error_code": "INVALID_UPLOAD_STATUS"
}
```
**Solution:** Image was already confirmed. Check if upload was successful.

**400 Bad Request - Invalid File Size**
```json
{
  "success": false,
  "message": "File size 6000000 bytes exceeds maximum limit of 5242880 bytes (5MB)",
  "error_code": "FILE_SIZE_EXCEEDED"
}
```
**Solution:** Ensure file size matches actual uploaded file.

**404 Not Found - Image Not Found**
```json
{
  "success": false,
  "message": "Image not found",
  "error_code": "IMAGE_NOT_FOUND"
}
```
**Solution:** Verify imageId is correct.

---

## Error Handling

### Retry Strategy

**For Step 1 (Register Intent):**
- Retry on network errors
- Do NOT retry on validation errors (400)
- Do NOT retry on permission errors (403)

**For Step 2 (Get Pre-Signed URL):**
- Retry on network errors
- Request new URL if previous one expired
- Do NOT retry on validation errors

**For Step 3 (S3 Upload):**
- Retry on network errors (with exponential backoff)
- Request new pre-signed URL if expired (403)
- Validate file size before retry

**For Step 4 (Confirm Upload):**
- Retry on network errors
- Do NOT retry if upload_status is already 'uploaded'
- Verify S3 upload succeeded before confirming

### Error Recovery

If Step 3 (S3 upload) fails:
1. Check error response from S3
2. If URL expired (403), go back to Step 2
3. If file too large (413), compress image and restart from Step 1
4. If network error, retry upload to same URL

If Step 4 (Confirm) fails:
1. Check if image upload_status is already 'uploaded'
2. If yes, upload was already confirmed (success)
3. If no, retry confirmation

---

## Best Practices

### 1. Client-Side Validation

**Before Step 1:**
- ✅ Validate file size (max 5MB)
- ✅ Validate file type (JPEG, PNG, WebP only)
- ✅ Check user has permission to upload for entity

**Before Step 3:**
- ✅ Verify pre-signed URL is not expired
- ✅ Verify file size matches validation
- ✅ Verify Content-Type matches file type

### 2. Upload Progress

Use `XMLHttpRequest` or `fetch` with progress tracking:

```javascript
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener('progress', (e) => {
  if (e.lengthComputable) {
    const percentComplete = (e.loaded / e.total) * 100;
    updateProgressBar(percentComplete);
  }
});
xhr.open('PUT', presignedUrl);
xhr.setRequestHeader('Content-Type', contentType);
xhr.send(file);
```

### 3. Timeout Handling

- Set timeout for S3 upload (recommended: 60 seconds)
- Request new pre-signed URL if upload times out
- Clean up failed image records if needed

### 4. Image Optimization

**Before Upload:**
- Compress images to reduce file size
- Resize large images to reasonable dimensions
- Consider converting to WebP for better compression

**Recommended Limits:**
- Maximum dimensions: 1920x1080 for gallery images
- Maximum dimensions: 800x800 for profile images
- Target file size: < 2MB (under 5MB limit)

### 5. Error Messages

Display user-friendly error messages:

```javascript
const errorMessages = {
  'IMAGE_LIMIT_REACHED': 'Maximum number of images reached. Please delete an existing image first.',
  'INVALID_CONTENT_TYPE': 'Invalid file type. Please upload JPEG, PNG, or WebP images only.',
  'FILE_SIZE_EXCEEDED': 'File is too large. Maximum size is 5MB. Please compress the image.',
  'FORBIDDEN': 'You do not have permission to upload images for this entity.',
  'IMAGE_ALREADY_UPLOADED': 'This image has already been uploaded. Please create a new image record.'
};
```

---

## Complete Example

```javascript
/**
 * Complete image upload function
 * Handles all 4 steps of the upload lifecycle
 */
async function uploadImage(file, entityType, entityId, imageType, token) {
  try {
    // Step 1: Register image intent
    const createResponse = await fetch('/api/v1/images', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        entityType,
        entityId,
        imageType,
        displayOrder: 0
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(error.message || 'Failed to create image record');
    }

    const { data: image } = await createResponse.json();
    console.log('Image registered:', image.id);

    // Step 2: Get pre-signed URL
    const presignResponse = await fetch(`/api/v1/images/id/${image.id}/presign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contentType: file.type
      })
    });

    if (!presignResponse.ok) {
      const error = await presignResponse.json();
      throw new Error(error.message || 'Failed to get pre-signed URL');
    }

    const { data: presignData } = await presignResponse.json();
    console.log('Pre-signed URL received, expires in:', presignData.expiresIn, 'seconds');

    // Step 3: Upload directly to S3
    const uploadResponse = await fetch(presignData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type
      },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error(`S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    console.log('File uploaded to S3 successfully');

    // Step 4: Confirm upload
    const confirmResponse = await fetch(`/api/v1/images/id/${image.id}/confirm-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileSize: file.size,
        contentType: file.type
      })
    });

    if (!confirmResponse.ok) {
      const error = await confirmResponse.json();
      throw new Error(error.message || 'Failed to confirm upload');
    }

    const { data: confirmedImage } = await confirmResponse.json();
    console.log('Upload confirmed! Image URL:', confirmedImage.url);

    return confirmedImage;

  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Usage
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      // Validate file
      if (file.size > 5242880) {
        alert('File is too large. Maximum size is 5MB.');
        return;
      }

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('Invalid file type. Please upload JPEG, PNG, or WebP images only.');
        return;
      }

      // Upload
      const image = await uploadImage(
        file,
        'facility',
        1,
        'gallery',
        userToken
      );

      console.log('Image uploaded successfully:', image.publicUrl);
      // Display image using publicUrl
      const imgElement = document.createElement('img');
      imgElement.src = image.publicUrl; // ✅ Always use publicUrl
      imgElement.alt = 'Uploaded image';
      document.body.appendChild(imgElement);
      alert('Image uploaded successfully!');

    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    }
  }
});
```

---

## CDN Image Delivery

### Using `publicUrl` for Image Display

**⚠️ CRITICAL: Frontend MUST use `publicUrl` for all image display.**

The API response includes two URL fields:

- **`s3Key`** (string): Internal S3 object key (e.g., `"facility/1/image.jpg"`)
  - ❌ **DO NOT use this** - This is for backend/internal use only
  - Not a valid URL for frontend display

- **`publicUrl`** (string): Public CDN URL for original image (e.g., `"https://cdn.sportsarena.com/facility/1/image.jpg"`)
  - ✅ **Use this for original image** - Fallback if variants not available
  - Served via CloudFront CDN for fast global delivery
  - Includes caching, compression, and HTTPS

- **`variants`** (object): Variant URLs object with:
  - **`thumb`** (string|null): Thumbnail variant (300px max width) - Use for avatars, thumbnails
  - **`medium`** (string|null): Medium variant (800px max width) - Use for cards, lists
  - **`full`** (string|null): Full variant (1600px max width) - Use for detail views, full-width displays
  - ⚠️ **Note:** Variants may not exist immediately (generated asynchronously). Handle 404 errors gracefully.

- **`url`** (string): Legacy field, same as `publicUrl` (kept for backward compatibility)
  - ✅ Can use this if `publicUrl` is not available (backward compatibility)

### Example: Displaying Images

```javascript
// ✅ CORRECT: Use publicUrl or appropriate variant
const image = await fetchImage(imageId);

// For thumbnails/avatars
<img src={image.variants.thumb || image.publicUrl} alt="Thumbnail" />

// For cards/lists
<img src={image.variants.medium || image.publicUrl} alt="Card image" />

// For detail views
<img src={image.variants.full || image.publicUrl} alt="Full image" />

// Fallback handling
const getImageUrl = (image, size = 'medium') => {
  const variant = image.variants?.[size];
  return variant || image.publicUrl || image.url;
};

// ❌ WRONG: Don't use s3Key
<img src={image.s3Key} alt="Facility image" /> // This will NOT work!
```

### Responsive Images with Variants

```javascript
// Use srcset for responsive images
<img
  srcSet={`
    ${image.variants.thumb} 300w,
    ${image.variants.medium} 800w,
    ${image.variants.full} 1600w
  `}
  src={image.variants.medium || image.publicUrl}
  sizes="(max-width: 300px) 300px, (max-width: 800px) 800px, 1600px"
  alt="Responsive image"
/>
```

### CDN Benefits

- **Fast Delivery**: Images cached at edge locations worldwide
- **Compression**: Automatic gzip/brotli compression
- **HTTPS**: SSL/TLS encryption by default
- **Caching**: Reduced bandwidth and faster load times
- **Scalability**: Handles high traffic without backend load

### CDN Configuration

CDN is configured at the backend level via `CDN_BASE_URL` environment variable. If not configured, `publicUrl` falls back to direct S3 URLs.

---

## Summary

### ✅ DO

- Upload images directly to S3 using pre-signed URLs
- Validate file size and type before upload
- Confirm upload after successful S3 upload
- **ALWAYS use `publicUrl` for image display**
- Handle errors gracefully with user-friendly messages
- Show upload progress to users

### ❌ DON'T

- Upload images to backend endpoints
- Send `multipart/form-data` to backend
- Skip upload confirmation step
- Cache pre-signed URLs (they expire in 5 minutes)
- Upload files larger than 5MB
- **Use `s3Key` for image display** (it's not a valid URL)

### Key Points

1. **Backend never handles binary data** - All uploads go directly to S3
2. **4-step process** - Register → Presign → Upload → Confirm
3. **Pre-signed URLs expire** - Request just before upload
4. **Confirmation is required** - Image remains 'pending' until confirmed
5. **File size limit: 5MB** - Validate before upload
6. **CDN delivery** - Always use `publicUrl` for image display (served via CloudFront)

The system is designed for security, performance, and scalability. Follow this guide to ensure reliable image uploads and optimal image delivery.

