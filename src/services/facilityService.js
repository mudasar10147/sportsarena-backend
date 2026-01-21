/**
 * Facility Service
 * 
 * Business logic for facility operations
 */

const Facility = require('../models/Facility');
const FacilitySport = require('../models/FacilitySport');
const Court = require('../models/Court');
const availabilityService = require('./availabilityService');
const availabilityFilterService = require('./availabilityFilterService');
const timeNorm = require('../utils/timeNormalization');

/**
 * Check if a court has availability for a specific time slot
 * @param {number} courtId - Court ID
 * @param {Date|string} date - Date to check
 * @param {number} startTimeMinutes - Start time in minutes since midnight
 * @param {number} endTimeMinutes - End time in minutes since midnight
 * @returns {Promise<boolean>} True if court has availability for the time slot
 * @private
 */
async function checkCourtAvailability(courtId, date, startTimeMinutes, endTimeMinutes) {
  try {
    // Generate base availability
    const baseAvailability = await availabilityService.generateBaseAvailability(courtId, date);
    
    // Filter by bookings and blocked ranges
    const filteredAvailability = await availabilityFilterService.filterAvailability(baseAvailability);
    
    // Check if any block contains or overlaps with the requested time slot
    // A block is available if it contains the entire requested time range
    const hasAvailability = filteredAvailability.blocks.some(block => {
      // Block contains the requested time if:
      // block.startTime <= startTimeMinutes AND block.endTime >= endTimeMinutes
      return block.startTime <= startTimeMinutes && block.endTime >= endTimeMinutes;
    });
    
    return hasAvailability;
  } catch (error) {
    // If court not found or other error, return false
    console.error(`Error checking availability for court ${courtId}:`, error.message);
    return false;
  }
}

/**
 * Get all facilities with optional filters
 * @param {Object} filters - Filter options
 * @param {string} [filters.city] - Filter by city
 * @param {number} [filters.sportId] - Filter by sport ID
 * @param {number} [filters.latitude] - Latitude for location-based search
 * @param {number} [filters.longitude] - Longitude for location-based search
 * @param {number} [filters.radiusKm] - Radius in kilometers
 * @param {string} [filters.date] - Date for availability check (YYYY-MM-DD)
 * @param {string} [filters.startTime] - Start time for availability check (HH:MM)
 * @param {string} [filters.endTime] - End time for availability check (HH:MM)
 * @param {number} [filters.page=1] - Page number
 * @param {number} [filters.limit=50] - Items per page
 * @returns {Promise<Object>} Object with facilities array and pagination info
 */
const getAllFacilities = async (filters = {}) => {
  const {
    city,
    sportId,
    latitude,
    longitude,
    radiusKm,
    date,
    startTime,
    endTime,
    page = 1,
    limit = 50
  } = filters;

  const offset = (page - 1) * limit;

  // If filtering by sport, get facility IDs first
  let facilityIds = null;
  if (sportId) {
    const facilitiesBySport = await FacilitySport.getFacilitiesBySport(sportId, {
      isActive: true
    });
    facilityIds = facilitiesBySport.map(fs => fs.facilityId);
    
    // If no facilities found for this sport, return empty result
    if (facilityIds.length === 0) {
      return {
        facilities: [],
        total: 0,
        limit,
        offset,
        page
      };
    }
  }

  // Build options for Facility.findAll
  const options = {
    limit,
    offset,
    city,
    isActive: true,
    latitude,
    longitude,
    radiusKm
  };

  // Get all facilities
  const result = await Facility.findAll(options);

  // Filter by sport if needed
  let facilities = result.facilities;
  if (facilityIds) {
    facilities = facilities.filter(f => facilityIds.includes(f.id));
    // Update total count
    result.total = facilities.length;
  }

  // Filter by availability if date and time provided
  if (date && startTime && endTime) {
    try {
      // Parse date
      const bookingDate = date instanceof Date ? date : new Date(date);
      if (isNaN(bookingDate.getTime())) {
        throw new Error('Invalid date format');
      }

      // Parse times
      const startTimeMinutes = timeNorm.parseTimeString(startTime);
      const endTimeMinutes = timeNorm.parseTimeString(endTime);

      // Validate time range
      if (startTimeMinutes >= endTimeMinutes) {
        throw new Error('Start time must be before end time');
      }

      // Check availability for each facility
      const facilitiesWithAvailability = await Promise.all(
        facilities.map(async (facility) => {
          // Get all active courts for this facility
          const courts = await Court.findByFacilityId(facility.id, { isActive: true });
          
          // Check if any court has availability
          const availabilityChecks = await Promise.all(
            courts.map(court => 
              checkCourtAvailability(court.id, bookingDate, startTimeMinutes, endTimeMinutes)
            )
          );
          
          const hasAvailableCourt = availabilityChecks.some(available => available);
          
          // Return facility with availability info
          return {
            ...facility,
            hasAvailability: hasAvailableCourt,
            availableCourtsCount: availabilityChecks.filter(a => a).length
          };
        })
      );

      // Filter to only facilities with availability
      facilities = facilitiesWithAvailability.filter(f => f.hasAvailability);
      
      // Remove availability metadata from response (or keep it if frontend needs it)
      facilities = facilities.map(({ hasAvailability, availableCourtsCount, ...facility }) => ({
        ...facility,
        ...(availableCourtsCount > 0 && { availableCourtsCount }) // Include count if > 0
      }));

      // Update total count
      result.total = facilities.length;
    } catch (error) {
      // If availability check fails, return empty result
      console.error('Error filtering by availability:', error.message);
      return {
        facilities: [],
        total: 0,
        limit,
        offset,
        page
      };
    }
  }

  return {
    facilities,
    total: result.total,
    limit,
    offset,
    page
  };
};

/**
 * Get facility details with related data (courts, sports)
 * @param {number} facilityId - Facility ID
 * @param {Object} [locationParams] - Optional location parameters for distance calculation
 * @param {number} [locationParams.latitude] - Latitude for distance calculation
 * @param {number} [locationParams.longitude] - Longitude for distance calculation
 * @returns {Promise<Object>} Facility object with courts and sports
 * @throws {Error} If facility not found
 */
const getFacilityDetails = async (facilityId, locationParams = {}) => {
  // Get facility with optional distance calculation
  const facility = await Facility.findById(facilityId, locationParams);

  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  // Get courts for this facility
  const courts = await Court.findByFacilityId(facilityId, {
    isActive: true
  });

  // Get sports for this facility
  const sports = await FacilitySport.getSportsByFacility(facilityId, {
    isActive: true
  });

  return {
    ...facility,
    courts,
    sports: sports.map(s => ({
      id: s.sportId,
      name: s.sportName,
      description: s.sportDescription,
      iconUrl: s.sportIconUrl
    }))
  };
};

/**
 * Validate amenities array
 * @param {Array<string>} amenities - Array of amenity strings
 * @returns {Object} Validation result with valid flag and sanitized amenities
 * @throws {Error} If validation fails
 */
const validateAmenities = (amenities) => {
  if (!amenities || !Array.isArray(amenities)) {
    return { valid: true, amenities: [] };
  }

  // Check max limit
  if (amenities.length > Facility.MAX_AMENITIES) {
    const error = new Error(`Maximum ${Facility.MAX_AMENITIES} amenities allowed`);
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Validate each amenity
  const invalidAmenities = amenities.filter(a => !Facility.VALID_AMENITIES.includes(a));
  if (invalidAmenities.length > 0) {
    const error = new Error(`Invalid amenities: ${invalidAmenities.join(', ')}. Valid options: ${Facility.VALID_AMENITIES.join(', ')}`);
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Remove duplicates
  const uniqueAmenities = [...new Set(amenities)];

  return { valid: true, amenities: uniqueAmenities };
};

/**
 * Create a new facility
 * @param {Object} facilityData - Facility data
 * @param {number} ownerId - User ID of facility owner
 * @returns {Promise<Object>} Created facility object
 * @throws {Error} If validation fails
 */
const createFacility = async (facilityData, ownerId) => {
  const {
    name,
    address,
    description,
    city,
    latitude,
    longitude,
    contactPhone,
    contactEmail,
    photos,
    openingHours,
    amenities
  } = facilityData;

  // Validation
  if (!name || !address) {
    const error = new Error('Name and address are required');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Validate amenities
  const amenitiesValidation = validateAmenities(amenities);

  // Create facility
  const facility = await Facility.create({
    name,
    address,
    ownerId,
    description,
    city,
    latitude,
    longitude,
    contactPhone,
    contactEmail,
    photos: photos || [],
    openingHours: openingHours || {},
    amenities: amenitiesValidation.amenities
  });

  return facility;
};

/**
 * Update facility details
 * @param {number} facilityId - Facility ID
 * @param {Object} updateData - Fields to update
 * @param {number} userId - User ID making the update
 * @returns {Promise<Object>} Updated facility object
 * @throws {Error} If facility not found or user not authorized
 */
const updateFacility = async (facilityId, updateData, userId) => {
  // Get facility to check ownership
  const facility = await Facility.findById(facilityId);

  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  // Check if user is the owner (or admin - can be enhanced later)
  if (facility.ownerId !== userId) {
    const error = new Error('You can only update your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Validate amenities if provided
  if (updateData.amenities !== undefined) {
    const amenitiesValidation = validateAmenities(updateData.amenities);
    updateData.amenities = amenitiesValidation.amenities;
  }

  // Update facility
  const updatedFacility = await Facility.update(facilityId, updateData);

  if (!updatedFacility) {
    const error = new Error('Failed to update facility');
    error.statusCode = 500;
    error.errorCode = 'UPDATE_FAILED';
    throw error;
  }

  return updatedFacility;
};

/**
 * Get list of unique cities where facilities exist
 * @param {Object} [options={}] - Query options
 * @param {boolean} [options.isActive=true] - Only include cities with active facilities
 * @returns {Promise<Array>} Array of city objects with facility count
 */
const getCities = async (options = {}) => {
  const { isActive = true } = options;

  const { pool } = require('../config/database');

  const query = `
    SELECT 
      city,
      COUNT(*) as facility_count
    FROM facilities
    WHERE city IS NOT NULL
      AND city != ''
      ${isActive ? 'AND is_active = TRUE' : ''}
    GROUP BY city
    ORDER BY city ASC
  `;

  const result = await pool.query(query);

  return result.rows.map(row => ({
    city: row.city,
    facilityCount: parseInt(row.facility_count, 10)
  }));
};

/**
 * Get closest facilities to a given location with pagination
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {number} [page=1] - Page number (default: 1)
 * @param {number} [limit=7] - Number of facilities per page (default: 7)
 * @returns {Promise<Object>} Object with facilities array and pagination info (max 28 total facilities)
 */
const getClosestFacilities = async (latitude, longitude, page = 1, limit = 7) => {
  // Validate coordinates
  if (latitude === undefined || longitude === undefined) {
    const error = new Error('Latitude and longitude are required');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    const error = new Error('Invalid latitude. Must be between -90 and 90');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    const error = new Error('Invalid longitude. Must be between -180 and 180');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 7;
  const MAX_TOTAL_FACILITIES = 28;
  const maxPage = Math.ceil(MAX_TOTAL_FACILITIES / limitNum);

  // Validate page number
  if (pageNum < 1) {
    const error = new Error('Page must be a positive number');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  if (pageNum > maxPage) {
    const error = new Error(`Page number exceeds maximum. Maximum page is ${maxPage} (${MAX_TOTAL_FACILITIES} total facilities)`);
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Calculate offset
  const offset = (pageNum - 1) * limitNum;
  
  // Get facilities ordered by distance (using existing findAll method)
  // We fetch up to MAX_TOTAL_FACILITIES to limit total results and get accurate count
  const options = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    isActive: true,
    limit: MAX_TOTAL_FACILITIES, // Fetch max allowed facilities (28) to get accurate total
    offset: 0
    // Note: Not providing radiusKm means we get all facilities ordered by distance
  };

  const result = await Facility.findAll(options);
  
  // Limit to MAX_TOTAL_FACILITIES (in case there are more in the database)
  const allFacilities = result.facilities.slice(0, MAX_TOTAL_FACILITIES);
  const total = Math.min(allFacilities.length, MAX_TOTAL_FACILITIES);
  
  // Apply pagination to get the requested page
  const paginatedFacilities = allFacilities.slice(offset, offset + limitNum);

  return {
    facilities: paginatedFacilities,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    hasNextPage: offset + limitNum < total,
    hasPreviousPage: pageNum > 1
  };
};

module.exports = {
  getAllFacilities,
  getFacilityDetails,
  createFacility,
  updateFacility,
  getClosestFacilities,
  getCities
};

