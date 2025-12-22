/**
 * FacilitySport Controller
 * 
 * Handles HTTP requests for facility-sport relationship operations
 */

const facilitySportService = require('../services/facilitySportService');
const { 
  sendSuccess, 
  sendCreated, 
  sendError, 
  sendValidationError 
} = require('../utils/response');

/**
 * Get sports offered by a facility
 * GET /api/v1/facilities/:id/sports
 */
const getFacilitySports = async (req, res, next) => {
  try {
    const facilityId = parseInt(req.params.id, 10);
    const { isActive } = req.query;

    if (isNaN(facilityId)) {
      return sendValidationError(res, 'Invalid facility ID');
    }

    // Parse isActive filter (default: true for active sports)
    const filterActive = isActive === undefined ? true : isActive === 'true';

    const sports = await facilitySportService.getSportsByFacility(facilityId, {
      isActive: filterActive
    });

    return sendSuccess(res, sports, 'Facility sports retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Assign a sport to a facility
 * POST /api/v1/facilities/:id/sports
 * Requires authentication and facility_admin role (must be facility owner)
 */
const assignSportToFacility = async (req, res, next) => {
  try {
    const facilityId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { sportId } = req.body;

    if (isNaN(facilityId)) {
      return sendValidationError(res, 'Invalid facility ID');
    }

    // Validation
    if (!sportId) {
      return sendValidationError(res, 'Sport ID is required');
    }

    const parsedSportId = parseInt(sportId, 10);
    if (isNaN(parsedSportId)) {
      return sendValidationError(res, 'Invalid sport ID');
    }

    // Assign sport to facility
    const facilitySport = await facilitySportService.assignSportToFacility(
      facilityId,
      parsedSportId,
      userId
    );

    return sendCreated(res, facilitySport, 'Sport assigned to facility successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFacilitySports,
  assignSportToFacility
};

