/**
 * Court Service
 * 
 * Business logic for court operations
 */

const Court = require('../models/Court');
const Facility = require('../models/Facility');
const Sport = require('../models/Sport');
const timeSlotService = require('./timeSlotService');

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

  // Automatically generate time slots if facility has opening hours configured
  // This happens in the background - don't fail court creation if slot generation fails
  if (facility.openingHours && Object.keys(facility.openingHours).length > 0) {
    try {
      await timeSlotService.generateSlotsForCourt(court.id, userId, 1); // Default: 1-hour slots
      // Note: We don't wait for this or throw errors - slots can be generated later if needed
    } catch (error) {
      // Log error but don't fail court creation
      console.warn(`Failed to auto-generate slots for court ${court.id}:`, error.message);
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

