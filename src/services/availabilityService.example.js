/**
 * Availability Service Usage Examples
 * 
 * This file demonstrates how to use the availability service and
 * how it will be extended in the future.
 * 
 * NOTE: This is an example file - not meant to be executed.
 */

const availabilityService = require('./availabilityService');
const timeNorm = require('../utils/timeNormalization');

// ============================================================================
// EXAMPLE 1: Basic Usage - Generate Base Availability
// ============================================================================

async function example1_BasicUsage() {
  const courtId = 1;
  const date = new Date('2024-01-15'); // Monday
  
  try {
    const availability = await availabilityService.generateBaseAvailability(
      courtId,
      date
    );
    
    console.log(`Court ${availability.courtId} availability on ${availability.date}:`);
    console.log(`Day of week: ${availability.dayOfWeek} (Monday)`);
    console.log(`Policy: ${availability.policy.maxAdvanceBookingDays} days advance booking`);
    console.log(`Found ${availability.blocks.length} base availability blocks`);
    
    availability.blocks.forEach((block, index) => {
      const start = timeNorm.formatTimeString(block.startTime);
      const end = timeNorm.formatTimeString(block.endTime);
      console.log(`  Block ${index + 1}: ${start} - ${end}`);
    });
    
    // Output:
    // Court 1 availability on 2024-01-15:
    // Day of week: 1 (Monday)
    // Policy: 30 days advance booking
    // Found 18 base availability blocks
    //   Block 1: 09:00 - 09:30
    //   Block 2: 09:30 - 10:00
    //   Block 3: 10:00 - 10:30
    //   ...
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// ============================================================================
// EXAMPLE 2: Handle Midnight Crossover
// ============================================================================

async function example2_MidnightCrossover() {
  // Court with availability 18:00 → 02:00 (crosses midnight)
  const courtId = 2;
  const date = new Date('2024-01-15');
  
  const availability = await availabilityService.generateBaseAvailability(
    courtId,
    date
  );
  
  // Blocks will include:
  // - 18:00-18:30, 18:30-19:00, ..., 23:30-00:00 (end of day)
  // - 00:00-00:30, 00:30-01:00, 01:00-01:30, 01:30-02:00 (next day)
  
  console.log('Midnight crossover blocks:');
  availability.blocks.forEach(block => {
    const start = timeNorm.formatTimeString(block.startTime);
    const end = timeNorm.formatTimeString(block.endTime);
    console.log(`  ${start} - ${end}`);
  });
}

// ============================================================================
// EXAMPLE 3: Error Handling
// ============================================================================

async function example3_ErrorHandling() {
  const courtId = 1;
  
  // Try past date
  try {
    await availabilityService.generateBaseAvailability(
      courtId,
      new Date('2020-01-01')
    );
  } catch (error) {
    console.error('Past date error:', error.errorCode); // PAST_DATE_NOT_ALLOWED
  }
  
  // Try date too far in advance
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 45); // 45 days ahead
    
    await availabilityService.generateBaseAvailability(courtId, futureDate);
  } catch (error) {
    console.error('Advance window error:', error.errorCode); // EXCEEDS_ADVANCE_BOOKING_WINDOW
    console.error('Max allowed:', error.maxAllowedDays); // 30
    console.error('Requested:', error.requestedDays); // 45
  }
  
  // Try invalid court
  try {
    await availabilityService.generateBaseAvailability(99999, new Date());
  } catch (error) {
    console.error('Court not found:', error.errorCode); // COURT_NOT_FOUND
  }
}

// ============================================================================
// EXAMPLE 4: Future Extension - Apply Blocked Ranges
// ============================================================================

/**
 * FUTURE: This function will be added to availabilityService
 */
async function generateAvailabilityWithBlocks(courtId, date) {
  // 1. Get base availability
  const baseAvailability = await availabilityService.generateBaseAvailability(
    courtId,
    date
  );
  
  // 2. Get blocked time ranges for this date
  const { pool } = require('../config/database');
  const dayOfWeek = new Date(date).getDay();
  
  const blockedQuery = `
    SELECT start_time, end_time, block_type, reason
    FROM blocked_time_ranges
    WHERE (court_id = $1 OR (court_id IS NULL AND facility_id = $2))
      AND (
        (block_type = 'one_time' AND start_date = $3) OR
        (block_type = 'recurring' AND day_of_week = $4) OR
        (block_type = 'date_range' AND $3 BETWEEN start_date AND end_date)
      )
      AND is_active = TRUE
  `;
  
  // Get facility_id from court
  const courtResult = await pool.query('SELECT facility_id FROM courts WHERE id = $1', [courtId]);
  const facilityId = courtResult.rows[0].facility_id;
  
  const blockedResult = await pool.query(blockedQuery, [
    courtId,
    facilityId,
    date,
    dayOfWeek
  ]);
  
  const blockedRanges = blockedResult.rows.map(row => ({
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason
  }));
  
  // 3. Subtract blocked ranges from base availability
  const availableBlocks = subtractBlockedRanges(
    baseAvailability.blocks,
    blockedRanges
  );
  
  return {
    ...baseAvailability,
    blocks: availableBlocks,
    blockedRanges: blockedRanges
  };
}

/**
 * Helper function to subtract blocked ranges
 */
function subtractBlockedRanges(baseBlocks, blockedRanges) {
  let result = [...baseBlocks];
  
  for (const blocked of blockedRanges) {
    result = result.flatMap(block => {
      // Check if block overlaps with blocked range
      const overlaps = timeNorm.isTimeInRange(
        block.startTime,
        blocked.startTime,
        blocked.endTime
      ) || timeNorm.isTimeInRange(
        block.endTime,
        blocked.startTime,
        blocked.endTime
      ) || (
        block.startTime <= blocked.startTime &&
        block.endTime >= blocked.endTime
      );
      
      if (!overlaps) {
        // No overlap - keep block as is
        return [block];
      }
      
      // Overlap detected - split or remove block
      const newBlocks = [];
      
      // Part before blocked range
      if (block.startTime < blocked.startTime) {
        newBlocks.push({
          startTime: block.startTime,
          endTime: Math.min(block.endTime, blocked.startTime),
          pricePerHourOverride: block.pricePerHourOverride
        });
      }
      
      // Part after blocked range
      if (block.endTime > blocked.endTime) {
        newBlocks.push({
          startTime: Math.max(block.startTime, blocked.endTime),
          endTime: block.endTime,
          pricePerHourOverride: block.pricePerHourOverride
        });
      }
      
      return newBlocks;
    });
  }
  
  return result;
}

// ============================================================================
// EXAMPLE 5: Future Extension - Apply Bookings
// ============================================================================

/**
 * FUTURE: This function will be added to availabilityService
 */
async function generateAvailabilityWithBookings(courtId, date) {
  // 1. Get base availability (or with blocks)
  const baseAvailability = await generateAvailabilityWithBlocks(courtId, date);
  
  // 2. Get existing bookings for this date
  const { pool } = require('../config/database');
  
  const bookingsQuery = `
    SELECT 
      b.id,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.booking_status
    FROM bookings b
    WHERE b.court_id = $1
      AND b.booking_date = $2
      AND b.booking_status NOT IN ('cancelled')
  `;
  
  const bookingsResult = await pool.query(bookingsQuery, [courtId, date]);
  
  const bookings = bookingsResult.rows.map(row => ({
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.booking_status
  }));
  
  // 3. Subtract booked time ranges from availability
  const availableBlocks = subtractBookings(
    baseAvailability.blocks,
    bookings
  );
  
  return {
    ...baseAvailability,
    blocks: availableBlocks,
    bookings: bookings
  };
}

/**
 * Helper function to subtract bookings
 */
function subtractBookings(baseBlocks, bookings) {
  // Similar to subtractBlockedRanges, but for bookings
  let result = [...baseBlocks];
  
  for (const booking of bookings) {
    result = result.flatMap(block => {
      // Check overlap and split/remove similar to blocked ranges
      // ... (same logic as subtractBlockedRanges)
      return [block]; // Simplified for example
    });
  }
  
  return result;
}

// ============================================================================
// EXAMPLE 6: Future Extension - Duration-Based Slots
// ============================================================================

/**
 * FUTURE: Generate slots for a specific duration (e.g., 90 minutes)
 */
async function generateSlotsForDuration(courtId, date, durationMinutes) {
  // 1. Get full availability (with blocks and bookings)
  const availability = await generateAvailabilityWithBookings(courtId, date);
  
  // 2. Validate duration
  const policy = availability.policy;
  if (durationMinutes < policy.minBookingDurationMinutes) {
    throw new Error(`Duration must be at least ${policy.minBookingDurationMinutes} minutes`);
  }
  if (durationMinutes > policy.maxBookingDurationMinutes) {
    throw new Error(`Duration must not exceed ${policy.maxBookingDurationMinutes} minutes`);
  }
  
  // 3. Generate slots from blocks
  const slots = [];
  
  for (const block of availability.blocks) {
    const blockDuration = timeNorm.calculateRangeDuration(
      block.startTime,
      block.endTime
    );
    
    if (blockDuration >= durationMinutes) {
      // Generate slots within this block
      let currentTime = block.startTime;
      
      while (currentTime + durationMinutes <= block.endTime) {
        slots.push({
          startTime: currentTime,
          endTime: currentTime + durationMinutes,
          pricePerHourOverride: block.pricePerHourOverride
        });
        
        // Move to next slot (30-minute increments)
        currentTime += bookingRules.TIME_GRANULARITY_MINUTES;
      }
    }
  }
  
  return {
    ...availability,
    slots: slots,
    requestedDuration: durationMinutes
  };
}

// ============================================================================
// EXAMPLE 7: Integration in Controller
// ============================================================================

/**
 * Example controller usage
 */
async function getCourtAvailabilityController(req, res, next) {
  try {
    const courtId = parseInt(req.params.id);
    const date = new Date(req.query.date);
    const duration = parseInt(req.query.duration) || 30;
    
    // Get base availability
    const availability = await availabilityService.generateBaseAvailability(
      courtId,
      date
    );
    
    // Format for API response
    const response = {
      courtId: availability.courtId,
      date: availability.date,
      dayOfWeek: availability.dayOfWeek,
      policy: {
        maxAdvanceBookingDays: availability.policy.maxAdvanceBookingDays,
        minBookingDurationMinutes: availability.policy.minBookingDurationMinutes,
        maxBookingDurationMinutes: availability.policy.maxBookingDurationMinutes
      },
      blocks: availability.blocks.map(block => ({
        startTime: timeNorm.formatTimeString(block.startTime),
        endTime: timeNorm.formatTimeString(block.endTime),
        startTimeMinutes: block.startTime,
        endTimeMinutes: block.endTime,
        durationMinutes: timeNorm.calculateRangeDuration(
          block.startTime,
          block.endTime
        )
      }))
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
  example1_BasicUsage,
  example2_MidnightCrossover,
  example3_ErrorHandling,
  generateAvailabilityWithBlocks,
  generateAvailabilityWithBookings,
  generateSlotsForDuration
};

