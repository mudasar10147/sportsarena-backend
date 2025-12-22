# 🟩 Sport Model

### Overview
The `Sport` model represents a predefined list of sports available on the SportsArena platform. It's a reference table used for filtering facilities and courts by sport type.

### Database Schema
**Table:** `sports`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing sport ID |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | Sport name (e.g., "Padel", "Tennis") |
| `description` | TEXT | NULL | Optional sport description |
| `icon_url` | VARCHAR(255) | NULL | URL to sport icon/image |
| `is_active` | BOOLEAN | DEFAULT TRUE | Whether sport is active |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- `idx_sports_name` - Fast name lookups
- `idx_sports_is_active` - Filter active sports

**Pre-seeded Sports:**
The migration includes initial sports: Padel, Tennis, Badminton, Football, Cricket, Basketball, Squash, Table Tennis, Volleyball.

### Model Methods

#### `Sport.create(sportData)`
Creates a new sport.
- **Parameters:** `{ name, description?, iconUrl? }`
- **Returns:** Sport object
- **Throws:** Error if name already exists

#### `Sport.findById(sportId)`
Finds sport by ID.
- **Parameters:** `sportId` (number)
- **Returns:** Sport object or `null`

#### `Sport.findByName(name)`
Finds sport by name (case-insensitive).
- **Parameters:** `name` (string)
- **Returns:** Sport object or `null`

#### `Sport.findAll(options?)`
Gets all active sports (sorted by name).
- **Parameters:** `{ isActive? }` (default: true)
- **Returns:** Array of sport objects

#### `Sport.search(searchTerm, options?)`
Searches sports by name or description.
- **Parameters:** `searchTerm` (string), `{ isActive? }`
- **Returns:** Array of matching sport objects

#### `Sport.update(sportId, updateData)`
Updates sport information.
- **Parameters:** `sportId` (number), `updateData` (object)
- **Allowed fields:** `name`, `description`, `iconUrl`, `isActive`
- **Returns:** Updated sport object or `null`

#### `Sport.nameExists(name, excludeId?)`
Checks if sport name already exists.
- **Parameters:** `name` (string), `excludeId?` (number)
- **Returns:** `true` if exists, `false` otherwise

#### `Sport.delete(sportId)`
Soft deletes sport (sets `is_active` to false).
- **Parameters:** `sportId` (number)
- **Returns:** `true` if successful

### Usage Examples

```javascript
const Sport = require('./models/Sport');

// Get all active sports
const sports = await Sport.findAll();
// Returns: [{ id: 1, name: 'Padel', ... }, ...]

// Find sport by name
const tennis = await Sport.findByName('Tennis');

// Search sports
const results = await Sport.search('racket');
// Returns sports with "racket" in name or description

// Create a new sport
const newSport = await Sport.create({
  name: 'Hockey',
  description: 'Team sport played with sticks and ball',
  iconUrl: 'https://example.com/hockey-icon.png'
});

// Update sport
await Sport.update(sportId, {
  description: 'Updated description',
  iconUrl: 'https://example.com/new-icon.png'
});
```

### Notes
- Sport names must be unique (case-insensitive check)
- Use soft deletes to preserve data integrity
- Pre-seeded with common sports for Pakistani market
- Icon URL is optional but recommended for better UI

