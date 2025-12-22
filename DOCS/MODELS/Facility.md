# 🟩 Facility Model

### Overview
The `Facility` model represents each sports venue in the SportsArena platform. It stores facility information including location, contact details, photos, and opening hours.

### Database Schema
**Table:** `facilities`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing facility ID |
| `name` | VARCHAR(255) | NOT NULL | Facility name |
| `description` | TEXT | NULL | Facility description |
| `address` | TEXT | NOT NULL | Full address |
| `city` | VARCHAR(100) | NULL | City name |
| `latitude` | DECIMAL(10,8) | NULL | Latitude coordinate |
| `longitude` | DECIMAL(11,8) | NULL | Longitude coordinate |
| `contact_phone` | VARCHAR(20) | NULL | Contact phone number |
| `contact_email` | VARCHAR(255) | NULL | Contact email |
| `owner_id` | INTEGER | REFERENCES users(id) | User ID of facility owner/admin |
| `photos` | JSONB | DEFAULT '[]' | Array of photo URLs (3-5 photos) |
| `opening_hours` | JSONB | DEFAULT '{}' | Opening hours by day |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether facility is active |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_facilities_owner_id` - Fast owner queries
- `idx_facilities_is_active` - Filter active facilities
- `idx_facilities_location` - Geo-based searches
- `idx_facilities_city` - City-based filtering

### Model Methods

#### `Facility.create(facilityData)`
Creates a new facility.
- **Parameters:** `{ name, address, ownerId, description?, city?, latitude?, longitude?, contactPhone?, contactEmail?, photos?, openingHours? }`
- **Returns:** Facility object
- **Note:** Photos should be array of URLs, openingHours is JSON object

#### `Facility.findById(facilityId)`
Finds facility by ID.
- **Parameters:** `facilityId` (number)
- **Returns:** Facility object or `null`

#### `Facility.findByOwnerId(ownerId)`
Finds all facilities owned by a user.
- **Parameters:** `ownerId` (number)
- **Returns:** Array of facility objects

#### `Facility.update(facilityId, updateData)`
Updates facility information.
- **Parameters:** `facilityId` (number), `updateData` (object)
- **Allowed fields:** `name`, `description`, `address`, `city`, `latitude`, `longitude`, `contactPhone`, `contactEmail`, `photos`, `openingHours`, `isActive`
- **Returns:** Updated facility object or `null`

#### `Facility.findAll(options?)`
Gets all facilities with filtering and pagination.
- **Parameters:** `{ limit?, offset?, city?, isActive?, latitude?, longitude?, radiusKm? }`
- **Returns:** `{ facilities: [], total: number, limit: number, offset: number }`
- **Note:** Supports location-based search with `latitude`, `longitude`, and `radiusKm`

#### `Facility.search(searchTerm, options?)`
Searches facilities by name, address, or city.
- **Parameters:** `searchTerm` (string), `{ limit?, offset?, isActive? }`
- **Returns:** Array of matching facilities

#### `Facility.delete(facilityId)`
Soft deletes facility (sets `is_active` to false).
- **Parameters:** `facilityId` (number)
- **Returns:** `true` if successful

### Usage Examples

```javascript
const Facility = require('./models/Facility');

// Create a new facility
const facility = await Facility.create({
  name: 'Elite Sports Center',
  address: '123 Sports Street, Karachi',
  city: 'Karachi',
  latitude: 24.8607,
  longitude: 67.0011,
  ownerId: 1,
  contactPhone: '+923001234567',
  contactEmail: 'info@elitesports.com',
  photos: [
    'https://example.com/photo1.jpg',
    'https://example.com/photo2.jpg'
  ],
  openingHours: {
    monday: { open: '09:00', close: '22:00' },
    tuesday: { open: '09:00', close: '22:00' }
  }
});

// Find facilities near a location (within 5km)
const { facilities } = await Facility.findAll({
  latitude: 24.8607,
  longitude: 67.0011,
  radiusKm: 5,
  isActive: true,
  limit: 20
});

// Search facilities
const results = await Facility.search('sports', {
  limit: 10,
  isActive: true
});

// Get all facilities for an owner
const myFacilities = await Facility.findByOwnerId(userId);
```

### Data Format Notes

**Photos:** Array of URL strings
```json
["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]
```

**Opening Hours:** Object with day keys
```json
{
  "monday": { "open": "09:00", "close": "22:00" },
  "tuesday": { "open": "09:00", "close": "22:00" },
  "sunday": null  // Closed
}
```

### Security Notes
- Soft deletes preserve data integrity
- Owner relationship ensures proper access control
- Location data enables geo-based search features
- Photos stored as URLs (not binary) for MVP simplicity

