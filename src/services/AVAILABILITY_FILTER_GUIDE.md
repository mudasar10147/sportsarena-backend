# Availability Filter Service Guide

## Overview

The `availabilityFilterService` filters base availability blocks by removing overlapping bookings and blocked time ranges. It is **pure and deterministic** - it takes base availability as input and returns filtered availability without modifying the database.

## Architecture

### Separation of Concerns

The service is divided into three clear layers:

1. **Data Fetching Layer** - Fetches bookings and blocked ranges from database
2. **Pure Time-Range Logic Layer** - Pure functions for overlap detection and subtraction
3. **Service Layer** - Composes data fetching with pure logic

This separation makes the service:
- **Testable**: Pure functions can be tested independently
- **Composable**: Can be used with different data sources
- **Deterministic**: Same input always produces same output

## Core Function: `filterAvailability(baseAvailability, options)`

### Input

```javascript
const baseAvailability = await availabilityService.generateBaseAvailability(courtId, date);

const filteredAvailability = await filterAvailability(baseAvailability, {
  includeBookings: true,    // Filter out bookings (default: true)
  includeBlocked: true      // Filter out blocked ranges (default: true)
});
```

### Output

```javascript
{
  // All properties from baseAvailability
  courtId: 1,
  date: '2024-01-15T00:00:00.000Z',
  dayOfWeek: 1,
  policy: { ... },
  
  // Filtered blocks (only free time)
  blocks: [
    { startTime: 540, endTime: 570, pricePerHourOverride: null },
    { startTime: 600, endTime: 630, pricePerHourOverride: null },
    // ... only blocks that don't overlap with bookings or blocks
  ],
  
  // Reference data
  bookings: [
    { id: 1, startTime: 570, endTime: 600, status: 'confirmed' }
  ],
  blockedRanges: [
    { id: 1, startTime: 720, endTime: 780, reason: 'Maintenance' }
  ],
  
  // Metadata
  metadata: {
    totalBaseBlocks: 18,
    totalFilteredBlocks: 16,
    bookingsCount: 1,
    blockedRangesCount: 1
  }
}
```

## Overlap Detection Algorithm

### How It Works

Two time ranges overlap if:
```
range1.start < range2.end AND range1.end > range2.start
```

This formula handles all overlap cases:

#### Case 1: Full Overlap (Range A contains Range B)
```
Range A: [9:00 ──────────────── 12:00]
Range B:    [10:00 ─── 11:00]
Result: Overlap ✓
```

#### Case 2: Partial Overlap (Ranges partially overlap)
```
Range A: [9:00 ──────── 11:00]
Range B:       [10:00 ──────── 12:00]
Result: Overlap ✓
```

#### Case 3: Adjacent Ranges (A ends when B starts)
```
Range A: [9:00 ─── 10:00]
Range B:            [10:00 ─── 11:00]
Result: Overlap ✓ (for booking purposes, adjacent is considered overlapping)
```

#### Case 4: No Overlap
```
Range A: [9:00 ─── 10:00]
Range B:                  [11:00 ─── 12:00]
Result: No overlap ✗
```

### Implementation

```javascript
function doRangesOverlap(start1, end1, start2, end2) {
  // Two ranges overlap if: start1 < end2 AND end1 > start2
  return start1 < end2 && end1 > start2;
}
```

## Block Subtraction Algorithm

### How It Works

When subtracting a range from a block, we handle three cases:

#### Case 1: Block Completely Contained in Range
```
Block:    [10:00 ─── 10:30]
Range:  [9:00 ──────────────── 12:00]
Result: [] (block completely removed)
```

#### Case 2: Range Completely Contained in Block
```
Block:  [9:00 ──────────────────── 12:00]
Range:      [10:00 ─── 11:00]
Result: [9:00-10:00] and [11:00-12:00] (block split into two)
```

#### Case 3: Partial Overlap
```
Block:  [9:00 ──────── 11:00]
Range:      [10:00 ──────── 12:00]
Result: [9:00-10:00] (only non-overlapping part remains)
```

### Implementation

```javascript
function subtractRangeFromBlock(block, rangeStart, rangeEnd) {
  const { startTime, endTime } = block;
  
  // No overlap - return block as-is
  if (!doRangesOverlap(startTime, endTime, rangeStart, rangeEnd)) {
    return [block];
  }
  
  const remainingParts = [];
  
  // Part before the range
  if (startTime < rangeStart) {
    remainingParts.push({
      startTime,
      endTime: Math.min(endTime, rangeStart)
    });
  }
  
  // Part after the range
  if (endTime > rangeEnd) {
    remainingParts.push({
      startTime: Math.max(startTime, rangeEnd),
      endTime
    });
  }
  
  return remainingParts;
}
```

## Composition with Base Availability Generator

### Clean Composition

The filter service composes cleanly with the base availability generator:

```javascript
// Step 1: Generate base availability
const baseAvailability = await availabilityService.generateBaseAvailability(
  courtId,
  date
);

// Step 2: Filter out bookings and blocks
const filteredAvailability = await filterAvailability(baseAvailability);

// Result: Only free time slots remain
```

### Why This Composition Works

1. **Input/Output Contract**: Base availability returns blocks, filter expects blocks
2. **No Side Effects**: Both services are pure (except database reads)
3. **Deterministic**: Same inputs produce same outputs
4. **Testable**: Each service can be tested independently

### Example Flow

```javascript
// 1. Generate base availability from rules
const base = await generateBaseAvailability(1, new Date('2024-01-15'));
// Returns: 18 blocks (9:00-18:00, 30-minute intervals)

// 2. Filter out bookings and blocks
const filtered = await filterAvailability(base);
// Returns: 16 blocks (removed 1 booking + 1 blocked range)

// 3. Use filtered blocks for display or further processing
filtered.blocks.forEach(block => {
  console.log(`${formatTime(block.startTime)} - ${formatTime(block.endTime)}`);
});
```

## Data Fetching

### Bookings

Fetches confirmed bookings (excludes cancelled):

```sql
SELECT * FROM bookings
WHERE court_id = $1
  AND booking_date = $2
  AND booking_status IN ('pending', 'confirmed', 'completed')
  AND booking_status != 'cancelled'
```

**Note**: This assumes bookings table has:
- `court_id` (INTEGER)
- `booking_date` (DATE)
- `start_time` (INTEGER - minutes since midnight)
- `end_time` (INTEGER - minutes since midnight)
- `booking_status` (VARCHAR)

### Blocked Ranges

Fetches all active blocked ranges:

```sql
SELECT * FROM blocked_time_ranges
WHERE (court_id = $1 OR facility_id = $2)
  AND (
    (block_type = 'one_time' AND start_date = $3) OR
    (block_type = 'recurring' AND day_of_week = $4) OR
    (block_type = 'date_range' AND $3 BETWEEN start_date AND end_date)
  )
  AND is_active = TRUE
```

**Handles:**
- One-time blocks (specific date + time)
- Recurring blocks (day of week + time)
- Date range blocks (all times in date range)

## Usage Examples

### Example 1: Basic Usage

```javascript
const availabilityService = require('./availabilityService');
const filterService = require('./availabilityFilterService');

// Get base availability
const base = await availabilityService.generateBaseAvailability(1, date);

// Filter out bookings and blocks
const filtered = await filterService.filterAvailability(base);

console.log(`Free blocks: ${filtered.blocks.length}`);
```

### Example 2: Only Filter Bookings

```javascript
// Get base availability
const base = await availabilityService.generateBaseAvailability(1, date);

// Only filter bookings, keep blocked ranges visible
const filtered = await filterService.filterAvailability(base, {
  includeBookings: true,
  includeBlocked: false
});
```

### Example 3: Check Specific Time

```javascript
// Get filtered availability
const filtered = await filterService.filterAvailability(base);

// Check if specific time is available
const checkTime = 600; // 10:00
const isAvailable = filtered.blocks.some(block =>
  checkTime >= block.startTime && checkTime < block.endTime
);

if (isAvailable) {
  console.log('Time is available');
} else {
  console.log('Time is booked or blocked');
}
```

## Testing

### Testing Pure Functions

```javascript
const { doRangesOverlap, subtractRangeFromBlock } = require('./availabilityFilterService');

describe('doRangesOverlap', () => {
  it('should detect full overlap', () => {
    expect(doRangesOverlap(540, 720, 600, 660)).toBe(true);
  });
  
  it('should detect partial overlap', () => {
    expect(doRangesOverlap(540, 660, 600, 720)).toBe(true);
  });
  
  it('should detect no overlap', () => {
    expect(doRangesOverlap(540, 600, 660, 720)).toBe(false);
  });
});

describe('subtractRangeFromBlock', () => {
  it('should split block when range is in middle', () => {
    const block = { startTime: 540, endTime: 720 };
    const result = subtractRangeFromBlock(block, 600, 660);
    expect(result).toEqual([
      { startTime: 540, endTime: 600 },
      { startTime: 660, endTime: 720 }
    ]);
  });
  
  it('should remove block completely when contained in range', () => {
    const block = { startTime: 600, endTime: 660 };
    const result = subtractRangeFromBlock(block, 540, 720);
    expect(result).toEqual([]);
  });
});
```

## Performance Considerations

### Efficiency

- **Sorted Ranges**: Ranges are sorted before subtraction for efficiency
- **Early Exit**: Stops processing if no blocks remain
- **Single Pass**: Processes all ranges in one pass through blocks

### Scalability

- **In-Memory Processing**: All logic happens in memory (fast)
- **Database Queries**: Only two queries (bookings + blocked ranges)
- **No Slot Storage**: No need to store/update individual slots

## Error Handling

The service handles edge cases gracefully:

- **Missing Bookings Table**: Returns empty bookings array (for migration period)
- **Invalid Time Ranges**: Validates all times before processing
- **Empty Base Availability**: Returns empty blocks array
- **No Overlaps**: Returns original blocks unchanged

## Summary

The `availabilityFilterService` provides:

1. ✅ **Pure Logic**: Deterministic, testable functions
2. ✅ **Clear Separation**: Data fetching separate from time-range logic
3. ✅ **Clean Composition**: Works seamlessly with base availability generator
4. ✅ **Complete Overlap Handling**: Handles all overlap cases correctly
5. ✅ **No Database Writes**: Read-only, no side effects
6. ✅ **Flexible**: Can filter bookings, blocks, or both

This service is the second layer in the availability generation pipeline:
1. **Base Availability** → Generates blocks from rules
2. **Filter Availability** → Removes bookings and blocks
3. **Future**: Apply buffers, generate duration-based slots, etc.

