# Rule-Based Availability Architecture

## Overview

The SportsArena booking system uses a **rule-based availability model** instead of storing individual time slots. This design stores availability rules, booking policies, and blocked time ranges, then generates slots on-demand when needed.

## Why Rule-Based Availability Scales Better

### Problems with Slot-Based Storage

**Traditional Approach (Storing Individual Slots):**
```
booking_slots table:
- slot_id, court_id, date, start_time, end_time, status
- For 1 court, 30 days, 30-min slots: 1,440 rows per court
- For 10 courts: 14,400 rows
- For 100 courts: 144,000 rows
```

**Problems:**
1. **Storage Explosion**: Millions of rows for even moderate facilities
2. **Maintenance Overhead**: Changing hours requires updating thousands of rows
3. **Query Complexity**: Complex queries across millions of rows
4. **Data Redundancy**: Same availability pattern repeated daily
5. **Update Inefficiency**: Changing one rule requires updating many slots

### Benefits of Rule-Based Storage

**Rule-Based Approach:**
```
court_availability_rules table:
- rule_id, court_id, day_of_week, start_time, end_time
- For 1 court with 7 different day rules: 7 rows
- For 10 courts: 70 rows
- For 100 courts: 700 rows
```

**Benefits:**
1. **Minimal Storage**: Only store rules, not individual slots
2. **Easy Updates**: Change one rule affects all future slots
3. **Fast Queries**: Query rules, not millions of slots
4. **Flexible**: Easy to add exceptions (blocked ranges)
5. **Scalable**: Grows linearly with courts, not exponentially with time

### Storage Comparison

| Approach | 10 Courts | 100 Courts | 1,000 Courts |
|----------|-----------|------------|--------------|
| **Slot-Based** | 14,400 rows | 144,000 rows | 1,440,000 rows |
| **Rule-Based** | 70 rows | 700 rows | 7,000 rows |

**Rule-based is 200x more efficient** for storage and queries.

## Schema Design

### 1. Court Availability Rules

**Table:** `court_availability_rules`

Stores when courts are available (day of week + time range).

```sql
CREATE TABLE court_availability_rules (
    id SERIAL PRIMARY KEY,
    court_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,  -- 0=Sunday, 6=Saturday
    start_time INTEGER NOT NULL,    -- Minutes since midnight (0-1439)
    end_time INTEGER NOT NULL,       -- Minutes since midnight (0-1439)
    is_active BOOLEAN DEFAULT TRUE,
    price_per_hour_override DECIMAL(10, 2),  -- Optional price override
    UNIQUE(court_id, day_of_week, start_time, end_time)
);
```

**Example Data:**
```
Court 1 (Padel Court):
- Monday-Friday: 9:00-18:00 (540 → 1080)
- Saturday: 10:00-16:00 (600 → 960)
- Sunday: Closed

Court 2 (Tennis Court):
- Monday-Sunday: 8:00-22:00 (480 → 1320)
```

**Storage:** 7 rows per court (one per day, even if closed)

### 2. Booking Policies

**Table:** `booking_policies`

Stores booking window limits and policies (facility-level or court-level).

```sql
CREATE TABLE booking_policies (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER,  -- NULL means facility-level
    court_id INTEGER,     -- NULL means facility-level, set means court-level override
    max_advance_booking_days INTEGER,
    min_booking_duration_minutes INTEGER,
    max_booking_duration_minutes INTEGER,
    booking_buffer_minutes INTEGER,
    min_advance_notice_minutes INTEGER,
    is_active BOOLEAN DEFAULT TRUE
);
```

**Example Data:**
```
Facility 1 (default policy):
- max_advance_booking_days: 30
- min_booking_duration_minutes: 30
- max_booking_duration_minutes: 480 (8 hours)

Court 1 (override):
- max_advance_booking_days: 7  (only 7 days in advance)
- min_booking_duration_minutes: 60  (minimum 1 hour)
```

**Storage:** 1-2 rows per facility (facility policy + optional court overrides)

### 3. Blocked Time Ranges

**Table:** `blocked_time_ranges`

Stores admin-blocked time ranges (maintenance, private events, etc.).

```sql
CREATE TABLE blocked_time_ranges (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER,
    court_id INTEGER,
    block_type VARCHAR(20),  -- 'one_time', 'recurring', 'date_range'
    start_date DATE,
    end_date DATE,
    start_time INTEGER,      -- Minutes since midnight
    end_time INTEGER,        -- Minutes since midnight
    day_of_week INTEGER,     -- For recurring blocks
    reason VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);
```

**Example Data:**
```
One-time block:
- Court 1, 2024-01-15, 14:00-16:00, "Maintenance"

Recurring block:
- Court 2, Every Monday, 12:00-13:00, "Staff Lunch Break"

Date range block:
- Facility 1, 2024-12-24 to 2024-12-26, "Holiday Closure"
```

**Storage:** Only active blocks stored (typically < 100 per facility)

## How Slot Generation Works

### Step 1: Query Availability Rules

```javascript
// Get availability rules for a court on a specific day
const rules = await db.query(`
    SELECT day_of_week, start_time, end_time 
    FROM court_availability_rules 
    WHERE court_id = $1 
      AND day_of_week = $2 
      AND is_active = TRUE
`, [courtId, dayOfWeek]);
```

### Step 2: Apply Blocked Ranges

```javascript
// Check for blocked ranges
const blocks = await db.query(`
    SELECT start_time, end_time, block_type
    FROM blocked_time_ranges
    WHERE court_id = $1 
      AND (
        (block_type = 'one_time' AND start_date = $2) OR
        (block_type = 'recurring' AND day_of_week = $3) OR
        (block_type = 'date_range' AND $2 BETWEEN start_date AND end_date)
      )
      AND is_active = TRUE
`, [courtId, date, dayOfWeek]);
```

### Step 3: Generate Slots

```javascript
function generateSlots(availabilityRule, blockedRanges, date) {
    const slots = [];
    let currentTime = availabilityRule.start_time;
    
    while (currentTime + MIN_DURATION <= availabilityRule.end_time) {
        const slotStart = currentTime;
        const slotEnd = slotStart + MIN_DURATION;
        
        // Check if slot overlaps with any blocked range
        const isBlocked = blockedRanges.some(block => 
            timeRangesOverlap(slotStart, slotEnd, block.start_time, block.end_time)
        );
        
        if (!isBlocked) {
            slots.push({
                date,
                startTime: slotStart,
                endTime: slotEnd,
                status: 'available'
            });
        }
        
        currentTime += TIME_GRANULARITY; // 30 minutes
    }
    
    return slots;
}
```

### Step 4: Apply Booking Policies

```javascript
// Check advance booking window
const policy = await getBookingPolicy(courtId);
const maxAdvanceDays = policy.max_advance_booking_days || 30;

if (daysUntil(date) > maxAdvanceDays) {
    // Filter out slots beyond advance window
    return [];
}
```

## Multi-Sport and Multi-Court Support

### Facility Structure

```
Facility 1 (Sports Complex)
├── Court 1 (Padel) - Sport: Padel
│   ├── Availability: Mon-Fri 9:00-18:00
│   └── Policy: 7-day advance booking
├── Court 2 (Padel) - Sport: Padel
│   ├── Availability: Mon-Sun 8:00-22:00
│   └── Policy: Uses facility default (30 days)
├── Court 3 (Tennis) - Sport: Tennis
│   ├── Availability: Mon-Fri 10:00-20:00
│   └── Policy: 14-day advance booking
└── Court 4 (Badminton) - Sport: Badminton
    ├── Availability: Mon-Sun 9:00-21:00
    └── Policy: Uses facility default
```

### Query Patterns

**Get all available courts for a sport:**
```sql
SELECT c.id, c.name, c.facility_id
FROM courts c
INNER JOIN court_availability_rules car ON c.id = car.court_id
WHERE c.sport_id = $1
  AND car.day_of_week = $2
  AND car.is_active = TRUE
  AND c.is_active = TRUE;
```

**Get availability for a specific court:**
```sql
SELECT day_of_week, start_time, end_time
FROM court_availability_rules
WHERE court_id = $1
  AND is_active = TRUE
ORDER BY day_of_week;
```

**Get booking policy (court-level or facility-level):**
```sql
-- Try court-level first, fallback to facility-level
SELECT 
    COALESCE(cp.max_advance_booking_days, fp.max_advance_booking_days) as max_advance_days,
    COALESCE(cp.min_booking_duration_minutes, fp.min_booking_duration_minutes) as min_duration
FROM courts c
LEFT JOIN booking_policies cp ON c.id = cp.court_id AND cp.is_active = TRUE
LEFT JOIN booking_policies fp ON c.facility_id = fp.facility_id 
    AND fp.court_id IS NULL AND fp.is_active = TRUE
WHERE c.id = $1;
```

## Advantages of This Design

### 1. Scalability
- **Storage**: O(courts) instead of O(courts × days × slots)
- **Queries**: Fast rule lookups instead of scanning millions of slots
- **Updates**: Change one rule, affects all future slots

### 2. Flexibility
- Easy to add exceptions (blocked ranges)
- Different policies per court
- Price overrides per time range
- Recurring vs one-time blocks

### 3. Maintainability
- Clear separation: rules vs policies vs blocks
- Easy to understand: "Court is open Mon-Fri 9-6"
- Simple queries: "What are the rules for this court?"

### 4. Performance
- Indexed lookups on small rule tables
- No need to pre-generate slots
- Generate slots on-demand when needed

## Usage Flow

### 1. Admin Sets Up Court

```javascript
// 1. Create availability rules
await createAvailabilityRule(courtId, 1, 540, 1080); // Monday 9:00-18:00
await createAvailabilityRule(courtId, 2, 540, 1080); // Tuesday 9:00-18:00
// ... etc

// 2. Set booking policy (optional, uses facility default if not set)
await createBookingPolicy(courtId, {
    maxAdvanceDays: 7,
    minDuration: 60
});

// 3. Add blocked ranges as needed
await createBlockedRange(courtId, {
    type: 'recurring',
    dayOfWeek: 1,
    startTime: 720,  // 12:00
    endTime: 780,    // 13:00
    reason: 'Staff Lunch Break'
});
```

### 2. User Requests Available Slots

```javascript
// User wants to see available slots for Court 1 on 2024-01-15 (Monday)

// 1. Get availability rules for Monday
const rules = await getAvailabilityRules(courtId, 1); // Monday

// 2. Get blocked ranges for that date
const blocks = await getBlockedRanges(courtId, date, 1);

// 3. Get existing bookings for that date
const bookings = await getBookingsForDate(courtId, date);

// 4. Generate slots on-demand
const slots = generateAvailableSlots(rules, blocks, bookings, date);

// 5. Apply booking policies (filter by advance window, etc.)
const filteredSlots = applyBookingPolicies(slots, courtId, date);
```

### 3. User Makes Booking

```javascript
// User books slot: 2024-01-15, 10:00-11:00

// 1. Validate against availability rules
const isValid = await validateAgainstRules(courtId, date, 1, 600, 660);

// 2. Check for blocked ranges
const isBlocked = await checkBlockedRanges(courtId, date, 600, 660);

// 3. Check booking policies
const policy = await getBookingPolicy(courtId);
if (daysUntil(date) > policy.maxAdvanceDays) {
    throw new Error('Booking too far in advance');
}

// 4. Check for conflicts with existing bookings
const conflicts = await checkBookingConflicts(courtId, date, 600, 660);

// 5. Create booking
if (isValid && !isBlocked && !conflicts) {
    await createBooking(userId, courtId, date, 600, 660);
}
```

## Migration from Slot-Based (If Needed)

If migrating from a slot-based system:

1. **Extract Rules**: Analyze existing slots to identify patterns
2. **Create Rules**: Convert patterns to availability rules
3. **Migrate Blocks**: Convert blocked slots to blocked ranges
4. **Update Code**: Change slot generation to use rules
5. **Remove Slots Table**: Drop old slots table after migration

## Summary

This rule-based architecture provides:
- **200x better storage efficiency**
- **Faster queries** (rule lookups vs slot scans)
- **Easier maintenance** (change rules, not thousands of slots)
- **Better scalability** (grows with courts, not time)
- **More flexibility** (policies, blocks, overrides)

The system generates slots on-demand from rules, making it efficient and maintainable at scale.

