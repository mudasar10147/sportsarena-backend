/**
 * Sport Controller
 * 
 * Handles HTTP requests for sport-related operations
 * Note: For MVP, sports are mostly static; create route is optional
 */

const sportService = require('../services/sportService');
const { 
  sendSuccess, 
  sendCreated, 
  sendError, 
  sendValidationError 
} = require('../utils/response');

/**
 * List all sports
 * GET /api/v1/sports
 */
const listSports = async (req, res, next) => {
  try {
    const { isActive } = req.query;

    // Parse isActive filter (default: true for active sports)
    const filterActive = isActive === undefined ? true : isActive === 'true';

    const sports = await sportService.getAllSports({
      isActive: filterActive
    });

    return sendSuccess(res, sports, 'Sports retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get sport details by ID
 * GET /api/v1/sports/:id
 */
const getSportDetails = async (req, res, next) => {
  try {
    const sportId = parseInt(req.params.id, 10);

    if (isNaN(sportId)) {
      return sendValidationError(res, 'Invalid sport ID');
    }

    const sport = await sportService.getSportById(sportId);

    return sendSuccess(res, sport, 'Sport details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new sport
 * POST /api/v1/sports
 * Note: For MVP, this is optional as sports are mostly static
 * Requires authentication and platform_admin role
 * Sports are global/shared resources, so only platform admins can create them
 */
const createSport = async (req, res, next) => {
  try {
    const { name, description, iconUrl } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return sendValidationError(res, 'Sport name is required');
    }

    // Validate iconUrl format if provided
    if (iconUrl && typeof iconUrl !== 'string') {
      return sendValidationError(res, 'Icon URL must be a string');
    }

    // Create sport
    const sport = await sportService.createSport({
      name,
      description,
      iconUrl
    });

    return sendCreated(res, sport, 'Sport created successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listSports,
  getSportDetails,
  createSport
};

