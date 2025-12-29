/**
 * Slot Composition Service Usage Examples
 * 
 * Demonstrates how the composition service works with base blocks
 * and how it avoids slot explosion.
 */

const availabilityService = require('./availabilityService');
const filterService = require('./availabilityFilterService');
const compositionService = require('./slotCompositionService');
const timeNorm = require('../utils/timeNormalization');

// ============================================================================
// EXAMPLE 1: Basic Composition
// ============================================================================

async function example1_BasicComposition() {
  const courtId = 1;
  const date = new Date('2024-01-15');
  const duration = 90; // 90 minutes
  
  console.log('=== Basic Composition Example ===\n');
  
  // Step 1: Get base availability
  const base = await availabilityService.generateBaseAvailability(courtId, date);
  console.log(`1. Base blocks: ${base.blocks.length}`);
  
  // Step 2: Filter out bookings and blocks
  const filtered = await filterService.filterAvailability(base);
  console.log(`2. Free blocks: ${filtered.blocks.length}`);
  
  // Step 3: Compose into duration-based slots
  const slots = compositionService.generateBookingSlots(
    filtered.blocks,
    duration
  );
  
  console.log(`3. ${duration}-minute slots: ${slots.slots.length}`);
  console.log(`   Required blocks: ${slots.metadata.requiredBlocks}`);
  
  // Display slots
  slots.slots.forEach((slot, index) => {
    const start = timeNorm.formatTimeString(slot.startTime);
    const end = timeNorm.formatTimeString(slot.endTime);
    console.log(`   ${index + 1}. ${start} - ${end} (${slot.durationMinutes} min)`);
  });
}

// ============================================================================
// EXAMPLE 2: Continuous Sequence Detection
// ============================================================================

function example2_ContinuousSequences() {
  console.log('=== Continuous Sequence Detection ===\n');
  
  // Free blocks with some gaps
  const freeBlocks = [
    { startTime: 540, endTime: 570 },  // 9:00-9:30
    { startTime: 570, endTime: 600 },  // 9:30-10:00
    { startTime: 600, endTime: 630 },  // 10:00-10:30
    { startTime: 630, endTime: 660 },  // 10:30-11:00
    // Gap: 11:00-12:00 (booked or blocked)
    { startTime: 720, endTime: 750 },  // 12:00-12:30
    { startTime: 750, endTime: 780 }   // 12:30-13:00
  ];
  
  console.log('Free blocks:');
  freeBlocks.forEach(block => {
    const start = timeNorm.formatTimeString(block.startTime);
    const end = timeNorm.formatTimeString(block.endTime);
    console.log(`  ${start} - ${end}`);
  });
  console.log();
  
  // Try different durations
  const durations = [30, 60, 90, 120];
  
  durations.forEach(duration => {
    const result = compositionService.generateBookingSlots(freeBlocks, duration);
    console.log(`${duration}-minute slots: ${result.slots.length} options`);
    
    result.slots.forEach(slot => {
      const start = timeNorm.formatTimeString(slot.startTime);
      const end = timeNorm.formatTimeString(slot.endTime);
      console.log(`  ${start} - ${end}`);
    });
    console.log();
  });
}

// ============================================================================
// EXAMPLE 3: Multiple Durations
// ============================================================================

function example3_MultipleDurations() {
  console.log('=== Multiple Durations ===\n');
  
  const freeBlocks = [
    { startTime: 540, endTime: 570 },  // 9:00-9:30
    { startTime: 570, endTime: 600 },  // 9:30-10:00
    { startTime: 600, endTime: 630 },  // 10:00-10:30
    { startTime: 630, endTime: 660 },  // 10:30-11:00
    { startTime: 660, endTime: 690 },  // 11:00-11:30
    { startTime: 690, endTime: 720 }   // 11:30-12:00
  ];
  
  // Generate slots for multiple durations
  const result = compositionService.generateSlotsForMultipleDurations(
    freeBlocks,
    [30, 60, 90, 120, 150, 180]  // 30min, 1h, 1.5h, 2h, 2.5h, 3h
  );
  
  console.log('Available durations:');
  Object.entries(result.slotsByDuration).forEach(([duration, slots]) => {
    console.log(`  ${duration} minutes: ${slots.length} options`);
  });
  
  console.log('\nDetailed options:');
  Object.entries(result.slotsByDuration).forEach(([duration, slots]) => {
    if (slots.length > 0) {
      console.log(`\n${duration}-minute slots:`);
      slots.forEach(slot => {
        const start = timeNorm.formatTimeString(slot.startTime);
        const end = timeNorm.formatTimeString(slot.endTime);
        console.log(`  ${start} - ${end}`);
      });
    }
  });
}

// ============================================================================
// EXAMPLE 4: Slot Explosion Avoidance Demonstration
// ============================================================================

function example4_SlotExplosionAvoidance() {
  console.log('=== Slot Explosion Avoidance ===\n');
  
  // Simulate: 1 court, 30 days, 8 hours/day availability
  const blocksPerDay = 16; // 8 hours = 16 × 30-minute blocks
  const days = 30;
  const totalBaseBlocks = blocksPerDay * days;
  
  console.log('Scenario: 1 court, 30 days, 8 hours/day availability\n');
  
  // Traditional approach: Pre-generate slots for 5 durations
  const durations = [30, 60, 90, 120, 150]; // 5 different durations
  let totalPreGeneratedSlots = 0;
  
  console.log('Traditional Approach (Pre-Generated Slots):');
  durations.forEach(duration => {
    const blocksNeeded = duration / 30;
    const slotsPerDay = Math.floor(blocksPerDay / blocksNeeded);
    const totalSlots = slotsPerDay * days;
    totalPreGeneratedSlots += totalSlots;
    
    console.log(`  ${duration}-min slots: ${slotsPerDay}/day × ${days} days = ${totalSlots} slots`);
  });
  console.log(`  Total: ${totalPreGeneratedSlots} slots\n`);
  
  // This approach: On-demand composition
  console.log('This Approach (On-Demand Composition):');
  console.log(`  Base blocks: ${blocksPerDay}/day × ${days} days = ${totalBaseBlocks} blocks`);
  console.log(`  Duration combinations: Generated on-demand (no storage needed)`);
  console.log(`  Storage: ${totalBaseBlocks} blocks (${((totalBaseBlocks / totalPreGeneratedSlots) * 100).toFixed(1)}% of traditional)\n`);
  
  console.log('Benefits:');
  console.log('  ✓ No pre-generation needed');
  console.log('  ✓ Add new durations without schema changes');
  console.log('  ✓ No update cascade when bookings change');
  console.log('  ✓ Memory efficient (only compose what\'s needed)');
}

// ============================================================================
// EXAMPLE 5: Real-World Integration
// ============================================================================

async function example5_RealWorldIntegration() {
  const courtId = 1;
  const date = new Date('2024-01-15');
  
  console.log('=== Real-World Integration ===\n');
  console.log(`Court: ${courtId}, Date: ${date.toISOString().split('T')[0]}\n`);
  
  // Step 1: Generate base availability
  const base = await availabilityService.generateBaseAvailability(courtId, date);
  console.log(`Step 1: Base availability`);
  console.log(`  - ${base.blocks.length} blocks from rules`);
  console.log(`  - Time range: ${timeNorm.formatTimeString(base.blocks[0]?.startTime || 0)} - ${timeNorm.formatTimeString(base.blocks[base.blocks.length - 1]?.endTime || 0)}\n`);
  
  // Step 2: Filter availability
  const filtered = await filterService.filterAvailability(base);
  console.log(`Step 2: Filtered availability`);
  console.log(`  - ${filtered.blocks.length} free blocks`);
  console.log(`  - Removed: ${filtered.metadata.bookingsCount} bookings`);
  console.log(`  - Removed: ${filtered.metadata.blockedRangesCount} blocked ranges\n`);
  
  // Step 3: Generate booking options for different durations
  const requestedDurations = [30, 60, 90, 120];
  
  console.log(`Step 3: Generate booking options\n`);
  
  requestedDurations.forEach(duration => {
    const slots = compositionService.generateBookingSlots(
      filtered.blocks,
      duration
    );
    
    console.log(`${duration}-minute options: ${slots.slots.length}`);
    
    if (slots.slots.length > 0) {
      // Show first 3 options
      slots.slots.slice(0, 3).forEach((slot, index) => {
        const start = timeNorm.formatTimeString(slot.startTime);
        const end = timeNorm.formatTimeString(slot.endTime);
        console.log(`  ${index + 1}. ${start} - ${end}`);
      });
      if (slots.slots.length > 3) {
        console.log(`  ... and ${slots.slots.length - 3} more`);
      }
    }
    console.log();
  });
}

// ============================================================================
// EXAMPLE 6: Edge Cases
// ============================================================================

function example6_EdgeCases() {
  console.log('=== Edge Cases ===\n');
  
  // Case 1: No free blocks
  console.log('Case 1: No free blocks');
  const emptyBlocks = [];
  const result1 = compositionService.generateBookingSlots(emptyBlocks, 60);
  console.log(`  Result: ${result1.slots.length} slots\n`);
  
  // Case 2: Insufficient consecutive blocks
  console.log('Case 2: Insufficient consecutive blocks');
  const sparseBlocks = [
    { startTime: 540, endTime: 570 },  // 9:00-9:30
    // Gap
    { startTime: 720, endTime: 750 }  // 12:00-12:30
  ];
  const result2 = compositionService.generateBookingSlots(sparseBlocks, 90);
  console.log(`  Result: ${result2.slots.length} slots (need 3 consecutive, only have 1)\n`);
  
  // Case 3: Exactly enough blocks
  console.log('Case 3: Exactly enough blocks');
  const exactBlocks = [
    { startTime: 540, endTime: 570 },  // 9:00-9:30
    { startTime: 570, endTime: 600 },  // 9:30-10:00
    { startTime: 600, endTime: 630 }   // 10:00-10:30
  ];
  const result3 = compositionService.generateBookingSlots(exactBlocks, 90);
  console.log(`  Result: ${result3.slots.length} slot`);
  if (result3.slots.length > 0) {
    const slot = result3.slots[0];
    const start = timeNorm.formatTimeString(slot.startTime);
    const end = timeNorm.formatTimeString(slot.endTime);
    console.log(`  ${start} - ${end}\n`);
  }
  
  // Case 4: Invalid duration
  console.log('Case 4: Invalid duration (not multiple of 30)');
  try {
    compositionService.generateBookingSlots(exactBlocks, 45);
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
}

// ============================================================================
// EXAMPLE 7: Performance Comparison
// ============================================================================

function example7_PerformanceComparison() {
  console.log('=== Performance Comparison ===\n');
  
  // Simulate different scales
  const scenarios = [
    { courts: 1, days: 30, name: 'Small (1 court, 30 days)' },
    { courts: 10, days: 30, name: 'Medium (10 courts, 30 days)' },
    { courts: 100, days: 30, name: 'Large (100 courts, 30 days)' }
  ];
  
  const blocksPerDay = 16; // 8 hours
  const durations = [30, 60, 90, 120, 150]; // 5 durations
  
  scenarios.forEach(scenario => {
    const totalBaseBlocks = scenario.courts * scenario.days * blocksPerDay;
    
    // Traditional: Pre-generate all combinations
    let totalPreGenerated = 0;
    durations.forEach(duration => {
      const blocksNeeded = duration / 30;
      const slotsPerDay = Math.floor(blocksPerDay / blocksNeeded);
      totalPreGenerated += scenario.courts * scenario.days * slotsPerDay;
    });
    
    // This approach: Only base blocks
    const onDemandBlocks = totalBaseBlocks;
    
    console.log(`${scenario.name}:`);
    console.log(`  Pre-generated: ${totalPreGenerated.toLocaleString()} slots`);
    console.log(`  On-demand: ${onDemandBlocks.toLocaleString()} blocks`);
    console.log(`  Savings: ${((1 - onDemandBlocks / totalPreGenerated) * 100).toFixed(1)}%`);
    console.log();
  });
}

module.exports = {
  example1_BasicComposition,
  example2_ContinuousSequences,
  example3_MultipleDurations,
  example4_SlotExplosionAvoidance,
  example5_RealWorldIntegration,
  example6_EdgeCases,
  example7_PerformanceComparison
};

