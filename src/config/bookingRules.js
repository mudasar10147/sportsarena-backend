/**
 * Booking Rules Configuration
 * 
 * Centralized source of truth for all time and booking rules.
 * This configuration defines the "policy" layer that all booking-related
 * services must follow.
 * 
 * IMPORTANT: This is policy, not business logic. All services should
 * import and use these constants to ensure consistency.
 * 
 * Usage:
 *   const { TIME_GRANULARITY, validateBookingTime } = require('./config/bookingRules');
 */

/**
 * ============================================================================
 * TIME GRANULARITY RULES
 * ============================================================================
 */

/**
 * Base time granularity in minutes
 * All times must align to this granularity
 */
const TIME_GRANULARITY_MINUTES = 30;

/**
 * Time granularity in milliseconds (for date calculations)
 */
const TIME_GRANULARITY_MS = TIME_GRANULARITY_MINUTES * 60 * 1000;

/**
 * Time granularity in hours (for duration calculations)
 */
const TIME_GRANULARITY_HOURS = TIME_GRANULARITY_MINUTES / 60;

/**
 * ============================================================================
 * BOOKING DURATION RULES
 * ============================================================================
 */

/**
 * Minimum booking duration in minutes
 */
const MIN_BOOKING_DURATION_MINUTES = 30;

/**
 * Minimum booking duration in hours
 */
const MIN_BOOKING_DURATION_HOURS = MIN_BOOKING_DURATION_MINUTES / 60;

/**
 * Minimum booking duration in milliseconds
 */
const MIN_BOOKING_DURATION_MS = MIN_BOOKING_DURATION_MINUTES * 60 * 1000;

/**
 * Default maximum booking duration in hours
 * Can be overridden per facility
 */
const DEFAULT_MAX_BOOKING_DURATION_HOURS = 8;

/**
 * ============================================================================
 * BOOKING WINDOW RULES
 * ============================================================================
 */

/**
 * Maximum advance booking window in days (default)
 * Bookings cannot be made more than this many days in advance
 */
const DEFAULT_MAX_ADVANCE_BOOKING_DAYS = 30;

/**
 * Maximum advance booking window in milliseconds
 */
const DEFAULT_MAX_ADVANCE_BOOKING_MS = DEFAULT_MAX_ADVANCE_BOOKING_DAYS * 24 * 60 * 60 * 1000;

/**
 * ============================================================================
 * PENDING BOOKING EXPIRATION RULES
 * ============================================================================
 */

/**
 * Default expiration duration for PENDING bookings in hours
 * PENDING bookings expire after this duration if not approved/rejected
 * Can be overridden per facility via booking_policies table
 */
const DEFAULT_PENDING_BOOKING_EXPIRATION_HOURS = 24;

/**
 * Default expiration duration for PENDING bookings in milliseconds
 */
const DEFAULT_PENDING_BOOKING_EXPIRATION_MS = DEFAULT_PENDING_BOOKING_EXPIRATION_HOURS * 60 * 60 * 1000;

/**
 * ============================================================================
 * TIME VALIDATION RULES
 * ============================================================================
 */

/**
 * Allowed start time minutes (must be 0 or 30)
 * Odd start times (e.g., 10:15, 14:45) are NOT allowed
 */
const ALLOWED_START_MINUTES = [0, 30];

/**
 * ============================================================================
 * VALIDATION FUNCTIONS
 * ============================================================================
 * 
 * These functions enforce the policy rules defined above.
 * Use these to validate times and durations throughout the system.
 */

/**
 * Check if a time aligns to the base granularity (30 minutes)
 * @param {Date} dateTime - Date/time to check
 * @returns {boolean} True if time is valid (minutes are 0 or 30)
 */
function isValidTimeGranularity(dateTime) {
  const minutes = dateTime.getMinutes();
  return ALLOWED_START_MINUTES.includes(minutes);
}

/**
 * Check if a start time is valid (must be on the hour or half-hour)
 * @param {Date} startTime - Start time to validate
 * @returns {boolean} True if start time is valid
 */
function isValidStartTime(startTime) {
  if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
    return false;
  }
  
  // Check if minutes are 0 or 30 (no odd start times)
  return isValidTimeGranularity(startTime);
}

/**
 * Check if a duration is valid
 * @param {number} durationHours - Duration in hours
 * @param {number} [maxDurationHours] - Maximum allowed duration (optional, uses default if not provided)
 * @returns {boolean} True if duration is valid
 */
function isValidDuration(durationHours, maxDurationHours = DEFAULT_MAX_BOOKING_DURATION_HOURS) {
  if (typeof durationHours !== 'number' || isNaN(durationHours)) {
    return false;
  }
  
  // Must be at least minimum duration
  if (durationHours < MIN_BOOKING_DURATION_HOURS) {
    return false;
  }
  
  // Must not exceed maximum duration
  if (durationHours > maxDurationHours) {
    return false;
  }
  
  // Must be a multiple of 0.5 hours (30 minutes)
  const halfHours = durationHours / TIME_GRANULARITY_HOURS;
  return Number.isInteger(halfHours);
}

/**
 * Check if a booking time range is within the advance booking window
 * @param {Date} startTime - Booking start time
 * @param {number} [maxAdvanceDays] - Maximum advance days (optional, uses default if not provided)
 * @returns {boolean} True if booking is within allowed window
 */
function isWithinAdvanceBookingWindow(startTime, maxAdvanceDays = DEFAULT_MAX_ADVANCE_BOOKING_DAYS) {
  if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
    return false;
  }
  
  const now = new Date();
  const maxAdvanceDate = new Date(now.getTime() + (maxAdvanceDays * 24 * 60 * 60 * 1000));
  
  // Start time must be in the future
  if (startTime <= now) {
    return false;
  }
  
  // Start time must not exceed maximum advance window
  if (startTime > maxAdvanceDate) {
    return false;
  }
  
  return true;
}

/**
 * Round a time down to the nearest valid granularity (30-minute mark)
 * @param {Date} dateTime - Date/time to round
 * @returns {Date} Rounded date/time
 */
function roundDownToGranularity(dateTime) {
  const rounded = new Date(dateTime);
  const minutes = rounded.getMinutes();
  
  if (minutes < 30) {
    rounded.setMinutes(0, 0, 0);
  } else {
    rounded.setMinutes(30, 0, 0);
  }
  
  return rounded;
}

/**
 * Round a time up to the nearest valid granularity (30-minute mark)
 * @param {Date} dateTime - Date/time to round
 * @returns {Date} Rounded date/time
 */
function roundUpToGranularity(dateTime) {
  const rounded = new Date(dateTime);
  const minutes = rounded.getMinutes();
  const seconds = rounded.getSeconds();
  const milliseconds = rounded.getMilliseconds();
  
  if (minutes === 0 && seconds === 0 && milliseconds === 0) {
    return rounded; // Already aligned
  }
  
  if (minutes < 30) {
    rounded.setMinutes(30, 0, 0);
  } else {
    rounded.setHours(rounded.getHours() + 1);
    rounded.setMinutes(0, 0, 0);
  }
  
  return rounded;
}

/**
 * Calculate duration in hours from start and end times
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @returns {number} Duration in hours
 */
function calculateDurationHours(startTime, endTime) {
  if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
    throw new Error('Both startTime and endTime must be Date objects');
  }
  
  if (endTime <= startTime) {
    throw new Error('endTime must be after startTime');
  }
  
  const durationMs = endTime.getTime() - startTime.getTime();
  return durationMs / (1000 * 60 * 60);
}

/**
 * Validate a complete booking time range
 * @param {Date} startTime - Booking start time
 * @param {Date} endTime - Booking end time
 * @param {Object} [options] - Validation options
 * @param {number} [options.maxDurationHours] - Maximum allowed duration
 * @param {number} [options.maxAdvanceDays] - Maximum advance booking days
 * @returns {Object} Validation result with isValid and errors array
 */
function validateBookingTimeRange(startTime, endTime, options = {}) {
  const {
    maxDurationHours = DEFAULT_MAX_BOOKING_DURATION_HOURS,
    maxAdvanceDays = DEFAULT_MAX_ADVANCE_BOOKING_DAYS
  } = options;
  
  const errors = [];
  
  // Validate start time
  if (!isValidStartTime(startTime)) {
    errors.push('Start time must be on the hour or half-hour (e.g., 10:00 or 10:30)');
  }
  
  // Validate end time
  if (!isValidStartTime(endTime)) {
    errors.push('End time must be on the hour or half-hour (e.g., 10:00 or 10:30)');
  }
  
  // Validate time order
  if (endTime <= startTime) {
    errors.push('End time must be after start time');
  }
  
  // Validate duration
  try {
    const durationHours = calculateDurationHours(startTime, endTime);
    if (!isValidDuration(durationHours, maxDurationHours)) {
      errors.push(`Duration must be between ${MIN_BOOKING_DURATION_HOURS} hours and ${maxDurationHours} hours, in 30-minute increments`);
    }
  } catch (error) {
    errors.push(error.message);
  }
  
  // Validate advance booking window
  if (!isWithinAdvanceBookingWindow(startTime, maxAdvanceDays)) {
    errors.push(`Booking must be within ${maxAdvanceDays} days in advance`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

module.exports = {
  // Time granularity constants
  TIME_GRANULARITY_MINUTES,
  TIME_GRANULARITY_MS,
  TIME_GRANULARITY_HOURS,
  
  // Booking duration constants
  MIN_BOOKING_DURATION_MINUTES,
  MIN_BOOKING_DURATION_HOURS,
  MIN_BOOKING_DURATION_MS,
  DEFAULT_MAX_BOOKING_DURATION_HOURS,
  
  // Booking window constants
  DEFAULT_MAX_ADVANCE_BOOKING_DAYS,
  DEFAULT_MAX_ADVANCE_BOOKING_MS,
  
  // Pending booking expiration constants
  DEFAULT_PENDING_BOOKING_EXPIRATION_HOURS,
  DEFAULT_PENDING_BOOKING_EXPIRATION_MS,
  
  // Time validation constants
  ALLOWED_START_MINUTES,
  
  // Validation functions
  isValidTimeGranularity,
  isValidStartTime,
  isValidDuration,
  isWithinAdvanceBookingWindow,
  roundDownToGranularity,
  roundUpToGranularity,
  calculateDurationHours,
  validateBookingTimeRange
};

