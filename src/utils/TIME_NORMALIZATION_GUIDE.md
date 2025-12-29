# Time Normalization Architecture Guide

## Overview

This system uses **"minutes since midnight"** (0-1439) as the standard format for all time-of-day operations. This approach eliminates timezone and date-related edge cases for recurring time-based operations.

## Why Minutes Since Midnight?

### Problems with Timestamps

Using full timestamps (e.g., `TIMESTAMP` in PostgreSQL) for recurring time operations causes:

1. **Timezone Confusion**: Is 10:00 UTC or local time? Daylight saving changes?
2. **Date Coupling**: Opening hours shouldn't depend on specific dates
3. **Complex Comparisons**: Comparing "10:00 today" vs "10:00 tomorrow" requires date math
4. **Midnight Crossover Complexity**: Ranges like 18:00 → 02:00 require special handling
5. **Storage Overhead**: Storing full timestamps when only time-of-day matters

### Benefits of Minutes Since Midnight

1. **No Timezone Issues**: Times are relative to midnight, not absolute
2. **Simple Comparisons**: Numeric comparison (630 < 1080 means 10:30 < 18:00)
3. **Midnight Crossover**: Handled naturally (1080 → 120 is valid)
4. **Storage Efficiency**: Single INTEGER column (4 bytes vs 8 bytes for TIMESTAMP)
5. **Validation Simplicity**: Just check 0-1439 range
6. **Database Queries**: Simple numeric range queries

## PostgreSQL Storage Strategy

### Column Type

Use `INTEGER` type for all time-of-day columns:

```sql
-- Opening hours example
CREATE TABLE facility_availability (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
    open_time INTEGER NOT NULL,    -- Minutes since midnight (0-1439)
    close_time INTEGER NOT NULL,   -- Minutes since midnight (0-1439)
    CHECK (open_time >= 0 AND open_time < 1440),
    CHECK (close_time >= 0 AND close_time < 1440)
);

-- Booking slots example
CREATE TABLE booking_slots (
    id SERIAL PRIMARY KEY,
    court_id INTEGER NOT NULL,
    booking_date DATE NOT NULL,   -- Actual date (YYYY-MM-DD)
    start_time INTEGER NOT NULL,   -- Minutes since midnight (0-1439)
    end_time INTEGER NOT NULL,     -- Minutes since midnight (0-1439)
    status VARCHAR(20) NOT NULL,
    CHECK (start_time >= 0 AND start_time < 1440),
    CHECK (end_time >= 0 AND end_time < 1440)
);
```

### Constraints

Always add CHECK constraints to enforce valid range:

```sql
CHECK (time_column >= 0 AND time_column < 1440)
```

### Indexing

Index time columns for range queries:

```sql
CREATE INDEX idx_availability_time_range ON facility_availability(open_time, close_time);
CREATE INDEX idx_slots_time ON booking_slots(booking_date, start_time, end_time);
```

### Query Examples

```sql
-- Find facilities open at 10:30 (630 minutes)
SELECT * FROM facility_availability 
WHERE isTimeInRange(630, open_time, close_time);

-- Find slots between 10:00 and 18:00 on a specific date
SELECT * FROM booking_slots
WHERE booking_date = '2024-01-15'
  AND start_time >= 600  -- 10:00
  AND end_time <= 1080;  -- 18:00

-- Find slots that cross midnight (18:00 → 02:00)
SELECT * FROM booking_slots
WHERE start_time > end_time;  -- Simple check for midnight crossover
```

## Service Layer Validation & Conversion

### Import Pattern

```javascript
const timeNorm = require('../utils/timeNormalization');
// Or destructure:
const { toMinutesSinceMidnight, fromMinutesSinceMidnight, isTimeInRange } = require('../utils/timeNormalization');
```

### Converting User Input

```javascript
// User provides Date object (from API request)
function createAvailability(req, res) {
  const { openTime, closeTime } = req.body;
  
  // Convert Date objects to minutes since midnight
  const openMinutes = timeNorm.toMinutesSinceMidnight(new Date(openTime));
  const closeMinutes = timeNorm.toMinutesSinceMidnight(new Date(closeTime));
  
  // Validate
  if (!timeNorm.isValidMinutes(openMinutes) || !timeNorm.isValidMinutes(closeMinutes)) {
    return res.status(400).json({ error: 'Invalid time range' });
  }
  
  // Store in database
  await db.query(
    'INSERT INTO facility_availability (facility_id, open_time, close_time) VALUES ($1, $2, $3)',
    [facilityId, openMinutes, closeMinutes]
  );
}
```

### Converting Database Results

```javascript
// Read from database
function getAvailability(facilityId) {
  const result = await db.query(
    'SELECT open_time, close_time FROM facility_availability WHERE facility_id = $1',
    [facilityId]
  );
  
  // Convert to Date objects for API response
  const availability = result.rows.map(row => ({
    openTime: timeNorm.fromMinutesSinceMidnight(row.open_time),
    closeTime: timeNorm.fromMinutesSinceMidnight(row.close_time),
    // Or format as string:
    openTimeString: timeNorm.formatTimeString(row.open_time),
    closeTimeString: timeNorm.formatTimeString(row.close_time)
  }));
  
  return availability;
}
```

### Validating Time Ranges

```javascript
function validateAvailabilityRange(openMinutes, closeMinutes) {
  // Check valid range
  if (!timeNorm.isValidMinutes(openMinutes) || !timeNorm.isValidMinutes(closeMinutes)) {
    throw new Error('Invalid time values');
  }
  
  // Check alignment to 30-minute granularity
  if (!timeNorm.isAlignedToGranularity(openMinutes) || 
      !timeNorm.isAlignedToGranularity(closeMinutes)) {
    throw new Error('Times must align to 30-minute intervals');
  }
  
  // Check duration (must be at least 30 minutes)
  const duration = timeNorm.calculateRangeDuration(openMinutes, closeMinutes);
  if (duration < 30) {
    throw new Error('Availability window must be at least 30 minutes');
  }
  
  return true;
}
```

### Handling Midnight Crossover

```javascript
function checkIfOpenAtTime(facilityId, checkMinutes) {
  const availability = await getAvailability(facilityId);
  
  // Check if time falls within any availability window
  for (const window of availability) {
    if (timeNorm.isTimeInRange(
      checkMinutes,
      window.open_time,
      window.close_time
    )) {
      return true;
    }
  }
  
  return false;
}

// Example: Check if facility is open at 01:00 (60 minutes)
// Availability: 18:00 → 02:00 (1080 → 120)
const isOpen = checkIfOpenAtTime(facilityId, 60); // Returns true (01:00 is in 18:00 → 02:00)
```

## Integration with Booking Rules

Combine with booking rules configuration:

```javascript
const bookingRules = require('../config/bookingRules');
const timeNorm = require('../utils/timeNormalization');

function validateBookingTime(startTime, endTime) {
  // Convert to minutes since midnight
  const startMinutes = timeNorm.toMinutesSinceMidnight(startTime);
  const endMinutes = timeNorm.toMinutesSinceMidnight(endTime);
  
  // Validate using booking rules
  const validation = bookingRules.validateBookingTimeRange(startTime, endTime);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // Validate alignment to granularity
  if (!timeNorm.isAlignedToGranularity(startMinutes) || 
      !timeNorm.isAlignedToGranularity(endMinutes)) {
    throw new Error('Times must align to 30-minute intervals');
  }
  
  return { startMinutes, endMinutes };
}
```

## Edge Cases Avoided

### 1. Timezone Issues

**With Timestamps:**
```javascript
// Problem: Is this UTC? Local time? What timezone?
const time = new Date('2024-01-01T10:00:00Z');
```

**With Minutes Since Midnight:**
```javascript
// Solution: Always relative to midnight, no timezone confusion
const minutes = 600; // Always means 10:00, regardless of timezone
```

### 2. Daylight Saving Time

**With Timestamps:**
```javascript
// Problem: DST changes can shift times
const time = new Date('2024-03-10T10:00:00'); // Might shift when DST starts
```

**With Minutes Since Midnight:**
```javascript
// Solution: No DST issues - time is just a number
const minutes = 600; // Always 10:00, DST doesn't affect it
```

### 3. Date Comparisons

**With Timestamps:**
```javascript
// Problem: Complex date math needed
const today = new Date('2024-01-15T10:00:00');
const tomorrow = new Date('2024-01-16T10:00:00');
// Are these the same time? Need to compare dates separately
```

**With Minutes Since Midnight:**
```javascript
// Solution: Simple numeric comparison
const todayMinutes = 600;
const tomorrowMinutes = 600;
// Same time-of-day, regardless of date
```

### 4. Midnight Crossover

**With Timestamps:**
```javascript
// Problem: Complex logic needed
const start = new Date('2024-01-15T18:00:00');
const end = new Date('2024-01-16T02:00:00');
// Need to check if dates are different, handle day rollover
```

**With Minutes Since Midnight:**
```javascript
// Solution: Natural handling
const startMinutes = 1080; // 18:00
const endMinutes = 120;     // 02:00
const crossesMidnight = endMinutes < startMinutes; // Simple check
const duration = timeNorm.calculateRangeDuration(startMinutes, endMinutes); // Works correctly
```

## Best Practices

1. **Always validate** before storing: Use `isValidMinutes()` and `isAlignedToGranularity()`
2. **Use database constraints**: Add CHECK constraints in PostgreSQL
3. **Convert at boundaries**: Convert to/from Date objects only at API boundaries
4. **Store as INTEGER**: Always store as INTEGER in database, never as strings
5. **Document ranges**: Clearly document when ranges cross midnight
6. **Use helper functions**: Always use utility functions, never manual calculations

## Migration Strategy

When migrating existing timestamp-based data:

```javascript
// Convert existing TIMESTAMP columns to INTEGER
async function migrateTimeColumns() {
  const rows = await db.query('SELECT id, old_time_column FROM table');
  
  for (const row of rows) {
    const date = new Date(row.old_time_column);
    const minutes = timeNorm.toMinutesSinceMidnight(date);
    
    await db.query(
      'UPDATE table SET new_time_column = $1 WHERE id = $2',
      [minutes, row.id]
    );
  }
}
```

