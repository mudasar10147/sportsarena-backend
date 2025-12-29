/**
 * Booking Controller
 * 
 * Handles HTTP requests for booking-related operations
 * Bookings are created with 'pending' status and must be confirmed.
 */

const bookingService = require('../services/bookingService');
const { 
  sendSuccess, 
  sendCreated, 
  sendError, 
  sendValidationError 
} = require('../utils/response');

/**
 * Create a new booking
 * POST /api/v1/bookings
 * Requires authentication
 * Booking is created with 'pending' status and must be confirmed via PUT /bookings/:id/confirm
 */
const createBooking = async (req, res, next) => {
  try {
    // Time slots have been removed - will be recreated from scratch
    return sendValidationError(res, 'Time slots have been removed. Please recreate time slots from scratch.');
  } catch (error) {
    next(error);
  }
};

/**
 * Get booking details
 * GET /api/v1/bookings/:id
 * Requires authentication (must be booking owner)
 */
const getBookingDetails = async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const userId = req.userId;

    if (isNaN(bookingId)) {
      return sendValidationError(res, 'Invalid booking ID');
    }

    // Get booking details (with ownership check)
    const booking = await bookingService.getBookingDetails(bookingId, userId);

    return sendSuccess(res, booking, 'Booking details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm a pending booking (DEPRECATED)
 * PUT /api/v1/bookings/:id/confirm
 * Requires authentication (must be booking owner)
 * 
 * @deprecated This endpoint is deprecated. Facility owners should use PUT /bookings/:id/accept instead.
 */
const confirmBooking = async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { paymentReference } = req.body;

    if (isNaN(bookingId)) {
      return sendValidationError(res, 'Invalid booking ID');
    }

    // Confirm booking (with policy checks)
    const booking = await bookingService.confirmBooking(bookingId, userId, paymentReference);

    return sendSuccess(res, booking, 'Booking confirmed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a booking
 * PUT /api/v1/bookings/:id/cancel
 * Requires authentication (must be booking owner)
 */
const cancelBooking = async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { cancellationReason } = req.body;

    if (isNaN(bookingId)) {
      return sendValidationError(res, 'Invalid booking ID');
    }

    // Cancel booking (with policy checks)
    const booking = await bookingService.cancelBooking(bookingId, userId, cancellationReason);

    return sendSuccess(res, booking, 'Booking cancelled successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending bookings for a facility (facility owner only)
 * GET /api/v1/facilities/:id/bookings/pending
 * Requires authentication and facility_admin role (must be facility owner)
 */
const getPendingBookingsForFacility = async (req, res, next) => {
  try {
    const facilityId = parseInt(req.params.id, 10);
    const ownerId = req.userId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = (page - 1) * limit;

    if (isNaN(facilityId)) {
      return sendValidationError(res, 'Invalid facility ID');
    }

    if (page < 1) {
      return sendValidationError(res, 'Page must be greater than 0');
    }

    if (limit < 1 || limit > 100) {
      return sendValidationError(res, 'Limit must be between 1 and 100');
    }

    // Get pending bookings (with ownership check)
    const result = await bookingService.getPendingBookingsForFacility(
      facilityId,
      ownerId,
      { limit, offset }
    );

    return sendSuccess(res, result, 'Pending bookings retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Accept a pending booking (facility owner only)
 * PUT /api/v1/bookings/:id/accept
 * Requires authentication and facility_admin role (must be facility owner)
 */
const acceptBooking = async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const ownerId = req.userId;
    const { paymentReference } = req.body;

    if (isNaN(bookingId)) {
      return sendValidationError(res, 'Invalid booking ID');
    }

    // Accept booking (with ownership check)
    const booking = await bookingService.acceptBooking(bookingId, ownerId, paymentReference);

    return sendSuccess(res, booking, 'Booking accepted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Reject a pending booking (facility owner only)
 * PUT /api/v1/bookings/:id/reject
 * Requires authentication and facility_admin role (must be facility owner)
 */
const rejectBooking = async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const ownerId = req.userId;
    const { rejectionReason } = req.body;

    if (isNaN(bookingId)) {
      return sendValidationError(res, 'Invalid booking ID');
    }

    // Reject booking (with ownership check and slot release)
    const booking = await bookingService.rejectBooking(bookingId, ownerId, rejectionReason);

    return sendSuccess(res, booking, 'Booking rejected successfully. Time slot is now available.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  getBookingDetails,
  confirmBooking,
  cancelBooking,
  getPendingBookingsForFacility,
  acceptBooking,
  rejectBooking
};

