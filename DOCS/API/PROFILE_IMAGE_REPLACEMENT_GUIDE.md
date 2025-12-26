# 👤 Profile Image Replacement API Guide

Complete guide for replacing user profile images using the dedicated replacement endpoint.

**⚠️ RECOMMENDED:** Use this endpoint when replacing profile images for a better developer experience.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [API Reference](#api-reference)
4. [Complete Upload Flow](#complete-upload-flow)
5. [Alternative Methods](#alternative-methods)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)

---

## Overview

### What This Endpoint Does

The `PUT /api/v1/images/profile/user/:userId` endpoint is a **convenience endpoint** that:

1. ✅ **Finds** existing profile image (if any)
2. ✅ **Deletes** old profile image (soft delete + S3 cleanup)
3. ✅ **Creates** new image record ready for upload
4. ✅ **Returns** new `imageId` for the upload flow

### Why Use This Endpoint?

- **Simpler**: Single endpoint call instead of delete + create
- **Atomic**: Ensures old image is cleaned up before creating new one
- **Explicit**: Clear intent - "replace profile image"
- **RESTful**: Follows REST conventions for resource replacement

### When to Use

- ✅ **Replacing** an existing profile image
- ✅ **Uploading** a profile image for the first time (works the same way)
- ✅ **Updating** user profile picture in settings

---

## Quick Start

### Minimal Example

```javascript
async function replaceProfileImage(file, userId, token) {
  // Step 1: Replace profile image (deletes old, creates new record)
  const replaceResponse = await fetch(`/api/v1/images/profile/user/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const { data: newImage } = await replaceResponse.json();
  const imageId = newImage.id;

  // Step 2: Get pre-signed URL
  const presignResponse = await fetch(`/api/v1/images/id/${imageId}/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contentType: file.type })
  });

  const { data: presignData } = await presignResponse.json();

  // Step 3: Upload to S3
  await fetch(presignData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  });

  // Step 4: Confirm upload
  await fetch(`/api/v1/images/id/${imageId}/confirm-upload`, {
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

  return newImage;
}
```

---

## API Reference

### Replace Profile Image

**Endpoint:** `PUT /api/v1/images/profile/user/:userId`

**Authentication:** Required (JWT token)

**URL Parameters:**
- `userId` (number, required): User ID whose profile image to replace

**Request Body (optional):**
```json
{
  "displayOrder": 0,
  "metadata": {}
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Profile image replacement initiated. Ready for upload.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "entityType": "user",
    "entityId": 1,
    "imageType": "profile",
    "s3Key": null,
    "publicUrl": null,
    "url": null,
    "variants": {
      "thumb": null,
      "medium": null,
      "full": null
    },
    "uploadStatus": "pending",
    "createdBy": 1,
    "isPrimary": true,
    "isActive": true,
    "displayOrder": 0,
    "metadata": {},
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-20T10:00:00.000Z"
  }
}
```

**Success Criteria:**
- ✅ HTTP status: `201 Created`
- ✅ Response contains `imageId` (UUID)
- ✅ `uploadStatus` is `"pending"`
- ✅ `imageType` is `"profile"`
- ✅ `isPrimary` is `true`

**Common Errors:**

**403 Forbidden - Not Your Profile**
```json
{
  "success": false,
  "message": "You can only replace your own profile image",
  "error_code": "FORBIDDEN"
}
```
**Solution:** Users can only replace their own profile images. Verify `userId` matches authenticated user.

**404 Not Found - User Not Found**
```json
{
  "success": false,
  "message": "User not found",
  "error_code": "USER_NOT_FOUND"
}
```
**Solution:** Verify `userId` is correct and user exists.

**400 Bad Request - Invalid User ID**
```json
{
  "success": false,
  "message": "Invalid userId. Must be a number.",
  "error_code": "VALIDATION_ERROR"
}
```
**Solution:** Ensure `userId` is a valid number.

---

## Complete Upload Flow

After calling the replacement endpoint, follow the standard 3-step upload process:

### Step 1: Replace Profile Image ✅ (Already Done)

You've already called `PUT /api/v1/images/profile/user/:userId` and received a new `imageId`.

### Step 2: Get Pre-Signed URL

**Endpoint:** `POST /api/v1/images/id/:imageId/presign`

```javascript
const presignResponse = await fetch(`/api/v1/images/id/${imageId}/presign`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    contentType: file.type // 'image/jpeg', 'image/png', or 'image/webp'
  })
});

const { data: presignData } = await presignResponse.json();
// presignData.uploadUrl - Use this to upload to S3
// presignData.expiresIn - 300 seconds (5 minutes)
```

### Step 3: Upload to S3

**Endpoint:** `<presignData.uploadUrl>` (S3 pre-signed URL)

```javascript
const uploadResponse = await fetch(presignData.uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type
  },
  body: file // Raw binary file data
});

if (!uploadResponse.ok) {
  throw new Error(`S3 upload failed: ${uploadResponse.status}`);
}
```

### Step 4: Confirm Upload

**Endpoint:** `POST /api/v1/images/id/:imageId/confirm-upload`

```javascript
const confirmResponse = await fetch(`/api/v1/images/id/${imageId}/confirm-upload`, {
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

const { data: confirmedImage } = await confirmResponse.json();
// confirmedImage.publicUrl - Use this to display the image
```

---

## Alternative Methods

### Option 1: Use Replacement Endpoint (Recommended) ✅

```javascript
// Single endpoint call
PUT /api/v1/images/profile/user/:userId
```

**Pros:**
- Simple and explicit
- Atomic operation
- Automatic cleanup

**Cons:**
- None

### Option 2: Delete + Create

```javascript
// Step 1: Delete existing (if any)
DELETE /api/v1/images/id/:existingImageId

// Step 2: Create new
POST /api/v1/images
{
  "entityType": "user",
  "entityId": userId,
  "imageType": "profile"
}
```

**Pros:**
- More control over the process
- Can check if image exists first

**Cons:**
- Two API calls instead of one
- Need to find existing image ID first
- Not atomic (race condition possible)

### Option 3: Just Create (Automatic Replacement)

```javascript
// Create new - automatically replaces existing
POST /api/v1/images
{
  "entityType": "user",
  "entityId": userId,
  "imageType": "profile"
}
```

**Pros:**
- Simple
- Automatic replacement built-in

**Cons:**
- Less explicit intent
- Replacement happens in create flow (less RESTful)

**Recommendation:** Use **Option 1** (replacement endpoint) for profile images.

---

## Error Handling

### Retry Strategy

**For Replacement Endpoint:**
- ✅ Retry on network errors
- ❌ Do NOT retry on validation errors (400)
- ❌ Do NOT retry on permission errors (403)
- ❌ Do NOT retry on not found errors (404)

**For Upload Flow:**
- See [IMAGE_UPLOAD_API_GUIDE.md](./IMAGE_UPLOAD_API_GUIDE.md) for detailed error handling

### Error Recovery

**If Replacement Fails:**
1. Check error response
2. If 403: Verify user is replacing their own profile
3. If 404: Verify userId is correct
4. If 400: Fix validation errors and retry

**If Upload Fails After Replacement:**
1. The new image record is already created (status: "pending")
2. You can retry the upload flow (presign → upload → confirm)
3. Or delete the pending image and start over

---

## Best Practices

### 1. Validate Before Replacement

```javascript
// Validate file before calling replacement endpoint
function validateProfileImage(file) {
  // Check file size (max 5MB)
  if (file.size > 5242880) {
    throw new Error('File is too large. Maximum size is 5MB.');
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload JPEG, PNG, or WebP images only.');
  }

  // Check dimensions (optional but recommended)
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.width > 2000 || img.height > 2000) {
        reject(new Error('Image dimensions too large. Maximum is 2000x2000 pixels.'));
      } else {
        resolve();
      }
    };
    img.onerror = () => reject(new Error('Invalid image file'));
    img.src = URL.createObjectURL(file);
  });
}
```

### 2. Show Upload Progress

```javascript
async function replaceProfileImageWithProgress(file, userId, token, onProgress) {
  // Step 1: Replace
  const replaceResponse = await fetch(`/api/v1/images/profile/user/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const { data: newImage } = await replaceResponse.json();
  onProgress(25); // 25% - Replacement done

  // Step 2: Get pre-signed URL
  const presignResponse = await fetch(`/api/v1/images/id/${newImage.id}/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contentType: file.type })
  });

  const { data: presignData } = await presignResponse.json();
  onProgress(50); // 50% - Ready to upload

  // Step 3: Upload to S3 with progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(50 + (percentComplete * 0.4)); // 50% to 90%
      }
    });

    xhr.addEventListener('load', async () => {
      if (xhr.status === 200) {
        onProgress(90); // 90% - Upload complete

        // Step 4: Confirm upload
        try {
          const confirmResponse = await fetch(`/api/v1/images/id/${newImage.id}/confirm-upload`, {
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

          const { data: confirmedImage } = await confirmResponse.json();
          onProgress(100); // 100% - Complete
          resolve(confirmedImage);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.open('PUT', presignData.uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
```

### 3. Handle Edge Cases

```javascript
async function replaceProfileImageSafe(file, userId, token) {
  try {
    // Validate first
    await validateProfileImage(file);

    // Replace and upload
    const image = await replaceProfileImage(file, userId, token);
    
    return image;
  } catch (error) {
    // Handle specific error cases
    if (error.message.includes('FORBIDDEN')) {
      throw new Error('You can only replace your own profile image');
    } else if (error.message.includes('USER_NOT_FOUND')) {
      throw new Error('User not found');
    } else if (error.message.includes('too large')) {
      throw new Error('File is too large. Maximum size is 5MB.');
    } else if (error.message.includes('Invalid file type')) {
      throw new Error('Invalid file type. Please upload JPEG, PNG, or WebP images only.');
    } else {
      throw error;
    }
  }
}
```

### 4. Optimize Images Before Upload

```javascript
// Compress and resize image before upload
async function optimizeImageForProfile(file) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Resize to max 800x800 for profile images
      const maxSize = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob (WebP for better compression)
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/webp',
        0.85 // Quality: 85%
      );
    };

    img.src = URL.createObjectURL(file);
  });
}

// Usage
const optimizedFile = await optimizeImageForProfile(originalFile);
const image = await replaceProfileImage(optimizedFile, userId, token);
```

---

## Complete Example

```javascript
/**
 * Complete profile image replacement function
 * Handles validation, replacement, upload, and confirmation
 */
async function replaceUserProfileImage(file, userId, token, onProgress) {
  try {
    // Validate file
    if (file.size > 5242880) {
      throw new Error('File is too large. Maximum size is 5MB.');
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Invalid file type. Please upload JPEG, PNG, or WebP images only.');
    }

    onProgress?.(0);

    // Step 1: Replace profile image
    const replaceResponse = await fetch(`/api/v1/images/profile/user/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!replaceResponse.ok) {
      const error = await replaceResponse.json();
      throw new Error(error.message || 'Failed to replace profile image');
    }

    const { data: newImage } = await replaceResponse.json();
    onProgress?.(10);

    // Step 2: Get pre-signed URL
    const presignResponse = await fetch(`/api/v1/images/id/${newImage.id}/presign`, {
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
    onProgress?.(20);

    // Step 3: Upload to S3
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

    onProgress?.(80);

    // Step 4: Confirm upload
    const confirmResponse = await fetch(`/api/v1/images/id/${newImage.id}/confirm-upload`, {
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
    onProgress?.(100);

    return confirmedImage;

  } catch (error) {
    console.error('Profile image replacement failed:', error);
    throw error;
  }
}

// Usage in React component
function ProfileImageUploader({ userId, token }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      const image = await replaceUserProfileImage(
        file,
        userId,
        token,
        (percent) => setProgress(percent)
      );

      console.log('Profile image replaced successfully:', image.publicUrl);
      // Update UI with new image
      // image.publicUrl or image.variants.thumb for display

    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload profile image: ' + error.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && (
        <div>
          <progress value={progress} max={100} />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
}
```

---

## Summary

### ✅ DO

- Use `PUT /api/v1/images/profile/user/:userId` for profile image replacement
- Validate file size and type before upload
- Show upload progress to users
- Handle errors gracefully
- Use `publicUrl` or `variants.thumb` for displaying images
- Optimize images before upload (resize, compress)

### ❌ DON'T

- Don't skip validation
- Don't forget to confirm upload after S3 upload
- Don't use `s3Key` for image display (use `publicUrl`)
- Don't retry on validation/permission errors
- Don't upload files larger than 5MB

### Key Points

1. **Single Endpoint**: One call replaces old image and creates new record
2. **Automatic Cleanup**: Old image is automatically deleted (soft delete + S3 cleanup)
3. **Standard Upload Flow**: After replacement, follow standard 3-step upload process
4. **User-Specific**: Users can only replace their own profile images
5. **RESTful**: Follows REST conventions for resource replacement

---

## Related Documentation

- [IMAGE_UPLOAD_API_GUIDE.md](./IMAGE_UPLOAD_API_GUIDE.md) - Complete image upload guide
- [USER_API_GUIDE.md](./USER_API_GUIDE.md) - User API reference
- [IMAGE_SYSTEM.md](../IMAGE_SYSTEM.md) - Image system architecture

---

**Last Updated:** 2025-01-20

