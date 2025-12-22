/**
 * TimeSlot Controller
 * 
 * Handles HTTP requests for time slot-related operations
 */

const timeSlotService = require('../services/timeSlotService');
const { 
  sendSuccess, 
  sendCreated, 
  sendError, 
  sendValidationError 
} = require('../utils/response');

/**
 * Get available time slots for a court (up to 30 days from today)
 * GET /api/v1/courts/:id/timeslots
 * 
 * Query Parameters:
 * - fromDate: Start date (ISO 8601 format, optional, defaults to now)
 * - duration: Duration in hours (0.5, 1, 2, etc.). Default: 1 hour. Minimum: 0.5 hours
 * 
 * Note: Slots are always capped at 30 days from today, regardless of fromDate.
 * If fromDate is more than 30 days in the future, no slots will be returned.
 * If fromDate is in the past, slots from today onwards will be returned.
 */
const getCourtTimeSlots = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const { fromDate, duration } = req.query;

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    // Parse fromDate if provided
    let startDate = null;
    if (fromDate) {
      startDate = new Date(fromDate);
      if (isNaN(startDate.getTime())) {
        return sendValidationError(res, 'Invalid fromDate format. Use ISO 8601 format (e.g., 2025-01-15T10:00:00Z)');
      }
      
      // If fromDate is more than 30 days in the future, return empty result
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 30);
      
      if (startDate > maxDate) {
        return sendSuccess(res, [], 'No slots available. Maximum booking window is 30 days from today.');
      }
    }

    // Parse duration (default: 1 hour, allowed values: 0.5, 1, 1.5, 2, 2.5, 3, etc. - increments of 0.5)
    let durationHours = 1; // Default: 1 hour
    if (duration !== undefined) {
      durationHours = parseFloat(duration);
      if (isNaN(durationHours) || durationHours < 0.5) {
        return sendValidationError(res, 'Invalid duration. Must be at least 0.5 hours (30 minutes)');
      }
      
      // Check if duration is in 0.5-hour increments (0.5, 1, 1.5, 2, 2.5, 3, etc.)
      const remainder = (durationHours * 10) % 5;
      if (remainder !== 0) {
        return sendValidationError(res, 'Invalid duration. Duration must be in 0.5-hour increments (0.5, 1, 1.5, 2, 2.5, 3, etc.)');
      }
    }

    const slots = await timeSlotService.getAvailableSlotsForCourt(courtId, startDate, durationHours);

    return sendSuccess(res, slots, 'Time slots retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new time slot for a court
 * POST /api/v1/courts/:id/timeslots
 * Requires authentication and facility_admin role (must be facility owner)
 */
const createTimeSlot = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { startTime, endTime, status } = req.body;

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    // Validation
    if (!startTime || !endTime) {
      return sendValidationError(res, 'startTime and endTime are required');
    }

    // Validate date format
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return sendValidationError(res, 'Invalid date format. Use ISO 8601 format (e.g., 2025-01-15T10:00:00Z)');
    }

    if (end <= start) {
      return sendValidationError(res, 'End time must be after start time');
    }

    // Validate status if provided
    if (status && !['available', 'blocked', 'booked'].includes(status)) {
      return sendValidationError(res, 'Invalid status. Must be: available, blocked, or booked');
    }

    // Create time slot
    const timeSlot = await timeSlotService.createTimeSlot(
      courtId,
      {
        startTime,
        endTime,
        status
      },
      userId
    );

    return sendCreated(res, timeSlot, 'Time slot created successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update time slot (e.g., block for maintenance)
 * PUT /api/v1/timeslots/:id
 * Requires authentication and facility_admin role (must be facility owner)
 */
const updateTimeSlot = async (req, res, next) => {
  try {
    const slotId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { status } = req.body;

    if (isNaN(slotId)) {
      return sendValidationError(res, 'Invalid time slot ID');
    }

    // Validation
    if (!status) {
      return sendValidationError(res, 'Status is required');
    }

    if (!['available', 'blocked', 'booked'].includes(status)) {
      return sendValidationError(res, 'Invalid status. Must be: available, blocked, or booked');
    }

    // Update time slot
    const timeSlot = await timeSlotService.updateTimeSlot(
      slotId,
      { status },
      userId
    );

    return sendSuccess(res, timeSlot, 'Time slot updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Generate time slots automatically for a court based on facility opening hours
 * POST /api/v1/courts/:id/generate-slots
 * Requires authentication and facility_admin role (must be facility owner)
 */
const generateSlotsForCourt = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { slotDuration } = req.body; // Optional: slot duration in hours (default: 1)

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    // Parse slot duration (default: 1 hour)
    let slotDurationHours = 1;
    if (slotDuration !== undefined) {
      slotDurationHours = parseFloat(slotDuration);
      if (isNaN(slotDurationHours) || slotDurationHours < 0.5) {
        return sendValidationError(res, 'Invalid slot duration. Must be at least 0.5 hours');
      }
      
      // Check if duration is in 0.5-hour increments
      const remainder = (slotDurationHours * 10) % 5;
      if (remainder !== 0) {
        return sendValidationError(res, 'Slot duration must be in 0.5-hour increments (0.5, 1, 1.5, 2, etc.)');
      }
    }

    const result = await timeSlotService.generateSlotsForCourt(courtId, userId, slotDurationHours);

    // If no slots generated, return a more informative response
    if (result.count === 0) {
      return sendSuccess(res, result, result.message || 'No slots generated. Check facility opening hours configuration.');
    }

    return sendSuccess(res, result, result.message || 'Time slots generated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Generate time slots for all courts in a facility
 * POST /api/v1/facilities/:id/generate-slots
 * Requires authentication and facility_admin role (must be facility owner)
 * 
 * Useful for existing facilities that need slots generated for all their courts
 */
const generateSlotsForAllCourts = async (req, res, next) => {
  try {
    const facilityId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { slotDuration } = req.body; // Optional: slot duration in hours (default: 1)

    if (isNaN(facilityId)) {
      return sendValidationError(res, 'Invalid facility ID');
    }

    // Parse slot duration (default: 1 hour)
    let slotDurationHours = 1;
    if (slotDuration !== undefined) {
      slotDurationHours = parseFloat(slotDuration);
      if (isNaN(slotDurationHours) || slotDurationHours < 0.5) {
        return sendValidationError(res, 'Invalid slot duration. Must be at least 0.5 hours');
      }
      
      // Check if duration is in 0.5-hour increments
      const remainder = (slotDurationHours * 10) % 5;
      if (remainder !== 0) {
        return sendValidationError(res, 'Slot duration must be in 0.5-hour increments (0.5, 1, 1.5, 2, etc.)');
      }
    }

    const result = await timeSlotService.generateSlotsForAllCourts(facilityId, userId, slotDurationHours);

    return sendSuccess(res, result, result.message || 'Time slots generated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCourtTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  generateSlotsForCourt,
  generateSlotsForAllCourts
};

