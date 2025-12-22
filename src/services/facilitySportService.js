/**
 * FacilitySport Service
 * 
 * Business logic for facility-sport relationship operations
 */

const FacilitySport = require('../models/FacilitySport');
const Facility = require('../models/Facility');
const Sport = require('../models/Sport');

/**
 * Get all sports offered by a facility
 * @param {number} facilityId - Facility ID
 * @param {Object} options - Query options
 * @param {boolean} [options.isActive=true] - Filter by active status
 * @returns {Promise<Array>} Array of sport objects with relationship info
 * @throws {Error} If facility not found
 */
const getSportsByFacility = async (facilityId, options = {}) => {
  // Verify facility exists
  const facility = await Facility.findById(facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  const { isActive = true } = options;
  return await FacilitySport.getSportsByFacility(facilityId, { isActive });
};

/**
 * Assign a sport to a facility
 * @param {number} facilityId - Facility ID
 * @param {number} sportId - Sport ID
 * @param {number} userId - User ID making the request (for ownership check)
 * @returns {Promise<Object>} Created facility_sport relationship object
 * @throws {Error} If facility not found, sport not found, or user not authorized
 */
const assignSportToFacility = async (facilityId, sportId, userId) => {
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
    const error = new Error('You can only manage sports for your own facilities');
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
    const error = new Error('Cannot assign inactive sport to facility');
    error.statusCode = 400;
    error.errorCode = 'SPORT_INACTIVE';
    throw error;
  }

  // Create or reactivate relationship
  const facilitySport = await FacilitySport.create(facilityId, sportId);

  return facilitySport;
};

module.exports = {
  getSportsByFacility,
  assignSportToFacility
};

