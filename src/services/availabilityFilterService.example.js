/**
 * Availability Filter Service Usage Examples
 * 
 * Demonstrates how the filter service composes with the base availability generator
 * and how overlap detection works.
 */

const availabilityService = require('./availabilityService');
const filterService = require('./availabilityFilterService');
const timeNorm = require('../utils/timeNormalization');

// ============================================================================
// EXAMPLE 1: Basic Composition
// ============================================================================

async function example1_BasicComposition() {
  const courtId = 1;
  const date = new Date('2024-01-15');
  
  // Step 1: Generate base availability from rules
  const baseAvailability = await availabilityService.generateBaseAvailability(
    courtId,
    date
  );
  
  console.log(`Base availability: ${baseAvailability.blocks.length} blocks`);
  
  // Step 2: Filter out bookings and blocked ranges
  const filteredAvailability = await filterService.filterAvailability(
    baseAvailability
  );
  
  console.log(`Filtered availability: ${filteredAvailability.blocks.length} blocks`);
  console.log(`Removed: ${filteredAvailability.metadata.bookingsCount} bookings`);
  console.log(`Removed: ${filteredAvailability.metadata.blockedRangesCount} blocked ranges`);
  
  // Display free blocks
  filteredAvailability.blocks.forEach(block => {
    const start = timeNorm.formatTimeString(block.startTime);
    const end = timeNorm.formatTimeString(block.endTime);
    console.log(`  Free: ${start} - ${end}`);
  });
}

// ============================================================================
// EXAMPLE 2: Overlap Detection Visualization
// ============================================================================

function example2_OverlapDetection() {
  const { doRangesOverlap } = filterService;
  
  console.log('=== Overlap Detection Examples ===\n');
  
  // Case 1: Full Overlap (Range A contains Range B)
  console.log('Case 1: Full Overlap');
  console.log('Block:     [9:00 ──────────────── 12:00]');
  console.log('Booking:      [10:00 ─── 11:00]');
  const case1 = doRangesOverlap(540, 720, 600, 660); // 9:00-12:00 vs 10:00-11:00
  console.log(`Overlap: ${case1}\n`); // true
  
  // Case 2: Partial Overlap
  console.log('Case 2: Partial Overlap');
  console.log('Block:  [9:00 ──────── 11:00]');
  console.log('Booking:    [10:00 ──────── 12:00]');
  const case2 = doRangesOverlap(540, 660, 600, 720); // 9:00-11:00 vs 10:00-12:00
  console.log(`Overlap: ${case2}\n`); // true
  
  // Case 3: Adjacent (considered overlapping for booking purposes)
  console.log('Case 3: Adjacent Ranges');
  console.log('Block:  [9:00 ─── 10:00]');
  console.log('Booking:        [10:00 ─── 11:00]');
  const case3 = doRangesOverlap(540, 600, 600, 660); // 9:00-10:00 vs 10:00-11:00
  console.log(`Overlap: ${case3}\n`); // false (adjacent, not overlapping)
  
  // Case 4: No Overlap
  console.log('Case 4: No Overlap');
  console.log('Block:  [9:00 ─── 10:00]');
  console.log('Booking:              [11:00 ─── 12:00]');
  const case4 = doRangesOverlap(540, 600, 660, 720); // 9:00-10:00 vs 11:00-12:00
  console.log(`Overlap: ${case4}\n`); // false
}

// ============================================================================
// EXAMPLE 3: Block Subtraction Visualization
// ============================================================================

function example3_BlockSubtraction() {
  const { subtractRangeFromBlock } = filterService;
  
  console.log('=== Block Subtraction Examples ===\n');
  
  // Case 1: Block Completely Contained in Range
  console.log('Case 1: Block Completely Contained');
  console.log('Block:    [10:00 ─── 10:30]');
  console.log('Booking: [9:00 ──────────────── 12:00]');
  const block1 = { startTime: 600, endTime: 630 };
  const result1 = subtractRangeFromBlock(block1, 540, 720);
  console.log(`Result: ${result1.length} blocks remaining\n`); // 0
  
  // Case 2: Range Completely Contained in Block (Splits Block)
  console.log('Case 2: Range in Middle (Splits Block)');
  console.log('Block:  [9:00 ──────────────────── 12:00]');
  console.log('Booking:    [10:00 ─── 11:00]');
  const block2 = { startTime: 540, endTime: 720 };
  const result2 = subtractRangeFromBlock(block2, 600, 660);
  console.log('Result:');
  result2.forEach(part => {
    const start = timeNorm.formatTimeString(part.startTime);
    const end = timeNorm.formatTimeString(part.endTime);
    console.log(`  [${start} ─── ${end}]`);
  });
  console.log(); // [9:00-10:00] and [11:00-12:00]
  
  // Case 3: Partial Overlap (Trims Block)
  console.log('Case 3: Partial Overlap');
  console.log('Block:  [9:00 ──────── 11:00]');
  console.log('Booking:    [10:00 ──────── 12:00]');
  const block3 = { startTime: 540, endTime: 660 };
  const result3 = subtractRangeFromBlock(block3, 600, 720);
  console.log('Result:');
  result3.forEach(part => {
    const start = timeNorm.formatTimeString(part.startTime);
    const end = timeNorm.formatTimeString(part.endTime);
    console.log(`  [${start} ─── ${end}]`);
  });
  console.log(); // [9:00-10:00]
  
  // Case 4: No Overlap (Block Unchanged)
  console.log('Case 4: No Overlap');
  console.log('Block:  [9:00 ─── 10:00]');
  console.log('Booking:              [11:00 ─── 12:00]');
  const block4 = { startTime: 540, endTime: 600 };
  const result4 = subtractRangeFromBlock(block4, 660, 720);
  console.log('Result:');
  result4.forEach(part => {
    const start = timeNorm.formatTimeString(part.startTime);
    const end = timeNorm.formatTimeString(part.endTime);
    console.log(`  [${start} ─── ${end}]`);
  });
  console.log(); // [9:00-10:00] (unchanged)
}

// ============================================================================
// EXAMPLE 4: Real-World Scenario
// ============================================================================

async function example4_RealWorldScenario() {
  const courtId = 1;
  const date = new Date('2024-01-15'); // Monday
  
  console.log('=== Real-World Scenario ===\n');
  console.log(`Court: ${courtId}, Date: ${date.toISOString().split('T')[0]}\n`);
  
  // Step 1: Base availability (from rules)
  const base = await availabilityService.generateBaseAvailability(courtId, date);
  console.log(`1. Base Availability (from rules):`);
  console.log(`   - ${base.blocks.length} blocks`);
  console.log(`   - Example: ${timeNorm.formatTimeString(base.blocks[0].startTime)} - ${timeNorm.formatTimeString(base.blocks[0].endTime)}\n`);
  
  // Step 2: Filter availability
  const filtered = await filterService.filterAvailability(base);
  
  console.log(`2. Filtered Availability:`);
  console.log(`   - ${filtered.blocks.length} free blocks`);
  console.log(`   - ${filtered.metadata.bookingsCount} bookings removed`);
  console.log(`   - ${filtered.metadata.blockedRangesCount} blocked ranges removed\n`);
  
  // Step 3: Show what was removed
  if (filtered.bookings.length > 0) {
    console.log(`3. Bookings (removed from availability):`);
    filtered.bookings.forEach(booking => {
      const start = timeNorm.formatTimeString(booking.startTime);
      const end = timeNorm.formatTimeString(booking.endTime);
      console.log(`   - ${start} - ${end} (${booking.status})`);
    });
    console.log();
  }
  
  if (filtered.blockedRanges.length > 0) {
    console.log(`4. Blocked Ranges (removed from availability):`);
    filtered.blockedRanges.forEach(block => {
      const start = timeNorm.formatTimeString(block.startTime);
      const end = timeNorm.formatTimeString(block.endTime);
      console.log(`   - ${start} - ${end} (${block.reason})`);
    });
    console.log();
  }
  
  // Step 4: Show free time slots
  console.log(`5. Available Time Slots:`);
  filtered.blocks.forEach((block, index) => {
    const start = timeNorm.formatTimeString(block.startTime);
    const end = timeNorm.formatTimeString(block.endTime);
    console.log(`   ${index + 1}. ${start} - ${end}`);
  });
}

// ============================================================================
// EXAMPLE 5: Check Specific Time Availability
// ============================================================================

async function example5_CheckSpecificTime() {
  const courtId = 1;
  const date = new Date('2024-01-15');
  const checkTime = 600; // 10:00 (minutes since midnight)
  
  // Get filtered availability
  const base = await availabilityService.generateBaseAvailability(courtId, date);
  const filtered = await filterService.filterAvailability(base);
  
  // Check if time is available
  const isAvailable = filtered.blocks.some(block =>
    checkTime >= block.startTime && checkTime < block.endTime
  );
  
  const timeString = timeNorm.formatTimeString(checkTime);
  console.log(`Time ${timeString} is ${isAvailable ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
  
  if (!isAvailable) {
    // Find why it's not available
    const conflictingBooking = filtered.bookings.find(booking =>
      checkTime >= booking.startTime && checkTime < booking.endTime
    );
    
    const conflictingBlock = filtered.blockedRanges.find(block =>
      checkTime >= block.startTime && checkTime < block.endTime
    );
    
    if (conflictingBooking) {
      console.log(`  Reason: Booked (${conflictingBooking.status})`);
    } else if (conflictingBlock) {
      console.log(`  Reason: Blocked (${conflictingBlock.reason})`);
    } else {
      console.log(`  Reason: Outside availability hours`);
    }
  }
}

// ============================================================================
// EXAMPLE 6: Filter Options
// ============================================================================

async function example6_FilterOptions() {
  const courtId = 1;
  const date = new Date('2024-01-15');
  const base = await availabilityService.generateBaseAvailability(courtId, date);
  
  // Option 1: Filter both bookings and blocks (default)
  const filtered1 = await filterService.filterAvailability(base);
  console.log(`Filter both: ${filtered1.blocks.length} blocks`);
  
  // Option 2: Only filter bookings
  const filtered2 = await filterService.filterAvailability(base, {
    includeBookings: true,
    includeBlocked: false
  });
  console.log(`Filter bookings only: ${filtered2.blocks.length} blocks`);
  
  // Option 3: Only filter blocked ranges
  const filtered3 = await filterService.filterAvailability(base, {
    includeBookings: false,
    includeBlocked: true
  });
  console.log(`Filter blocks only: ${filtered3.blocks.length} blocks`);
  
  // Option 4: Don't filter anything (returns base)
  const filtered4 = await filterService.filterAvailability(base, {
    includeBookings: false,
    includeBlocked: false
  });
  console.log(`No filtering: ${filtered4.blocks.length} blocks`);
}

// ============================================================================
// EXAMPLE 7: Integration in Controller
// ============================================================================

async function getAvailableSlotsController(req, res, next) {
  try {
    const courtId = parseInt(req.params.id);
    const date = new Date(req.query.date);
    
    // Step 1: Generate base availability
    const baseAvailability = await availabilityService.generateBaseAvailability(
      courtId,
      date
    );
    
    // Step 2: Filter out bookings and blocks
    const filteredAvailability = await filterService.filterAvailability(
      baseAvailability
    );
    
    // Step 3: Format for API response
    const response = {
      courtId: filteredAvailability.courtId,
      date: filteredAvailability.date,
      availableSlots: filteredAvailability.blocks.map(block => ({
        startTime: timeNorm.formatTimeString(block.startTime),
        endTime: timeNorm.formatTimeString(block.endTime),
        startTimeMinutes: block.startTime,
        endTimeMinutes: block.endTime,
        durationMinutes: timeNorm.calculateRangeDuration(
          block.startTime,
          block.endTime
        )
      })),
      metadata: filteredAvailability.metadata
    };
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  example1_BasicComposition,
  example2_OverlapDetection,
  example3_BlockSubtraction,
  example4_RealWorldScenario,
  example5_CheckSpecificTime,
  example6_FilterOptions
};

