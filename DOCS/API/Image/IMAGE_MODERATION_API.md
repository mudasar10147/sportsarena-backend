# 🛡️ Image Moderation API Guide

Complete guide for platform administrators on image moderation endpoints.

---

## 📋 Overview

The image moderation system allows platform administrators to review and moderate uploaded images before they become visible to the public.

**Key Features:**
- ✅ **Pending Review**: New images start with `moderation_status: 'pending'`
- ✅ **Approval Workflow**: Admins can approve or reject images
- ✅ **Public Visibility**: Only approved images are visible to the public
- ✅ **Soft Delete**: Deleted images are never returned in queries
- ✅ **Audit Trail**: All moderation actions are tracked (moderator, timestamp, notes)

---

## 🔐 Authentication & Authorization

All moderation endpoints require:
1. **Authentication**: Valid JWT token
2. **Authorization**: `platform_admin` role

**Error Response (403 Forbidden):**
```json
{
  "success": false,
  "message": "Access denied. Required role: platform_admin. Your role: player",
  "error_code": "FORBIDDEN"
}
```

---

## 📊 Moderation Workflow

```
Image Uploaded
  ↓
moderation_status: 'pending'
  ↓
Admin Reviews (GET /moderation/pending)
  ↓
Admin Approves/Rejects
  ↓
moderation_status: 'approved' (visible to public)
  OR
moderation_status: 'rejected' (hidden from public)
```

---

## 🎯 API Endpoints

### 1. Get Pending Moderation Queue

**`GET /api/v1/images/moderation/pending`**

Returns list of images awaiting moderation review.

**Query Parameters:**
- `limit` (optional, default: 50): Maximum number of images to return
- `offset` (optional, default: 0): Pagination offset

**Request Example:**
```http
GET /api/v1/images/moderation/pending?limit=20&offset=0
Authorization: Bearer <admin_token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Pending moderation images retrieved successfully",
  "data": {
    "images": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "entityType": "facility",
        "entityId": 1,
        "imageType": "gallery",
        "s3Key": "facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
        "publicUrl": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000.jpg",
        "variants": {
          "thumb": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_thumb.jpg",
          "medium": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_medium.jpg",
          "full": "https://cdn.sportsarena.com/facility/1/550e8400-e29b-41d4-a716-446655440000_full.jpg"
        },
        "moderationStatus": "pending",
        "uploadStatus": "uploaded",
        "fileSize": 245678,
        "contentType": "image/jpeg",
        "createdBy": 5,
        "createdAt": "2025-01-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

**Notes:**
- Only returns images with `upload_status: 'uploaded'` (images must be fully uploaded)
- Only returns images with `moderation_status: 'pending'`
- Excludes deleted images (`is_deleted: false`)
- Ordered by creation date (oldest first)

---

### 2. Approve Image

**`POST /api/v1/images/moderation/:imageId/approve`**

Approves an image, making it visible to the public.

**URL Parameters:**
- `imageId` (required): Image UUID

**Request Body (optional):**
```json
{
  "notes": "Approved - image meets quality standards"
}
```

**Request Example:**
```http
POST /api/v1/images/moderation/550e8400-e29b-41d4-a716-446655440000/approve
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "notes": "Approved - image meets quality standards"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Image approved successfully. It is now visible to the public.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "moderationStatus": "approved",
    "moderatedBy": 1,
    "moderatedAt": "2025-01-20T11:00:00.000Z",
    "moderationNotes": "Approved - image meets quality standards"
  }
}
```

**Updates:**
- `moderation_status` → `'approved'`
- `moderated_by` → Admin user ID
- `moderated_at` → Current timestamp
- `moderation_notes` → Notes (if provided)

**Error Responses:**

**404 Not Found:**
```json
{
  "success": false,
  "message": "Image not found",
  "error_code": "IMAGE_NOT_FOUND"
}
```

---

### 3. Reject Image

**`POST /api/v1/images/moderation/:imageId/reject`**

Rejects an image, hiding it from public view.

**URL Parameters:**
- `imageId` (required): Image UUID

**Request Body (required):**
```json
{
  "notes": "Rejected - inappropriate content"
}
```

**Request Example:**
```http
POST /api/v1/images/moderation/550e8400-e29b-41d4-a716-446655440000/reject
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "notes": "Rejected - inappropriate content"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Image rejected successfully. It is now hidden from public view.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "moderationStatus": "rejected",
    "moderatedBy": 1,
    "moderatedAt": "2025-01-20T11:00:00.000Z",
    "moderationNotes": "Rejected - inappropriate content"
  }
}
```

**Updates:**
- `moderation_status` → `'rejected'`
- `moderated_by` → Admin user ID
- `moderated_at` → Current timestamp
- `moderation_notes` → Rejection reason (required)

**Error Responses:**

**400 Bad Request - Missing Notes:**
```json
{
  "success": false,
  "message": "Rejection notes are required. Please provide a reason for rejection.",
  "error_code": "VALIDATION_ERROR"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Image not found",
  "error_code": "IMAGE_NOT_FOUND"
}
```

---

### 4. Get Moderation Statistics

**`GET /api/v1/images/moderation/stats`**

Returns moderation statistics for admin dashboard.

**Request Example:**
```http
GET /api/v1/images/moderation/stats
Authorization: Bearer <admin_token>
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Moderation statistics retrieved successfully",
  "data": {
    "pending": 15,
    "approved": 245,
    "rejected": 8,
    "total": 268
  }
}
```

**Statistics:**
- `pending`: Number of images awaiting review
- `approved`: Number of approved images (visible to public)
- `rejected`: Number of rejected images (hidden from public)
- `total`: Total number of uploaded images (excluding deleted)

**Notes:**
- Only counts images with `upload_status: 'uploaded'`
- Excludes deleted images (`is_deleted: false`)

---

## 🔍 Public Image Visibility

### Query Filters

Public image queries automatically filter:

1. **Deleted Images**: `is_deleted = false`
2. **Approved Only**: `moderation_status = 'approved'`

**Example:**
```javascript
// Public query - only returns approved, non-deleted images
GET /api/v1/images/facility/1

// Admin query - can include pending images
// (Currently not exposed via API, but available in model)
Image.findByEntity('facility', 1, { includePending: true })
```

### Image States

| State | `is_deleted` | `moderation_status` | Visible to Public? |
|-------|--------------|---------------------|-------------------|
| Pending Review | `false` | `pending` | ❌ No |
| Approved | `false` | `approved` | ✅ Yes |
| Rejected | `false` | `rejected` | ❌ No |
| Deleted | `true` | (any) | ❌ No (never returned) |

---

## 📝 Best Practices

### 1. Review Process

1. **Check pending queue regularly**
   ```javascript
   GET /api/v1/images/moderation/pending
   ```

2. **Review image content**
   - Check image URL/variants for content
   - Verify image quality and appropriateness

3. **Approve or reject**
   - **Approve**: Image meets standards
   - **Reject**: Provide clear reason in notes

### 2. Rejection Notes

Always provide clear, actionable rejection notes:

✅ **Good:**
- "Rejected - image contains inappropriate content"
- "Rejected - image quality too low"
- "Rejected - image does not match facility description"

❌ **Bad:**
- "Rejected"
- "No"

### 3. Batch Processing

For efficiency, process multiple images:

```javascript
// Get pending images
const { data } = await fetch('/api/v1/images/moderation/pending?limit=50');

// Approve multiple images
for (const image of data.images) {
  if (imageMeetsStandards(image)) {
    await fetch(`/api/v1/images/moderation/${image.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes: 'Approved' })
    });
  } else {
    await fetch(`/api/v1/images/moderation/${image.id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes: 'Does not meet quality standards' })
    });
  }
}
```

---

## 🔒 Security Considerations

1. **Role-Based Access**: Only `platform_admin` can moderate images
2. **Audit Trail**: All moderation actions are logged (moderator, timestamp, notes)
3. **No Direct Deletion**: Images are soft-deleted, never permanently removed
4. **Public Filtering**: Rejected and deleted images are never returned to public APIs

---

## 📊 Moderation Dashboard Integration

### Dashboard Widget Example

```javascript
// Get statistics
const stats = await fetch('/api/v1/images/moderation/stats').then(r => r.json());

// Display
console.log(`Pending: ${stats.data.pending}`);
console.log(`Approved: ${stats.data.approved}`);
console.log(`Rejected: ${stats.data.rejected}`);

// Show alert if pending queue is large
if (stats.data.pending > 20) {
  alert(`⚠️ ${stats.data.pending} images pending review`);
}
```

---

## ✅ Summary

- ✅ **Pending Queue**: View images awaiting review
- ✅ **Approve/Reject**: Make images visible or hidden
- ✅ **Statistics**: Track moderation workload
- ✅ **Audit Trail**: All actions are logged
- ✅ **Public Safety**: Rejected/deleted images are never visible

The moderation system ensures only appropriate, high-quality images are visible to the public while maintaining a complete audit trail of all moderation decisions.

