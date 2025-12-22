/**
 * Sport Service
 * 
 * Business logic for sport operations
 * Note: For MVP, sports are mostly static; create/update routes are optional
 */

const Sport = require('../models/Sport');

/**
 * Get all active sports
 * @param {Object} options - Query options
 * @param {boolean} [options.isActive=true] - Filter by active status
 * @returns {Promise<Array>} Array of sport objects
 */
const getAllSports = async (options = {}) => {
  const { isActive = true } = options;
  return await Sport.findAll({ isActive });
};

/**
 * Get sport by ID
 * @param {number} sportId - Sport ID
 * @returns {Promise<Object>} Sport object
 * @throws {Error} If sport not found
 */
const getSportById = async (sportId) => {
  const sport = await Sport.findById(sportId);

  if (!sport) {
    const error = new Error('Sport not found');
    error.statusCode = 404;
    error.errorCode = 'SPORT_NOT_FOUND';
    throw error;
  }

  return sport;
};

/**
 * Create a new sport
 * @param {Object} sportData - Sport data
 * @returns {Promise<Object>} Created sport object
 * @throws {Error} If validation fails or name already exists
 */
const createSport = async (sportData) => {
  const { name, description, iconUrl } = sportData;

  // Validation
  if (!name || name.trim().length === 0) {
    const error = new Error('Sport name is required');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
    throw error;
  }

  // Check if name already exists
  const nameExists = await Sport.nameExists(name);
  if (nameExists) {
    const error = new Error('Sport name already exists');
    error.statusCode = 400;
    error.errorCode = 'SPORT_NAME_EXISTS';
    throw error;
  }

  // Create sport
  const sport = await Sport.create({
    name: name.trim(),
    description: description || null,
    iconUrl: iconUrl || null
  });

  return sport;
};

module.exports = {
  getAllSports,
  getSportById,
  createSport
};

