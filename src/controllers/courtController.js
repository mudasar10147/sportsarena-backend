/**
 * Court Controller
 * 
 * Handles HTTP requests for court-related operations
 */

const courtService = require('../services/courtService');
const { 
  sendSuccess, 
  sendCreated, 
  sendError, 
  sendValidationError 
} = require('../utils/response');

/**
 * Get all courts for a facility
 * GET /api/v1/facilities/:id/courts
 */
const getFacilityCourts = async (req, res, next) => {
  try {
    const facilityId = parseInt(req.params.id, 10);
    const { isActive } = req.query;

    if (isNaN(facilityId)) {
      return sendValidationError(res, 'Invalid facility ID');
    }

    // Parse isActive filter (default: true for active courts)
    const filterActive = isActive === undefined ? true : isActive === 'true';

    const courts = await courtService.getCourtsByFacility(facilityId, {
      isActive: filterActive
    });

    return sendSuccess(res, courts, 'Facility courts retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new court for a facility
 * POST /api/v1/facilities/:id/courts
 * Requires authentication and facility_admin role (must be facility owner)
 */
const createCourt = async (req, res, next) => {
  try {
    const facilityId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { sportId, name, pricePerHour, description, isIndoor } = req.body;

    if (isNaN(facilityId)) {
      return sendValidationError(res, 'Invalid facility ID');
    }

    // Validation
    if (!sportId || !name || pricePerHour === undefined) {
      return sendValidationError(res, 'Sport ID, name, and price per hour are required');
    }

    const parsedSportId = parseInt(sportId, 10);
    if (isNaN(parsedSportId)) {
      return sendValidationError(res, 'Invalid sport ID');
    }

    const parsedPrice = parseFloat(pricePerHour);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return sendValidationError(res, 'Price per hour must be a positive number');
    }

    // Validate isIndoor if provided
    if (isIndoor !== undefined && typeof isIndoor !== 'boolean') {
      return sendValidationError(res, 'isIndoor must be a boolean');
    }

    // Create court
    const court = await courtService.createCourt(
      facilityId,
      {
        sportId: parsedSportId,
        name: name.trim(),
        pricePerHour: parsedPrice,
        description,
        isIndoor
      },
      userId
    );

    return sendCreated(res, court, 'Court created successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update court details
 * PUT /api/v1/courts/:id
 * Requires authentication and facility_admin role (must be facility owner)
 */
const updateCourt = async (req, res, next) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const userId = req.userId;

    if (isNaN(courtId)) {
      return sendValidationError(res, 'Invalid court ID');
    }

    const { name, description, pricePerHour, isIndoor, isActive } = req.body;

    // Build update data (only include provided fields)
    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return sendValidationError(res, 'Court name cannot be empty');
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) updateData.description = description;
    if (pricePerHour !== undefined) {
      const parsedPrice = parseFloat(pricePerHour);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return sendValidationError(res, 'Price per hour must be a positive number');
      }
      updateData.pricePerHour = parsedPrice;
    }
    if (isIndoor !== undefined) {
      if (typeof isIndoor !== 'boolean') {
        return sendValidationError(res, 'isIndoor must be a boolean');
      }
      updateData.isIndoor = isIndoor;
    }
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return sendValidationError(res, 'isActive must be a boolean');
      }
      updateData.isActive = isActive;
    }

    // At least one field must be provided
    if (Object.keys(updateData).length === 0) {
      return sendValidationError(res, 'At least one field must be provided for update');
    }

    // Update court
    const court = await courtService.updateCourt(courtId, updateData, userId);

    return sendSuccess(res, court, 'Court updated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFacilityCourts,
  createCourt,
  updateCourt
};

