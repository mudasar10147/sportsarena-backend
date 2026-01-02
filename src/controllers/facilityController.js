/**
 * Facility Controller
 * 
 * Handles HTTP requests for facility-related operations
 */

const facilityService = require('../services/facilityService');
const { 
  sendSuccess, 
  sendCreated, 
  sendError, 
  sendValidationError 
} = require('../utils/response');
const { parsePagination, sendPaginatedResponse } = require('../utils/pagination');

/**
 * List all facilities with optional filters
 * GET /api/v1/facilities
 */
const listFacilities = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { city, sportId, latitude, longitude, radiusKm, date, startTime, endTime } = req.query;

    // Build filters
    const filters = {
      page,
      limit,
      city: city || undefined,
      sportId: sportId ? parseInt(sportId, 10) : undefined,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
      date: date || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined
    };

    // Validate availability parameters (all or none)
    if ((date || startTime || endTime) && (!date || !startTime || !endTime)) {
      return sendValidationError(
        res,
        'For availability filtering, all of date, startTime, and endTime must be provided'
      );
    }

    // Validate date format if provided
    if (date) {
      const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateMatch) {
        return sendValidationError(res, 'Invalid date format. Expected YYYY-MM-DD (e.g., 2025-12-31)');
      }
    }

    // Validate time format if provided
    if (startTime) {
      const timeMatch = startTime.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/);
      if (!timeMatch) {
        return sendValidationError(res, 'Invalid startTime format. Expected HH:MM (e.g., 13:00)');
      }
    }

    if (endTime) {
      const timeMatch = endTime.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/);
      if (!timeMatch) {
        return sendValidationError(res, 'Invalid endTime format. Expected HH:MM (e.g., 16:00)');
      }
    }

    // Validate location-based search
    if ((latitude || longitude || radiusKm) && (!latitude || !longitude || !radiusKm)) {
      return sendValidationError(
        res,
        'For location-based search, all of latitude, longitude, and radiusKm must be provided'
      );
    }

    // Get facilities
    const result = await facilityService.getAllFacilities(filters);

    return sendPaginatedResponse(
      res,
      result.facilities,
      result.page,
      result.limit,
      result.total,
      'Facilities retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get facility details with courts and sports
 * GET /api/v1/facilities/:id
 */
const getFacilityDetails = async (req, res, next) => {
  try {
    const facilityId = parseInt(req.params.id, 10);

    if (isNaN(facilityId)) {
      return sendValidationError(res, 'Invalid facility ID');
    }

    // Extract optional location parameters for distance calculation
    const { latitude, longitude } = req.query;
    const locationParams = {};
    
    if (latitude !== undefined || longitude !== undefined) {
      if (latitude === undefined || longitude === undefined) {
        return sendValidationError(
          res,
          'Both latitude and longitude must be provided together for distance calculation'
        );
      }
      
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return sendValidationError(res, 'Invalid latitude. Must be between -90 and 90');
      }
      
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return sendValidationError(res, 'Invalid longitude. Must be between -180 and 180');
      }
      
      locationParams.latitude = lat;
      locationParams.longitude = lng;
    }

    const facility = await facilityService.getFacilityDetails(facilityId, locationParams);

    return sendSuccess(res, facility, 'Facility details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new facility
 * POST /api/v1/facilities
 * Requires authentication and facility_admin role
 */
const createFacility = async (req, res, next) => {
  try {
    const userId = req.userId;
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
    } = req.body;

    // Validation
    if (!name || !address) {
      return sendValidationError(res, 'Name and address are required');
    }

    // Validate photos array if provided
    if (photos !== undefined && !Array.isArray(photos)) {
      return sendValidationError(res, 'Photos must be an array of URLs');
    }

    // Validate opening hours object if provided
    if (openingHours !== undefined && typeof openingHours !== 'object') {
      return sendValidationError(res, 'Opening hours must be an object');
    }

    // Validate coordinates if provided
    if (latitude !== undefined && (isNaN(latitude) || latitude < -90 || latitude > 90)) {
      return sendValidationError(res, 'Invalid latitude. Must be between -90 and 90');
    }

    if (longitude !== undefined && (isNaN(longitude) || longitude < -180 || longitude > 180)) {
      return sendValidationError(res, 'Invalid longitude. Must be between -180 and 180');
    }

    // Create facility
    const facility = await facilityService.createFacility({
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
    }, userId);

    return sendCreated(res, facility, 'Facility created successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update facility details
 * PUT /api/v1/facilities/:id
 * Requires authentication and facility_admin role (must be owner)
 */
const updateFacility = async (req, res, next) => {
  try {
    const facilityId = parseInt(req.params.id, 10);
    const userId = req.userId;

    if (isNaN(facilityId)) {
      return sendValidationError(res, 'Invalid facility ID');
    }

    const {
      name,
      description,
      address,
      city,
      latitude,
      longitude,
      contactPhone,
      contactEmail,
      photos,
      openingHours,
      isActive
    } = req.body;

    // Build update data (only include provided fields)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (latitude !== undefined) {
      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        return sendValidationError(res, 'Invalid latitude. Must be between -90 and 90');
      }
      updateData.latitude = latitude;
    }
    if (longitude !== undefined) {
      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        return sendValidationError(res, 'Invalid longitude. Must be between -180 and 180');
      }
      updateData.longitude = longitude;
    }
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
    if (photos !== undefined) {
      if (!Array.isArray(photos)) {
        return sendValidationError(res, 'Photos must be an array of URLs');
      }
      updateData.photos = photos;
    }
    if (openingHours !== undefined) {
      if (typeof openingHours !== 'object') {
        return sendValidationError(res, 'Opening hours must be an object');
      }
      updateData.openingHours = openingHours;
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

    // Update facility
    const facility = await facilityService.updateFacility(facilityId, updateData, userId);

    return sendSuccess(res, facility, 'Facility updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get closest arenas to a given location with pagination
 * GET /api/v1/facilities/closest
 */
const getClosestArenas = async (req, res, next) => {
  try {
    const { latitude, longitude, page, limit } = req.query;

    // Validate required parameters
    if (!latitude || !longitude) {
      return sendValidationError(
        res,
        'Both latitude and longitude are required'
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Validate coordinate ranges
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return sendValidationError(res, 'Invalid latitude. Must be between -90 and 90');
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return sendValidationError(res, 'Invalid longitude. Must be between -180 and 180');
    }

    // Parse pagination parameters (default page: 1, default limit: 7)
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 7;

    if (isNaN(pageNum) || pageNum < 1) {
      return sendValidationError(res, 'Page must be a positive number');
    }

    if (isNaN(limitNum) || limitNum < 1) {
      return sendValidationError(res, 'Limit must be a positive number');
    }

    // Get closest facilities with pagination
    const result = await facilityService.getClosestFacilities(lat, lng, pageNum, limitNum);

    return sendPaginatedResponse(
      res,
      result.facilities,
      result.page,
      result.limit,
      result.total,
      `Closest arenas retrieved successfully`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of unique cities where facilities exist
 * GET /api/v1/facilities/cities
 */
const getCities = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    
    // Parse isActive parameter (default: true)
    const filterActive = isActive === undefined ? true : isActive === 'true' || isActive === true;

    const cities = await facilityService.getCities({ isActive: filterActive });

    return sendSuccess(res, cities, 'Cities retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listFacilities,
  getFacilityDetails,
  createFacility,
  updateFacility,
  getClosestArenas,
  getCities
};

