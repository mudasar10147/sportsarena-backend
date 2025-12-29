/**
 * Availability Service
 * 
 * Generates base availability blocks for courts based on availability rules.
 * This service generates availability intervals in memory without considering
 * bookings or blocked time ranges.
 * 
 * This is the foundation layer - bookings and blocks will be applied later
 * by other services that consume this base availability.
 */

const { pool } = require('../config/database');
const bookingRules = require('../config/bookingRules');
const timeNorm = require('../utils/timeNormalization');

/**
 * Get booking policy for a court (court-level or facility-level)
 * @param {number} courtId - Court ID
 * @returns {Promise<Object>} Booking policy object
 * @private
 */
async function getBookingPolicy(courtId) {
  const query = `
    SELECT 
      COALESCE(cp.max_advance_booking_days, fp.max_advance_booking_days, $1) as max_advance_booking_days,
      COALESCE(cp.min_booking_duration_minutes, fp.min_booking_duration_minutes, $2) as min_booking_duration_minutes,
      COALESCE(cp.max_booking_duration_minutes, fp.max_booking_duration_minutes, $3) as max_booking_duration_minutes,
      COALESCE(cp.booking_buffer_minutes, fp.booking_buffer_minutes, 0) as booking_buffer_minutes,
      COALESCE(cp.min_advance_notice_minutes, fp.min_advance_notice_minutes, 0) as min_advance_notice_minutes
    FROM courts c
    LEFT JOIN booking_policies cp ON c.id = cp.court_id AND cp.is_active = TRUE
    LEFT JOIN booking_policies fp ON c.facility_id = fp.facility_id 
      AND fp.court_id IS NULL AND fp.is_active = TRUE
    WHERE c.id = $4
  `;
  
  const result = await pool.query(query, [
    bookingRules.DEFAULT_MAX_ADVANCE_BOOKING_DAYS,
    bookingRules.MIN_BOOKING_DURATION_MINUTES,
    bookingRules.DEFAULT_MAX_BOOKING_DURATION_HOURS * 60, // Convert to minutes
    courtId
  ]);
  
  if (result.rows.length === 0) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }
  
  return {
    maxAdvanceBookingDays: parseInt(result.rows[0].max_advance_booking_days, 10),
    minBookingDurationMinutes: parseInt(result.rows[0].min_booking_duration_minutes, 10),
    maxBookingDurationMinutes: parseInt(result.rows[0].max_booking_duration_minutes, 10),
    bookingBufferMinutes: parseInt(result.rows[0].booking_buffer_minutes, 10) || 0,
    minAdvanceNoticeMinutes: parseInt(result.rows[0].min_advance_notice_minutes, 10) || 0
  };
}

/**
 * Get availability rules for a court on a specific day of week
 * @param {number} courtId - Court ID
 * @param {number} dayOfWeek - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns {Promise<Array>} Array of availability rule objects
 * @private
 */
async function getAvailabilityRules(courtId, dayOfWeek) {
  const query = `
    SELECT 
      id,
      court_id,
      day_of_week,
      start_time,
      end_time,
      price_per_hour_override,
      is_active
    FROM court_availability_rules
    WHERE court_id = $1
      AND day_of_week = $2
      AND is_active = TRUE
    ORDER BY start_time ASC
  `;
  
  const result = await pool.query(query, [courtId, dayOfWeek]);
  
  // Parse and validate time values from database
  return result.rows.map(row => {
    let startTime = parseInt(row.start_time, 10);
    let endTime = parseInt(row.end_time, 10);
    
    // Validate time ranges - clamp invalid values for safety
    if (isNaN(startTime) || startTime < 0) startTime = 0;
    if (startTime >= 1440) startTime = 1439;
    if (isNaN(endTime) || endTime < 0) endTime = 0;
    if (endTime >= 1440) endTime = 1439;
    
    return {
      id: row.id,
      courtId: row.court_id,
      dayOfWeek: row.day_of_week,
      startTime,
      endTime,
      pricePerHourOverride: row.price_per_hour_override ? parseFloat(row.price_per_hour_override) : null,
      isActive: row.is_active
    };
  });
}

/**
 * Calculate number of days between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} Number of days
 * @private
 */
function calculateDaysDifference(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / oneDay);
}

/**
 * Validate date against advance booking policy
 * @param {Date} date - Date to validate
 * @param {Object} policy - Booking policy object
 * @throws {Error} If date is outside allowed booking window
 * @private
 */
function validateAdvanceBookingWindow(date, policy) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset to start of day
  
  const bookingDate = new Date(date);
  bookingDate.setHours(0, 0, 0, 0); // Reset to start of day
  
  // Check if date is in the past
  if (bookingDate < now) {
    const error = new Error('Cannot generate availability for past dates');
    error.statusCode = 400;
    error.errorCode = 'PAST_DATE_NOT_ALLOWED';
    throw error;
  }
  
  // Check advance booking window
  const daysUntil = calculateDaysDifference(now, bookingDate);
  if (daysUntil > policy.maxAdvanceBookingDays) {
    const error = new Error(
      `Booking date exceeds maximum advance booking window of ${policy.maxAdvanceBookingDays} days`
    );
    error.statusCode = 400;
    error.errorCode = 'EXCEEDS_ADVANCE_BOOKING_WINDOW';
    error.maxAllowedDays = policy.maxAdvanceBookingDays;
    error.requestedDays = daysUntil;
    throw error;
  }
  
  // Check minimum advance notice
  if (policy.minAdvanceNoticeMinutes > 0) {
    const nowWithTime = new Date();
    const bookingDateTime = new Date(date);
    const minutesUntil = (bookingDateTime.getTime() - nowWithTime.getTime()) / (1000 * 60);
    
    if (minutesUntil < policy.minAdvanceNoticeMinutes) {
      const error = new Error(
        `Booking requires at least ${policy.minAdvanceNoticeMinutes} minutes advance notice`
      );
      error.statusCode = 400;
      error.errorCode = 'INSUFFICIENT_ADVANCE_NOTICE';
      error.requiredMinutes = policy.minAdvanceNoticeMinutes;
      error.availableMinutes = Math.max(0, minutesUntil);
      throw error;
    }
  }
}

/**
 * Generate 30-minute base availability blocks from an availability rule
 * @param {Object} rule - Availability rule object
 * @returns {Array<Object>} Array of availability block objects
 * @private
 */
function generateBlocksFromRule(rule) {
  const blocks = [];
  let { startTime, endTime } = rule;
  
  // Validate and normalize time values from database
  // Convert to integers in case they're stored as strings or decimals
  startTime = parseInt(startTime, 10);
  endTime = parseInt(endTime, 10);
  
  // Validate and clamp time ranges (0-1439)
  // If values are invalid, clamp them to valid range instead of throwing error
  if (isNaN(startTime) || startTime < 0) {
    console.warn(`Invalid start time in availability rule ${rule.id}: ${rule.startTime}. Clamping to 0.`);
    startTime = 0;
  }
  if (startTime >= 1440) {
    console.warn(`Invalid start time in availability rule ${rule.id}: ${rule.startTime}. Clamping to 1439.`);
    startTime = 1439;
  }
  
  if (isNaN(endTime) || endTime < 0) {
    console.warn(`Invalid end time in availability rule ${rule.id}: ${rule.endTime}. Clamping to 0.`);
    endTime = 0;
  }
  if (endTime >= 1440) {
    console.warn(`Invalid end time in availability rule ${rule.id}: ${rule.endTime}. Clamping to 1439.`);
    endTime = 1439;
  }
  
  // Skip rule if startTime >= endTime after clamping
  // BUT allow midnight crossover (e.g., 1080 -> 120, or 780 -> 0)
  // Midnight crossover: endTime < startTime AND endTime is reasonable (0-480 for early morning)
  // If both are clamped to invalid values (like 0 and 0), skip
  if (startTime >= endTime) {
    // Check if this is a valid midnight crossover
    // Valid midnight crossover: startTime is afternoon/evening (>= 480 = 8:00 AM) and endTime is early morning (0-480)
    const isMidnightCrossover = startTime >= 480 && endTime >= 0 && endTime <= 480;
    
    if (!isMidnightCrossover) {
      // This is not a valid midnight crossover, likely invalid data
      console.warn(`Invalid time range in availability rule ${rule.id}: startTime (${startTime}) >= endTime (${endTime}). Skipping rule.`);
      return [];
    }
    // Otherwise, it's a valid midnight crossover, continue processing
  }
  
  // Handle midnight crossover (use try-catch as safety)
  let crossesMidnight = false;
  try {
    const normalized = timeNorm.normalizeTimeRange(startTime, endTime);
    crossesMidnight = normalized.crossesMidnight;
  } catch (error) {
    // If normalizeTimeRange still fails after clamping, skip this rule
    console.warn(`Failed to normalize time range for rule ${rule.id}: ${error.message}. Skipping rule.`);
    return [];
  }
  
  if (crossesMidnight) {
    // Generate blocks from start_time to end of day (1439)
    let currentTime = startTime;
    while (currentTime + bookingRules.TIME_GRANULARITY_MINUTES <= 1440) {
      const blockStart = currentTime;
      const blockEnd = blockStart + bookingRules.TIME_GRANULARITY_MINUTES;
      
      // Don't exceed end of day
      if (blockEnd > 1440) {
        break;
      }
      
      // Validate block times before adding (safety check)
      if (blockStart >= 0 && blockStart < 1440 && blockEnd >= 0 && blockEnd <= 1440) {
        blocks.push({
          startTime: blockStart,
          endTime: Math.min(blockEnd, 1439), // Ensure endTime doesn't exceed 1439
          pricePerHourOverride: rule.pricePerHourOverride
        });
      }
      
      currentTime += bookingRules.TIME_GRANULARITY_MINUTES;
    }
    
    // Generate blocks from start of day (0) to end_time
    currentTime = 0;
    while (currentTime + bookingRules.TIME_GRANULARITY_MINUTES <= endTime) {
      const blockStart = currentTime;
      const blockEnd = blockStart + bookingRules.TIME_GRANULARITY_MINUTES;
      
      // Validate block times before adding (safety check)
      if (blockStart >= 0 && blockStart < 1440 && blockEnd >= 0 && blockEnd <= 1440) {
        blocks.push({
          startTime: blockStart,
          endTime: Math.min(blockEnd, 1439), // Ensure endTime doesn't exceed 1439
          pricePerHourOverride: rule.pricePerHourOverride
        });
      }
      
      currentTime += bookingRules.TIME_GRANULARITY_MINUTES;
    }
  } else {
    // Normal range - generate blocks from start to end
    let currentTime = startTime;
    while (currentTime + bookingRules.TIME_GRANULARITY_MINUTES <= endTime) {
      const blockStart = currentTime;
      const blockEnd = blockStart + bookingRules.TIME_GRANULARITY_MINUTES;
      
      // Validate block times before adding (safety check)
      if (blockStart >= 0 && blockStart < 1440 && blockEnd >= 0 && blockEnd <= 1440) {
        blocks.push({
          startTime: blockStart,
          endTime: Math.min(blockEnd, 1439), // Ensure endTime doesn't exceed 1439
          pricePerHourOverride: rule.pricePerHourOverride
        });
      }
      
      currentTime += bookingRules.TIME_GRANULARITY_MINUTES;
    }
  }
  
  return blocks;
}

/**
 * Merge overlapping blocks and sort by start time
 * @param {Array<Object>} blocks - Array of availability blocks
 * @returns {Array<Object>} Sorted and merged blocks
 * @private
 */
function mergeAndSortBlocks(blocks) {
  if (blocks.length === 0) {
    return [];
  }
  
  // Sort by start time
  const sorted = blocks.sort((a, b) => a.startTime - b.startTime);
  
  // Merge overlapping blocks
  const merged = [];
  let current = { ...sorted[0] };
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    
    // Check if blocks overlap or are adjacent
    // Blocks overlap if: next.startTime <= current.endTime
    // (We allow adjacent blocks to merge for cleaner output)
    if (next.startTime <= current.endTime) {
      // Merge: extend current block's end time
      current.endTime = Math.max(current.endTime, next.endTime);
      
      // If both have price overrides, prefer the first one
      // (In practice, overlapping rules shouldn't have different prices)
      if (current.pricePerHourOverride === null && next.pricePerHourOverride !== null) {
        current.pricePerHourOverride = next.pricePerHourOverride;
      }
    } else {
      // No overlap: save current block and start new one
      merged.push(current);
      current = { ...next };
    }
  }
  
  // Don't forget the last block
  merged.push(current);
  
  return merged;
}

/**
 * Generate base availability blocks for a court on a given date
 * 
 * This function:
 * - Validates the date against advance booking policy
 * - Reads availability rules for the court
 * - Generates 30-minute base time blocks in memory
 * - Returns a sorted list of availability intervals
 * 
 * NOTE: This does NOT consider:
 * - Existing bookings
 * - Blocked time ranges
 * - Buffer times between bookings
 * 
 * These will be applied by other services that consume this base availability.
 * 
 * @param {number} courtId - Court ID
 * @param {Date|string} date - Date to generate availability for (Date object or ISO string)
 * @returns {Promise<Object>} Object containing:
 *   - courtId: Court ID
 *   - date: Date (as ISO string)
 *   - dayOfWeek: Day of week (0-6)
 *   - policy: Booking policy applied
 *   - blocks: Array of availability block objects with:
 *     - startTime: Start time in minutes since midnight (0-1439)
 *     - endTime: End time in minutes since midnight (0-1439)
 *     - pricePerHourOverride: Optional price override (null if using court default)
 * 
 * @throws {Error} If court not found, date is invalid, or date exceeds advance booking window
 * 
 * @example
 * const availability = await generateBaseAvailability(1, new Date('2024-01-15'));
 * // Returns:
 * // {
 * //   courtId: 1,
 * //   date: '2024-01-15T00:00:00.000Z',
 * //   dayOfWeek: 1,
 * //   policy: { maxAdvanceBookingDays: 30, ... },
 * //   blocks: [
 * //     { startTime: 540, endTime: 570, pricePerHourOverride: null },
 * //     { startTime: 570, endTime: 600, pricePerHourOverride: null },
 * //     ...
 * //   ]
 * // }
 */
async function generateBaseAvailability(courtId, date) {
  // Validate inputs
  if (!courtId || typeof courtId !== 'number') {
    const error = new Error('Invalid court ID');
    error.statusCode = 400;
    error.errorCode = 'INVALID_COURT_ID';
    throw error;
  }
  
  // Parse and validate date
  const bookingDate = date instanceof Date ? date : new Date(date);
  if (isNaN(bookingDate.getTime())) {
    const error = new Error('Invalid date');
    error.statusCode = 400;
    error.errorCode = 'INVALID_DATE';
    throw error;
  }
  
  // Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  const dayOfWeek = bookingDate.getDay();
  
  // Get booking policy for the court
  const policy = await getBookingPolicy(courtId);
  
  // Validate date against advance booking policy
  validateAdvanceBookingWindow(bookingDate, policy);
  
  // Get availability rules for this court and day of week
  const rules = await getAvailabilityRules(courtId, dayOfWeek);
  
  if (rules.length === 0) {
    // Court has no availability rules for this day
    return {
      courtId,
      date: bookingDate.toISOString(),
      dayOfWeek,
      policy,
      blocks: []
    };
  }
  
  // Generate blocks from each rule
  const allBlocks = [];
  
  for (const rule of rules) {
    try {
      // Validate rule has valid time values before processing
      if (rule.startTime === null || rule.startTime === undefined || 
          rule.endTime === null || rule.endTime === undefined) {
        console.warn(`Skipping availability rule ${rule.id}: null or undefined time values`);
        continue;
      }
      
      const blocks = generateBlocksFromRule(rule);
      allBlocks.push(...blocks);
    } catch (error) {
      // Log error for debugging but continue processing other rules
      console.error(`Error processing availability rule ${rule.id} for court ${courtId}:`, error.message);
      // Don't throw - just skip this rule and continue
      continue;
    }
  }
  
  // Sort blocks by start time (don't merge - keep individual 30-minute blocks)
  // Individual blocks are needed for slot composition service
  const sortedBlocks = allBlocks.sort((a, b) => a.startTime - b.startTime);
  
  return {
    courtId,
    date: bookingDate.toISOString(),
    dayOfWeek,
    policy,
    blocks: sortedBlocks
  };
}

module.exports = {
  generateBaseAvailability
};

