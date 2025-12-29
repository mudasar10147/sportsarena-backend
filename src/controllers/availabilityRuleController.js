/**
 * Availability Rule Controller
 * 
 * Handles HTTP requests for availability rule management operations
 */

const availabilityRuleService = require('../services/availabilityRuleService');
const { formatTimeString } = require('../utils/timeNormalization');
const { 
  sendSuccess, 
  sendCreated, 
  sendError, 
  sendValidationError 
} = require('../utils/response');

/**
 * Get all availability rules for a court
 * GET /api/v1/courts/:id/availability/rules
 */
const getAvailabilityRules = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { isActive } = req.query;

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    const options = {};
    if (isActive !== undefined) {
      options.isActive = isActive === 'true';
    }

    const rules = await availabilityRuleService.getAvailabilityRules(courtId, options, userId);

    // Format rules with time strings for better readability
    const formattedRules = rules.map(rule => ({
      ...rule,
      startTimeFormatted: formatTimeString(rule.startTime),
      endTimeFormatted: formatTimeString(rule.endTime),
      dayName: getDayName(rule.dayOfWeek)
    }));

    return sendSuccess(res, formattedRules, 'Availability rules retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new availability rule for a court
 * POST /api/v1/courts/:id/availability/rules
 */
const createAvailabilityRule = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const ruleData = req.body;

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    const rule = await availabilityRuleService.createAvailabilityRule(courtId, ruleData, userId);

    // Format rule with time strings
    const formattedRule = {
      ...rule,
      startTimeFormatted: formatTimeString(rule.startTime),
      endTimeFormatted: formatTimeString(rule.endTime),
      dayName: getDayName(rule.dayOfWeek)
    };

    return sendCreated(res, formattedRule, 'Availability rule created successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update an availability rule
 * PUT /api/v1/courts/:id/availability/rules/:ruleId
 */
const updateAvailabilityRule = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const ruleId = parseInt(req.params.ruleId, 10);
    const userId = req.userId;
    const updateData = req.body;

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    if (isNaN(ruleId)) {
      return sendValidationError(res, 'Invalid rule ID');
    }

    // At least one field must be provided
    if (Object.keys(updateData).length === 0) {
      return sendValidationError(res, 'At least one field must be provided for update');
    }

    const rule = await availabilityRuleService.updateAvailabilityRule(courtId, ruleId, updateData, userId);

    // Format rule with time strings
    const formattedRule = {
      ...rule,
      startTimeFormatted: formatTimeString(rule.startTime),
      endTimeFormatted: formatTimeString(rule.endTime),
      dayName: getDayName(rule.dayOfWeek)
    };

    return sendSuccess(res, formattedRule, 'Availability rule updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an availability rule
 * DELETE /api/v1/courts/:id/availability/rules/:ruleId
 */
const deleteAvailabilityRule = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const ruleId = parseInt(req.params.ruleId, 10);
    const userId = req.userId;

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    if (isNaN(ruleId)) {
      return sendValidationError(res, 'Invalid rule ID');
    }

    await availabilityRuleService.deleteAvailabilityRule(courtId, ruleId, userId);

    return sendSuccess(res, null, 'Availability rule deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get day name from day of week number
 * @private
 */
const getDayName = (dayOfWeek) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
};

module.exports = {
  getAvailabilityRules,
  createAvailabilityRule,
  updateAvailabilityRule,
  deleteAvailabilityRule
};

