# Time Normalization Architecture

## Executive Summary

The SportsArena booking system uses **"minutes since midnight"** (0-1439) as the standard format for all time-of-day operations. This approach eliminates timezone and date-related edge cases while providing simple, efficient storage and querying.

## Core Principle

**All recurring time operations use minutes since midnight (0-1439) instead of full timestamps.**

- `0` = 00:00 (midnight)
- `630` = 10:30
- `1080` = 18:00
- `1439` = 23:59

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Controllers)                   │
│  - Receives Date objects or time strings from clients        │
│  - Converts to minutes since midnight                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Service Layer (Business Logic)              │
│  - Uses timeNormalization.js utilities                      │
│  - Validates using bookingRules.js                           │
│  - Works with minutes since midnight internally              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Layer (PostgreSQL)                     │
│  - Stores as INTEGER (0-1439)                                │
│  - Uses CHECK constraints for validation                       │
│  - Helper functions for range queries                        │
└─────────────────────────────────────────────────────────────┘
```

## PostgreSQL Storage Strategy

### Column Type

**Use `INTEGER` for all time-of-day columns:**

```sql
CREATE TABLE facility_availability (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    open_time INTEGER NOT NULL,    -- Minutes since midnight (0-1439)
    close_time INTEGER NOT NULL,    -- Minutes since midnight (0-1439)
    CHECK (open_time >= 0 AND open_time < 1440),
    CHECK (close_time >= 0 AND close_time < 1440)
);
```

### Key Points

1. **Type**: Always use `INTEGER`, never `VARCHAR` or `TIME`
2. **Constraints**: Always add CHECK constraints (0-1439)
3. **Indexing**: Index time columns for range queries
4. **Date Separation**: Store actual dates separately (use `DATE` type)

### Example Schema

```sql
-- Availability windows (recurring, day-based)
CREATE TABLE facility_availability (
    facility_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,  -- 0=Sunday, 1=Monday, etc.
    open_time INTEGER NOT NULL,    -- Minutes since midnight
    close_time INTEGER NOT NULL,   -- Minutes since midnight
    CHECK (open_time >= 0 AND open_time < 1440),
    CHECK (close_time >= 0 AND close_time < 1440)
);

-- Booking slots (specific date + time)
CREATE TABLE booking_slots (
    id SERIAL PRIMARY KEY,
    court_id INTEGER NOT NULL,
    booking_date DATE NOT NULL,    -- Actual date (YYYY-MM-DD)
    start_time INTEGER NOT NULL,   -- Minutes since midnight
    end_time INTEGER NOT NULL,     -- Minutes since midnight
    status VARCHAR(20) NOT NULL,
    CHECK (start_time >= 0 AND start_time < 1440),
    CHECK (end_time >= 0 AND end_time < 1440)
);
```

## Service Layer Validation & Conversion

### Import Pattern

```javascript
const timeNorm = require('../utils/timeNormalization');
const bookingRules = require('../config/bookingRules');
```

### Conversion Flow

```
User Input (Date/String) 
    ↓
toMinutesSinceMidnight() 
    ↓
Validation (isValidMinutes, isAlignedToGranularity)
    ↓
Database Storage (INTEGER)
    ↓
fromMinutesSinceMidnight() 
    ↓
API Response (Date/String)
```

### Example: Creating Availability

```javascript
// 1. Receive Date object from API
const openTime = new Date(req.body.openTime); // e.g., "2024-01-01T10:00:00"

// 2. Convert to minutes since midnight
const openMinutes = timeNorm.toMinutesSinceMidnight(openTime); // 600

// 3. Validate
if (!timeNorm.isValidMinutes(openMinutes)) {
  throw new Error('Invalid time');
}

if (!timeNorm.isAlignedToGranularity(openMinutes)) {
  throw new Error('Time must align to 30-minute intervals');
}

// 4. Store in database
await db.query(
  'INSERT INTO facility_availability (open_time) VALUES ($1)',
  [openMinutes]
);
```

### Example: Reading from Database

```javascript
// 1. Query database
const result = await db.query(
  'SELECT open_time, close_time FROM facility_availability WHERE id = $1',
  [availabilityId]
);

// 2. Convert to Date objects for API response
const availability = {
  openTime: timeNorm.fromMinutesSinceMidnight(result.rows[0].open_time),
  closeTime: timeNorm.fromMinutesSinceMidnight(result.rows[0].close_time),
  // Or format as string:
  openTimeString: timeNorm.formatTimeString(result.rows[0].open_time),
  closeTimeString: timeNorm.formatTimeString(result.rows[0].close_time)
};
```

## Midnight Crossover Handling

### The Problem

Some facilities operate across midnight (e.g., 18:00 → 02:00). Traditional timestamp approaches require complex date math.

### The Solution

With minutes since midnight, midnight crossover is natural:

```javascript
const startMinutes = 1080;  // 18:00
const endMinutes = 120;      // 02:00

// Simple check: if end < start, it crosses midnight
const crossesMidnight = endMinutes < startMinutes; // true

// Duration calculation handles it automatically
const duration = timeNorm.calculateRangeDuration(startMinutes, endMinutes);
// Returns 480 minutes (8 hours) - correctly calculated
```

### Range Checking

```javascript
// Check if 01:00 (60 minutes) is in range 18:00 → 02:00
const isInRange = timeNorm.isTimeInRange(60, 1080, 120); // true

// The function handles midnight crossover automatically:
// - If range crosses: time >= start OR time <= end
// - If normal range: time >= start AND time <= end
```

## Advantages Over Timestamps

### 1. No Timezone Confusion

**Timestamps:**
```javascript
// Problem: What timezone is this?
const time = new Date('2024-01-01T10:00:00Z'); // UTC? Local?
```

**Minutes Since Midnight:**
```javascript
// Solution: Always relative to midnight, no timezone
const minutes = 600; // Always means 10:00, regardless of timezone
```

### 2. No Daylight Saving Time Issues

**Timestamps:**
```javascript
// Problem: DST can shift times unexpectedly
const time = new Date('2024-03-10T10:00:00'); // Might shift when DST starts
```

**Minutes Since Midnight:**
```javascript
// Solution: No DST issues - time is just a number
const minutes = 600; // Always 10:00, DST doesn't affect it
```

### 3. Simple Comparisons

**Timestamps:**
```javascript
// Problem: Complex date math needed
const today = new Date('2024-01-15T10:00:00');
const tomorrow = new Date('2024-01-16T10:00:00');
// Are these the same time? Need to compare dates separately
```

**Minutes Since Midnight:**
```javascript
// Solution: Simple numeric comparison
const todayMinutes = 600;
const tomorrowMinutes = 600;
// Same time-of-day, regardless of date
```

### 4. Natural Midnight Crossover

**Timestamps:**
```javascript
// Problem: Complex logic needed
const start = new Date('2024-01-15T18:00:00');
const end = new Date('2024-01-16T02:00:00');
// Need to check if dates are different, handle day rollover
```

**Minutes Since Midnight:**
```javascript
// Solution: Natural handling
const startMinutes = 1080; // 18:00
const endMinutes = 120;     // 02:00
const crossesMidnight = endMinutes < startMinutes; // Simple check
```

### 5. Storage Efficiency

- **Timestamp**: 8 bytes (TIMESTAMP)
- **Minutes Since Midnight**: 4 bytes (INTEGER)
- **50% storage reduction** for time-of-day data

### 6. Query Performance

**Timestamps:**
```sql
-- Complex query with date extraction
SELECT * FROM slots 
WHERE EXTRACT(HOUR FROM start_time) >= 10 
  AND EXTRACT(HOUR FROM start_time) < 18;
```

**Minutes Since Midnight:**
```sql
-- Simple numeric comparison
SELECT * FROM slots 
WHERE start_time >= 600 AND start_time < 1080;
```

## Integration Points

### 1. API Boundaries

**Input**: Convert Date objects or time strings to minutes
```javascript
const minutes = timeNorm.toMinutesSinceMidnight(new Date(req.body.time));
```

**Output**: Convert minutes to Date objects or formatted strings
```javascript
const timeString = timeNorm.formatTimeString(row.start_time);
```

### 2. Service Layer

Use minutes internally for all calculations:
```javascript
const duration = timeNorm.calculateRangeDuration(startMinutes, endMinutes);
const isInRange = timeNorm.isTimeInRange(checkMinutes, openMinutes, closeMinutes);
```

### 3. Database Layer

Store as INTEGER, use helper functions for queries:
```sql
SELECT * FROM availability 
WHERE is_time_in_range(630, open_time, close_time);
```

### 4. Validation Layer

Combine with booking rules:
```javascript
const validation = bookingRules.validateBookingTimeRange(startTime, endTime);
const startMinutes = timeNorm.toMinutesSinceMidnight(startTime);
if (!timeNorm.isAlignedToGranularity(startMinutes)) {
  throw new Error('Time must align to 30-minute intervals');
}
```

## Best Practices

1. **Always validate** before storing: Use `isValidMinutes()` and `isAlignedToGranularity()`
2. **Use database constraints**: Add CHECK constraints in PostgreSQL
3. **Convert at boundaries**: Convert to/from Date objects only at API boundaries
4. **Store as INTEGER**: Always store as INTEGER in database, never as strings
5. **Document ranges**: Clearly document when ranges cross midnight
6. **Use helper functions**: Always use utility functions, never manual calculations
7. **Separate date and time**: Store actual dates as DATE, times as INTEGER

## Files Reference

- **Core Utility**: `src/utils/timeNormalization.js`
- **Architecture Guide**: `src/utils/TIME_NORMALIZATION_GUIDE.md`
- **Usage Examples**: `src/utils/timeNormalization.example.js`
- **Database Helpers**: `src/db/migrations/016_add_time_normalization_helpers.sql`
- **Booking Rules**: `src/config/bookingRules.js`

## Migration Path

When migrating existing timestamp-based data:

1. Identify columns that represent time-of-day (not specific dates)
2. Add new INTEGER columns
3. Migrate data using `toMinutesSinceMidnight()`
4. Update application code to use new columns
5. Drop old timestamp columns

Example migration:
```javascript
const rows = await db.query('SELECT id, old_time_column FROM table');
for (const row of rows) {
  const minutes = timeNorm.toMinutesSinceMidnight(new Date(row.old_time_column));
  await db.query('UPDATE table SET new_time_column = $1 WHERE id = $2', [minutes, row.id]);
}
```

