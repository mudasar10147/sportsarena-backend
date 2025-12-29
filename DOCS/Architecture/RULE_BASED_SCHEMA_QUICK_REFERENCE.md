# Rule-Based Schema Quick Reference

## Table Relationships

```
facilities (1) ──< (many) courts
                    │
                    ├──< (many) court_availability_rules
                    │
                    ├──< (many) booking_policies (court-level)
                    │
                    └──< (many) blocked_time_ranges (court-level)

facilities (1) ──< (many) booking_policies (facility-level)
                    │
                    └──< (many) blocked_time_ranges (facility-level)
```

## Table Purposes

### `court_availability_rules`
**Purpose:** Defines when courts are available (day of week + time range)

**Key Columns:**
- `court_id` - Which court
- `day_of_week` - 0=Sunday, 1=Monday, ..., 6=Saturday
- `start_time` - Minutes since midnight (0-1439)
- `end_time` - Minutes since midnight (0-1439)

**Example:**
```sql
-- Court 1 is open Monday-Friday 9:00-18:00
INSERT INTO court_availability_rules (court_id, day_of_week, start_time, end_time)
VALUES 
  (1, 1, 540, 1080),  -- Monday 9:00-18:00
  (1, 2, 540, 1080),  -- Tuesday 9:00-18:00
  (1, 3, 540, 1080), -- Wednesday 9:00-18:00
  (1, 4, 540, 1080), -- Thursday 9:00-18:00
  (1, 5, 540, 1080); -- Friday 9:00-18:00
```

### `booking_policies`
**Purpose:** Defines booking window limits and policies

**Key Columns:**
- `facility_id` - Facility-level policy (court_id = NULL)
- `court_id` - Court-level override (both facility_id and court_id set)
- `max_advance_booking_days` - How many days in advance can book
- `min_booking_duration_minutes` - Minimum booking length
- `max_booking_duration_minutes` - Maximum booking length

**Example:**
```sql
-- Facility default: 30 days advance, 30 min minimum
INSERT INTO booking_policies (facility_id, max_advance_booking_days, min_booking_duration_minutes)
VALUES (1, 30, 30);

-- Court 1 override: Only 7 days advance, 1 hour minimum
INSERT INTO booking_policies (facility_id, court_id, max_advance_booking_days, min_booking_duration_minutes)
VALUES (1, 1, 7, 60);
```

### `blocked_time_ranges`
**Purpose:** Admin-blocked time ranges (maintenance, events, etc.)

**Key Columns:**
- `block_type` - 'one_time', 'recurring', or 'date_range'
- `facility_id` - Facility-wide block (court_id = NULL)
- `court_id` - Court-specific block
- `start_date`, `end_date` - For one_time and date_range
- `start_time`, `end_time` - Minutes since midnight
- `day_of_week` - For recurring blocks

**Example:**
```sql
-- One-time: Court 1 maintenance on Jan 15, 2-4 PM
INSERT INTO blocked_time_ranges (court_id, block_type, start_date, start_time, end_time, reason)
VALUES (1, 'one_time', '2024-01-15', 840, 960, 'Maintenance');

-- Recurring: Court 2 closed every Monday 12-1 PM for staff lunch
INSERT INTO blocked_time_ranges (court_id, block_type, day_of_week, start_time, end_time, reason)
VALUES (2, 'recurring', 1, 720, 780, 'Staff Lunch Break');

-- Date range: Facility closed Dec 24-26
INSERT INTO blocked_time_ranges (facility_id, block_type, start_date, end_date, reason)
VALUES (1, 'date_range', '2024-12-24', '2024-12-26', 'Holiday Closure');
```

## Common Queries

### Get Availability Rules for a Court

```sql
SELECT day_of_week, start_time, end_time
FROM court_availability_rules
WHERE court_id = $1
  AND is_active = TRUE
ORDER BY day_of_week;
```

### Get Booking Policy (Court-Level or Facility-Level)

```sql
-- Returns court-level policy if exists, otherwise facility-level
SELECT 
    COALESCE(cp.max_advance_booking_days, fp.max_advance_booking_days) as max_advance_days,
    COALESCE(cp.min_booking_duration_minutes, fp.min_booking_duration_minutes) as min_duration,
    COALESCE(cp.max_booking_duration_minutes, fp.max_booking_duration_minutes) as max_duration
FROM courts c
LEFT JOIN booking_policies cp ON c.id = cp.court_id AND cp.is_active = TRUE
LEFT JOIN booking_policies fp ON c.facility_id = fp.facility_id 
    AND fp.court_id IS NULL AND fp.is_active = TRUE
WHERE c.id = $1;
```

### Get Blocked Ranges for a Date

```sql
SELECT start_time, end_time, block_type, reason
FROM blocked_time_ranges
WHERE (court_id = $1 OR (court_id IS NULL AND facility_id = $2))
  AND (
    -- One-time block on this date
    (block_type = 'one_time' AND start_date = $3) OR
    -- Recurring block on this day of week
    (block_type = 'recurring' AND day_of_week = $4) OR
    -- Date range block covering this date
    (block_type = 'date_range' AND $3 BETWEEN start_date AND end_date)
  )
  AND is_active = TRUE;
```

### Check if Time Range is Blocked

```sql
SELECT COUNT(*) > 0 as is_blocked
FROM blocked_time_ranges
WHERE (court_id = $1 OR (court_id IS NULL AND facility_id = $2))
  AND (
    (block_type = 'one_time' AND start_date = $3) OR
    (block_type = 'recurring' AND day_of_week = $4) OR
    (block_type = 'date_range' AND $3 BETWEEN start_date AND end_date)
  )
  AND is_active = TRUE
  AND (
    (start_time IS NULL AND end_time IS NULL) OR  -- Date range block (all day)
    is_time_in_range($5, start_time, end_time) OR  -- Check start time
    is_time_in_range($6, start_time, end_time)    -- Check end time
  );
```

## Slot Generation Logic (Pseudo-code)

```javascript
function generateSlotsForDate(courtId, date) {
    // 1. Get day of week (0=Sunday, 1=Monday, etc.)
    const dayOfWeek = date.getDay();
    
    // 2. Get availability rules for this day
    const rules = await getAvailabilityRules(courtId, dayOfWeek);
    // Returns: [{ start_time: 540, end_time: 1080 }] // 9:00-18:00
    
    // 3. Get blocked ranges for this date
    const blocks = await getBlockedRanges(courtId, date, dayOfWeek);
    // Returns: [{ start_time: 720, end_time: 780, reason: 'Lunch' }]
    
    // 4. Get existing bookings for this date
    const bookings = await getBookingsForDate(courtId, date);
    // Returns: [{ start_time: 600, end_time: 660 }] // 10:00-11:00 booked
    
    // 5. Generate slots from rules
    const slots = [];
    for (const rule of rules) {
        let currentTime = rule.start_time;
        while (currentTime + 30 <= rule.end_time) {
            const slotStart = currentTime;
            const slotEnd = slotStart + 30;
            
            // Check if blocked
            const isBlocked = blocks.some(block => 
                timeRangesOverlap(slotStart, slotEnd, block.start_time, block.end_time)
            );
            
            // Check if booked
            const isBooked = bookings.some(booking =>
                timeRangesOverlap(slotStart, slotEnd, booking.start_time, booking.end_time)
            );
            
            if (!isBlocked && !isBooked) {
                slots.push({
                    date,
                    startTime: slotStart,
                    endTime: slotEnd,
                    status: 'available'
                });
            }
            
            currentTime += 30; // Next 30-minute slot
        }
    }
    
    // 6. Apply booking policies (filter by advance window, etc.)
    const policy = await getBookingPolicy(courtId);
    const maxAdvanceDays = policy.max_advance_booking_days || 30;
    const daysUntil = calculateDaysUntil(date);
    
    return slots.filter(slot => daysUntil <= maxAdvanceDays);
}
```

## Key Design Decisions

### 1. Why Minutes Since Midnight?

- No timezone confusion
- Simple numeric comparisons
- Supports midnight crossover naturally
- Efficient storage (INTEGER vs TIMESTAMP)

### 2. Why Rule-Based Instead of Slot-Based?

- **Storage**: 7 rows per court vs 1,440 rows per court per month
- **Updates**: Change one rule vs updating thousands of slots
- **Queries**: Fast rule lookups vs scanning millions of slots
- **Scalability**: Grows with courts, not with time

### 3. Why Separate Policies Table?

- Different policies per court (some courts have restrictions)
- Easy to change policies without touching rules
- Can have facility defaults with court overrides
- Clear separation of concerns

### 4. Why Three Block Types?

- **one_time**: Specific maintenance, events
- **recurring**: Weekly patterns (lunch breaks, etc.)
- **date_range**: Holiday closures, renovations

### 5. Why Facility-Level and Court-Level Blocks?

- Some blocks affect entire facility (holidays)
- Some blocks affect specific courts (maintenance)
- Flexible admin control

## Validation Rules

### Availability Rules
- `day_of_week`: 0-6 (Sunday-Saturday)
- `start_time`: 0-1439 (minutes since midnight)
- `end_time`: 0-1439 (minutes since midnight)
- Unique: `(court_id, day_of_week, start_time, end_time)`

### Booking Policies
- `max_advance_booking_days`: > 0
- `min_booking_duration_minutes`: > 0
- `max_booking_duration_minutes`: > 0
- `booking_buffer_minutes`: >= 0
- Scope: Either `facility_id` (court_id = NULL) or both `facility_id` and `court_id`

### Blocked Time Ranges
- `block_type`: 'one_time', 'recurring', or 'date_range'
- `one_time`: Requires `start_date`, `start_time`, `end_time`
- `recurring`: Requires `day_of_week`, `start_time`, `end_time`
- `date_range`: Requires `start_date`, `end_date` (all day block)
- Scope: Either `facility_id` (court_id = NULL) or both `facility_id` and `court_id`

## Indexes for Performance

All tables have indexes on:
- Foreign keys (`court_id`, `facility_id`)
- Common query columns (`day_of_week`, `is_active`)
- Time ranges (`start_time`, `end_time`)
- Date ranges (`start_date`, `end_date`)

This ensures fast lookups for slot generation queries.

