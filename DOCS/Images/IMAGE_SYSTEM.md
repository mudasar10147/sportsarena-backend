# 📸 Image System Documentation

Complete guide for the SportsArena image management system.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Image Types & Use Cases](#image-types--use-cases)
3. [Role-Based Permissions](#role-based-permissions)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Image Limits](#image-limits)
7. [S3 Integration (Future)](#s3-integration-future)
8. [Usage Examples](#usage-examples)

---

## Overview

The image system manages image metadata and references for all entities in the SportsArena platform. **Actual image files are NOT stored in the database** - only metadata is stored. File storage will be handled by AWS S3 (to be integrated).

### Current Status

- ✅ **Image metadata management** - Complete
- ✅ **Role-based access control** - Complete
- ✅ **Image limits enforcement** - Complete
- ⏳ **S3 file upload** - Pending integration
- ⏳ **Pre-signed URLs** - Pending integration

### Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. Register intent (POST /images)
       ▼
┌─────────────┐
│   Backend   │ ──► Creates image record in database
└──────┬──────┘
       │ 2. Returns imageId
       ▼
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 3. Upload file to S3 (future)
       ▼
┌─────────────┐
│     S3      │
└─────────────┘
```

---

## Image Types & Use Cases

### 1. User Images

| Image Type | Count | Description | Primary |
|------------|-------|-------------|---------|
| `profile` | 1 | User profile picture | ✅ Yes |
| `gallery` | 0-10 | User gallery images | ❌ No |

**Use Case:** Users can upload a profile picture and up to 10 gallery images.

---

### 2. Facility Images

| Image Type | Count | Description | Primary |
|------------|-------|-------------|---------|
| `profile` | 1 | Facility main image | ✅ Yes |
| `cover` | 1 | Facility cover/banner image | ✅ Yes |
| `gallery` | 0-20 | Facility gallery images | ❌ No |

**Use Case:** Facility owners can upload a profile image, cover image, and up to 20 gallery images.

---

### 3. Court Images

| Image Type | Count | Description | Primary |
|------------|-------|-------------|---------|
| `main` | 1 | Court main image | ✅ Yes |
| `gallery` | 0-15 | Court gallery images | ❌ No |

**Use Case:** Facility owners can upload a main image and up to 15 gallery images for each court.

---

### 4. Sport Images (Admin-Managed)

| Image Type | Count | Description | Primary |
|------------|-------|-------------|---------|
| `icon` | 1 | Sport icon/image | ✅ Yes |
| `banner` | 1 | Sport banner image | ✅ Yes |

**Use Case:** Platform admins can upload an icon and banner for each sport.

---

### 5. Review Images (Future)

| Image Type | Count | Description | Primary |
|------------|-------|-------------|---------|
| `gallery` | 0-5 | Review images | ❌ No |

**Use Case:** Users can upload up to 5 images per review.

---

## Role-Based Permissions

### Player (Regular User)

**Can upload:**
- ✅ Own profile image (`user` entity, `profile` type)
- ✅ Own gallery images (`user` entity, `gallery` type)
- ✅ Review images (`review` entity, `gallery` type)

**Cannot upload:**
- ❌ Facility images
- ❌ Court images
- ❌ Sport images

---

### Facility Owner (`facility_admin`)

**Can upload:**
- ✅ Own profile image (`user` entity, `profile` type)
- ✅ Own gallery images (`user` entity, `gallery` type)
- ✅ Images for **owned facilities** (`facility` entity, all types)
- ✅ Images for **courts in owned facilities** (`court` entity, all types)
- ✅ Review images (`review` entity, `gallery` type)

**Cannot upload:**
- ❌ Images for facilities they don't own
- ❌ Images for courts in facilities they don't own
- ❌ Sport images

---

### Platform Admin (`platform_admin`)

**Can upload:**
- ✅ All image types for all entities
- ✅ Sport images (`sport` entity, `icon` and `banner` types)
- ✅ Global promotional images (future)

**Full access** to all image management operations.

---

## Database Schema

### Images Table

```sql
CREATE TABLE images (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,  -- user, facility, court, sport, review
    entity_id INTEGER NOT NULL,        -- ID of the entity
    image_type VARCHAR(50) NOT NULL,   -- profile, cover, gallery, icon, banner, main
    storage_key TEXT,                   -- S3 object key (e.g., 'facility/1/image.jpg')
    url TEXT,                           -- Legacy field (kept for backward compatibility)
    created_by INTEGER NOT NULL,        -- User who created the image
    is_primary BOOLEAN DEFAULT FALSE,   -- For single-image types
    is_active BOOLEAN DEFAULT TRUE,     -- Soft delete flag
    display_order INTEGER DEFAULT 0,   -- For gallery ordering
    metadata JSONB DEFAULT '{}',       -- Additional metadata
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Key Constraints

- **Single Primary Image:** Only one primary image per `entity_type + entity_id + image_type` combination
- **Entity Types:** `user`, `facility`, `court`, `sport`, `review`
- **Image Types:** `profile`, `cover`, `gallery`, `icon`, `banner`, `main`

### Indexes

- `idx_images_entity` - Fast lookups by entity
- `idx_images_created_by` - User image queries
- `idx_images_single_primary` - Enforces single primary image constraint

---

## API Endpoints

### Base URL: `/api/v1/images`

All endpoints require authentication.

---

### 1. Create Image Record

**`POST /api/v1/images`**

Register intent to upload an image. Creates an image record in the database.

**Request Body:**
```json
{
  "entityType": "facility",
  "entityId": 1,
  "imageType": "gallery",
  "displayOrder": 0,
  "metadata": {}
}
```

**Response (201 Created):**
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
    "createdBy": 5,
    "isPrimary": false,
    "isActive": true,
    "displayOrder": 0,
    "uploadStatus": "pending",
    "metadata": {},
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-20T10:00:00.000Z"
  }
}
```

**Response Fields:**
- `s3Key` (string|null): Internal S3 object key (for backend use only)
- `publicUrl` (string|null): **Public CDN URL for original image (frontend MUST use this for image display)**
- `url` (string|null): Legacy field, same as `publicUrl` (kept for backward compatibility)
- `variants` (object): Variant URLs object with:
  - `thumb` (string|null): Thumbnail variant URL (300px max width)
  - `medium` (string|null): Medium variant URL (800px max width)
  - `full` (string|null): Full variant URL (1600px max width)
  
**Note:** Variant URLs are generated even if variants don't exist yet (generated asynchronously). Frontend should handle 404 errors gracefully and fallback to `publicUrl`.

**Authorization:** Based on entity type and ownership (see [Role-Based Permissions](#role-based-permissions))

---

### 2. Get Images for Entity

**`GET /api/v1/images/:entityType/:entityId`**

Get all images for a specific entity.

**Query Parameters:**
- `imageType` (optional) - Filter by image type

**Example:**
```
GET /api/v1/images/facility/1?imageType=gallery
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Images retrieved successfully",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "entityType": "facility",
      "entityId": 1,
      "imageType": "gallery",
      "s3Key": "facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
      "publicUrl": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
      "url": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
      "variants": {
        "thumb": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_thumb.jpg",
        "medium": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_medium.jpg",
        "full": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_full.jpg"
      },
      "isPrimary": false,
      "displayOrder": 0,
      "uploadStatus": "uploaded",
      "uploadedAt": "2025-01-20T10:05:00.000Z",
      "fileSize": 245678,
      "contentType": "image/jpeg",
      "createdAt": "2025-01-20T10:00:00.000Z"
    }
  ]
}
```

**⚠️ Frontend MUST use `publicUrl` or appropriate variant URL for image display.**

---

### 3. Get Image by ID

**`GET /api/v1/images/id/:imageId`**

Get a specific image by its UUID.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Image retrieved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "entityType": "facility",
    "entityId": 1,
    "imageType": "profile",
    "s3Key": "facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "publicUrl": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "url": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "variants": {
      "thumb": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_thumb.jpg",
      "medium": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_medium.jpg",
      "full": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_full.jpg"
    },
    "isPrimary": true,
    "createdAt": "2025-01-20T10:00:00.000Z"
  }
}
```

---

### 4. Update Image

**`PUT /api/v1/images/id/:imageId`**

Update image metadata. Used to set `storageKey` and `url` after S3 upload.

**Request Body:**
```json
{
  "storageKey": "facilities/1/gallery/image1.jpg",
  "url": "https://s3.amazonaws.com/bucket/facilities/1/gallery/image1.jpg",
  "displayOrder": 1,
  "metadata": {
    "width": 1920,
    "height": 1080,
    "fileSize": 245678,
    "mimeType": "image/jpeg"
  }
}
```

**Authorization:** Must own the entity or be platform admin

---

### 5. Delete Image

**`DELETE /api/v1/images/id/:imageId`**

Soft delete an image (sets `is_active` to `false`).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Image deleted successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "isActive": false
  }
}
```

**Authorization:** Must own the entity or be platform admin

---

### 6. Get Image Limits

**`GET /api/v1/images/limits/:entityType`**

Get maximum number of images allowed per type for an entity.

**Example:**
```
GET /api/v1/images/limits/facility
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Image limits retrieved successfully",
  "data": {
    "profile": 1,
    "cover": 1,
    "gallery": 20
  }
}
```

---

### 7. Generate Pre-Signed Upload URL

**`POST /api/v1/images/id/:imageId/presign`**

Generate a pre-signed URL for direct client-to-S3 image upload.

**Authentication:** Required (must own the image entity)

**Request Body:**
```json
{
  "contentType": "image/jpeg"
}
```

**Required Fields:**
- `contentType` (string): MIME type - must be `image/jpeg`, `image/png`, or `image/webp`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pre-signed URL generated successfully",
  "data": {
    "uploadUrl": "https://your-bucket.s3.us-east-1.amazonaws.com/facility/1/uuid.jpg?X-Amz-Algorithm=...",
    "s3Key": "facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "s3Url": "https://your-bucket.s3.us-east-1.amazonaws.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
    "expiresIn": 300,
    "maxFileSize": 5242880
  }
}
```

**Note:**
- Pre-signed URL expires in 5 minutes (300 seconds)
- Maximum file size: 5MB
- Content-Type is enforced in the pre-signed URL
- Image record is automatically updated with `storageKey` and `url`

**Error Responses:**

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

### 8. Confirm Image Upload

**`POST /api/v1/images/id/:imageId/confirm-upload`**

**⚠️ REQUIRED:** Confirm that image upload to S3 was successful. Finalizes image record.

**Authentication:** Required (must own the image entity)

**Request Body:**
```json
{
  "fileSize": 245678,
  "contentType": "image/webp"
}
```

**Required Fields:**
- `fileSize` (number): File size in bytes (must match actual uploaded file)
- `contentType` (string): MIME type - must match the contentType from presign request

**Response (200 OK):**
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

**Important Notes:**
- ✅ **This endpoint is REQUIRED** - Image remains in 'pending' status until confirmed
- ✅ **Upload status changes** - From 'pending' → 'uploaded'
- ✅ **Timestamp recorded** - `uploadedAt` is set automatically
- ✅ **File metadata stored** - `fileSize` and `contentType` are persisted

**Error Responses:**

**400 Bad Request - Invalid Upload Status**
```json
{
  "success": false,
  "message": "Image upload status is 'uploaded'. Only images with 'pending' status can be confirmed.",
  "error_code": "INVALID_UPLOAD_STATUS"
}
```

**400 Bad Request - Invalid File Size**
```json
{
  "success": false,
  "message": "File size 6000000 bytes exceeds maximum limit of 5242880 bytes (5MB)",
  "error_code": "FILE_SIZE_EXCEEDED"
}
```

**400 Bad Request - Invalid Content Type**
```json
{
  "success": false,
  "message": "Invalid content type. Allowed types: image/jpeg, image/png, image/webp",
  "error_code": "INVALID_CONTENT_TYPE"
}
```

---

## CDN Image Delivery

### Overview

Images are served via **AWS CloudFront CDN** for fast global delivery. The backend generates CDN URLs automatically based on the `CDN_BASE_URL` environment variable.

### Response Format

All image API responses include:

- **`s3Key`** (string|null): Internal S3 object key (e.g., `"facility/1/image.jpg"`)
  - For backend/internal use only
  - Not a valid URL for frontend display

- **`publicUrl`** (string|null): **Public CDN URL (frontend MUST use this)**
  - Format: `{CDN_BASE_URL}/{s3Key}`
  - Example: `https://cdn.sportsarena.com/facility/1/image.jpg`
  - Served via CloudFront CDN with caching, compression, and HTTPS

- **`url`** (string|null): Legacy field, same as `publicUrl` (backward compatibility)

### Frontend Usage

**⚠️ CRITICAL: Frontend MUST use `publicUrl` for all image display.**

```javascript
// ✅ CORRECT
<img src={image.publicUrl} alt="Facility image" />

// ❌ WRONG - s3Key is not a valid URL
<img src={image.s3Key} alt="Facility image" />
```

### CDN Configuration

CDN is configured via backend environment variable:

```bash
CDN_BASE_URL=https://cdn.sportsarena.com
```

If `CDN_BASE_URL` is not set, `publicUrl` falls back to direct S3 URLs.

**See:** [CloudFront Setup Guide](../CLOUDFRONT_SETUP.md) for complete setup instructions.

### CDN Benefits

- ✅ **Fast Delivery**: Images cached at edge locations worldwide
- ✅ **Compression**: Automatic gzip/brotli compression
- ✅ **HTTPS**: SSL/TLS encryption by default
- ✅ **Caching**: Reduced bandwidth and faster load times
- ✅ **Scalability**: Handles high traffic without backend load

---

## Image Limits & Abuse Protection

### Upload Limits

Upload limits are enforced at image creation time to prevent abuse and ensure system performance.

| Entity Type | Image Type | Max Count | Description |
|-------------|------------|-----------|-------------|
| `user` | `profile` | 1 | User profile image |
| `user` | `gallery` | 10 | User gallery images |
| `facility` | `profile` | 1 | Facility profile image |
| `facility` | `cover` | 1 | Facility cover image |
| `facility` | `gallery` | 20 | Facility gallery images |
| `court` | `main` | 1 | Court main image |
| `court` | `gallery` | 10 | Court gallery images |
| `sport` | `icon` | 1 | Sport icon image |
| `sport` | `banner` | 1 | Sport banner image |
| `review` | `gallery` | 5 | Review gallery images |

### Limit Enforcement

- ✅ **Enforced at creation**: Limits are checked when creating image records
- ✅ **Active images only**: Deleted images don't count toward limits
- ✅ **Clear error messages**: Users receive helpful error messages when limits are reached
- ✅ **Per-entity basis**: Limits apply per entity (e.g., per facility, per court)

### Error Response

When a limit is exceeded, the API returns:

**HTTP Status:** `400 Bad Request`

**Response Body:**
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

### Best Practices

1. **Check limits before upload**: Use `GET /api/v1/images/limits/:entityType` to check limits
2. **Delete unused images**: Remove old images before uploading new ones
3. **Use appropriate image types**: Choose the right image type for your use case
4. **Monitor usage**: Track image counts to avoid hitting limits unexpectedly

**Note:** Single-image types (`profile`, `cover`, `icon`, `banner`, `main`) are automatically set as primary and only one is allowed per entity.

---

## S3 Integration ✅

### Complete Upload Flow

1. **Client registers intent:**
   ```
   POST /api/v1/images
   {
     "entityType": "facility",
     "entityId": 1,
     "imageType": "gallery"
   }
   → Returns imageId
   ```

2. **Backend generates pre-signed URL:**
   ```
   POST /api/v1/images/id/:imageId/presign
   {
     "contentType": "image/jpeg"
   }
   → Returns pre-signed S3 upload URL
   ```

3. **Client uploads file directly to S3:**
   ```
   PUT <pre-signed-url>
   Content-Type: image/jpeg
   [Binary image data]
   → File uploaded directly to S3 (bypasses backend)
   ```

4. **Client confirms upload (REQUIRED):**
   ```
   POST /api/v1/images/id/:imageId/confirm-upload
   {
     "fileSize": 245678,
     "contentType": "image/webp"
   }
   → Finalizes image record (upload_status: pending → uploaded)
   ```

### S3 Configuration

**Required Environment Variables:**
```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

**Security Features:**
- ✅ Private S3 bucket (no public access)
- ✅ Pre-signed URLs expire in 5 minutes
- ✅ Content-Type enforcement
- ✅ MIME type validation (image/jpeg, image/png, image/webp)
- ✅ File size limit: 5MB
- ✅ Server-side encryption (AES256)

### S3 Object Key Format

Images are stored with the following key structure:
```
{entity_type}/{entity_id}/{image_id}.{extension}
```

**Examples:**
- `facility/1/550e8400-e29b-41d4-a716-446655440000.jpg`
- `user/5/660e8400-e29b-41d4-a716-446655440001.png`
- `court/10/770e8400-e29b-41d4-a716-446655440002.webp`

### Future Integration Points

The following enhancements can be added:

- **Image Resizing:** Lambda@Edge or S3 event triggers
- **CDN (CloudFront):** Update `generateS3Url()` to use CloudFront domain
- **Virus Scanning:** S3 event triggers to Lambda/ClamAV
- **Image Optimization:** Automatic WebP conversion

---

## Usage Examples

### Example 1: User Uploads Profile Image

```javascript
// 1. Register intent
const createResponse = await fetch('/api/v1/images', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    entityType: 'user',
    entityId: userId,
    imageType: 'profile'
  })
});

const { data: image } = await createResponse.json();
console.log(`Image ID: ${image.id}`);

// 2. Get pre-signed URL
const presignResponse = await fetch(`/api/v1/images/id/${image.id}/presign`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    contentType: 'image/jpeg'
  })
});

const { data: presignData } = await presignResponse.json();
console.log(`Upload URL: ${presignData.uploadUrl}`);

// 3. Upload file directly to S3
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

const uploadResponse = await fetch(presignData.uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': 'image/jpeg'
  },
  body: file
});

if (uploadResponse.ok) {
  console.log('Upload successful!');
  
  // 4. Confirm upload (REQUIRED)
  await fetch(`/api/v1/images/id/${image.id}/confirm-upload`, {
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
}
```

### Example 2: Facility Owner Uploads Gallery Image

```javascript
// 1. Register intent
const createResponse = await fetch('/api/v1/images', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${facilityOwnerToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    entityType: 'facility',
    entityId: 1,
    imageType: 'gallery',
    displayOrder: 0
  })
});

const { data: image } = await createResponse.json();

// 2. Get pre-signed URL
const presignResponse = await fetch(`/api/v1/images/id/${image.id}/presign`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${facilityOwnerToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    contentType: 'image/png'
  })
});

const { data: presignData } = await presignResponse.json();

// 3. Upload to S3
const file = /* get file from input */;
await fetch(presignData.uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': 'image/png'
  },
  body: file
});

// 4. Confirm upload (REQUIRED)
await fetch(`/api/v1/images/id/${image.id}/confirm-upload`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${facilityOwnerToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileSize: file.size,
    contentType: 'image/png'
  })
});
```

### Example 3: Get All Facility Images

```javascript
const response = await fetch('/api/v1/images/facility/1', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data: images } = await response.json();
console.log(`Found ${images.length} images`);
```

### Example 4: Get Only Gallery Images

```javascript
const response = await fetch('/api/v1/images/facility/1?imageType=gallery', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `IMAGE_LIMIT_REACHED` | 400 | Maximum number of images reached |
| `INVALID_CONTENT_TYPE` | 400 | Invalid MIME type (must be image/jpeg, image/png, or image/webp) |
| `IMAGE_ALREADY_UPLOADED` | 400 | Image has already been uploaded |
| `INVALID_UPLOAD_STATUS` | 400 | Image upload status is not 'pending' |
| `INVALID_FILE_SIZE` | 400 | Invalid file size (must be positive number) |
| `FILE_SIZE_EXCEEDED` | 400 | File size exceeds 5MB limit |
| `FORBIDDEN` | 403 | User doesn't have permission |
| `IMAGE_NOT_FOUND` | 404 | Image not found |
| `USER_NOT_FOUND` | 404 | User entity not found |
| `FACILITY_NOT_FOUND` | 404 | Facility entity not found |
| `COURT_NOT_FOUND` | 404 | Court entity not found |
| `SPORT_NOT_FOUND` | 404 | Sport entity not found |
| `S3_NOT_CONFIGURED` | 500 | S3 bucket is not configured |
| `UNAUTHORIZED` | 401 | Missing or invalid token |

---

## Summary

- ✅ **Metadata-only system** - No binary data in database
- ✅ **Role-based access control** - Enforced at service layer
- ✅ **Image limits** - Configurable per entity type
- ✅ **Single-image constraints** - Enforced via database constraints
- ✅ **Soft delete** - Images can be deactivated without deletion
- ✅ **S3 integration** - Complete with pre-signed URLs
- ✅ **Direct client-to-S3 uploads** - Backend never handles binary data
- ✅ **Upload lifecycle tracking** - upload_status (pending/uploaded/failed), uploaded_at, file_size, content_type
- ✅ **Security** - MIME type validation, file size limits, short-lived URLs
- ✅ **Upload confirmation** - Required endpoint to finalize uploads

The system is production-ready with full S3 integration and upload lifecycle management. Images are uploaded directly from client to S3, bypassing the backend entirely. Backend tracks upload status and metadata only.

