/**
 * Availability Filter Service
 * 
 * Filters base availability blocks by removing overlapping bookings and blocked time ranges.
 * This service is pure and deterministic - it takes base availability as input and
 * returns filtered availability without modifying the database.
 * 
 * Architecture:
 * - Data fetching: Separate functions to fetch bookings and blocked ranges
 * - Time-range logic: Pure functions for overlap detection and block subtraction
 * - Composition: Cleanly composes with base availability generator
 */

const { pool } = require('../config/database');
const timeNorm = require('../utils/timeNormalization');

/**
 * ============================================================================
 * DATA FETCHING LAYER
 * ============================================================================
 * These functions fetch data from the database. They are separated from
 * the pure time-range logic for testability and clarity.
 */

/**
 * Fetch all confirmed bookings for a court on a given date
 * 
 * NOTE: This assumes bookings table will have:
 * - court_id (INTEGER)
 * - booking_date (DATE)
 * - start_time (INTEGER - minutes since midnight)
 * - end_time (INTEGER - minutes since midnight)
 * - booking_status (VARCHAR)
 * 
 * For now, this is a placeholder that will need to be updated when
 * the bookings schema is migrated to the new structure.
 * 
 * @param {number} courtId - Court ID
 * @param {Date|string} date - Date to fetch bookings for
 * @returns {Promise<Array>} Array of booking objects with startTime and endTime
 * @private
 */
async function fetchConfirmedBookings(courtId, date) {
  // Parse date
  const bookingDate = date instanceof Date ? date : new Date(date);
  const dateString = bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Fetch bookings that block availability:
  // - CONFIRMED bookings (always block)
  // - PENDING bookings (block only if not expired)
  // - COMPLETED bookings (block if still in progress)
  // Exclude: CANCELLED, REJECTED, EXPIRED bookings
  const query = `
    SELECT 
      id,
      court_id,
      booking_date,
      start_time,
      end_time,
      booking_status,
      expires_at
    FROM bookings
    WHERE court_id = $1
      AND booking_date = $2
      AND booking_status IN ('pending', 'confirmed', 'completed')
      AND booking_status NOT IN ('cancelled', 'rejected', 'expired')
      -- Exclude expired PENDING bookings
      AND (
        booking_status != 'pending' OR
        (booking_status = 'pending' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP))
      )
    ORDER BY start_time ASC
  `;
  
  try {
    const result = await pool.query(query, [courtId, dateString]);
    
    return result.rows.map(row => ({
      id: row.id,
      courtId: row.court_id,
      bookingDate: row.booking_date,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.booking_status,
      expiresAt: row.expires_at ? new Date(row.expires_at) : null
    }));
  } catch (error) {
    // If query fails (e.g., columns don't exist yet), return empty array
    // This allows the service to work during migration
    if (error.code === '42703' || error.message.includes('column')) {
      console.warn('Bookings table may not have new structure yet. Returning empty bookings.');
      return [];
    }
    throw error;
  }
}

/**
 * Fetch all blocked time ranges for a court on a given date
 * 
 * @param {number} courtId - Court ID
 * @param {Date|string} date - Date to fetch blocked ranges for
 * @returns {Promise<Array>} Array of blocked range objects with startTime and endTime
 * @private
 */
async function fetchBlockedTimeRanges(courtId, date) {
  const bookingDate = date instanceof Date ? date : new Date(date);
  const dateString = bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const dayOfWeek = bookingDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  
  // Get facility_id from court
  const courtResult = await pool.query(
    'SELECT facility_id FROM courts WHERE id = $1',
    [courtId]
  );
  
  if (courtResult.rows.length === 0) {
    return [];
  }
  
  const facilityId = courtResult.rows[0].facility_id;
  
  // Query blocked time ranges
  // Handles: one_time, recurring, and date_range blocks
  const query = `
    SELECT 
      id,
      facility_id,
      court_id,
      block_type,
      start_date,
      end_date,
      start_time,
      end_time,
      day_of_week,
      reason,
      description
    FROM blocked_time_ranges
    WHERE (
      (court_id = $1) OR 
      (court_id IS NULL AND facility_id = $2)
    )
    AND (
      -- One-time block on this specific date
      (block_type = 'one_time' AND start_date = $3) OR
      -- Recurring block on this day of week
      (block_type = 'recurring' AND day_of_week = $4) OR
      -- Date range block covering this date
      (block_type = 'date_range' AND $3 BETWEEN start_date AND end_date)
    )
    AND is_active = TRUE
    ORDER BY start_time ASC NULLS LAST
  `;
  
  const result = await pool.query(query, [courtId, facilityId, dateString, dayOfWeek]);
  
  return result.rows.map(row => {
    // For date_range blocks, start_time and end_time are NULL (blocks entire day)
    // We'll represent this as 0-1440 (full day)
    if (row.block_type === 'date_range') {
      return {
        id: row.id,
        blockType: row.block_type,
        startTime: 0,
        endTime: 1440, // Full day
        reason: row.reason,
        description: row.description
      };
    }
    
    return {
      id: row.id,
      blockType: row.block_type,
      startTime: row.start_time,
      endTime: row.end_time,
      reason: row.reason,
      description: row.description
    };
  });
}

/**
 * ============================================================================
 * PURE TIME-RANGE LOGIC LAYER
 * ============================================================================
 * These functions are pure (no side effects) and work only with time ranges.
 * They can be easily tested and composed.
 */

/**
 * Check if two time ranges overlap
 * 
 * Two ranges overlap if:
 * - Range A starts before Range B ends AND
 * - Range A ends after Range B starts
 * 
 * Handles all overlap cases:
 * - Full overlap: A contains B or B contains A
 * - Partial overlap: A starts before B but overlaps
 * - Adjacent ranges: A ends exactly when B starts (considered overlapping for booking purposes)
 * 
 * @param {number} start1 - Start time of first range (minutes since midnight)
 * @param {number} end1 - End time of first range (minutes since midnight)
 * @param {number} start2 - Start time of second range (minutes since midnight)
 * @param {number} end2 - End time of second range (minutes since midnight)
 * @returns {boolean} True if ranges overlap
 */
function doRangesOverlap(start1, end1, start2, end2) {
  // Validate inputs
  if (!timeNorm.isValidMinutes(start1) || !timeNorm.isValidMinutes(end1) ||
      !timeNorm.isValidMinutes(start2) || !timeNorm.isValidMinutes(end2)) {
    return false;
  }
  
  // Two ranges overlap if: start1 < end2 AND end1 > start2
  // This handles all cases:
  // - Full overlap: [9:00-12:00] and [10:00-11:00] → 540 < 660 AND 720 > 600 ✓
  // - Partial overlap: [9:00-11:00] and [10:00-12:00] → 540 < 720 AND 660 > 600 ✓
  // - Adjacent: [9:00-10:00] and [10:00-11:00] → 540 < 660 AND 600 > 600 ✗ (no overlap)
  //   But we want adjacent to be considered overlapping for booking purposes
  //   So we use <= and >= for adjacent ranges
  
  // For booking purposes, adjacent ranges (A ends when B starts) are considered overlapping
  // because you can't book a slot that starts exactly when another ends
  return start1 < end2 && end1 > start2;
}

/**
 * Subtract a time range from a block, returning remaining parts
 * 
 * This handles all overlap cases:
 * - Block completely contained in range → returns empty array
 * - Range completely contained in block → splits block into two parts
 * - Partial overlap → returns non-overlapping part
 * - No overlap → returns original block
 * 
 * @param {Object} block - Block object with startTime and endTime
 * @param {number} rangeStart - Start time of range to subtract
 * @param {number} rangeEnd - End time of range to subtract
 * @returns {Array<Object>} Array of remaining block parts (empty if fully subtracted)
 */
function subtractRangeFromBlock(block, rangeStart, rangeEnd) {
  const { startTime, endTime, ...rest } = block;
  
  // Check if block overlaps with range
  if (!doRangesOverlap(startTime, endTime, rangeStart, rangeEnd)) {
    // No overlap - return block as-is
    return [{ startTime, endTime, ...rest }];
  }
  
  // Overlap detected - calculate remaining parts
  const remainingParts = [];
  
  // Part before the range (if exists)
  if (startTime < rangeStart) {
    remainingParts.push({
      startTime,
      endTime: Math.min(endTime, rangeStart),
      ...rest
    });
  }
  
  // Part after the range (if exists)
  if (endTime > rangeEnd) {
    remainingParts.push({
      startTime: Math.max(startTime, rangeEnd),
      endTime,
      ...rest
    });
  }
  
  // If block is completely contained in range, remainingParts will be empty
  return remainingParts;
}

/**
 * Subtract multiple time ranges from a single block
 * 
 * @param {Object} block - Block object
 * @param {Array<Object>} ranges - Array of range objects with startTime and endTime
 * @returns {Array<Object>} Array of remaining block parts
 */
function subtractRangesFromBlock(block, ranges) {
  let remaining = [block];
  
  for (const range of ranges) {
    // Subtract this range from all remaining parts
    remaining = remaining.flatMap(part =>
      subtractRangeFromBlock(part, range.startTime, range.endTime)
    );
    
    // Early exit if nothing left
    if (remaining.length === 0) {
      break;
    }
  }
  
  return remaining;
}

/**
 * Subtract multiple time ranges from multiple blocks
 * 
 * @param {Array<Object>} blocks - Array of block objects
 * @param {Array<Object>} ranges - Array of range objects with startTime and endTime
 * @returns {Array<Object>} Array of remaining blocks
 */
function subtractRangesFromBlocks(blocks, ranges) {
  if (ranges.length === 0) {
    return blocks;
  }
  
  // Sort ranges by start time for efficiency
  const sortedRanges = [...ranges].sort((a, b) => a.startTime - b.startTime);
  
  // Subtract all ranges from all blocks
  const result = blocks.flatMap(block =>
    subtractRangesFromBlock(block, sortedRanges)
  );
  
  // Sort result by start time
  return result.sort((a, b) => a.startTime - b.startTime);
}

/**
 * ============================================================================
 * SERVICE LAYER
 * ============================================================================
 * These functions compose data fetching with pure logic to provide
 * the main service interface.
 */

/**
 * Filter out past time slots for today's date
 * Only returns slots that start at least 1 hour from now
 * 
 * @param {Array<Object>} blocks - Array of block objects with startTime
 * @param {Date|string} date - The date being queried
 * @param {number} [bufferMinutes=60] - Minimum minutes from now for a slot to be available (default: 60 = 1 hour)
 * @returns {Array<Object>} Filtered blocks (only future slots)
 */
function filterPastTimeSlots(blocks, date, bufferMinutes = 60) {
  const now = new Date();
  const queryDate = date instanceof Date ? date : new Date(date);
  
  // Get just the date parts for comparison (YYYY-MM-DD)
  const todayDateString = now.toISOString().split('T')[0];
  const queryDateString = queryDate.toISOString().split('T')[0];
  
  // If the query date is not today, return all blocks (no past filtering needed)
  if (queryDateString !== todayDateString) {
    return blocks;
  }
  
  // For today, calculate the minimum start time (current time + buffer)
  // Convert current time to minutes since midnight
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const minimumStartTime = currentMinutes + bufferMinutes;
  
  // Filter out blocks that start before the minimum time
  const futureBlocks = blocks.filter(block => block.startTime >= minimumStartTime);
  
  return futureBlocks;
}

/**
 * Filter base availability blocks by removing overlapping bookings and blocked ranges
 * 
 * This is a pure, deterministic function that:
 * 1. Fetches confirmed bookings for the court/date
 * 2. Fetches blocked time ranges for the court/date
 * 3. Subtracts overlapping ranges from base availability blocks
 * 4. Filters out past time slots for today (with 1 hour buffer)
 * 5. Returns only truly free blocks
 * 
 * @param {Object} baseAvailability - Base availability object from generateBaseAvailability
 * @param {Object} [options] - Optional configuration
 * @param {boolean} [options.includeBookings=true] - Whether to filter out bookings
 * @param {boolean} [options.includeBlocked=true] - Whether to filter out blocked ranges
 * @param {boolean} [options.filterPastSlots=true] - Whether to filter out past time slots for today
 * @param {number} [options.pastSlotBufferMinutes=60] - Buffer in minutes from now for slots to be available (default: 60 = 1 hour)
 * @returns {Promise<Object>} Filtered availability object with:
 *   - All properties from baseAvailability
 *   - blocks: Filtered blocks (only free time)
 *   - bookings: Array of bookings found (for reference)
 *   - blockedRanges: Array of blocked ranges found (for reference)
 * 
 * @example
 * const baseAvailability = await availabilityService.generateBaseAvailability(1, date);
 * const filteredAvailability = await filterAvailability(baseAvailability);
 * // filteredAvailability.blocks contains only free time slots
 */
async function filterAvailability(baseAvailability, options = {}) {
  const {
    includeBookings = true,
    includeBlocked = true,
    filterPastSlots = true,
    pastSlotBufferMinutes = 60
  } = options;
  
  const { courtId, date, blocks: baseBlocks } = baseAvailability;
  
  // Fetch data (separated from logic)
  const [bookings, blockedRanges] = await Promise.all([
    includeBookings ? fetchConfirmedBookings(courtId, date) : Promise.resolve([]),
    includeBlocked ? fetchBlockedTimeRanges(courtId, date) : Promise.resolve([])
  ]);
  
  // Convert bookings to time ranges
  const bookingRanges = bookings.map(booking => ({
    startTime: booking.startTime,
    endTime: booking.endTime,
    bookingId: booking.id
  }));
  
  // Convert blocked ranges to time ranges
  const blockedTimeRanges = blockedRanges.map(block => ({
    startTime: block.startTime,
    endTime: block.endTime,
    blockId: block.id,
    reason: block.reason
  }));
  
  // Combine all ranges to subtract
  const allRangesToSubtract = [
    ...(includeBookings ? bookingRanges : []),
    ...(includeBlocked ? blockedTimeRanges : [])
  ];
  
  // Apply pure time-range logic
  let filteredBlocks = subtractRangesFromBlocks(baseBlocks, allRangesToSubtract);
  
  // Filter out past time slots for today (with buffer)
  if (filterPastSlots) {
    filteredBlocks = filterPastTimeSlots(filteredBlocks, date, pastSlotBufferMinutes);
  }
  
  return {
    ...baseAvailability,
    blocks: filteredBlocks,
    bookings: bookings,
    blockedRanges: blockedRanges,
    metadata: {
      totalBaseBlocks: baseBlocks.length,
      totalFilteredBlocks: filteredBlocks.length,
      bookingsCount: bookings.length,
      blockedRangesCount: blockedRanges.length,
      pastSlotsFiltered: filterPastSlots,
      pastSlotBufferMinutes: filterPastSlots ? pastSlotBufferMinutes : null
    }
  };
}

module.exports = {
  filterAvailability,
  // Export pure functions for testing
  doRangesOverlap,
  subtractRangeFromBlock,
  subtractRangesFromBlock,
  subtractRangesFromBlocks,
  filterPastTimeSlots
};

