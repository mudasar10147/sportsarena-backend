/**
 * TimeSlot Service
 * 
 * Business logic for time slot operations
 */

const TimeSlot = require('../models/TimeSlot');
const Court = require('../models/Court');
const Facility = require('../models/Facility');

/**
 * Get available time slots for a court (up to 30 days) filtered by duration
 * Automatically maintains slots for the next 30 days (auto-generates if needed)
 * 
 * Note: Slots are generated as 0.5-hour base units. Any duration in 0.5-hour increments
 * (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, etc.) can be created by combining consecutive 0.5-hour slots.
 * 
 * @param {number} courtId - Court ID
 * @param {Date} [fromDate] - Start date (defaults to now)
 * @param {number} [durationHours=1] - Duration in hours (default: 1 hour, minimum: 0.5 hours)
 * @returns {Promise<Array>} Array of available time slot objects matching the duration (capped at 30 days from today)
 * @throws {Error} If court not found
 */
const getAvailableSlotsForCourt = async (courtId, fromDate = null, durationHours = 1) => {
  // Verify court exists
  const court = await Court.findById(courtId);
  if (!court) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }

  // Validate duration
  if (durationHours < 0.5) {
    const error = new Error('Duration must be at least 0.5 hours (30 minutes)');
    error.statusCode = 400;
    error.errorCode = 'INVALID_DURATION';
    throw error;
  }

  // Validate duration is in 0.5-hour increments (0.5, 1, 1.5, 2, 2.5, 3, etc.)
  const remainder = (durationHours * 10) % 5;
  if (remainder !== 0) {
    const error = new Error('Duration must be in 0.5-hour increments (0.5, 1, 1.5, 2, 2.5, 3, etc.)');
    error.statusCode = 400;
    error.errorCode = 'INVALID_DURATION';
    throw error;
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  // Calculate the maximum allowed end date (30 days from today)
  const maxEndDate = new Date(today);
  maxEndDate.setDate(maxEndDate.getDate() + 30);
  
  // Use provided fromDate or default to now
  const startDate = fromDate || now;
  
  // Cap the end date at 30 days from today (not from fromDate)
  const endDate = startDate > maxEndDate ? startDate : maxEndDate;
  
  // Get available slots for the requested date range (up to 30 days from today)
  const slots = await TimeSlot.getAvailableSlotsNext30Days(courtId, startDate, endDate);
  
  // Filter slots to only include those within 30 days from today
  const filteredByDateRange = slots.filter(slot => {
    const slotDate = new Date(slot.startTime);
    return slotDate >= startDate && slotDate <= maxEndDate;
  });
  
  // Auto-maintain slots: Check if we have slots for at least 25 days ahead
  // If not, automatically generate slots to maintain 30 days coverage
  // This ensures slots are always available without manual intervention
  const slotsInFuture = filteredByDateRange.filter(slot => slot.startTime > now);
  const latestSlot = slotsInFuture.length > 0 
    ? new Date(Math.max(...slotsInFuture.map(s => s.startTime.getTime())))
    : null;
  
  const daysAhead = latestSlot 
    ? Math.floor((latestSlot.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  
  // If we have less than 25 days of slots ahead, auto-generate to maintain 30 days
  // Note: Auto-generation uses the facility owner's ID (from court.facilityId)
  // This is safe because we're only generating slots, not modifying existing ones
  if (daysAhead < 25) {
    try {
      // Get facility to check if it has opening hours and get owner ID
      const facility = await Facility.findById(court.facilityId);
      if (facility && facility.openingHours && Object.keys(facility.openingHours).length > 0) {
        // Auto-generate slots using facility owner ID
        // Generate only 0.5-hour slots as the base unit
        // This allows any duration in 0.5-hour increments by combining consecutive slots:
        // - 0.5h = 1 slot, 1h = 2 slots, 1.5h = 3 slots, 2h = 4 slots, etc.
        await generateSlotsForCourt(courtId, facility.ownerId, 0.5);
        
        // Re-fetch slots after generation
        const updatedSlots = await TimeSlot.getAvailableSlotsNext30Days(courtId, startDate, endDate);
        
        // Filter by date range
        const filteredByDate = updatedSlots.filter(slot => {
          const slotDate = new Date(slot.startTime);
          return slotDate >= startDate && slotDate <= maxEndDate;
        });
        
        // Apply duration filtering (same logic as main function below)
        // All slots are 0.5-hour base units, so combine consecutive slots
        const durationMs = durationHours * 60 * 60 * 1000;
        const halfHourMs = 0.5 * 60 * 60 * 1000;
        const tolerance = 60 * 1000;
        const requiredSlotsCount = Math.round(durationHours * 2);
        
        const sortedSlots = [...filteredByDate].sort((a, b) => 
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
        
        const resultSlots = [];
        
        for (let i = 0; i <= sortedSlots.length - requiredSlotsCount; i++) {
          const firstSlot = sortedSlots[i];
          const firstSlotStart = new Date(firstSlot.startTime).getTime();
          const firstSlotEnd = new Date(firstSlot.endTime).getTime();
          const firstSlotDuration = firstSlotEnd - firstSlotStart;
          
          if (Math.abs(firstSlotDuration - halfHourMs) > tolerance) {
            continue;
          }
          
          let consecutiveSlots = [firstSlot];
          let currentEndTime = firstSlotEnd;
          
          for (let j = i + 1; j < sortedSlots.length && consecutiveSlots.length < requiredSlotsCount; j++) {
            const nextSlot = sortedSlots[j];
            const nextSlotStart = new Date(nextSlot.startTime).getTime();
            const nextSlotEnd = new Date(nextSlot.endTime).getTime();
            const nextSlotDuration = nextSlotEnd - nextSlotStart;
            
            if (Math.abs(nextSlotDuration - halfHourMs) > tolerance) {
              break;
            }
            
            if (Math.abs(nextSlotStart - currentEndTime) < tolerance) {
              consecutiveSlots.push(nextSlot);
              currentEndTime = nextSlotEnd;
            } else {
              break;
            }
          }
          
          if (consecutiveSlots.length === requiredSlotsCount) {
            const totalDuration = currentEndTime - firstSlotStart;
            if (Math.abs(totalDuration - durationMs) < tolerance) {
              resultSlots.push(firstSlot);
            }
          }
        }
        
        return resultSlots;
      }
    } catch (error) {
      // If auto-generation fails, continue with existing slots
      // Don't throw error - just log it and return what we have
      // This ensures the API doesn't break if auto-generation fails
      console.warn(`Auto-generation of slots for court ${courtId} failed:`, error.message);
    }
  }
  
  // Handle all duration types: 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, etc.
  // Strategy: Since all slots are 0.5-hour base units, we combine consecutive slots
  // to match the requested duration. For example:
  // - 0.5h = 1 slot, 1h = 2 slots, 1.5h = 3 slots, 2h = 4 slots, etc.
  const durationMs = durationHours * 60 * 60 * 1000;
  const halfHourMs = 0.5 * 60 * 60 * 1000; // 0.5 hour in milliseconds
  const tolerance = 60 * 1000; // 1 minute tolerance for time comparisons
  const requiredSlotsCount = Math.round(durationHours * 2); // Number of 0.5-hour slots needed
  
  // Sort slots by start time to ensure we process them in order
  const sortedSlots = [...filteredByDateRange].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  
  const resultSlots = [];
  
  // Find consecutive 0.5-hour slots that add up to the requested duration
  for (let i = 0; i <= sortedSlots.length - requiredSlotsCount; i++) {
    const firstSlot = sortedSlots[i];
    const firstSlotStart = new Date(firstSlot.startTime).getTime();
    const firstSlotEnd = new Date(firstSlot.endTime).getTime();
    const firstSlotDuration = firstSlotEnd - firstSlotStart;
    
    // Check if first slot is approximately 0.5 hours (base unit)
    if (Math.abs(firstSlotDuration - halfHourMs) > tolerance) {
      continue; // Skip slots that aren't 0.5-hour base units
    }
    
    // Try to find the required number of consecutive 0.5-hour slots
    let consecutiveSlots = [firstSlot];
    let currentEndTime = firstSlotEnd;
    
    for (let j = i + 1; j < sortedSlots.length && consecutiveSlots.length < requiredSlotsCount; j++) {
      const nextSlot = sortedSlots[j];
      const nextSlotStart = new Date(nextSlot.startTime).getTime();
      const nextSlotEnd = new Date(nextSlot.endTime).getTime();
      const nextSlotDuration = nextSlotEnd - nextSlotStart;
      
      // Check if next slot is approximately 0.5 hours
      if (Math.abs(nextSlotDuration - halfHourMs) > tolerance) {
        break; // Not a 0.5-hour slot, can't form consecutive group
      }
      
      // Check if next slot starts exactly when current slot ends (consecutive)
      if (Math.abs(nextSlotStart - currentEndTime) < tolerance) {
        consecutiveSlots.push(nextSlot);
        currentEndTime = nextSlotEnd;
      } else {
        break; // Not consecutive, can't form a combination
      }
    }
    
    // If we have exactly the required number of consecutive slots, add the first slot to results
    if (consecutiveSlots.length === requiredSlotsCount) {
      const totalDuration = currentEndTime - firstSlotStart;
      
      // Verify total duration matches requested duration (with tolerance)
      if (Math.abs(totalDuration - durationMs) < tolerance) {
        // Return the first slot of the group (representing the booking start)
        // The client can use this to book all consecutive slots
        resultSlots.push(firstSlot);
      }
    }
  }
  
  return resultSlots;
};

/**
 * Create a new time slot for a court
 * @param {number} courtId - Court ID
 * @param {Object} slotData - Time slot data
 * @param {number} userId - User ID making the request (for ownership check)
 * @returns {Promise<Object>} Created time slot object
 * @throws {Error} If court not found, validation fails, or user not authorized
 */
const createTimeSlot = async (courtId, slotData, userId) => {
  const { startTime, endTime, status } = slotData;

  // Verify court exists
  const court = await Court.findById(courtId);
  if (!court) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }

  // Get facility to check ownership
  const facility = await Facility.findById(court.facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  // Check if user is the facility owner
  if (facility.ownerId !== userId) {
    const error = new Error('You can only add time slots to courts in your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Validate time range
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const error = new Error('Invalid date format for startTime or endTime');
    error.statusCode = 400;
    error.errorCode = 'INVALID_DATE';
    throw error;
  }

  if (end <= start) {
    const error = new Error('End time must be after start time');
    error.statusCode = 400;
    error.errorCode = 'INVALID_TIME_RANGE';
    throw error;
  }

  // Validate status if provided
  if (status && !['available', 'blocked', 'booked'].includes(status)) {
    const error = new Error('Invalid status. Must be: available, blocked, or booked');
    error.statusCode = 400;
    error.errorCode = 'INVALID_STATUS';
    throw error;
  }

  // Create time slot
  const timeSlot = await TimeSlot.create({
    courtId,
    startTime: start,
    endTime: end,
    status: status || 'available'
  });

  return timeSlot;
};

/**
 * Update time slot (status change, e.g., block for maintenance)
 * @param {number} slotId - Time slot ID
 * @param {Object} updateData - Fields to update
 * @param {number} userId - User ID making the request (for ownership check)
 * @returns {Promise<Object>} Updated time slot object
 * @throws {Error} If slot not found or user not authorized
 */
const updateTimeSlot = async (slotId, updateData, userId) => {
  // Get time slot
  const timeSlot = await TimeSlot.findById(slotId);
  if (!timeSlot) {
    const error = new Error('Time slot not found');
    error.statusCode = 404;
    error.errorCode = 'TIME_SLOT_NOT_FOUND';
    throw error;
  }

  // Get court
  const court = await Court.findById(timeSlot.courtId);
  if (!court) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }

  // Get facility to check ownership
  const facility = await Facility.findById(court.facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  // Check if user is the facility owner
  if (facility.ownerId !== userId) {
    const error = new Error('You can only update time slots for courts in your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Validate status if provided
  if (updateData.status && !['available', 'blocked', 'booked'].includes(updateData.status)) {
    const error = new Error('Invalid status. Must be: available, blocked, or booked');
    error.statusCode = 400;
    error.errorCode = 'INVALID_STATUS';
    throw error;
  }

  // Update time slot status
  const updatedSlot = await TimeSlot.updateStatus(slotId, updateData.status);

  if (!updatedSlot) {
    const error = new Error('Failed to update time slot');
    error.statusCode = 500;
    error.errorCode = 'UPDATE_FAILED';
    throw error;
  }

  return updatedSlot;
};

/**
 * Generate time slots automatically based on facility opening hours
 * Creates slots for the next 30 days
 * @param {number} courtId - Court ID
 * @param {number} userId - User ID making the request (for ownership check)
 * @param {number} [slotDurationHours=1] - Duration of each slot in hours (default: 1 hour)
 * @returns {Promise<Object>} Object with count of slots generated
 * @throws {Error} If court not found, facility has no opening hours, or user not authorized
 */
const generateSlotsForCourt = async (courtId, userId, slotDurationHours = 1) => {
  // Verify court exists
  const court = await Court.findById(courtId);
  if (!court) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }

  // Get facility to check ownership and get opening hours
  const facility = await Facility.findById(court.facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  // Check if user is the facility owner
  if (facility.ownerId !== userId) {
    const error = new Error('You can only generate time slots for courts in your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Check if facility has opening hours configured
  if (!facility.openingHours || Object.keys(facility.openingHours).length === 0) {
    const error = new Error('Facility must have opening hours configured before generating slots. Please set opening hours for at least one day of the week.');
    error.statusCode = 400;
    error.errorCode = 'NO_OPENING_HOURS';
    throw error;
  }

  // Debug: Log opening hours structure (only in development)
  if (process.env.NODE_ENV !== 'production') {
    console.log('Opening hours for facility:', JSON.stringify(facility.openingHours, null, 2));
  }

  // Validate slot duration (must be in 0.5-hour increments)
  if (slotDurationHours < 0.5) {
    const error = new Error('Slot duration must be at least 0.5 hours');
    error.statusCode = 400;
    error.errorCode = 'INVALID_DURATION';
    throw error;
  }
  const remainder = (slotDurationHours * 10) % 5;
  if (remainder !== 0) {
    const error = new Error('Slot duration must be in 0.5-hour increments (0.5, 1, 1.5, 2, etc.)');
    error.statusCode = 400;
    error.errorCode = 'INVALID_DURATION';
    throw error;
  }

  // Day names mapping
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  // Start from today
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0); // Start of today
  
  const slotsToCreate = [];
  const slotDurationMs = slotDurationHours * 60 * 60 * 1000;

  // Generate slots for next 30 days
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayName = dayNames[dayOfWeek];
    
    // Get opening hours for this day (case-insensitive lookup)
    const dayHours = facility.openingHours[dayName] || 
                     facility.openingHours[dayName.toLowerCase()] || 
                     facility.openingHours[dayName.charAt(0).toUpperCase() + dayName.slice(1)];
    
    // Skip if facility is closed on this day
    if (!dayHours || !dayHours.open || !dayHours.close) {
      console.log(`Skipping ${dayName}:`, dayHours ? 'has hours but missing open/close' : 'no hours configured');
      continue;
    }

    // Parse opening and closing times
    const openTimeStr = String(dayHours.open).trim();
    const closeTimeStr = String(dayHours.close).trim();
    
    if (!openTimeStr || !closeTimeStr) {
      console.log(`Skipping ${dayName}: invalid time format`);
      continue;
    }
    
    const [openHour, openMinute] = openTimeStr.split(':').map(Number);
    const [closeHour, closeMinute] = closeTimeStr.split(':').map(Number);
    
    // Validate parsed times
    if (isNaN(openHour) || isNaN(openMinute) || isNaN(closeHour) || isNaN(closeMinute)) {
      console.log(`Skipping ${dayName}: could not parse times - open: ${openTimeStr}, close: ${closeTimeStr}`);
      continue;
    }
    
    // Create date objects for open and close times
    const openTime = new Date(currentDate);
    openTime.setHours(openHour, openMinute, 0, 0);
    
    const closeTime = new Date(currentDate);
    closeTime.setHours(closeHour, closeMinute, 0, 0);
    
    // Handle "00:00" as end of day (24:00) - if close time is before open time, it means it's next day
    // Example: open "13:00", close "00:00" means open 1 PM, close midnight (next day)
    if (closeTime <= openTime) {
      // Add 24 hours to close time (it's actually the next day's midnight)
      closeTime.setTime(closeTime.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Skip if opening time is in the past (for today)
    if (dayOffset === 0 && openTime < new Date()) {
      // For today, start from current time if it's after opening time
      const now = new Date();
      
      // Check if we're still within operating hours
      // Note: closeTime might be tomorrow's midnight if close was "00:00"
      const isWithinHours = now < closeTime;
      
      if (isWithinHours) {
        // Round up to next slot boundary based on slot duration
        const slotDurationMinutes = slotDurationHours * 60;
        const currentSlotStart = new Date(now);
        
        // Calculate how many minutes into the hour we are
        const totalMinutes = currentSlotStart.getHours() * 60 + currentSlotStart.getMinutes();
        // Round up to next slot boundary
        const roundedTotalMinutes = Math.ceil(totalMinutes / slotDurationMinutes) * slotDurationMinutes;
        
        // Convert back to hours and minutes
        const roundedHours = Math.floor(roundedTotalMinutes / 60);
        const roundedMins = roundedTotalMinutes % 60;
        
        currentSlotStart.setHours(roundedHours, roundedMins, 0, 0);
        
        // If rounded time is in the past (shouldn't happen, but safety check), move to next slot
        if (currentSlotStart <= now) {
          currentSlotStart.setTime(currentSlotStart.getTime() + slotDurationMs);
        }
        
        // Make sure rounded time doesn't exceed closing time
        if (currentSlotStart < closeTime) {
          openTime.setTime(currentSlotStart.getTime());
        } else {
          continue; // Already past closing time today
        }
      } else {
        continue; // Already past closing time today
      }
    }

    // Generate slots from open time to close time
    let slotStart = new Date(openTime);
    
    while (slotStart < closeTime) {
      const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
      
      // Don't create slot if it extends past closing time
      if (slotEnd > closeTime) {
        break;
      }
      
      slotsToCreate.push({
        courtId,
        startTime: new Date(slotStart),
        endTime: new Date(slotEnd),
        status: 'available'
      });
      
      // Move to next slot
      slotStart = new Date(slotEnd);
    }
  }

  if (slotsToCreate.length === 0) {
    // Check why no slots were generated
    const openingHoursKeys = facility.openingHours ? Object.keys(facility.openingHours) : [];
    const validDays = [];
    const invalidDays = [];
    
    // Check each day to see which ones are valid
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    dayNames.forEach(dayName => {
      const dayHours = facility.openingHours?.[dayName];
      if (dayHours && dayHours.open && dayHours.close) {
        validDays.push(dayName);
      } else {
        invalidDays.push(dayName);
      }
    });
    
    let errorMessage = 'No slots generated. ';
    if (validDays.length === 0) {
      errorMessage += 'No valid opening hours found. Please configure opening hours for at least one day. ';
      errorMessage += `Found opening hours keys: ${openingHoursKeys.join(', ') || 'none'}`;
    } else {
      errorMessage += `Opening hours found for: ${validDays.join(', ')}, but no slots could be generated for the next 30 days. `;
      errorMessage += `This might be because all time slots are in the past or there's an issue with the time format.`;
    }
    
    return {
      count: 0,
      message: errorMessage,
      debug: {
        hasOpeningHours: !!facility.openingHours,
        openingHoursKeys,
        validDays,
        invalidDays,
        slotDurationHours,
        openingHoursSample: facility.openingHours ? Object.entries(facility.openingHours).slice(0, 3) : null
      }
    };
  }

  // Check for existing slots to avoid duplicates
  // Get existing slots for the date range
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 30);
  
  const existingSlots = await TimeSlot.findByCourtId(courtId, {
    startDate: startDate,
    endDate: endDate
  });

  // Create a set of existing slot time ranges for quick lookup
  const existingSlotKeys = new Set(
    existingSlots.map(slot => 
      `${slot.startTime.getTime()}-${slot.endTime.getTime()}`
    )
  );

  // Filter out slots that already exist
  const newSlots = slotsToCreate.filter(slot => {
    const key = `${slot.startTime.getTime()}-${slot.endTime.getTime()}`;
    return !existingSlotKeys.has(key);
  });

  if (newSlots.length === 0) {
    return {
      count: 0,
      message: 'All slots for the next 30 days already exist.'
    };
  }

  // Bulk insert new slots
  const createdSlots = await TimeSlot.createMultiple(newSlots);

  return {
    count: createdSlots.length,
    message: `Successfully generated ${createdSlots.length} time slots for the next 30 days.`
  };
};

/**
 * Generate time slots for all courts in a facility
 * Useful for existing facilities that need slots generated
 * @param {number} facilityId - Facility ID
 * @param {number} userId - User ID making the request (for ownership check)
 * @param {number} [slotDurationHours=1] - Duration of each slot in hours (default: 1 hour)
 * @returns {Promise<Object>} Object with summary of slots generated per court
 * @throws {Error} If facility not found or user not authorized
 */
const generateSlotsForAllCourts = async (facilityId, userId, slotDurationHours = 1) => {
  // Verify facility exists
  const facility = await Facility.findById(facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  // Check if user is the facility owner
  if (facility.ownerId !== userId) {
    const error = new Error('You can only generate time slots for courts in your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Check if facility has opening hours configured
  if (!facility.openingHours || Object.keys(facility.openingHours).length === 0) {
    const error = new Error('Facility must have opening hours configured before generating slots');
    error.statusCode = 400;
    error.errorCode = 'NO_OPENING_HOURS';
    throw error;
  }

  // Get all active courts for this facility
  const courts = await Court.findByFacilityId(facilityId, { isActive: true });

  if (courts.length === 0) {
    return {
      facilityId,
      totalCourts: 0,
      totalSlotsGenerated: 0,
      courts: [],
      message: 'No active courts found for this facility'
    };
  }

  // Generate slots for each court
  const results = [];
  let totalSlotsGenerated = 0;

  for (const court of courts) {
    try {
      const result = await generateSlotsForCourt(court.id, userId, slotDurationHours);
      results.push({
        courtId: court.id,
        courtName: court.name,
        slotsGenerated: result.count,
        message: result.message
      });
      totalSlotsGenerated += result.count;
    } catch (error) {
      results.push({
        courtId: court.id,
        courtName: court.name,
        slotsGenerated: 0,
        error: error.message
      });
    }
  }

  return {
    facilityId,
    facilityName: facility.name,
    totalCourts: courts.length,
    totalSlotsGenerated,
    courts: results,
    message: `Generated ${totalSlotsGenerated} slots across ${courts.length} court(s)`
  };
};

module.exports = {
  getAvailableSlotsForCourt,
  createTimeSlot,
  updateTimeSlot,
  generateSlotsForCourt,
  generateSlotsForAllCourts
};

