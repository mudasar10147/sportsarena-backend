/**
 * Facility Service
 * 
 * Business logic for facility operations
 */

const Facility = require('../models/Facility');
const FacilitySport = require('../models/FacilitySport');
const Court = require('../models/Court');

/**
 * Get all facilities with optional filters
 * @param {Object} filters - Filter options
 * @param {string} [filters.city] - Filter by city
 * @param {number} [filters.sportId] - Filter by sport ID
 * @param {number} [filters.latitude] - Latitude for location-based search
 * @param {number} [filters.longitude] - Longitude for location-based search
 * @param {number} [filters.radiusKm] - Radius in kilometers
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
    openingHours
  } = facilityData;

  // Validation
  if (!name || !address) {
    const error = new Error('Name and address are required');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

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
    openingHours: openingHours || {}
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

module.exports = {
  getAllFacilities,
  getFacilityDetails,
  createFacility,
  updateFacility
};

