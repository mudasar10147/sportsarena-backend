/**
 * Time Normalization Utility
 * 
 * Standardizes time handling across the booking system using "minutes since midnight"
 * format (0-1439). This approach avoids timezone and date-related edge cases for
 * recurring time-based operations like availability windows and booking slots.
 * 
 * Key Benefits:
 * - No timezone confusion (times are relative to midnight, not absolute)
 * - Simple range comparisons (numeric comparisons)
 * - Supports midnight crossover (e.g., 18:00 → 02:00)
 * - Consistent storage format in PostgreSQL (INTEGER)
 * - Easy to validate (0-1439 range)
 * 
 * Usage:
 *   const { toMinutesSinceMidnight, fromMinutesSinceMidnight, normalizeTimeRange } = require('./utils/timeNormalization');
 */

/**
 * ============================================================================
 * CONSTANTS
 * ============================================================================
 */

/**
 * Maximum minutes in a day (24 * 60 = 1440)
 * Valid range: 0-1439 (0:00 to 23:59)
 */
const MAX_MINUTES_PER_DAY = 1440;

/**
 * Minutes per hour
 */
const MINUTES_PER_HOUR = 60;

/**
 * ============================================================================
 * CONVERSION FUNCTIONS
 * ============================================================================
 */

/**
 * Convert a Date object to minutes since midnight
 * 
 * @param {Date} dateTime - Date object (only hours/minutes are used)
 * @returns {number} Minutes since midnight (0-1439)
 * @throws {Error} If input is not a valid Date
 * 
 * @example
 * toMinutesSinceMidnight(new Date('2024-01-01T10:30:00')) // Returns 630 (10:30)
 * toMinutesSinceMidnight(new Date('2024-01-01T00:00:00')) // Returns 0 (midnight)
 * toMinutesSinceMidnight(new Date('2024-01-01T23:59:00')) // Returns 1439
 */
function toMinutesSinceMidnight(dateTime) {
  if (!(dateTime instanceof Date) || isNaN(dateTime.getTime())) {
    throw new Error('Invalid Date object provided');
  }
  
  const hours = dateTime.getHours();
  const minutes = dateTime.getMinutes();
  
  return (hours * MINUTES_PER_HOUR) + minutes;
}

/**
 * Convert minutes since midnight to a Date object
 * 
 * Note: The date portion is set to a reference date (2000-01-01).
 * Only the time portion is meaningful. Use this for display/calculation purposes.
 * 
 * @param {number} minutes - Minutes since midnight (0-1439)
 * @param {Date} [referenceDate] - Optional reference date (defaults to 2000-01-01)
 * @returns {Date} Date object with time set to the specified minutes
 * @throws {Error} If minutes is out of valid range
 * 
 * @example
 * fromMinutesSinceMidnight(630) // Returns Date object with time 10:30:00
 * fromMinutesSinceMidnight(0) // Returns Date object with time 00:00:00
 * fromMinutesSinceMidnight(1439) // Returns Date object with time 23:59:00
 */
function fromMinutesSinceMidnight(minutes, referenceDate = new Date('2000-01-01')) {
  if (typeof minutes !== 'number' || isNaN(minutes)) {
    throw new Error('Minutes must be a valid number');
  }
  
  if (minutes < 0 || minutes >= MAX_MINUTES_PER_DAY) {
    throw new Error(`Minutes must be between 0 and ${MAX_MINUTES_PER_DAY - 1}`);
  }
  
  const date = new Date(referenceDate);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const mins = minutes % MINUTES_PER_HOUR;
  
  date.setHours(hours, mins, 0, 0);
  
  return date;
}

/**
 * Convert a time string (HH:MM) to minutes since midnight
 * 
 * @param {string} timeString - Time string in HH:MM format
 * @returns {number} Minutes since midnight (0-1439)
 * @throws {Error} If format is invalid
 * 
 * @example
 * parseTimeString('10:30') // Returns 630
 * parseTimeString('00:00') // Returns 0
 * parseTimeString('23:59') // Returns 1439
 */
function parseTimeString(timeString) {
  if (typeof timeString !== 'string') {
    throw new Error('Time string must be a string');
  }
  
  const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:MM`);
  }
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  if (hours < 0 || hours >= 24) {
    throw new Error(`Invalid hours: ${hours}. Must be 0-23`);
  }
  
  if (minutes < 0 || minutes >= 60) {
    throw new Error(`Invalid minutes: ${minutes}. Must be 0-59`);
  }
  
  return (hours * MINUTES_PER_HOUR) + minutes;
}

/**
 * Format minutes since midnight to HH:MM string
 * 
 * @param {number} minutes - Minutes since midnight (0-1439)
 * @returns {string} Time string in HH:MM format
 * @throws {Error} If minutes is out of valid range
 * 
 * @example
 * formatTimeString(630) // Returns '10:30'
 * formatTimeString(0) // Returns '00:00'
 * formatTimeString(1439) // Returns '23:59'
 */
function formatTimeString(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes)) {
    throw new Error('Minutes must be a valid number');
  }
  
  if (minutes < 0 || minutes >= MAX_MINUTES_PER_DAY) {
    throw new Error(`Minutes must be between 0 and ${MAX_MINUTES_PER_DAY - 1}`);
  }
  
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const mins = minutes % MINUTES_PER_HOUR;
  
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * ============================================================================
 * VALIDATION FUNCTIONS
 * ============================================================================
 */

/**
 * Validate that minutes are within valid range
 * 
 * @param {number} minutes - Minutes since midnight
 * @returns {boolean} True if valid (0-1439)
 */
function isValidMinutes(minutes) {
  return typeof minutes === 'number' && 
         !isNaN(minutes) && 
         minutes >= 0 && 
         minutes < MAX_MINUTES_PER_DAY;
}

/**
 * Validate that minutes align to 30-minute granularity
 * 
 * @param {number} minutes - Minutes since midnight
 * @returns {boolean} True if minutes are 0 or 30 (aligned to granularity)
 */
function isAlignedToGranularity(minutes) {
  if (!isValidMinutes(minutes)) {
    return false;
  }
  
  return minutes % 30 === 0;
}

/**
 * ============================================================================
 * TIME RANGE FUNCTIONS (with midnight crossover support)
 * ============================================================================
 */

/**
 * Normalize a time range that may cross midnight
 * 
 * Handles ranges like 18:00 → 02:00 (1080 → 120) where end < start.
 * 
 * @param {number} startMinutes - Start time in minutes since midnight
 * @param {number} endMinutes - End time in minutes since midnight
 * @returns {Object} Normalized range with start, end, and crossesMidnight flag
 * @throws {Error} If inputs are invalid
 * 
 * @example
 * normalizeTimeRange(1080, 120) // { start: 1080, end: 120, crossesMidnight: true }
 * normalizeTimeRange(600, 1080) // { start: 600, end: 1080, crossesMidnight: false }
 */
function normalizeTimeRange(startMinutes, endMinutes) {
  if (!isValidMinutes(startMinutes) || !isValidMinutes(endMinutes)) {
    throw new Error('Both start and end must be valid minutes (0-1439)');
  }
  
  const crossesMidnight = endMinutes < startMinutes;
  
  return {
    start: startMinutes,
    end: endMinutes,
    crossesMidnight
  };
}

/**
 * Check if a time falls within a range (supports midnight crossover)
 * 
 * @param {number} timeMinutes - Time to check in minutes since midnight
 * @param {number} rangeStart - Range start in minutes since midnight
 * @param {number} rangeEnd - Range end in minutes since midnight
 * @returns {boolean} True if time is within range
 * 
 * @example
 * isTimeInRange(630, 600, 1080) // true (10:30 is between 10:00 and 18:00)
 * isTimeInRange(120, 1080, 120) // true (02:00 is in range 18:00 → 02:00)
 * isTimeInRange(600, 1080, 120) // false (10:00 is not in range 18:00 → 02:00)
 */
function isTimeInRange(timeMinutes, rangeStart, rangeEnd) {
  if (!isValidMinutes(timeMinutes) || !isValidMinutes(rangeStart) || !isValidMinutes(rangeEnd)) {
    return false;
  }
  
  const { crossesMidnight } = normalizeTimeRange(rangeStart, rangeEnd);
  
  if (crossesMidnight) {
    // Range crosses midnight: time must be >= start OR <= end
    return timeMinutes >= rangeStart || timeMinutes <= rangeEnd;
  } else {
    // Normal range: time must be >= start AND <= end
    return timeMinutes >= rangeStart && timeMinutes <= rangeEnd;
  }
}

/**
 * Calculate duration of a time range (handles midnight crossover)
 * 
 * @param {number} startMinutes - Start time in minutes since midnight
 * @param {number} endMinutes - End time in minutes since midnight
 * @returns {number} Duration in minutes
 * 
 * @example
 * calculateRangeDuration(600, 1080) // Returns 480 (8 hours: 10:00 to 18:00)
 * calculateRangeDuration(1080, 120) // Returns 480 (8 hours: 18:00 to 02:00 next day)
 */
function calculateRangeDuration(startMinutes, endMinutes) {
  if (!isValidMinutes(startMinutes) || !isValidMinutes(endMinutes)) {
    throw new Error('Both start and end must be valid minutes (0-1439)');
  }
  
  const { crossesMidnight } = normalizeTimeRange(startMinutes, endMinutes);
  
  if (crossesMidnight) {
    // Range crosses midnight: duration = (1440 - start) + end
    return (MAX_MINUTES_PER_DAY - startMinutes) + endMinutes;
  } else {
    // Normal range: duration = end - start
    return endMinutes - startMinutes;
  }
}

/**
 * ============================================================================
 * POSTGRESQL INTEGRATION HELPERS
 * ============================================================================
 */

/**
 * Convert database value (INTEGER) to minutes
 * Handles null/undefined and validates range
 * 
 * @param {number|null|undefined} dbValue - Value from database
 * @returns {number|null} Minutes since midnight or null
 */
function fromDatabase(dbValue) {
  if (dbValue === null || dbValue === undefined) {
    return null;
  }
  
  const minutes = typeof dbValue === 'string' ? parseInt(dbValue, 10) : dbValue;
  
  if (!isValidMinutes(minutes)) {
    throw new Error(`Invalid database value: ${dbValue}. Must be 0-1439`);
  }
  
  return minutes;
}

/**
 * Convert minutes to database value (INTEGER)
 * 
 * @param {number|null} minutes - Minutes since midnight
 * @returns {number|null} Value for database storage
 */
function toDatabase(minutes) {
  if (minutes === null || minutes === undefined) {
    return null;
  }
  
  if (!isValidMinutes(minutes)) {
    throw new Error(`Invalid minutes: ${minutes}. Must be 0-1439`);
  }
  
  return minutes;
}

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

module.exports = {
  // Constants
  MAX_MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  
  // Conversion functions
  toMinutesSinceMidnight,
  fromMinutesSinceMidnight,
  parseTimeString,
  formatTimeString,
  
  // Validation functions
  isValidMinutes,
  isAlignedToGranularity,
  
  // Time range functions
  normalizeTimeRange,
  isTimeInRange,
  calculateRangeDuration,
  
  // Database helpers
  fromDatabase,
  toDatabase
};

