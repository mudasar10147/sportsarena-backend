/**
 * Booking Controller
 * 
 * Handles HTTP requests for booking-related operations
 * Bookings are created with 'pending' status and must be confirmed.
 */

const bookingService = require('../services/bookingService');
const transactionSafeBookingService = require('../services/transactionSafeBookingService');
const bookingPaymentProofService = require('../services/bookingPaymentProofService');
const imageService = require('../services/imageService');
const s3Service = require('../services/s3Service');
const Booking = require('../models/Booking');
const timeNorm = require('../utils/timeNormalization');
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
 * Booking is created with 'pending' status and must be accepted/rejected by facility owner
 * 
 * Request body:
 * {
 *   "courtId": 5,
 *   "date": "2024-01-15",
 *   "startTime": "10:00",
 *   "endTime": "11:30"
 * }
 */
const createBooking = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { courtId, date, startTime, endTime, paymentReference } = req.body;

    // Validate required fields
    if (!courtId || !date || !startTime || !endTime) {
      return sendValidationError(res, 'Missing required fields: courtId, date, startTime, endTime');
    }

    // Validate and parse date (YYYY-MM-DD format)
    // Parse date string to avoid timezone issues
    const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      return sendValidationError(res, 'Invalid date format. Expected YYYY-MM-DD (e.g., 2025-12-31)');
    }

    // Create date in local timezone to avoid timezone conversion issues
    const [year, month, day] = dateMatch.slice(1).map(Number);
    const bookingDate = new Date(year, month - 1, day); // month is 0-indexed
    
    // Validate date is valid
    if (isNaN(bookingDate.getTime())) {
      return sendValidationError(res, 'Invalid date provided');
    }

    // Convert times to minutes since midnight
    const startTimeMinutes = timeNorm.toMinutesSinceMidnight(startTime);
    const endTimeMinutes = timeNorm.toMinutesSinceMidnight(endTime);

    // Create booking using transaction-safe service
    const booking = await transactionSafeBookingService.createTransactionSafeBooking(
      userId,
      parseInt(courtId, 10),
      bookingDate,
      startTimeMinutes,
      endTimeMinutes,
      { paymentReference }
    );

    return sendCreated(res, booking, 'Booking created successfully');
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

/**
 * Upload payment proof image for a booking
 * PUT /api/v1/bookings/:id/payment-proof
 * Requires authentication (must be booking owner)
 * 
 * This endpoint:
 * 1. Creates image record for payment proof
 * 2. Generates pre-signed URL for S3 upload
 * 3. Links image to booking
 * 
 * Request body:
 * {
 *   "contentType": "image/jpeg"
 * }
 */
const uploadPaymentProof = async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { contentType } = req.body;

    if (isNaN(bookingId)) {
      return sendValidationError(res, 'Invalid booking ID');
    }

    if (!contentType) {
      return sendValidationError(res, 'Content type is required');
    }

    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(contentType.toLowerCase())) {
      return sendValidationError(
        res,
        `Invalid content type. Must be one of: ${allowedTypes.join(', ')}`
      );
    }

    // Step 1: Verify booking exists and user owns it (before creating image)
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return sendError(res, 'Booking not found', 404, 'BOOKING_NOT_FOUND');
    }
    if (booking.userId !== userId) {
      return sendError(res, 'You can only upload payment proof for your own bookings', 403, 'FORBIDDEN');
    }
    if (booking.bookingStatus !== 'pending') {
      return sendError(res, 'Payment proof can only be uploaded for pending bookings', 400, 'INVALID_BOOKING_STATUS');
    }

    // Step 2: Create image record for payment proof
    const image = await imageService.createImage(
      {
        entityType: 'booking',
        entityId: bookingId,
        imageType: 'payment_proof',
        isPrimary: true
      },
      userId,
      req.user.role || 'user'
    );

    // Step 3: Generate pre-signed URL for S3 upload
    const presignedData = await s3Service.generatePresignedUploadUrl(
      image.id,
      contentType,
      userId
    );

    // Step 4: Link image to booking
    const updatedBooking = await bookingPaymentProofService.linkPaymentProof(
      bookingId,
      userId,
      image.id
    );

    // Return booking with upload instructions
    return sendSuccess(res, {
      booking: {
        id: updatedBooking.id,
        paymentProofImageId: updatedBooking.paymentProofImageId
      },
      image: {
        id: image.id,
        ...presignedData
      }
    }, 'Payment proof upload initiated. Use the uploadUrl to upload the image file.');
  } catch (error) {
    next(error);
  }
};

/**
 * Remove payment proof image from a booking
 * DELETE /api/v1/bookings/:id/payment-proof
 * Requires authentication (must be booking owner)
 */
const removePaymentProof = async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.id, 10);
    const userId = req.userId;

    if (isNaN(bookingId)) {
      return sendValidationError(res, 'Invalid booking ID');
    }

    const booking = await bookingPaymentProofService.removePaymentProof(bookingId, userId);

    return sendSuccess(res, booking, 'Payment proof removed successfully');
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
  rejectBooking,
  uploadPaymentProof,
  removePaymentProof
};

