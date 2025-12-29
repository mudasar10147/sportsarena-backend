/**
 * Availability Rule Service
 * 
 * Business logic for availability rule operations
 */

const Court = require('../models/Court');
const Facility = require('../models/Facility');
const { parseTimeString } = require('../utils/timeNormalization');

/**
 * Get availability rules for a court
 * @param {number} courtId - Court ID
 * @param {Object} options - Query options
 * @param {boolean} [options.isActive] - Filter by active status
 * @param {number} userId - User ID making the request (for ownership check)
 * @returns {Promise<Array>} Array of availability rule objects
 * @throws {Error} If court not found or user not authorized
 */
const getAvailabilityRules = async (courtId, options = {}, userId) => {
  // Verify court exists
  const court = await Court.findById(courtId);
  if (!court) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }

  // Check if user is the facility owner
  const facility = await Facility.findById(court.facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  if (facility.ownerId !== userId) {
    const error = new Error('You can only view availability rules for courts in your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  return await Court.findAvailabilityRulesByCourtId(courtId, options);
};

/**
 * Create availability rule for a court
 * @param {number} courtId - Court ID
 * @param {Object} ruleData - Rule data
 * @param {number} userId - User ID making the request (for ownership check)
 * @returns {Promise<Object>} Created rule object
 * @throws {Error} If court not found, user not authorized, or validation fails
 */
const createAvailabilityRule = async (courtId, ruleData, userId) => {
  const { dayOfWeek, startTime, endTime, isActive, pricePerHourOverride, startTimeFormatted, endTimeFormatted } = ruleData;

  // Verify court exists
  const court = await Court.findById(courtId);
  if (!court) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }

  // Check if user is the facility owner
  const facility = await Facility.findById(court.facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  if (facility.ownerId !== userId) {
    const error = new Error('You can only create availability rules for courts in your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Validate dayOfWeek
  if (dayOfWeek === undefined || dayOfWeek === null) {
    const error = new Error('Day of week is required');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  const parsedDayOfWeek = parseInt(dayOfWeek, 10);
  if (isNaN(parsedDayOfWeek) || parsedDayOfWeek < 0 || parsedDayOfWeek > 6) {
    const error = new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Parse times - support both formatted strings (HH:MM) and minutes since midnight
  let parsedStartTime;
  let parsedEndTime;

  if (startTimeFormatted) {
    try {
      parsedStartTime = parseTimeString(startTimeFormatted);
    } catch (error) {
      const err = new Error(`Invalid start time format: ${error.message}`);
      err.statusCode = 400;
      err.errorCode = 'VALIDATION_ERROR';
      throw err;
    }
  } else if (startTime !== undefined && startTime !== null) {
    parsedStartTime = parseInt(startTime, 10);
    if (isNaN(parsedStartTime) || parsedStartTime < 0 || parsedStartTime >= 1440) {
      const error = new Error('Start time must be between 0 and 1439 (minutes since midnight)');
      error.statusCode = 400;
      error.errorCode = 'VALIDATION_ERROR';
      throw error;
    }
  } else {
    const error = new Error('Start time is required (either startTime or startTimeFormatted)');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  if (endTimeFormatted) {
    try {
      parsedEndTime = parseTimeString(endTimeFormatted);
    } catch (error) {
      const err = new Error(`Invalid end time format: ${error.message}`);
      err.statusCode = 400;
      err.errorCode = 'VALIDATION_ERROR';
      throw err;
    }
  } else if (endTime !== undefined && endTime !== null) {
    parsedEndTime = parseInt(endTime, 10);
    if (isNaN(parsedEndTime) || parsedEndTime < 0 || parsedEndTime >= 1440) {
      const error = new Error('End time must be between 0 and 1439 (minutes since midnight)');
      error.statusCode = 400;
      error.errorCode = 'VALIDATION_ERROR';
      throw error;
    }
  } else {
    const error = new Error('End time is required (either endTime or endTimeFormatted)');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Validate time range
  if (parsedEndTime <= parsedStartTime) {
    const error = new Error('End time must be after start time');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Validate price override if provided
  let parsedPriceOverride = null;
  if (pricePerHourOverride !== undefined && pricePerHourOverride !== null) {
    parsedPriceOverride = parseFloat(pricePerHourOverride);
    if (isNaN(parsedPriceOverride) || parsedPriceOverride <= 0) {
      const error = new Error('Price per hour override must be a positive number');
      error.statusCode = 400;
      error.errorCode = 'VALIDATION_ERROR';
      throw error;
    }
  }

  // Create rule
  const rules = await Court.createAvailabilityRules(courtId, [{
    dayOfWeek: parsedDayOfWeek,
    startTime: parsedStartTime,
    endTime: parsedEndTime,
    isActive: isActive !== undefined ? isActive : true,
    pricePerHourOverride: parsedPriceOverride
  }]);

  if (rules.length === 0) {
    // Rule already exists (conflict)
    const error = new Error('An availability rule with the same day, start time, and end time already exists');
    error.statusCode = 409;
    error.errorCode = 'RULE_CONFLICT';
    throw error;
  }

  return rules[0];
};

/**
 * Update availability rule
 * @param {number} courtId - Court ID
 * @param {number} ruleId - Rule ID
 * @param {Object} updateData - Fields to update
 * @param {number} userId - User ID making the request (for ownership check)
 * @returns {Promise<Object>} Updated rule object
 * @throws {Error} If rule not found or user not authorized
 */
const updateAvailabilityRule = async (courtId, ruleId, updateData, userId) => {
  // Get rule to verify it belongs to the court
  const rule = await Court.findAvailabilityRuleById(ruleId);
  if (!rule) {
    const error = new Error('Availability rule not found');
    error.statusCode = 404;
    error.errorCode = 'RULE_NOT_FOUND';
    throw error;
  }

  if (rule.courtId !== courtId) {
    const error = new Error('Rule does not belong to this court');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Verify court exists and user is owner
  const court = await Court.findById(courtId);
  if (!court) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }

  const facility = await Facility.findById(court.facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  if (facility.ownerId !== userId) {
    const error = new Error('You can only update availability rules for courts in your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Process update data - convert formatted times to minutes if provided
  const processedData = {};
  
  if (updateData.dayOfWeek !== undefined) {
    const parsedDayOfWeek = parseInt(updateData.dayOfWeek, 10);
    if (isNaN(parsedDayOfWeek) || parsedDayOfWeek < 0 || parsedDayOfWeek > 6) {
      const error = new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
      error.statusCode = 400;
      error.errorCode = 'VALIDATION_ERROR';
      throw error;
    }
    processedData.dayOfWeek = parsedDayOfWeek;
  }

  if (updateData.startTimeFormatted !== undefined) {
    try {
      processedData.startTime = parseTimeString(updateData.startTimeFormatted);
    } catch (error) {
      const err = new Error(`Invalid start time format: ${error.message}`);
      err.statusCode = 400;
      err.errorCode = 'VALIDATION_ERROR';
      throw err;
    }
  } else if (updateData.startTime !== undefined) {
    const parsedStartTime = parseInt(updateData.startTime, 10);
    if (isNaN(parsedStartTime) || parsedStartTime < 0 || parsedStartTime >= 1440) {
      const error = new Error('Start time must be between 0 and 1439 (minutes since midnight)');
      error.statusCode = 400;
      error.errorCode = 'VALIDATION_ERROR';
      throw error;
    }
    processedData.startTime = parsedStartTime;
  }

  if (updateData.endTimeFormatted !== undefined) {
    try {
      processedData.endTime = parseTimeString(updateData.endTimeFormatted);
    } catch (error) {
      const err = new Error(`Invalid end time format: ${error.message}`);
      err.statusCode = 400;
      err.errorCode = 'VALIDATION_ERROR';
      throw err;
    }
  } else if (updateData.endTime !== undefined) {
    const parsedEndTime = parseInt(updateData.endTime, 10);
    if (isNaN(parsedEndTime) || parsedEndTime < 0 || parsedEndTime >= 1440) {
      const error = new Error('End time must be between 0 and 1439 (minutes since midnight)');
      error.statusCode = 400;
      error.errorCode = 'VALIDATION_ERROR';
      throw error;
    }
    processedData.endTime = parsedEndTime;
  }

  // Validate time range if both times are provided
  const startTimeToValidate = processedData.startTime !== undefined ? processedData.startTime : rule.startTime;
  const endTimeToValidate = processedData.endTime !== undefined ? processedData.endTime : rule.endTime;
  
  if (endTimeToValidate <= startTimeToValidate) {
    const error = new Error('End time must be after start time');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  if (updateData.isActive !== undefined) {
    if (typeof updateData.isActive !== 'boolean') {
      const error = new Error('isActive must be a boolean');
      error.statusCode = 400;
      error.errorCode = 'VALIDATION_ERROR';
      throw error;
    }
    processedData.isActive = updateData.isActive;
  }

  if (updateData.pricePerHourOverride !== undefined) {
    if (updateData.pricePerHourOverride === null) {
      processedData.pricePerHourOverride = null;
    } else {
      const parsedPrice = parseFloat(updateData.pricePerHourOverride);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        const error = new Error('Price per hour override must be a positive number or null');
        error.statusCode = 400;
        error.errorCode = 'VALIDATION_ERROR';
        throw error;
      }
      processedData.pricePerHourOverride = parsedPrice;
    }
  }

  // Update rule
  const updatedRule = await Court.updateAvailabilityRule(ruleId, processedData);
  if (!updatedRule) {
    const error = new Error('Failed to update availability rule');
    error.statusCode = 500;
    error.errorCode = 'UPDATE_FAILED';
    throw error;
  }

  return updatedRule;
};

/**
 * Delete availability rule
 * @param {number} courtId - Court ID
 * @param {number} ruleId - Rule ID
 * @param {number} userId - User ID making the request (for ownership check)
 * @returns {Promise<boolean>} True if deleted successfully
 * @throws {Error} If rule not found or user not authorized
 */
const deleteAvailabilityRule = async (courtId, ruleId, userId) => {
  // Get rule to verify it belongs to the court
  const rule = await Court.findAvailabilityRuleById(ruleId);
  if (!rule) {
    const error = new Error('Availability rule not found');
    error.statusCode = 404;
    error.errorCode = 'RULE_NOT_FOUND';
    throw error;
  }

  if (rule.courtId !== courtId) {
    const error = new Error('Rule does not belong to this court');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Verify court exists and user is owner
  const court = await Court.findById(courtId);
  if (!court) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }

  const facility = await Facility.findById(court.facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  if (facility.ownerId !== userId) {
    const error = new Error('You can only delete availability rules for courts in your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  const deleted = await Court.deleteAvailabilityRule(ruleId);
  if (!deleted) {
    const error = new Error('Failed to delete availability rule');
    error.statusCode = 500;
    error.errorCode = 'DELETE_FAILED';
    throw error;
  }

  return true;
};

module.exports = {
  getAvailabilityRules,
  createAvailabilityRule,
  updateAvailabilityRule,
  deleteAvailabilityRule
};

