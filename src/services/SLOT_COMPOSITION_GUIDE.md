# Slot Composition Service Guide

## Overview

The `slotCompositionService` composes free 30-minute base availability blocks into duration-based booking options. It finds continuous sequences of base blocks that satisfy a requested duration and returns them as booking ranges (start_time → end_time).

## Core Function: `generateBookingSlots(freeBlocks, durationMinutes, options)`

### Input

```javascript
const freeBlocks = [
  { startTime: 540, endTime: 570 },  // 9:00-9:30
  { startTime: 570, endTime: 600 },  // 9:30-10:00
  { startTime: 600, endTime: 630 },  // 10:00-10:30
  { startTime: 720, endTime: 750 }   // 12:00-12:30
];

const result = generateBookingSlots(freeBlocks, 90); // 90-minute duration
```

### Output

```javascript
{
  slots: [
    {
      startTime: 540,      // 9:00 (minutes since midnight)
      endTime: 630,        // 10:30
      durationMinutes: 90,
      pricePerHourOverride: null
    }
  ],
  metadata: {
    totalBlocks: 4,
    requiredBlocks: 3,      // 90 minutes = 3 × 30-minute blocks
    sequencesFound: 1,
    durationMinutes: 90,
    minDuration: 30,
    maxDuration: 480
  }
}
```

## How It Works

### Step 1: Validate Inputs

```javascript
// Validate duration aligns to 30-minute granularity
if (durationMinutes % 30 !== 0) {
  throw new Error('Duration must be a multiple of 30 minutes');
}

// Validate blocks are properly formatted
if (!isValidBlocks(freeBlocks)) {
  throw new Error('Invalid blocks array');
}
```

### Step 2: Calculate Required Blocks

```javascript
// 90 minutes = 3 × 30-minute blocks
const requiredBlocks = durationMinutes / 30;
```

### Step 3: Find Continuous Sequences

```javascript
// Algorithm:
// 1. Sort blocks by start time
// 2. For each block, try to build a sequence starting from that block
// 3. Check if blocks are consecutive (end of one = start of next)
// 4. If sequence reaches required length, add to results
```

**Example:**
```
Free blocks: [9:00-9:30, 9:30-10:00, 10:00-10:30, 12:00-12:30]
Duration: 90 minutes (3 blocks)

Sequences found:
- Starting at 9:00: [9:00-9:30, 9:30-10:00, 10:00-10:30] ✓
  → Result: 9:00-10:30 (90 minutes)
  
- Starting at 9:30: [9:30-10:00, 10:00-10:30] ✗ (only 2 blocks)
  
- Starting at 10:00: [10:00-10:30] ✗ (only 1 block)
  
- Starting at 12:00: [12:00-12:30] ✗ (only 1 block)

Final result: [9:00-10:30]
```

### Step 4: Remove Duplicates and Sort

```javascript
// Remove any duplicate slots
// Sort by start time
// Return sorted array
```

## How This Supports Custom Durations Cleanly

### Flexible Duration Support

The service supports **any duration that's a multiple of 30 minutes**:

```javascript
// 30 minutes (1 block)
generateBookingSlots(blocks, 30);   // 30, 60, 90, 120, etc.

// 60 minutes (2 blocks)
generateBookingSlots(blocks, 60);

// 90 minutes (3 blocks)
generateBookingSlots(blocks, 90);

// 150 minutes (5 blocks)
generateBookingSlots(blocks, 150);

// 210 minutes (7 blocks)
generateBookingSlots(blocks, 210);
```

### No Pre-Generation Required

Unlike slot-based systems that pre-generate all possible durations:

**Traditional Approach (Slot Explosion):**
```
For each court, for each date, for each possible duration:
  - Generate all 30-minute slots
  - Generate all 60-minute slots
  - Generate all 90-minute slots
  - Generate all 120-minute slots
  - ... (exponential growth)
```

**This Approach (On-Demand):**
```
1. Generate base 30-minute blocks (once)
2. When user requests 90-minute slots:
   - Compose blocks on-demand
   - No pre-generation needed
```

### Multiple Durations Support

You can generate slots for multiple durations in one call:

```javascript
const result = generateSlotsForMultipleDurations(blocks, [30, 60, 90, 120]);

// Returns:
// {
//   slotsByDuration: {
//     30: [...],  // All 30-minute options
//     60: [...],  // All 60-minute options
//     90: [...],  // All 90-minute options
//     120: [...]  // All 120-minute options
//   }
// }
```

## Why This Approach Avoids Slot Explosion

### Problem: Slot Explosion

**Traditional slot-based systems:**

For 1 court, 30 days, with 5 possible durations:
- 30-minute slots: 1,440 slots/day × 30 days = 43,200 slots
- 60-minute slots: 720 slots/day × 30 days = 21,600 slots
- 90-minute slots: 480 slots/day × 30 days = 14,400 slots
- 120-minute slots: 360 slots/day × 30 days = 10,800 slots
- 150-minute slots: 288 slots/day × 30 days = 8,640 slots

**Total: 98,640 slots** for just 1 court!

For 10 courts: **986,400 slots**
For 100 courts: **9,864,000 slots**

### Solution: On-Demand Composition

**This approach:**

For 1 court, 30 days:
- Base 30-minute blocks: 1,440 blocks/day × 30 days = 43,200 blocks
- **No pre-generation of duration combinations**

When user requests 90-minute slots:
- Compose on-demand from base blocks
- **No storage needed for duration combinations**

**Storage: 43,200 blocks** (same regardless of how many durations you support)

### Storage Comparison

| Approach | 1 Court | 10 Courts | 100 Courts |
|----------|---------|-----------|------------|
| **Pre-Generated Slots** (5 durations) | 98,640 | 986,400 | 9,864,000 |
| **On-Demand Composition** | 43,200 | 432,000 | 4,320,000 |
| **Savings** | 56% | 56% | 56% |

### Additional Benefits

1. **No Update Cascade**: Change one booking doesn't require updating multiple slot tables
2. **Flexible Durations**: Add new durations without schema changes
3. **Memory Efficient**: Only compose what's needed, when needed
4. **Fast Queries**: Query base blocks only, compose in memory

## Usage Examples

### Example 1: Basic Usage

```javascript
const availabilityService = require('./availabilityService');
const filterService = require('./availabilityFilterService');
const compositionService = require('./slotCompositionService');

// Step 1: Get base availability
const base = await availabilityService.generateBaseAvailability(courtId, date);

// Step 2: Filter out bookings and blocks
const filtered = await filterService.filterAvailability(base);

// Step 3: Generate 90-minute booking slots
const slots = compositionService.generateBookingSlots(
  filtered.blocks,
  90  // 90-minute duration
);

console.log(`Found ${slots.slots.length} available 90-minute slots`);
```

### Example 2: Multiple Durations

```javascript
// Generate slots for multiple durations
const result = compositionService.generateSlotsForMultipleDurations(
  filtered.blocks,
  [30, 60, 90, 120, 150]  // 30min, 1h, 1.5h, 2h, 2.5h
);

// Display options
Object.entries(result.slotsByDuration).forEach(([duration, slots]) => {
  console.log(`${duration}-minute slots: ${slots.length} options`);
});
```

### Example 3: Integration in Controller

```javascript
async function getBookingOptions(req, res, next) {
  try {
    const courtId = parseInt(req.params.id);
    const date = new Date(req.query.date);
    const duration = parseInt(req.query.duration) || 30;
    
    // Get filtered availability
    const base = await availabilityService.generateBaseAvailability(courtId, date);
    const filtered = await filterService.filterAvailability(base);
    
    // Generate booking slots for requested duration
    const slots = compositionService.generateBookingSlots(
      filtered.blocks,
      duration
    );
    
    // Format for API response
    const response = {
      courtId,
      date: date.toISOString().split('T')[0],
      duration,
      options: slots.slots.map(slot => ({
        startTime: timeNorm.formatTimeString(slot.startTime),
        endTime: timeNorm.formatTimeString(slot.endTime),
        startTimeMinutes: slot.startTime,
        endTimeMinutes: slot.endTime,
        durationMinutes: slot.durationMinutes
      })),
      metadata: slots.metadata
    };
    
    res.json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
}
```

## Algorithm Details

### Continuous Sequence Detection

```javascript
function findContinuousSequences(blocks, requiredBlocks) {
  const sortedBlocks = [...blocks].sort((a, b) => a.startTime - b.startTime);
  const sequences = [];
  
  // For each possible starting block
  for (let i = 0; i <= sortedBlocks.length - requiredBlocks; i++) {
    const sequence = [sortedBlocks[i]];
    
    // Try to build a continuous sequence
    for (let j = i + 1; j < sortedBlocks.length && sequence.length < requiredBlocks; j++) {
      const lastBlock = sequence[sequence.length - 1];
      const nextBlock = sortedBlocks[j];
      
      // Check if blocks are consecutive
      if (lastBlock.endTime === nextBlock.startTime) {
        sequence.push(nextBlock);
      } else {
        // Gap detected - cannot continue
        break;
      }
    }
    
    // If we found enough consecutive blocks, create a slot
    if (sequence.length === requiredBlocks) {
      sequences.push({
        startTime: sequence[0].startTime,
        endTime: sequence[sequence.length - 1].endTime
      });
    }
  }
  
  return sequences;
}
```

### Time Complexity

- **Sorting**: O(n log n) where n = number of blocks
- **Sequence Finding**: O(n × m) where m = required blocks
- **Overall**: O(n log n + n × m)

For typical use cases:
- 50 free blocks, 90-minute duration (3 blocks required)
- Sorting: ~50 × log(50) ≈ 300 operations
- Sequence finding: ~50 × 3 ≈ 150 operations
- **Total: ~450 operations** (very fast)

## Error Handling

### Invalid Duration

```javascript
try {
  generateBookingSlots(blocks, 45); // Not a multiple of 30
} catch (error) {
  // error.errorCode: 'INVALID_DURATION'
  // error.message: 'Duration must be a positive multiple of 30 minutes'
}
```

### Duration Too Short

```javascript
try {
  generateBookingSlots(blocks, 15); // Less than minimum
} catch (error) {
  // error.errorCode: 'DURATION_TOO_SHORT'
  // error.message: 'Duration must be at least 30 minutes'
}
```

### Duration Too Long

```javascript
try {
  generateBookingSlots(blocks, 600); // Exceeds maximum
} catch (error) {
  // error.errorCode: 'DURATION_TOO_LONG'
  // error.message: 'Duration must not exceed 480 minutes'
}
```

## Testing

### Unit Tests

```javascript
describe('generateBookingSlots', () => {
  it('should find continuous sequences', () => {
    const blocks = [
      { startTime: 540, endTime: 570 },
      { startTime: 570, endTime: 600 },
      { startTime: 600, endTime: 630 }
    ];
    
    const result = generateBookingSlots(blocks, 90);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].startTime).toBe(540);
    expect(result.slots[0].endTime).toBe(630);
  });
  
  it('should handle gaps in blocks', () => {
    const blocks = [
      { startTime: 540, endTime: 570 },
      { startTime: 570, endTime: 600 },
      { startTime: 720, endTime: 750 }  // Gap
    ];
    
    const result = generateBookingSlots(blocks, 90);
    expect(result.slots).toHaveLength(0); // No 90-minute sequence possible
  });
  
  it('should reject invalid durations', () => {
    expect(() => {
      generateBookingSlots([], 45); // Not a multiple of 30
    }).toThrow('INVALID_DURATION');
  });
});
```

## Summary

The `slotCompositionService` provides:

1. ✅ **Custom Duration Support**: Any duration that's a multiple of 30 minutes
2. ✅ **No Slot Explosion**: Composes on-demand, doesn't pre-generate
3. ✅ **Pure Function**: Deterministic, testable, no side effects
4. ✅ **Efficient**: Fast in-memory composition
5. ✅ **Flexible**: Supports multiple durations in one call
6. ✅ **Reusable**: Works for all sports and courts

This service is the third layer in the availability generation pipeline:
1. **Base Availability** → Generates blocks from rules
2. **Filter Availability** → Removes bookings and blocks
3. **Compose Slots** → Creates duration-based booking options
4. **Future**: Apply buffers, validate against policies, etc.

