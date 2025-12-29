/**
 * Booking Rules Usage Examples
 * 
 * This file demonstrates how to import and use the booking rules
 * configuration across different parts of the backend.
 * 
 * NOTE: This is an example file - not meant to be executed.
 * Copy patterns from here into your actual service/controller files.
 */

// ============================================================================
// EXAMPLE 1: Service Layer Usage
// ============================================================================

const bookingRules = require('./bookingRules');

// In a time slot service
function createTimeSlot(courtId, startTime, durationHours) {
  // Validate start time
  if (!bookingRules.isValidStartTime(startTime)) {
    throw new Error('Start time must be on the hour or half-hour');
  }
  
  // Validate duration
  if (!bookingRules.isValidDuration(durationHours)) {
    throw new Error('Invalid booking duration');
  }
  
  // Calculate end time
  const endTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000));
  
  // ... create time slot logic
}

// ============================================================================
// EXAMPLE 2: Controller Layer Usage
// ============================================================================

const {
  validateBookingTimeRange,
  DEFAULT_MAX_ADVANCE_BOOKING_DAYS
} = require('./bookingRules');

// In a booking controller
function createBooking(req, res, next) {
  const { startTime, endTime } = req.body;
  const facility = req.facility; // From middleware
  
  // Validate time range
  const validation = validateBookingTimeRange(
    new Date(startTime),
    new Date(endTime),
    {
      maxDurationHours: facility.maxBookingDurationHours,
      maxAdvanceDays: facility.maxAdvanceBookingDays || DEFAULT_MAX_ADVANCE_BOOKING_DAYS
    }
  );
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      errors: validation.errors
    });
  }
  
  // ... proceed with booking creation
}

// ============================================================================
// EXAMPLE 3: Model Layer Usage
// ============================================================================

const {
  TIME_GRANULARITY_MINUTES,
  MIN_BOOKING_DURATION_HOURS
} = require('./bookingRules');

// In a booking model
class Booking {
  static validate(bookingData) {
    const errors = [];
    
    // Use constants for validation
    if (bookingData.durationHours < MIN_BOOKING_DURATION_HOURS) {
      errors.push(`Duration must be at least ${MIN_BOOKING_DURATION_HOURS} hours`);
    }
    
    // ... more validation using constants
    
    return errors;
  }
}

// ============================================================================
// EXAMPLE 4: Utility Function Usage
// ============================================================================

const {
  roundDownToGranularity,
  roundUpToGranularity,
  calculateDurationHours
} = require('./bookingRules');

// In a utility file
function normalizeTimeInput(userInput) {
  // Round user input to valid time slot
  return roundUpToGranularity(new Date(userInput));
}

function getBookingDuration(startTime, endTime) {
  return calculateDurationHours(new Date(startTime), new Date(endTime));
}

// ============================================================================
// EXAMPLE 5: Middleware Usage
// ============================================================================

const { isWithinAdvanceBookingWindow } = require('./bookingRules');

// In validation middleware
function validateBookingWindow(req, res, next) {
  const { startTime } = req.body;
  const facility = req.facility;
  
  if (!isWithinAdvanceBookingWindow(
    new Date(startTime),
    facility.maxAdvanceBookingDays
  )) {
    return res.status(400).json({
      success: false,
      message: 'Booking is outside the allowed advance booking window'
    });
  }
  
  next();
}

