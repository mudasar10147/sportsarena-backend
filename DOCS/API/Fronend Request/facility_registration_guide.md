# Facility Registration Guide (Frontend Dashboard)

## Overview
This guide explains how to implement facility registration in the frontend dashboard for facility admins.

---

## Prerequisites

- User must be authenticated (JWT token)
- User must have `facility_admin` role

---

## Registration Flow

```
1. Basic Info Form → 2. Upload Cover Image → 3. Upload Gallery Images → 4. Done
```

---

## Step 1: Create Facility (Basic Info)

### Endpoint
```
POST /api/v1/facilities
```

### Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Request Body
```json
{
  "name": "Sports Arena Lahore",
  "address": "123 Main Boulevard, Gulberg III",
  "city": "Lahore",
  "description": "Premium sports facility with multiple courts",
  "latitude": 31.5204,
  "longitude": 74.3587,
  "contactPhone": "+923001234567",
  "contactEmail": "contact@sportsarena.pk",
  "amenities": ["parking", "wifi", "restroom", "cafeteria", "lighting", "water"],
  "openingHours": {
    "monday": { "open": "06:00", "close": "23:00" },
    "tuesday": { "open": "06:00", "close": "23:00" },
    "wednesday": { "open": "06:00", "close": "23:00" },
    "thursday": { "open": "06:00", "close": "23:00" },
    "friday": { "open": "06:00", "close": "23:00" },
    "saturday": { "open": "08:00", "close": "22:00" },
    "sunday": { "open": "08:00", "close": "22:00" }
  }
}
```

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Facility name |
| `address` | string | Full address |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| `city` | string | City name |
| `description` | string | Facility description |
| `latitude` | number | Latitude (-90 to 90) |
| `longitude` | number | Longitude (-180 to 180) |
| `contactPhone` | string | Contact phone |
| `contactEmail` | string | Contact email |
| `amenities` | array | Array of amenity strings (max 8) |
| `openingHours` | object | Opening hours by day |

### Valid Amenities (Max 8)
```javascript
const VALID_AMENITIES = [
  'parking',
  'wifi',
  'restroom',
  'cafeteria',
  'lighting',
  'water',
  'seating',
  'pro_shop',
  'locker_room',
  'shower',
  'air_conditioning',
  'first_aid',
  'equipment_rental',
  'coaching',
  'spectator_area',
  'wheelchair_accessible'
];
```

### Success Response (201 Created)
```json
{
  "success": true,
  "message": "Facility created successfully",
  "data": {
    "id": 1,
    "name": "Sports Arena Lahore",
    "address": "123 Main Boulevard, Gulberg III",
    "city": "Lahore",
    "description": "Premium sports facility with multiple courts",
    "latitude": 31.5204,
    "longitude": 74.3587,
    "contactPhone": "+923001234567",
    "contactEmail": "contact@sportsarena.pk",
    "amenities": ["parking", "wifi", "restroom", "cafeteria", "lighting", "water"],
    "openingHours": { ... },
    "ownerId": 5,
    "isActive": true,
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-20T10:00:00.000Z"
  }
}
```

### Error Responses

**400 Bad Request - Missing Required Fields**
```json
{
  "success": false,
  "message": "Name and address are required",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Invalid Amenities**
```json
{
  "success": false,
  "message": "Invalid amenities: swimming_pool. Valid options: parking, wifi, ...",
  "error_code": "VALIDATION_ERROR"
}
```

**400 Bad Request - Too Many Amenities**
```json
{
  "success": false,
  "message": "Maximum 8 amenities allowed",
  "error_code": "VALIDATION_ERROR"
}
```

**403 Forbidden - Not a Facility Admin**
```json
{
  "success": false,
  "message": "Access denied. Facility admin role required.",
  "error_code": "FORBIDDEN"
}
```

---

## Step 2: Upload Cover Image

Upload a single cover image (Facebook-style, optimized for mobile display).

### Endpoint
```
POST /api/v1/images/upload
```

### Headers
```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

### Form Data
| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Image file (JPEG, PNG, WebP) |
| `entityType` | string | `"facility"` |
| `entityId` | number | Facility ID from Step 1 |
| `imageType` | string | `"cover"` |

### Example (JavaScript/Fetch)
```javascript
const uploadCoverImage = async (facilityId, file, token) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', 'facility');
  formData.append('entityId', facilityId);
  formData.append('imageType', 'cover');

  const response = await fetch(`${API_BASE_URL}/api/v1/images/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  return response.json();
};
```

### Example (Flutter/Dart)
```dart
Future<Map<String, dynamic>> uploadCoverImage(int facilityId, File file, String token) async {
  final request = http.MultipartRequest(
    'POST',
    Uri.parse('$baseUrl/api/v1/images/upload'),
  );
  
  request.headers['Authorization'] = 'Bearer $token';
  request.fields['entityType'] = 'facility';
  request.fields['entityId'] = facilityId.toString();
  request.fields['imageType'] = 'cover';
  request.files.add(await http.MultipartFile.fromPath('file', file.path));
  
  final response = await request.send();
  final responseBody = await response.stream.bytesToString();
  return jsonDecode(responseBody);
}
```

### Success Response (201 Created)
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "entityType": "facility",
    "entityId": 1,
    "imageType": "cover",
    "url": "https://cdn.example.com/facilities/1/cover.jpg",
    "isPrimary": true,
    "isActive": true,
    "createdAt": "2025-01-20T10:05:00.000Z"
  }
}
```

### Notes
- Only 1 cover image allowed per facility
- Uploading a new cover image automatically replaces the old one
- Recommended aspect ratio: Mobile-optimized (like Facebook cover)

---

## Step 3: Upload Gallery Images

Upload up to 10 gallery images (3:2 aspect ratio recommended).

### Endpoint
```
POST /api/v1/images/upload
```

### Form Data
| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Image file (JPEG, PNG, WebP) |
| `entityType` | string | `"facility"` |
| `entityId` | number | Facility ID from Step 1 |
| `imageType` | string | `"gallery"` |

### Example (JavaScript - Multiple Images)
```javascript
const uploadGalleryImages = async (facilityId, files, token) => {
  const results = [];
  
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'facility');
    formData.append('entityId', facilityId);
    formData.append('imageType', 'gallery');

    const response = await fetch(`${API_BASE_URL}/api/v1/images/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const result = await response.json();
    results.push(result);
  }
  
  return results;
};
```

### Notes
- Maximum 10 gallery images per facility
- Recommended aspect ratio: 3:2
- Each image must be uploaded separately (one API call per image)

### Error Response - Limit Reached
```json
{
  "success": false,
  "message": "Image limit reached. Maximum 10 Gallery images allowed per Facility. Please delete an existing gallery image before uploading a new one.",
  "error_code": "IMAGE_LIMIT_REACHED"
}
```

---

## Step 4: Get Facility Images

Retrieve all images for a facility.

### Endpoint
```
GET /api/v1/images/entity/facility/:facilityId
```

### Success Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "imageType": "cover",
      "url": "https://cdn.example.com/facilities/1/cover.jpg",
      "isPrimary": true
    },
    {
      "id": "uuid-2",
      "imageType": "gallery",
      "url": "https://cdn.example.com/facilities/1/gallery-1.jpg",
      "isPrimary": false
    },
    {
      "id": "uuid-3",
      "imageType": "gallery",
      "url": "https://cdn.example.com/facilities/1/gallery-2.jpg",
      "isPrimary": false
    }
  ]
}
```

---

## Update Facility

### Endpoint
```
PUT /api/v1/facilities/:id
```

### Request Body (partial update)
```json
{
  "name": "Updated Facility Name",
  "amenities": ["parking", "wifi", "restroom", "lighting"]
}
```

### Notes
- Only include fields you want to update
- User must be the facility owner

---

## Delete Gallery Image

### Endpoint
```
DELETE /api/v1/images/id/:imageId
```

### Headers
```
Authorization: Bearer <jwt-token>
```

### Success Response
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

---

## Complete Registration Flow (Code Example)

```javascript
// Complete facility registration flow
const registerFacility = async (facilityData, coverImage, galleryImages, token) => {
  try {
    // Step 1: Create facility
    const facilityResponse = await fetch(`${API_BASE_URL}/api/v1/facilities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(facilityData)
    });
    
    const facility = await facilityResponse.json();
    if (!facility.success) {
      throw new Error(facility.message);
    }
    
    const facilityId = facility.data.id;
    console.log('Facility created:', facilityId);
    
    // Step 2: Upload cover image (if provided)
    if (coverImage) {
      const coverResult = await uploadCoverImage(facilityId, coverImage, token);
      console.log('Cover image uploaded:', coverResult.data.url);
    }
    
    // Step 3: Upload gallery images (if provided)
    if (galleryImages && galleryImages.length > 0) {
      const galleryResults = await uploadGalleryImages(facilityId, galleryImages, token);
      console.log('Gallery images uploaded:', galleryResults.length);
    }
    
    return { success: true, facilityId };
    
  } catch (error) {
    console.error('Facility registration failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Usage
const facilityData = {
  name: "Sports Arena Lahore",
  address: "123 Main Boulevard",
  city: "Lahore",
  amenities: ["parking", "wifi", "restroom", "lighting"]
};

const coverImage = document.getElementById('coverInput').files[0];
const galleryImages = Array.from(document.getElementById('galleryInput').files);

const result = await registerFacility(facilityData, coverImage, galleryImages, authToken);
```

---

## Flutter/Dart Complete Example

```dart
class FacilityRegistrationService {
  final String baseUrl;
  final String token;
  
  FacilityRegistrationService(this.baseUrl, this.token);
  
  // Step 1: Create facility
  Future<int> createFacility(Map<String, dynamic> facilityData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/v1/facilities'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(facilityData),
    );
    
    final data = jsonDecode(response.body);
    if (!data['success']) {
      throw Exception(data['message']);
    }
    
    return data['data']['id'];
  }
  
  // Step 2: Upload cover image
  Future<void> uploadCoverImage(int facilityId, File file) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/api/v1/images/upload'),
    );
    
    request.headers['Authorization'] = 'Bearer $token';
    request.fields['entityType'] = 'facility';
    request.fields['entityId'] = facilityId.toString();
    request.fields['imageType'] = 'cover';
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    
    final response = await request.send();
    if (response.statusCode != 201) {
      throw Exception('Failed to upload cover image');
    }
  }
  
  // Step 3: Upload gallery images
  Future<void> uploadGalleryImages(int facilityId, List<File> files) async {
    for (final file in files) {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/api/v1/images/upload'),
      );
      
      request.headers['Authorization'] = 'Bearer $token';
      request.fields['entityType'] = 'facility';
      request.fields['entityId'] = facilityId.toString();
      request.fields['imageType'] = 'gallery';
      request.files.add(await http.MultipartFile.fromPath('file', file.path));
      
      final response = await request.send();
      if (response.statusCode != 201) {
        throw Exception('Failed to upload gallery image');
      }
    }
  }
  
  // Complete registration
  Future<int> registerFacility({
    required Map<String, dynamic> facilityData,
    File? coverImage,
    List<File>? galleryImages,
  }) async {
    // Create facility
    final facilityId = await createFacility(facilityData);
    
    // Upload cover image
    if (coverImage != null) {
      await uploadCoverImage(facilityId, coverImage);
    }
    
    // Upload gallery images
    if (galleryImages != null && galleryImages.isNotEmpty) {
      await uploadGalleryImages(facilityId, galleryImages);
    }
    
    return facilityId;
  }
}

// Usage
final service = FacilityRegistrationService(baseUrl, authToken);

final facilityId = await service.registerFacility(
  facilityData: {
    'name': 'Sports Arena Lahore',
    'address': '123 Main Boulevard',
    'city': 'Lahore',
    'amenities': ['parking', 'wifi', 'restroom', 'lighting'],
  },
  coverImage: coverImageFile,
  galleryImages: galleryImageFiles,
);
```

---

## Image Requirements Summary

| Image Type | Limit | Aspect Ratio | Recommended Size |
|------------|-------|--------------|------------------|
| Cover | 1 | Mobile-optimized (Facebook-style) | 1200x630px |
| Gallery | 10 | 3:2 | 1200x800px |

---

## Amenities Display

For displaying amenities in the UI, you can use icons:

| Amenity | Icon Suggestion |
|---------|-----------------|
| `parking` | 🅿️ / car icon |
| `wifi` | 📶 / wifi icon |
| `restroom` | 🚻 / restroom icon |
| `cafeteria` | ☕ / coffee/food icon |
| `lighting` | 💡 / light icon |
| `water` | 💧 / water icon |
| `seating` | 🪑 / chair icon |
| `pro_shop` | 🛒 / shop icon |
| `locker_room` | 🚪 / locker icon |
| `shower` | 🚿 / shower icon |
| `air_conditioning` | ❄️ / ac icon |
| `first_aid` | ⛑️ / medical icon |
| `equipment_rental` | 🎾 / equipment icon |
| `coaching` | 👨‍🏫 / coach icon |
| `spectator_area` | 👥 / audience icon |
| `wheelchair_accessible` | ♿ / accessibility icon |

---

**Last Updated**: 2025-01-20
