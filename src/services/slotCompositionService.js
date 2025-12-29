/**
 * Slot Composition Service
 * 
 * Composes free 30-minute base availability blocks into duration-based booking options.
 * This service finds continuous sequences of base blocks that satisfy a requested duration
 * and returns them as booking ranges (start_time → end_time).
 * 
 * Architecture:
 * - Pure function: No side effects, deterministic output
 * - Composes base blocks: Works with output from availabilityFilterService
 * - Duration-based: Supports any duration that's a multiple of 30 minutes
 * - No slot explosion: Generates options on-demand, doesn't pre-generate all combinations
 * 
 * Usage:
 *   const slots = await slotCompositionService.generateBookingSlots(
 *     freeBlocks,
 *     90  // 90-minute duration
 *   );
 */

const bookingRules = require('../config/bookingRules');
const timeNorm = require('../utils/timeNormalization');

/**
 * ============================================================================
 * VALIDATION FUNCTIONS
 * ============================================================================
 */

/**
 * Validate that duration aligns to base granularity (30 minutes)
 * @param {number} durationMinutes - Duration in minutes
 * @returns {boolean} True if duration is valid
 */
function isValidDuration(durationMinutes) {
  if (typeof durationMinutes !== 'number' || isNaN(durationMinutes)) {
    return false;
  }
  
  // Duration must be positive
  if (durationMinutes <= 0) {
    return false;
  }
  
  // Duration must be a multiple of base granularity (30 minutes)
  return durationMinutes % bookingRules.TIME_GRANULARITY_MINUTES === 0;
}

/**
 * Validate that blocks are properly formatted
 * @param {Array<Object>} blocks - Array of block objects
 * @returns {boolean} True if blocks are valid
 */
function isValidBlocks(blocks) {
  if (!Array.isArray(blocks)) {
    return false;
  }
  
  return blocks.every(block => {
    return block &&
           typeof block.startTime === 'number' &&
           typeof block.endTime === 'number' &&
           timeNorm.isValidMinutes(block.startTime) &&
           timeNorm.isValidMinutes(block.endTime) &&
           block.startTime < block.endTime;
  });
}

/**
 * ============================================================================
 * PURE COMPOSITION LOGIC
 * ============================================================================
 */

/**
 * Check if two blocks are consecutive (end of first = start of second)
 * @param {Object} block1 - First block
 * @param {Object} block2 - Second block
 * @returns {boolean} True if blocks are consecutive
 */
function areBlocksConsecutive(block1, block2) {
  return block1.endTime === block2.startTime;
}

/**
 * Calculate number of base blocks needed for a duration
 * @param {number} durationMinutes - Duration in minutes
 * @returns {number} Number of 30-minute blocks needed
 */
function calculateRequiredBlocks(durationMinutes) {
  return durationMinutes / bookingRules.TIME_GRANULARITY_MINUTES;
}

/**
 * Find all continuous sequences of blocks that satisfy a duration
 * 
 * Algorithm:
 * 1. Sort blocks by start time
 * 2. For each block, try to build a sequence starting from that block
 * 3. If sequence reaches required length, add it to results
 * 4. Continue until all blocks are processed
 * 
 * @param {Array<Object>} blocks - Sorted array of free blocks
 * @param {number} requiredBlocks - Number of consecutive blocks needed
 * @returns {Array<Object>} Array of booking slot objects with startTime and endTime
 */
function findContinuousSequences(blocks, requiredBlocks) {
  if (blocks.length === 0 || requiredBlocks <= 0) {
    return [];
  }
  
  // Ensure blocks are sorted by start time
  const sortedBlocks = [...blocks].sort((a, b) => a.startTime - b.startTime);
  
  const sequences = [];
  
  // For each possible starting block
  for (let i = 0; i <= sortedBlocks.length - requiredBlocks; i++) {
    const sequence = [sortedBlocks[i]];
    
    // Try to build a continuous sequence
    for (let j = i + 1; j < sortedBlocks.length && sequence.length < requiredBlocks; j++) {
      const lastBlock = sequence[sequence.length - 1];
      const nextBlock = sortedBlocks[j];
      
      if (areBlocksConsecutive(lastBlock, nextBlock)) {
        // Blocks are consecutive - add to sequence
        sequence.push(nextBlock);
      } else {
        // Gap detected - cannot continue this sequence
        break;
      }
    }
    
    // If we found enough consecutive blocks, create a booking slot
    if (sequence.length === requiredBlocks) {
      const firstBlock = sequence[0];
      const lastBlock = sequence[sequence.length - 1];
      
      sequences.push({
        startTime: firstBlock.startTime,
        endTime: lastBlock.endTime,
        durationMinutes: lastBlock.endTime - firstBlock.startTime,
        // Preserve any additional properties from blocks (e.g., pricePerHourOverride)
        pricePerHourOverride: firstBlock.pricePerHourOverride || null
      });
    }
  }
  
  return sequences;
}

/**
 * Remove duplicate slots (same start and end time)
 * @param {Array<Object>} slots - Array of slot objects
 * @returns {Array<Object>} Array with duplicates removed
 */
function removeDuplicates(slots) {
  const seen = new Set();
  const unique = [];
  
  for (const slot of slots) {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(slot);
    }
  }
  
  return unique;
}

/**
 * ============================================================================
 * SERVICE LAYER
 * ============================================================================
 */

/**
 * Generate booking slots from free base blocks for a requested duration
 * 
 * This function:
 * 1. Validates inputs (duration, blocks)
 * 2. Calculates required number of consecutive blocks
 * 3. Finds continuous sequences that satisfy the duration
 * 4. Returns sorted booking ranges (start_time → end_time)
 * 
 * @param {Array<Object>} freeBlocks - Array of free base blocks from availabilityFilterService
 *   Each block must have: { startTime, endTime, ... }
 * @param {number} durationMinutes - Requested booking duration in minutes
 *   Must be a multiple of 30 (base granularity)
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.minDuration] - Minimum allowed duration (default: from booking rules)
 * @param {number} [options.maxDuration] - Maximum allowed duration (default: from booking rules)
 * @returns {Object} Result object with:
 *   - slots: Array of booking slot objects with startTime, endTime, durationMinutes
 *   - metadata: Object with statistics (totalBlocks, requiredBlocks, sequencesFound)
 * 
 * @throws {Error} If inputs are invalid
 * 
 * @example
 * const freeBlocks = [
 *   { startTime: 540, endTime: 570 },  // 9:00-9:30
 *   { startTime: 570, endTime: 600 },  // 9:30-10:00
 *   { startTime: 600, endTime: 630 },  // 10:00-10:30
 *   { startTime: 720, endTime: 750 }   // 12:00-12:30
 * ];
 * 
 * const result = generateBookingSlots(freeBlocks, 90); // 90-minute duration
 * // Returns:
 * // {
 * //   slots: [
 * //     { startTime: 540, endTime: 630, durationMinutes: 90 }  // 9:00-10:30
 * //   ],
 * //   metadata: { ... }
 * // }
 */
function generateBookingSlots(freeBlocks, durationMinutes, options = {}) {
  // Validate inputs
  if (!isValidBlocks(freeBlocks)) {
    const error = new Error('Invalid blocks array');
    error.statusCode = 400;
    error.errorCode = 'INVALID_BLOCKS';
    throw error;
  }
  
  if (!isValidDuration(durationMinutes)) {
    const error = new Error(
      `Duration must be a positive multiple of ${bookingRules.TIME_GRANULARITY_MINUTES} minutes`
    );
    error.statusCode = 400;
    error.errorCode = 'INVALID_DURATION';
    error.duration = durationMinutes;
    error.requiredGranularity = bookingRules.TIME_GRANULARITY_MINUTES;
    throw error;
  }
  
  // Validate against min/max duration if provided
  const minDuration = options.minDuration || bookingRules.MIN_BOOKING_DURATION_MINUTES;
  const maxDuration = options.maxDuration || (bookingRules.DEFAULT_MAX_BOOKING_DURATION_HOURS * 60);
  
  if (durationMinutes < minDuration) {
    const error = new Error(
      `Duration must be at least ${minDuration} minutes`
    );
    error.statusCode = 400;
    error.errorCode = 'DURATION_TOO_SHORT';
    error.duration = durationMinutes;
    error.minDuration = minDuration;
    throw error;
  }
  
  if (durationMinutes > maxDuration) {
    const error = new Error(
      `Duration must not exceed ${maxDuration} minutes`
    );
    error.statusCode = 400;
    error.errorCode = 'DURATION_TOO_LONG';
    error.duration = durationMinutes;
    error.maxDuration = maxDuration;
    throw error;
  }
  
  // Handle empty blocks
  if (freeBlocks.length === 0) {
    return {
      slots: [],
      metadata: {
        totalBlocks: 0,
        requiredBlocks: 0,
        sequencesFound: 0,
        durationMinutes
      }
    };
  }
  
  // Calculate required number of consecutive blocks
  const requiredBlocks = calculateRequiredBlocks(durationMinutes);
  
  // Find continuous sequences
  const sequences = findContinuousSequences(freeBlocks, requiredBlocks);
  
  // Remove duplicates and sort
  const uniqueSlots = removeDuplicates(sequences);
  const sortedSlots = uniqueSlots.sort((a, b) => a.startTime - b.startTime);
  
  return {
    slots: sortedSlots,
    metadata: {
      totalBlocks: freeBlocks.length,
      requiredBlocks,
      sequencesFound: sortedSlots.length,
      durationMinutes,
      minDuration,
      maxDuration
    }
  };
}

/**
 * Generate booking slots for multiple durations
 * 
 * Useful when you want to show options for different durations (e.g., 30min, 60min, 90min)
 * 
 * @param {Array<Object>} freeBlocks - Array of free base blocks
 * @param {Array<number>} durations - Array of durations in minutes
 * @param {Object} [options] - Optional configuration
 * @returns {Object} Result object with slots grouped by duration
 * 
 * @example
 * const result = generateSlotsForMultipleDurations(freeBlocks, [30, 60, 90]);
 * // Returns:
 * // {
 * //   slotsByDuration: {
 * //     30: [...],
 * //     60: [...],
 * //     90: [...]
 * //   },
 * //   metadata: { ... }
 * // }
 */
function generateSlotsForMultipleDurations(freeBlocks, durations, options = {}) {
  const slotsByDuration = {};
  const errors = [];
  
  for (const duration of durations) {
    try {
      const result = generateBookingSlots(freeBlocks, duration, options);
      slotsByDuration[duration] = result.slots;
    } catch (error) {
      errors.push({
        duration,
        error: error.message,
        errorCode: error.errorCode
      });
    }
  }
  
  return {
    slotsByDuration,
    errors: errors.length > 0 ? errors : undefined,
    metadata: {
      totalBlocks: freeBlocks.length,
      requestedDurations: durations,
      successfulDurations: Object.keys(slotsByDuration).map(Number),
      failedDurations: errors.map(e => e.duration)
    }
  };
}

module.exports = {
  generateBookingSlots,
  generateSlotsForMultipleDurations,
  // Export pure functions for testing
  isValidDuration,
  isValidBlocks,
  areBlocksConsecutive,
  calculateRequiredBlocks,
  findContinuousSequences
};

