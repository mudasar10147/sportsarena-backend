# 🟩 Court Model

### Overview
The `Court` model represents individual courts/grounds at a facility. Each court belongs to a facility and is designed for a specific sport, with pricing and indoor/outdoor classification.

### Database Schema
**Table:** `courts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing court ID |
| `facility_id` | INTEGER | NOT NULL, REFERENCES facilities(id) | Facility that owns this court |
| `sport_id` | INTEGER | NOT NULL, REFERENCES sports(id) | Sport type this court is for |
| `name` | VARCHAR(100) | NOT NULL | Court name/number (e.g., "Court 1", "Padel Court A") |
| `description` | TEXT | NULL | Optional court description |
| `price_per_hour` | DECIMAL(10,2) | NOT NULL | Price per hour in PKR |
| `is_indoor` | BOOLEAN | DEFAULT TRUE | TRUE for indoor, FALSE for outdoor |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether court is active |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_courts_facility_id` - Fast facility queries
- `idx_courts_sport_id` - Fast sport queries
- `idx_courts_is_active` - Filter active courts
- `idx_courts_facility_active` - Composite index for facility + active status

### Model Methods

#### `Court.create(courtData)`
Creates a new court.
- **Parameters:** `{ facilityId, sportId, name, pricePerHour, description?, isIndoor? }`
- **Returns:** Court object
- **Note:** Price is in PKR (Pakistani Rupees)

#### `Court.findById(courtId)`
Finds court by ID.
- **Parameters:** `courtId` (number)
- **Returns:** Court object or `null`

#### `Court.findByFacilityId(facilityId, options?)`
Finds all courts for a facility.
- **Parameters:** `facilityId` (number), `{ isActive? }`
- **Returns:** Array of court objects (sorted by name)

#### `Court.findBySportId(sportId, options?)`
Finds all courts for a sport.
- **Parameters:** `sportId` (number), `{ isActive? }`
- **Returns:** Array of court objects (sorted by name)

#### `Court.findByFacilityAndSport(facilityId, sportId, options?)`
Finds courts at a facility for a specific sport.
- **Parameters:** `facilityId` (number), `sportId` (number), `{ isActive? }`
- **Returns:** Array of court objects (sorted by price, then name)

#### `Court.findAll(options?)`
Gets all courts with filtering and pagination.
- **Parameters:** `{ limit?, offset?, facilityId?, sportId?, isIndoor?, isActive?, minPrice?, maxPrice? }`
- **Returns:** `{ courts: [], total: number, limit: number, offset: number }`

#### `Court.update(courtId, updateData)`
Updates court information.
- **Parameters:** `courtId` (number), `updateData` (object)
- **Allowed fields:** `name`, `description`, `pricePerHour`, `isIndoor`, `isActive`
- **Returns:** Updated court object or `null`

#### `Court.delete(courtId)`
Soft deletes court (sets `is_active` to false).
- **Parameters:** `courtId` (number)
- **Returns:** `true` if successful

### Usage Examples

```javascript
const Court = require('./models/Court');

// Create a new court
const court = await Court.create({
  facilityId: 1,
  sportId: 2, // Tennis
  name: 'Court 1',
  pricePerHour: 1500, // PKR
  description: 'Premium indoor court with air conditioning',
  isIndoor: true
});

// Get all courts for a facility
const courts = await Court.findByFacilityId(facilityId);

// Get courts for a specific sport at a facility
const tennisCourts = await Court.findByFacilityAndSport(facilityId, tennisSportId);

// Search courts with filters
const { courts } = await Court.findAll({
  sportId: 2,
  isIndoor: true,
  minPrice: 1000,
  maxPrice: 2000,
  isActive: true,
  limit: 20
});
```

### Notes
- Price stored as DECIMAL(10,2) for precise currency handling (PKR)
- Court belongs to one facility and one sport
- Cascade delete when facility is deleted
- Restrict delete when sport is deleted (prevents orphaned courts)
- Price filtering supports MVP price range search feature

