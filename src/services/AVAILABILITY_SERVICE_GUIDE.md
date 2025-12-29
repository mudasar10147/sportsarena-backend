# Availability Service Guide

## Overview

The `availabilityService` generates **base availability blocks** for courts based on availability rules stored in PostgreSQL. This is the foundation layer that other services will build upon.

## Current Implementation

### Function: `generateBaseAvailability(courtId, date)`

**Purpose:** Generate 30-minute base availability blocks for a court on a given date.

**What it does:**
1. ✅ Validates date against advance booking policy
2. ✅ Reads availability rules from database
3. ✅ Generates 30-minute blocks in memory
4. ✅ Returns sorted availability intervals

**What it does NOT do:**
- ❌ Does not consider existing bookings
- ❌ Does not consider blocked time ranges
- ❌ Does not apply buffer times
- ❌ Does not write to database

### Input

```javascript
const availability = await generateBaseAvailability(
  1,                          // courtId: number
  new Date('2024-01-15')     // date: Date object or ISO string
);
```

### Output

```javascript
{
  courtId: 1,
  date: '2024-01-15T00:00:00.000Z',
  dayOfWeek: 1,  // Monday
  policy: {
    maxAdvanceBookingDays: 30,
    minBookingDurationMinutes: 30,
    maxBookingDurationMinutes: 480,
    bookingBufferMinutes: 0,
    minAdvanceNoticeMinutes: 0
  },
  blocks: [
    {
      startTime: 540,    // 9:00 (minutes since midnight)
      endTime: 570,      // 9:30
      pricePerHourOverride: null  // Uses court default price
    },
    {
      startTime: 570,    // 9:30
      endTime: 600,      // 10:00
      pricePerHourOverride: null
    },
    // ... more blocks
  ]
}
```

### Example Usage

```javascript
const availabilityService = require('./services/availabilityService');

// Generate availability for Court 1 on January 15, 2024
try {
  const availability = await availabilityService.generateBaseAvailability(
    1,
    new Date('2024-01-15')
  );
  
  console.log(`Found ${availability.blocks.length} base availability blocks`);
  availability.blocks.forEach(block => {
    const start = timeNorm.formatTimeString(block.startTime);
    const end = timeNorm.formatTimeString(block.endTime);
    console.log(`${start} - ${end}`);
  });
} catch (error) {
  console.error('Error:', error.message);
}
```

## How It Works

### Step 1: Policy Validation

```javascript
// Get booking policy (court-level or facility-level)
const policy = await getBookingPolicy(courtId);

// Validate date is within advance booking window
validateAdvanceBookingWindow(date, policy);
```

**Checks:**
- Date is not in the past
- Date is within `maxAdvanceBookingDays`
- Date meets `minAdvanceNoticeMinutes` (if set)

### Step 2: Read Availability Rules

```javascript
// Get availability rules for this court and day of week
const rules = await getAvailabilityRules(courtId, dayOfWeek);
```

**Query:**
```sql
SELECT * FROM court_availability_rules
WHERE court_id = $1
  AND day_of_week = $2
  AND is_active = TRUE
ORDER BY start_time ASC
```

### Step 3: Generate Blocks

```javascript
// For each rule, generate 30-minute blocks
for (const rule of rules) {
  const blocks = generateBlocksFromRule(rule);
  // Blocks are 30 minutes each: 540-570, 570-600, 600-630, etc.
}
```

**Handles:**
- Normal ranges: 9:00-18:00 → blocks every 30 minutes
- Midnight crossover: 18:00-02:00 → blocks from 18:00 to 23:59, then 00:00 to 02:00

### Step 4: Merge and Sort

```javascript
// Merge overlapping blocks and sort by start time
const mergedBlocks = mergeAndSortBlocks(allBlocks);
```

**Why merge?**
- Multiple rules might overlap (e.g., 9:00-12:00 and 10:00-18:00)
- Merging creates clean, non-overlapping intervals

## Error Handling

### Court Not Found

```javascript
{
  statusCode: 404,
  errorCode: 'COURT_NOT_FOUND',
  message: 'Court not found'
}
```

### Invalid Date

```javascript
{
  statusCode: 400,
  errorCode: 'INVALID_DATE',
  message: 'Invalid date'
}
```

### Past Date

```javascript
{
  statusCode: 400,
  errorCode: 'PAST_DATE_NOT_ALLOWED',
  message: 'Cannot generate availability for past dates'
}
```

### Exceeds Advance Booking Window

```javascript
{
  statusCode: 400,
  errorCode: 'EXCEEDS_ADVANCE_BOOKING_WINDOW',
  message: 'Booking date exceeds maximum advance booking window of 30 days',
  maxAllowedDays: 30,
  requestedDays: 45
}
```

### Insufficient Advance Notice

```javascript
{
  statusCode: 400,
  errorCode: 'INSUFFICIENT_ADVANCE_NOTICE',
  message: 'Booking requires at least 60 minutes advance notice',
  requiredMinutes: 60,
  availableMinutes: 30
}
```

## Future Extensions

### Extension 1: Apply Blocked Time Ranges

**New Function:** `generateAvailabilityWithBlocks(courtId, date)`

```javascript
async function generateAvailabilityWithBlocks(courtId, date) {
  // 1. Get base availability
  const baseAvailability = await generateBaseAvailability(courtId, date);
  
  // 2. Get blocked time ranges for this date
  const blockedRanges = await getBlockedTimeRanges(courtId, date);
  
  // 3. Subtract blocked ranges from base availability
  const availableBlocks = subtractBlockedRanges(
    baseAvailability.blocks,
    blockedRanges
  );
  
  return {
    ...baseAvailability,
    blocks: availableBlocks
  };
}
```

**Implementation:**
- Query `blocked_time_ranges` table
- Check for `one_time`, `recurring`, and `date_range` blocks
- Use `timeNorm.isTimeInRange()` to check overlaps
- Remove or split blocks that overlap with blocked ranges

### Extension 2: Apply Existing Bookings

**New Function:** `generateAvailabilityWithBookings(courtId, date)`

```javascript
async function generateAvailabilityWithBookings(courtId, date) {
  // 1. Get base availability (or availability with blocks)
  const baseAvailability = await generateAvailabilityWithBlocks(courtId, date);
  
  // 2. Get existing bookings for this date
  const bookings = await getBookingsForDate(courtId, date);
  
  // 3. Subtract booked time ranges from availability
  const availableBlocks = subtractBookings(
    baseAvailability.blocks,
    bookings
  );
  
  return {
    ...baseAvailability,
    blocks: availableBlocks,
    bookings: bookings  // Include for reference
  };
}
```

**Implementation:**
- Query `bookings` table for this court and date
- Filter by status (exclude 'cancelled')
- Use `timeNorm.isTimeInRange()` to check overlaps
- Remove or split blocks that overlap with bookings

### Extension 3: Apply Buffer Times

**New Function:** `generateAvailabilityWithBuffers(courtId, date)`

```javascript
async function generateAvailabilityWithBuffers(courtId, date) {
  // 1. Get availability with bookings
  const availability = await generateAvailabilityWithBookings(courtId, date);
  
  // 2. Get booking policy (includes buffer_minutes)
  const policy = availability.policy;
  
  // 3. Apply buffer times around bookings
  const availableBlocks = applyBufferTimes(
    availability.blocks,
    availability.bookings,
    policy.bookingBufferMinutes
  );
  
  return {
    ...availability,
    blocks: availableBlocks
  };
}
```

**Implementation:**
- For each booking, add buffer time before and after
- Example: 15-minute buffer means 10:00-11:00 booking blocks 9:45-11:15
- Remove or adjust blocks that fall within buffer zones

### Extension 4: Duration-Based Slot Generation

**New Function:** `generateSlotsForDuration(courtId, date, durationMinutes)`

```javascript
async function generateSlotsForDuration(courtId, date, durationMinutes) {
  // 1. Get full availability (with blocks and bookings)
  const availability = await generateAvailabilityWithBuffers(courtId, date);
  
  // 2. Validate duration against policy
  const policy = availability.policy;
  if (durationMinutes < policy.minBookingDurationMinutes) {
    throw new Error(`Duration must be at least ${policy.minBookingDurationMinutes} minutes`);
  }
  if (durationMinutes > policy.maxBookingDurationMinutes) {
    throw new Error(`Duration must not exceed ${policy.maxBookingDurationMinutes} minutes`);
  }
  
  // 3. Generate slots of requested duration
  const slots = generateSlotsFromBlocks(
    availability.blocks,
    durationMinutes
  );
  
  return {
    ...availability,
    slots: slots,
    requestedDuration: durationMinutes
  };
}
```

**Implementation:**
- Take base availability blocks
- For each block, check if it has enough duration
- If block is 9:00-12:00 (180 minutes) and user wants 90-minute slots:
  - Generate: 9:00-10:30, 9:30-11:00, 10:00-11:30, 10:30-12:00
- Use sliding window approach for flexible start times

### Extension 5: Complete Availability Service

**New Function:** `getAvailableSlots(courtId, date, options)`

```javascript
async function getAvailableSlots(courtId, date, options = {}) {
  const {
    durationMinutes = 30,
    includeBlocked = false,
    includeBookings = false
  } = options;
  
  // 1. Get base availability
  let availability = await generateBaseAvailability(courtId, date);
  
  // 2. Apply blocked ranges (unless excluded)
  if (!includeBlocked) {
    availability = await applyBlockedRanges(availability);
  }
  
  // 3. Apply bookings (unless excluded)
  if (!includeBookings) {
    availability = await applyBookings(availability);
  }
  
  // 4. Apply buffers
  availability = await applyBuffers(availability);
  
  // 5. Generate slots for requested duration
  if (durationMinutes !== 30) {
    availability = await generateSlotsForDuration(
      availability,
      durationMinutes
    );
  }
  
  return availability;
}
```

## Integration Pattern

### In Controllers

```javascript
// GET /api/v1/courts/:id/availability?date=2024-01-15
async function getCourtAvailability(req, res, next) {
  try {
    const courtId = parseInt(req.params.id);
    const date = new Date(req.query.date);
    
    // Get base availability
    const availability = await availabilityService.generateBaseAvailability(
      courtId,
      date
    );
    
    // Format for API response
    const response = {
      courtId: availability.courtId,
      date: availability.date,
      blocks: availability.blocks.map(block => ({
        startTime: timeNorm.formatTimeString(block.startTime),
        endTime: timeNorm.formatTimeString(block.endTime),
        startTimeMinutes: block.startTime,
        endTimeMinutes: block.endTime
      }))
    };
    
    res.json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
}
```

### In Other Services

```javascript
// Booking service uses availability service
async function checkSlotAvailability(courtId, date, startTime, endTime) {
  // Get base availability
  const availability = await availabilityService.generateBaseAvailability(
    courtId,
    date
  );
  
  // Check if requested time is in base availability
  const startMinutes = timeNorm.toMinutesSinceMidnight(startTime);
  const endMinutes = timeNorm.toMinutesSinceMidnight(endTime);
  
  const isInBaseAvailability = availability.blocks.some(block =>
    startMinutes >= block.startTime && endMinutes <= block.endTime
  );
  
  if (!isInBaseAvailability) {
    throw new Error('Requested time is outside court availability');
  }
  
  // Then check bookings, blocks, etc. (in other functions)
  return true;
}
```

## Testing Strategy

### Unit Tests

```javascript
describe('generateBaseAvailability', () => {
  it('should generate blocks for normal time range', async () => {
    const availability = await generateBaseAvailability(1, new Date('2024-01-15'));
    expect(availability.blocks.length).toBeGreaterThan(0);
  });
  
  it('should handle midnight crossover', async () => {
    // Court with 18:00-02:00 availability
    const availability = await generateBaseAvailability(2, new Date('2024-01-15'));
    // Should have blocks from 18:00 to 23:59 and 00:00 to 02:00
  });
  
  it('should reject past dates', async () => {
    await expect(
      generateBaseAvailability(1, new Date('2020-01-01'))
    ).rejects.toThrow('PAST_DATE_NOT_ALLOWED');
  });
  
  it('should reject dates beyond advance window', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 45); // 45 days ahead
    
    await expect(
      generateBaseAvailability(1, futureDate)
    ).rejects.toThrow('EXCEEDS_ADVANCE_BOOKING_WINDOW');
  });
});
```

## Summary

The `generateBaseAvailability` function is the **foundation layer** for availability generation. It:

1. ✅ Provides deterministic, predictable output
2. ✅ Validates against booking policies
3. ✅ Generates base blocks from rules
4. ✅ Returns sorted, merged intervals

**Future extensions** will layer on:
- Blocked time ranges
- Existing bookings
- Buffer times
- Duration-based slot generation

This separation of concerns makes the system:
- **Testable**: Each layer can be tested independently
- **Maintainable**: Changes to one layer don't affect others
- **Flexible**: Can combine layers as needed
- **Scalable**: Can cache base availability and apply filters in memory

