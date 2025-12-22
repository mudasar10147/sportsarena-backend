# 🟩 FacilitySport Model

### Overview
The `FacilitySport` model represents the many-to-many relationship between facilities and sports. It links which sports are available at which facilities, enabling users to search facilities by sport type.

### Database Schema
**Table:** `facility_sports`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing relationship ID |
| `facility_id` | INTEGER | NOT NULL, REFERENCES facilities(id) | Facility ID |
| `sport_id` | INTEGER | NOT NULL, REFERENCES sports(id) | Sport ID |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether relationship is active |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Constraints:**
- `UNIQUE(facility_id, sport_id)` - Prevents duplicate sport assignments to same facility

**Indexes:**
- `idx_facility_sports_facility_id` - Fast facility queries
- `idx_facility_sports_sport_id` - Fast sport queries
- `idx_facility_sports_is_active` - Filter active relationships

### Model Methods

#### `FacilitySport.create(facilityId, sportId)`
Adds a sport to a facility (or reactivates if exists).
- **Parameters:** `facilityId` (number), `sportId` (number)
- **Returns:** FacilitySport relationship object
- **Note:** Uses `ON CONFLICT` to handle duplicates gracefully

#### `FacilitySport.findById(id)`
Finds relationship by ID.
- **Parameters:** `id` (number)
- **Returns:** FacilitySport object or `null`

#### `FacilitySport.findByFacilityAndSport(facilityId, sportId)`
Finds relationship by facility and sport.
- **Parameters:** `facilityId` (number), `sportId` (number)
- **Returns:** FacilitySport object or `null`

#### `FacilitySport.getSportsByFacility(facilityId, options?)`
Gets all sports offered by a facility.
- **Parameters:** `facilityId` (number), `{ isActive? }`
- **Returns:** Array of objects with sport details included

#### `FacilitySport.getFacilitiesBySport(sportId, options?)`
Gets all facilities offering a specific sport.
- **Parameters:** `sportId` (number), `{ isActive? }`
- **Returns:** Array of objects with facility details included

#### `FacilitySport.facilityOffersSport(facilityId, sportId)`
Checks if facility offers a sport.
- **Parameters:** `facilityId` (number), `sportId` (number)
- **Returns:** `true` if facility offers the sport

#### `FacilitySport.addSportsToFacility(facilityId, sportIds)`
Adds multiple sports to a facility at once.
- **Parameters:** `facilityId` (number), `sportIds` (Array<number>)
- **Returns:** Array of created FacilitySport objects

#### `FacilitySport.removeSportFromFacility(facilityId, sportId)`
Removes a sport from a facility (soft delete).
- **Parameters:** `facilityId` (number), `sportId` (number)
- **Returns:** `true` if removed successfully

#### `FacilitySport.removeAllSportsFromFacility(facilityId)`
Removes all sports from a facility.
- **Parameters:** `facilityId` (number)
- **Returns:** Number of sports removed

#### `FacilitySport.updateStatus(facilityId, sportId, isActive)`
Updates relationship active status.
- **Parameters:** `facilityId` (number), `sportId` (number), `isActive` (boolean)
- **Returns:** Updated FacilitySport object or `null`

### Usage Examples

```javascript
const FacilitySport = require('./models/FacilitySport');

// Add a sport to a facility
await FacilitySport.create(facilityId, sportId);

// Get all sports for a facility
const sports = await FacilitySport.getSportsByFacility(facilityId);
// Returns: [{ id, facilityId, sportId, sport: { name, description, ... } }, ...]

// Get all facilities offering Tennis
const facilities = await FacilitySport.getFacilitiesBySport(tennisSportId);
// Returns: [{ id, facilityId, sportId, facility: { name, address, ... } }, ...]

// Check if facility offers Padel
const offersPadel = await FacilitySport.facilityOffersSport(facilityId, padelSportId);

// Add multiple sports at once
await FacilitySport.addSportsToFacility(facilityId, [1, 2, 3]); // Tennis, Badminton, Football

// Remove a sport from facility
await FacilitySport.removeSportFromFacility(facilityId, sportId);
```

### Notes
- Many-to-many relationship between facilities and sports
- Unique constraint prevents duplicate assignments
- Soft deletes preserve historical data
- Cascade deletes when facility or sport is removed
- Join queries include related data for convenience

