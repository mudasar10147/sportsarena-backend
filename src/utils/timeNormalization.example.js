/**
 * Time Normalization Usage Examples
 * 
 * This file demonstrates practical usage patterns for time normalization
 * across different layers of the application.
 * 
 * NOTE: This is an example file - not meant to be executed.
 */

const timeNorm = require('./timeNormalization');
const bookingRules = require('../config/bookingRules');

// ============================================================================
// EXAMPLE 1: Service Layer - Availability Management
// ============================================================================

class AvailabilityService {
  /**
   * Create availability window for a facility
   */
  async createAvailability(facilityId, dayOfWeek, openTime, closeTime) {
    // Convert Date objects to minutes since midnight
    const openMinutes = timeNorm.toMinutesSinceMidnight(new Date(openTime));
    const closeMinutes = timeNorm.toMinutesSinceMidnight(new Date(closeTime));
    
    // Validate
    if (!timeNorm.isValidMinutes(openMinutes) || !timeNorm.isValidMinutes(closeMinutes)) {
      throw new Error('Invalid time values');
    }
    
    // Check alignment to 30-minute granularity
    if (!timeNorm.isAlignedToGranularity(openMinutes) || 
        !timeNorm.isAlignedToGranularity(closeMinutes)) {
      throw new Error('Times must align to 30-minute intervals');
    }
    
    // Check minimum duration
    const duration = timeNorm.calculateRangeDuration(openMinutes, closeMinutes);
    if (duration < bookingRules.MIN_BOOKING_DURATION_MINUTES) {
      throw new Error(`Availability window must be at least ${bookingRules.MIN_BOOKING_DURATION_MINUTES} minutes`);
    }
    
    // Store in database
    await db.query(
      `INSERT INTO facility_availability 
       (facility_id, day_of_week, open_time, close_time) 
       VALUES ($1, $2, $3, $4)`,
      [facilityId, dayOfWeek, openMinutes, closeMinutes]
    );
  }
  
  /**
   * Check if facility is open at a specific time
   */
  async isOpenAtTime(facilityId, dayOfWeek, checkTime) {
    const checkMinutes = timeNorm.toMinutesSinceMidnight(new Date(checkTime));
    
    const result = await db.query(
      `SELECT open_time, close_time 
       FROM facility_availability 
       WHERE facility_id = $1 AND day_of_week = $2`,
      [facilityId, dayOfWeek]
    );
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const { open_time, close_time } = result.rows[0];
    return timeNorm.isTimeInRange(checkMinutes, open_time, close_time);
  }
  
  /**
   * Get all availability windows for a facility
   */
  async getAvailability(facilityId) {
    const result = await db.query(
      `SELECT day_of_week, open_time, close_time 
       FROM facility_availability 
       WHERE facility_id = $1 
       ORDER BY day_of_week`,
      [facilityId]
    );
    
    return result.rows.map(row => ({
      dayOfWeek: row.day_of_week,
      openTime: timeNorm.formatTimeString(row.open_time),
      closeTime: timeNorm.formatTimeString(row.close_time),
      openTimeMinutes: row.open_time,
      closeTimeMinutes: row.close_time,
      crossesMidnight: row.close_time < row.open_time
    }));
  }
}

// ============================================================================
// EXAMPLE 2: Controller Layer - API Request Handling
// ============================================================================

function createAvailabilityController(req, res, next) {
  try {
    const { facilityId, dayOfWeek, openTime, closeTime } = req.body;
    
    // Convert string inputs to Date objects
    const openDate = new Date(`2000-01-01T${openTime}:00`);
    const closeDate = new Date(`2000-01-01T${closeTime}:00`);
    
    // Convert to minutes
    const openMinutes = timeNorm.toMinutesSinceMidnight(openDate);
    const closeMinutes = timeNorm.toMinutesSinceMidnight(closeDate);
    
    // Validate
    if (!timeNorm.isValidMinutes(openMinutes) || !timeNorm.isValidMinutes(closeMinutes)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid time format. Expected HH:MM'
      });
    }
    
    // Use service to create availability
    const service = new AvailabilityService();
    await service.createAvailability(facilityId, dayOfWeek, openDate, closeDate);
    
    res.status(201).json({
      success: true,
      message: 'Availability created successfully'
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// EXAMPLE 3: Slot Generation - Creating Booking Slots
// ============================================================================

class SlotGenerationService {
  /**
   * Generate booking slots for a court based on availability
   */
  async generateSlotsForCourt(courtId, date, availability) {
    const slots = [];
    const { open_time, close_time } = availability;
    
    // Handle midnight crossover
    const { crossesMidnight } = timeNorm.normalizeTimeRange(open_time, close_time);
    
    if (crossesMidnight) {
      // Generate slots from open_time to midnight
      slots.push(...this.generateSlotsInRange(
        courtId, date, open_time, timeNorm.MAX_MINUTES_PER_DAY - 1
      ));
      
      // Generate slots from midnight to close_time (next day)
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      slots.push(...this.generateSlotsInRange(
        courtId, nextDate, 0, close_time
      ));
    } else {
      // Normal range - generate slots from open to close
      slots.push(...this.generateSlotsInRange(
        courtId, date, open_time, close_time
      ));
    }
    
    return slots;
  }
  
  /**
   * Generate slots within a time range (no midnight crossover)
   */
  generateSlotsInRange(courtId, date, startMinutes, endMinutes) {
    const slots = [];
    let currentMinutes = startMinutes;
    
    while (currentMinutes + bookingRules.MIN_BOOKING_DURATION_MINUTES <= endMinutes) {
      const slotStart = currentMinutes;
      const slotEnd = slotStart + bookingRules.MIN_BOOKING_DURATION_MINUTES;
      
      slots.push({
        courtId,
        bookingDate: date,
        startTime: slotStart,
        endTime: slotEnd,
        status: 'available'
      });
      
      // Move to next slot (30-minute increments)
      currentMinutes += bookingRules.TIME_GRANULARITY_MINUTES;
    }
    
    return slots;
  }
}

// ============================================================================
// EXAMPLE 4: Booking Validation
// ============================================================================

function validateBookingRequest(startTime, endTime, facility) {
  // Convert to minutes since midnight
  const startMinutes = timeNorm.toMinutesSinceMidnight(startTime);
  const endMinutes = timeNorm.toMinutesSinceMidnight(endTime);
  
  // Validate using booking rules
  const validation = bookingRules.validateBookingTimeRange(startTime, endTime, {
    maxDurationHours: facility.maxBookingDurationHours,
    maxAdvanceDays: facility.maxAdvanceBookingDays
  });
  
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // Validate alignment
  if (!timeNorm.isAlignedToGranularity(startMinutes) || 
      !timeNorm.isAlignedToGranularity(endMinutes)) {
    throw new Error('Times must align to 30-minute intervals');
  }
  
  // Check if within availability window
  // (This would check against facility availability)
  
  return { startMinutes, endMinutes };
}

// ============================================================================
// EXAMPLE 5: Database Query Helpers
// ============================================================================

class TimeQueryHelpers {
  /**
   * Find slots available at a specific time
   */
  async findSlotsAtTime(courtId, date, timeMinutes) {
    return await db.query(
      `SELECT * FROM booking_slots
       WHERE court_id = $1 
         AND booking_date = $2
         AND start_time <= $3
         AND end_time > $3
         AND status = 'available'`,
      [courtId, date, timeMinutes]
    );
  }
  
  /**
   * Find slots overlapping with a time range
   */
  async findOverlappingSlots(courtId, date, startMinutes, endMinutes) {
    // Handle midnight crossover
    const { crossesMidnight } = timeNorm.normalizeTimeRange(startMinutes, endMinutes);
    
    if (crossesMidnight) {
      // Query for slots that cross midnight or are in either range
      return await db.query(
        `SELECT * FROM booking_slots
         WHERE court_id = $1 
           AND booking_date = $2
           AND (
             (start_time >= $3 OR end_time <= $4) OR  -- Crosses midnight
             (start_time < $3 AND end_time > $3) OR  -- Overlaps start
             (start_time < $4 AND end_time > $4)     -- Overlaps end
           )
           AND status = 'available'`,
        [courtId, date, startMinutes, endMinutes]
      );
    } else {
      // Normal range query
      return await db.query(
        `SELECT * FROM booking_slots
         WHERE court_id = $1 
           AND booking_date = $2
           AND start_time < $4
           AND end_time > $3
           AND status = 'available'`,
        [courtId, date, startMinutes, endMinutes]
      );
    }
  }
}

// ============================================================================
// EXAMPLE 6: API Response Formatting
// ============================================================================

function formatAvailabilityForAPI(availability) {
  return {
    dayOfWeek: availability.day_of_week,
    openTime: timeNorm.formatTimeString(availability.open_time),
    closeTime: timeNorm.formatTimeString(availability.close_time),
    // Also include minutes for client-side calculations if needed
    openTimeMinutes: availability.open_time,
    closeTimeMinutes: availability.close_time,
    duration: timeNorm.calculateRangeDuration(
      availability.open_time,
      availability.close_time
    ),
    crossesMidnight: availability.close_time < availability.open_time
  };
}

function formatSlotForAPI(slot) {
  return {
    id: slot.id,
    courtId: slot.court_id,
    date: slot.booking_date,
    startTime: timeNorm.formatTimeString(slot.start_time),
    endTime: timeNorm.formatTimeString(slot.end_time),
    startTimeMinutes: slot.start_time,
    endTimeMinutes: slot.end_time,
    duration: timeNorm.calculateRangeDuration(slot.start_time, slot.end_time),
    status: slot.status
  };
}

