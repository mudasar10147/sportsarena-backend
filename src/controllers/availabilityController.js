/**
 * Availability Controller
 * 
 * Handles HTTP requests for court availability operations
 * Uses rule-based availability system (no pre-created slots)
 */

const availabilityService = require('../services/availabilityService');
const availabilityFilterService = require('../services/availabilityFilterService');
const slotCompositionService = require('../services/slotCompositionService');
const timeNorm = require('../utils/timeNormalization');
const { 
  sendSuccess, 
  sendError, 
  sendValidationError 
} = require('../utils/response');

/**
 * Get availability for a single date
 * GET /api/v1/courts/:id/availability
 */
const getAvailability = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const { date, duration, includeBookings } = req.query;

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    if (!date) {
      return sendValidationError(res, 'Date parameter is required (YYYY-MM-DD format)');
    }

    // Parse date
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      return sendValidationError(res, 'Invalid date format. Use YYYY-MM-DD');
    }

    // Generate base availability
    const baseAvailability = await availabilityService.generateBaseAvailability(courtId, bookingDate);

    // Filter by bookings and blocked ranges
    const filteredAvailability = await availabilityFilterService.filterAvailability(baseAvailability, {
      includeBookings: includeBookings !== 'false'
    });

    // Format blocks with time strings
    const formattedBlocks = filteredAvailability.blocks.map(block => ({
      ...block,
      startTimeFormatted: timeNorm.formatTimeString(block.startTime),
      endTimeFormatted: timeNorm.formatTimeString(block.endTime)
    }));

    // If duration is requested, compose slots
    let slots = null;
    if (duration) {
      const durationMinutes = parseInt(duration, 10);
      if (isNaN(durationMinutes) || durationMinutes <= 0) {
        return sendValidationError(res, 'Duration must be a positive number (in minutes)');
      }

      const slotResult = slotCompositionService.generateBookingSlots(filteredAvailability.blocks, durationMinutes);
      slots = slotResult.slots.map(slot => ({
        ...slot,
        startTimeFormatted: timeNorm.formatTimeString(slot.startTime),
        endTimeFormatted: timeNorm.formatTimeString(slot.endTime)
      }));
    }

    // Calculate total hours available (from slots if duration provided, otherwise from blocks)
    const totalHoursAvailable = slots
      ? Math.round(slots.reduce((total, slot) => {
          const durationMinutes = slot.endTime - slot.startTime;
          return total + (durationMinutes / 60);
        }, 0) * 100) / 100
      : Math.round(formattedBlocks.reduce((total, block) => {
          const durationMinutes = block.endTime - block.startTime;
          return total + (durationMinutes / 60);
        }, 0) * 100) / 100;

    // Format response
    const response = {
      courtId: filteredAvailability.courtId,
      date: filteredAvailability.date,
      dayOfWeek: filteredAvailability.dayOfWeek,
      policy: filteredAvailability.policy,
      // If duration is requested, return only slots; otherwise return blocks
      ...(slots ? { slots } : { blocks: formattedBlocks }),
      ...(includeBookings !== 'false' && {
        bookings: filteredAvailability.bookings.map(booking => ({
          ...booking,
          startTimeFormatted: timeNorm.formatTimeString(booking.startTime),
          endTimeFormatted: timeNorm.formatTimeString(booking.endTime)
        })),
        blockedRanges: filteredAvailability.blockedRanges.map(range => ({
          ...range,
          startTimeFormatted: timeNorm.formatTimeString(range.startTime),
          endTimeFormatted: timeNorm.formatTimeString(range.endTime)
        }))
      }),
      metadata: {
        totalBlocks: slots ? slots.length : formattedBlocks.length,
        totalHoursAvailable,
        ...(duration && { requestedDuration: parseInt(duration, 10), slotsGenerated: slots?.length || 0 })
      }
    };

    return sendSuccess(res, response, 'Availability retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get availability for a date range (e.g., 7 days)
 * GET /api/v1/courts/:id/availability/range
 */
const getAvailabilityRange = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const { startDate, endDate, duration, includeBookings } = req.query;

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    if (!startDate || !endDate) {
      return sendValidationError(res, 'startDate and endDate parameters are required (YYYY-MM-DD format)');
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return sendValidationError(res, 'Invalid date format. Use YYYY-MM-DD');
    }

    if (start > end) {
      return sendValidationError(res, 'startDate must be before or equal to endDate');
    }

    // Calculate date range
    const dates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Generate availability for each date
    const availabilityPromises = dates.map(async (date) => {
      try {
        const baseAvailability = await availabilityService.generateBaseAvailability(courtId, date);
        const filteredAvailability = await availabilityFilterService.filterAvailability(baseAvailability, {
          includeBookings: includeBookings !== 'false'
        });

        // Format blocks (with validation to handle invalid time values)
        const formattedBlocks = filteredAvailability.blocks
          .filter(block => {
            // Filter out blocks with invalid time values
            const isValid = typeof block.startTime === 'number' && 
                           !isNaN(block.startTime) && 
                           block.startTime >= 0 && 
                           block.startTime < 1440 &&
                           typeof block.endTime === 'number' && 
                           !isNaN(block.endTime) && 
                           block.endTime >= 0 && 
                           block.endTime < 1440;
            if (!isValid) {
              console.warn(`Skipping block with invalid time values: startTime=${block.startTime}, endTime=${block.endTime}`);
            }
            return isValid;
          })
          .map(block => ({
            ...block,
            startTimeFormatted: timeNorm.formatTimeString(block.startTime),
            endTimeFormatted: timeNorm.formatTimeString(block.endTime)
          }));

        // Compose slots if duration requested
        let slots = null;
        if (duration) {
          const durationMinutes = parseInt(duration, 10);
          if (!isNaN(durationMinutes) && durationMinutes > 0) {
            const slotResult = slotCompositionService.generateBookingSlots(filteredAvailability.blocks, durationMinutes);
            slots = slotResult.slots.map(slot => ({
              ...slot,
              startTimeFormatted: timeNorm.formatTimeString(slot.startTime),
              endTimeFormatted: timeNorm.formatTimeString(slot.endTime)
            }));
          }
        }

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Calculate total hours available (from slots if duration provided, otherwise from blocks)
        const totalHoursAvailable = slots
          ? Math.round(slots.reduce((total, slot) => {
              const durationMinutes = slot.endTime - slot.startTime;
              return total + (durationMinutes / 60);
            }, 0) * 100) / 100
          : Math.round(formattedBlocks.reduce((total, block) => {
              const durationMinutes = block.endTime - block.startTime;
              return total + (durationMinutes / 60);
            }, 0) * 100) / 100;

        const result = {
          date: date.toISOString().split('T')[0],
          dayOfWeek: filteredAvailability.dayOfWeek,
          dayName: dayNames[filteredAvailability.dayOfWeek],
          // If duration is requested, return only slots; otherwise return blocks
          ...(slots ? { slots } : { blocks: formattedBlocks }),
          totalHoursAvailable,
          totalBlocks: slots ? slots.length : formattedBlocks.length
        };

        // Add helpful message if no availability rules configured
        if (formattedBlocks.length === 0 && baseAvailability.blocks.length === 0) {
          result.message = 'No availability rules configured for this court on this day';
          result.hasRules = false;
        } else {
          result.hasRules = true;
        }

        return result;
      } catch (error) {
        // If one date fails, return error info but continue with others
        return {
          date: date.toISOString().split('T')[0],
          error: error.message,
          errorCode: error.errorCode,
          blocks: [],
          totalHoursAvailable: 0,
          totalBlocks: 0
        };
      }
    });

    const availability = await Promise.all(availabilityPromises);

    const response = {
      courtId,
      dateRange: {
        startDate: startDate,
        endDate: endDate
      },
      availability,
      metadata: {
        totalDays: dates.length,
        ...(duration && { requestedDuration: parseInt(duration, 10) })
      }
    };

    return sendSuccess(res, response, 'Availability range retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get duration-based slots for a date
 * GET /api/v1/courts/:id/availability/slots
 */
const getAvailabilitySlots = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const { date, duration, multipleDurations } = req.query;

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    if (!date) {
      return sendValidationError(res, 'Date parameter is required (YYYY-MM-DD format)');
    }

    // Parse date
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      return sendValidationError(res, 'Invalid date format. Use YYYY-MM-DD');
    }

    // Generate and filter availability
    const baseAvailability = await availabilityService.generateBaseAvailability(courtId, bookingDate);
    const filteredAvailability = await availabilityFilterService.filterAvailability(baseAvailability);

    // Handle multiple durations
    if (multipleDurations) {
      const durations = multipleDurations.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d) && d > 0);
      
      if (durations.length === 0) {
        return sendValidationError(res, 'Invalid multipleDurations format. Use comma-separated numbers (e.g., "90,120,150")');
      }

      const slotResult = slotCompositionService.generateSlotsForMultipleDurations(filteredAvailability.blocks, durations);
      
      const slotsByDuration = {};
      Object.keys(slotResult.slotsByDuration).forEach(dur => {
        slotsByDuration[dur] = slotResult.slotsByDuration[dur].map(slot => ({
          ...slot,
          startTimeFormatted: timeNorm.formatTimeString(slot.startTime),
          endTimeFormatted: timeNorm.formatTimeString(slot.endTime)
        }));
      });

      const response = {
        courtId,
        date: filteredAvailability.date,
        slotsByDuration,
        metadata: {
          requestedDurations: durations,
          totalSlotsGenerated: Object.values(slotsByDuration).reduce((sum, slots) => sum + slots.length, 0)
        }
      };

      return sendSuccess(res, response, 'Availability slots retrieved successfully');
    }

    // Single duration
    if (!duration) {
      return sendValidationError(res, 'duration or multipleDurations parameter is required');
    }

    const durationMinutes = parseInt(duration, 10);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      return sendValidationError(res, 'Duration must be a positive number (in minutes)');
    }

    const slotResult = slotCompositionService.generateBookingSlots(filteredAvailability.blocks, durationMinutes);
    
    const slots = slotResult.slots.map(slot => ({
      ...slot,
      startTimeFormatted: timeNorm.formatTimeString(slot.startTime),
      endTimeFormatted: timeNorm.formatTimeString(slot.endTime)
    }));

    const response = {
      courtId,
      date: filteredAvailability.date,
      slots,
      metadata: {
        requestedDuration: durationMinutes,
        slotsGenerated: slots.length,
        totalFreeBlocks: filteredAvailability.blocks.length
      }
    };

    return sendSuccess(res, response, 'Availability slots retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAvailability,
  getAvailabilityRange,
  getAvailabilitySlots
};

