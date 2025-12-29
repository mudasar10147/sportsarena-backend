/**
 * Court Service
 * 
 * Business logic for court operations
 */

const Court = require('../models/Court');
const Facility = require('../models/Facility');
const Sport = require('../models/Sport');
const { parseTimeString } = require('../utils/timeNormalization');

/**
 * Map day name to day of week number
 * @private
 * @param {string} dayName - Day name (lowercase, e.g., 'monday', 'tuesday')
 * @returns {number|null} Day of week (0=Sunday, 1=Monday, ..., 6=Saturday) or null if invalid
 */
const mapDayNameToNumber = (dayName) => {
  const dayMap = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };
  
  const normalizedDayName = dayName.toLowerCase();
  return dayMap[normalizedDayName] !== undefined ? dayMap[normalizedDayName] : null;
};

/**
 * Generate availability rules from facility opening hours
 * @private
 * @param {Object} openingHours - Facility opening hours object
 * @returns {Array<Object>} Array of rule objects ready for insertion
 */
const generateAvailabilityRulesFromOpeningHours = (openingHours) => {
  const rules = [];

  if (!openingHours || typeof openingHours !== 'object') {
    return rules;
  }

  // Iterate through each day in opening hours
  for (const [dayName, hours] of Object.entries(openingHours)) {
    // Skip if day is null or hours object is invalid
    if (!hours || typeof hours !== 'object' || !hours.open || !hours.close) {
      continue;
    }

    const dayOfWeek = mapDayNameToNumber(dayName);
    if (dayOfWeek === null) {
      // Invalid day name, skip
      continue;
    }

    try {
      const startTime = parseTimeString(hours.open);
      const endTime = parseTimeString(hours.close);

      rules.push({
        dayOfWeek,
        startTime,
        endTime,
        isActive: true
      });
    } catch (error) {
      // Invalid time format, skip this day
      console.warn(`Skipping invalid opening hours for ${dayName}: ${error.message}`);
      continue;
    }
  }

  return rules;
};

/**
 * Get all courts for a facility
 * @param {number} facilityId - Facility ID
 * @param {Object} options - Query options
 * @param {boolean} [options.isActive=true] - Filter by active status
 * @returns {Promise<Array>} Array of court objects
 * @throws {Error} If facility not found
 */
const getCourtsByFacility = async (facilityId, options = {}) => {
  // Verify facility exists
  const facility = await Facility.findById(facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  const { isActive = true } = options;
  return await Court.findByFacilityId(facilityId, { isActive });
};

/**
 * Create a new court for a facility
 * @param {number} facilityId - Facility ID
 * @param {Object} courtData - Court data
 * @param {number} userId - User ID making the request (for ownership check)
 * @returns {Promise<Object>} Created court object
 * @throws {Error} If facility not found, sport not found, or user not authorized
 */
const createCourt = async (facilityId, courtData, userId) => {
  const { sportId, name, pricePerHour, description, isIndoor } = courtData;

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
    const error = new Error('You can only add courts to your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Verify sport exists
  const sport = await Sport.findById(sportId);
  if (!sport) {
    const error = new Error('Sport not found');
    error.statusCode = 404;
    error.errorCode = 'SPORT_NOT_FOUND';
    throw error;
  }

  // Check if sport is active
  if (!sport.isActive) {
    const error = new Error('Cannot create court for inactive sport');
    error.statusCode = 400;
    error.errorCode = 'SPORT_INACTIVE';
    throw error;
  }

  // Validate price
  if (pricePerHour <= 0) {
    const error = new Error('Price per hour must be greater than 0');
    error.statusCode = 400;
    error.errorCode = 'INVALID_PRICE';
    throw error;
  }

  // Create court
  const court = await Court.create({
    facilityId,
    sportId,
    name,
    pricePerHour,
    description: description || null,
    isIndoor: isIndoor !== undefined ? isIndoor : true
  });

  // Automatically create availability rules based on facility opening hours
  if (facility.openingHours && Object.keys(facility.openingHours).length > 0) {
    const rules = generateAvailabilityRulesFromOpeningHours(facility.openingHours);
    if (rules.length > 0) {
      try {
        await Court.createAvailabilityRules(court.id, rules);
      } catch (error) {
        // Log error but don't fail court creation if rule creation fails
        console.error(`Failed to create availability rules for court ${court.id}:`, error.message);
      }
    }
  }

  return court;
};

/**
 * Update court details
 * @param {number} courtId - Court ID
 * @param {Object} updateData - Fields to update
 * @param {number} userId - User ID making the request (for ownership check)
 * @returns {Promise<Object>} Updated court object
 * @throws {Error} If court not found or user not authorized
 */
const updateCourt = async (courtId, updateData, userId) => {
  // Get court to check ownership
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
    const error = new Error('You can only update courts in your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Validate price if provided
  if (updateData.pricePerHour !== undefined && updateData.pricePerHour <= 0) {
    const error = new Error('Price per hour must be greater than 0');
    error.statusCode = 400;
    error.errorCode = 'INVALID_PRICE';
    throw error;
  }

  // Update court
  const updatedCourt = await Court.update(courtId, updateData);

  if (!updatedCourt) {
    const error = new Error('Failed to update court');
    error.statusCode = 500;
    error.errorCode = 'UPDATE_FAILED';
    throw error;
  }

  return updatedCourt;
};

module.exports = {
  getCourtsByFacility,
  createCourt,
  updateCourt
};

