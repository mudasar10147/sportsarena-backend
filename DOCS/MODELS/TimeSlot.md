# 🟧 TimeSlot Model

### Overview
The `TimeSlot` model represents available booking slots created by facility admins. It tracks court availability with start/end times and status (available, blocked, or booked).

### Database Schema
**Table:** `time_slots`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing slot ID |
| `court_id` | INTEGER | NOT NULL, REFERENCES courts(id) | Court this slot belongs to |
| `start_time` | TIMESTAMP | NOT NULL | Slot start time |
| `end_time` | TIMESTAMP | NOT NULL | Slot end time |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'available' | Status: available, blocked, or booked |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Constraints:**
- `CHECK (status IN ('available', 'blocked', 'booked'))` - Valid status values
- `CHECK (end_time > start_time)` - Ensures valid time range

**Indexes:**
- `idx_time_slots_court_id` - Fast court queries
- `idx_time_slots_status` - Filter by status
- `idx_time_slots_start_time` - Date range queries
- `idx_time_slots_court_status` - Composite index for court + status
- `idx_time_slots_court_start` - Composite index for date range queries

### Model Methods

#### `TimeSlot.create(slotData)`
Creates a new time slot.
- **Parameters:** `{ courtId, startTime, endTime, status? }`
- **Returns:** Time slot object
- **Note:** Status defaults to 'available'

#### `TimeSlot.findById(slotId)`
Finds time slot by ID.
- **Parameters:** `slotId` (number)
- **Returns:** Time slot object or `null`

#### `TimeSlot.findByCourtId(courtId, options?)`
Finds all time slots for a court.
- **Parameters:** `courtId` (number), `{ status?, startDate?, endDate? }`
- **Returns:** Array of time slot objects (sorted by start time)

#### `TimeSlot.getAvailableSlots(courtId, startDate, endDate)`
Gets available slots for a court within date range.
- **Parameters:** `courtId` (number), `startDate` (Date), `endDate` (Date)
- **Returns:** Array of available time slot objects

#### `TimeSlot.getAvailableSlotsNext7Days(courtId, fromDate?)`
Gets available slots for next 7 days (MVP requirement).
- **Parameters:** `courtId` (number), `fromDate?` (Date, defaults to now)
- **Returns:** Array of available time slot objects

#### `TimeSlot.isAvailable(slotId)`
Checks if slot is available.
- **Parameters:** `slotId` (number)
- **Returns:** `true` if available

#### `TimeSlot.updateStatus(slotId, status)`
Updates slot status.
- **Parameters:** `slotId` (number), `status` (string: 'available'|'blocked'|'booked')
- **Returns:** Updated time slot object or `null`

#### `TimeSlot.block(slotId)`
Blocks a time slot (convenience method).
- **Parameters:** `slotId` (number)
- **Returns:** Updated time slot object or `null`

#### `TimeSlot.markAsBooked(slotId)`
Marks slot as booked (convenience method).
- **Parameters:** `slotId` (number)
- **Returns:** Updated time slot object or `null`

#### `TimeSlot.markAsAvailable(slotId)`
Marks slot as available (convenience method).
- **Parameters:** `slotId` (number)
- **Returns:** Updated time slot object or `null`

#### `TimeSlot.createMultiple(slotsData)`
Creates multiple time slots at once (bulk insert).
- **Parameters:** `slotsData` (Array<Object>)
- **Returns:** Array of created time slot objects

#### `TimeSlot.delete(slotId)`
Deletes a time slot (hard delete).
- **Parameters:** `slotId` (number)
- **Returns:** `true` if successful

### Usage Examples

```javascript
const TimeSlot = require('./models/TimeSlot');

// Create a time slot
const slot = await TimeSlot.create({
  courtId: 1,
  startTime: '2025-01-15 10:00:00',
  endTime: '2025-01-15 11:00:00',
  status: 'available'
});

// Get available slots for next 7 days (MVP requirement)
const availableSlots = await TimeSlot.getAvailableSlotsNext7Days(courtId);

// Get slots for a court with date range
const slots = await TimeSlot.findByCourtId(courtId, {
  startDate: '2025-01-15',
  endDate: '2025-01-22',
  status: 'available'
});

// Block a slot
await TimeSlot.block(slotId);

// Mark as booked when booking is confirmed
await TimeSlot.markAsBooked(slotId);

// Create multiple slots at once
await TimeSlot.createMultiple([
  { courtId: 1, startTime: '2025-01-15 10:00', endTime: '2025-01-15 11:00' },
  { courtId: 1, startTime: '2025-01-15 11:00', endTime: '2025-01-15 12:00' }
]);
```

### Notes
- Status values: 'available', 'blocked', 'booked'
- Cascade delete when court is deleted
- Timestamps stored as PostgreSQL TIMESTAMP
- Date range queries optimized with indexes
- Bulk insert for efficient slot creation
- Hard delete (no soft delete) - slots can be recreated

