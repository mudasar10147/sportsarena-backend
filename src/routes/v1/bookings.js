/**
 * Booking Routes
 * 
 * Following MVP_FULL_ROADMAP.md Step 2: Booking Routes
 * 
 * Endpoints:
 * - POST   /bookings              - Create a new booking (user) - status: pending
 * - GET    /bookings/:id          - Get booking details
 * - PUT    /bookings/:id/confirm  - Confirm a pending booking (DEPRECATED: Use accept/reject by facility owner)
 * - PUT    /bookings/:id/accept   - Accept a pending booking (facility owner only)
 * - PUT    /bookings/:id/reject   - Reject a pending booking (facility owner only)
 * - PUT    /bookings/:id/cancel   - Cancel a booking (if allowed by policy)
 * 
 * Note: GET /users/bookings is already implemented in user routes
 * Note: GET /facilities/:id/bookings/pending is for facility owners to view pending bookings
 * 
 * Important: Backend handles slot locking to prevent double booking.
 * Bookings are created with 'pending' status and must be accepted/rejected by facility owner.
 */

const express = require('express');
const router = express.Router();
const bookingController = require('../../controllers/bookingController');
const { authenticate } = require('../../middleware/auth');
const { requireFacilityAdmin } = require('../../middleware/authorization');

// All routes require authentication
router.post('/', authenticate, bookingController.createBooking);
router.get('/:id', authenticate, bookingController.getBookingDetails);
router.put('/:id/confirm', authenticate, bookingController.confirmBooking); // DEPRECATED
router.put('/:id/accept', authenticate, requireFacilityAdmin, bookingController.acceptBooking);
router.put('/:id/reject', authenticate, requireFacilityAdmin, bookingController.rejectBooking);
router.put('/:id/cancel', authenticate, bookingController.cancelBooking);

module.exports = router;

