/**
 * Booking Service
 * 
 * Business logic for booking operations
 * Bookings are created with 'pending' status and must be confirmed.
 */

const Booking = require('../models/Booking');
const TimeSlot = require('../models/TimeSlot');
const Court = require('../models/Court');
const Facility = require('../models/Facility');
const { pool } = require('../config/database');

/**
 * Calculate booking price based on time slot duration and court price
 * @param {Object} timeSlot - Time slot object
 * @param {Object} court - Court object
 * @returns {number} Final price in PKR
 */
const calculateBookingPrice = (timeSlot, court) => {
  const startTime = new Date(timeSlot.startTime);
  const endTime = new Date(timeSlot.endTime);
  
  // Calculate duration in hours
  const durationMs = endTime - startTime;
  const durationHours = durationMs / (1000 * 60 * 60);
  
  // Calculate price: court price per hour * duration
  const price = court.pricePerHour * durationHours;
  
  return Math.round(price * 100) / 100; // Round to 2 decimal places
};

/**
 * Create a new booking with slot locking to prevent double booking
 * @param {number} userId - User ID
 * @param {number} timeSlotId - Time slot ID
 * @returns {Promise<Object>} Created booking object
 * @throws {Error} If slot not available, validation fails, or booking fails
 */
const createBooking = async (userId, timeSlotId) => {
  const client = await pool.connect();
  
  try {
    // Start transaction for atomicity
    await client.query('BEGIN');

    // Check if time slot exists and is available (with row lock)
    const slotQuery = `
      SELECT id, court_id, start_time, end_time, status
      FROM time_slots
      WHERE id = $1
      FOR UPDATE
    `;
    const slotResult = await client.query(slotQuery, [timeSlotId]);
    
    if (slotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Time slot not found');
      error.statusCode = 404;
      error.errorCode = 'TIME_SLOT_NOT_FOUND';
      throw error;
    }

    const timeSlot = {
      id: slotResult.rows[0].id,
      courtId: slotResult.rows[0].court_id,
      startTime: slotResult.rows[0].start_time,
      endTime: slotResult.rows[0].end_time,
      status: slotResult.rows[0].status
    };

    // Check if slot is available
    if (timeSlot.status !== 'available') {
      await client.query('ROLLBACK');
      const error = new Error('Time slot is not available for booking');
      error.statusCode = 400;
      error.errorCode = 'SLOT_NOT_AVAILABLE';
      throw error;
    }

    // Check if slot is already booked (double-check within transaction)
    const bookingCheckQuery = `
      SELECT id, booking_status
      FROM bookings
      WHERE time_slot_id = $1 AND booking_status != 'cancelled'
      LIMIT 1
    `;
    const bookingCheckResult = await client.query(bookingCheckQuery, [timeSlotId]);
    if (bookingCheckResult.rows.length > 0) {
      await client.query('ROLLBACK');
      const error = new Error('Time slot is already booked');
      error.statusCode = 400;
      error.errorCode = 'SLOT_ALREADY_BOOKED';
      throw error;
    }

    // Get court to calculate price
    const court = await Court.findById(timeSlot.courtId);
    if (!court) {
      await client.query('ROLLBACK');
      const error = new Error('Court not found');
      error.statusCode = 404;
      error.errorCode = 'COURT_NOT_FOUND';
      throw error;
    }

    // Calculate final price
    const finalPrice = calculateBookingPrice(timeSlot, court);

    // Create booking with status 'pending' (requires confirmation)
    const bookingQuery = `
      INSERT INTO bookings (user_id, time_slot_id, final_price, booking_status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id, user_id, time_slot_id, final_price, booking_status, payment_reference, cancellation_reason, created_at, updated_at
    `;
    const bookingResult = await client.query(bookingQuery, [userId, timeSlotId, finalPrice]);
    
    // Format booking using the model's format method
    const bookingRow = bookingResult.rows[0];
    const booking = {
      id: bookingRow.id,
      userId: bookingRow.user_id,
      timeSlotId: bookingRow.time_slot_id,
      finalPrice: parseFloat(bookingRow.final_price),
      bookingStatus: bookingRow.booking_status,
      paymentReference: bookingRow.payment_reference,
      cancellationReason: bookingRow.cancellation_reason,
      createdAt: new Date(bookingRow.created_at),
      updatedAt: new Date(bookingRow.updated_at)
    };

    // Mark time slot as booked (prevent double booking)
    await client.query(
      'UPDATE time_slots SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['booked', timeSlotId]
    );

    // Commit transaction
    await client.query('COMMIT');

    return booking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get booking details by ID
 * @param {number} bookingId - Booking ID
 * @param {number} userId - User ID (for ownership check)
 * @returns {Promise<Object>} Booking object with related data
 * @throws {Error} If booking not found or user not authorized
 */
const getBookingDetails = async (bookingId, userId) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    error.errorCode = 'BOOKING_NOT_FOUND';
    throw error;
  }

  // Check if user owns the booking
  if (booking.userId !== userId) {
    const error = new Error('You can only view your own bookings');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Get time slot details
  const timeSlot = await TimeSlot.findById(booking.timeSlotId);
  if (!timeSlot) {
    const error = new Error('Time slot not found');
    error.statusCode = 404;
    error.errorCode = 'TIME_SLOT_NOT_FOUND';
    throw error;
  }

  // Get court details
  const court = await Court.findById(timeSlot.courtId);
  if (!court) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }

  return {
    ...booking,
    timeSlot: {
      id: timeSlot.id,
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime,
      status: timeSlot.status
    },
    court: {
      id: court.id,
      name: court.name,
      description: court.description,
      pricePerHour: court.pricePerHour,
      isIndoor: court.isIndoor
    }
  };
};

/**
 * Cancel a booking
 * @param {number} bookingId - Booking ID
 * @param {number} userId - User ID (for ownership check)
 * @param {string} [cancellationReason] - Reason for cancellation
 * @returns {Promise<Object>} Updated booking object
 * @throws {Error} If booking not found, user not authorized, or cancellation not allowed
 */
const cancelBooking = async (bookingId, userId, cancellationReason = null) => {
  // Get booking
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    error.errorCode = 'BOOKING_NOT_FOUND';
    throw error;
  }

  // Check if user owns the booking
  if (booking.userId !== userId) {
    const error = new Error('You can only cancel your own bookings');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Check if booking can be cancelled
  if (booking.bookingStatus === 'cancelled') {
    const error = new Error('Booking is already cancelled');
    error.statusCode = 400;
    error.errorCode = 'ALREADY_CANCELLED';
    throw error;
  }

  if (booking.bookingStatus === 'completed') {
    const error = new Error('Cannot cancel a completed booking');
    error.statusCode = 400;
    error.errorCode = 'CANNOT_CANCEL_COMPLETED';
    throw error;
  }

  // Get time slot to check if it's in the past
  const timeSlot = await TimeSlot.findById(booking.timeSlotId);
  if (!timeSlot) {
    const error = new Error('Time slot not found');
    error.statusCode = 404;
    error.errorCode = 'TIME_SLOT_NOT_FOUND';
    throw error;
  }

  // Check if slot time has passed (basic policy check)
  const now = new Date();
  const slotStartTime = new Date(timeSlot.startTime);
  
  if (slotStartTime < now) {
    const error = new Error('Cannot cancel a booking for a time slot that has already started');
    error.statusCode = 400;
    error.errorCode = 'CANNOT_CANCEL_PAST_SLOT';
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Cancel booking
    const cancelledBooking = await Booking.cancel(bookingId, cancellationReason);

    // Mark time slot as available again (within transaction)
    const slotUpdateResult = await client.query(
      'UPDATE time_slots SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status',
      ['available', booking.timeSlotId]
    );

    // Verify the slot was updated
    if (slotUpdateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Failed to update time slot status');
      error.statusCode = 500;
      error.errorCode = 'SLOT_UPDATE_FAILED';
      throw error;
    }

    // Double-check the status was set correctly
    if (slotUpdateResult.rows[0].status !== 'available') {
      await client.query('ROLLBACK');
      const error = new Error('Time slot status was not set to available');
      error.statusCode = 500;
      error.errorCode = 'SLOT_STATUS_UPDATE_FAILED';
      throw error;
    }

    await client.query('COMMIT');

    return cancelledBooking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Confirm a pending booking
 * @param {number} bookingId - Booking ID
 * @param {number} userId - User ID (for ownership check)
 * @param {string} [paymentReference] - Payment transaction reference
 * @returns {Promise<Object>} Updated booking object
 * @throws {Error} If booking not found, user not authorized, or confirmation not allowed
 */
const confirmBooking = async (bookingId, userId, paymentReference = null) => {
  // Get booking
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    error.errorCode = 'BOOKING_NOT_FOUND';
    throw error;
  }

  // Check if user owns the booking
  if (booking.userId !== userId) {
    const error = new Error('You can only confirm your own bookings');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Check if booking can be confirmed
  if (booking.bookingStatus === 'confirmed') {
    const error = new Error('Booking is already confirmed');
    error.statusCode = 400;
    error.errorCode = 'ALREADY_CONFIRMED';
    throw error;
  }

  if (booking.bookingStatus === 'cancelled') {
    const error = new Error('Cannot confirm a cancelled booking');
    error.statusCode = 400;
    error.errorCode = 'CANNOT_CONFIRM_CANCELLED';
    throw error;
  }

  if (booking.bookingStatus === 'completed') {
    const error = new Error('Cannot confirm a completed booking');
    error.statusCode = 400;
    error.errorCode = 'CANNOT_CONFIRM_COMPLETED';
    throw error;
  }

  // Get time slot to verify it still exists and is valid
  const timeSlot = await TimeSlot.findById(booking.timeSlotId);
  if (!timeSlot) {
    const error = new Error('Time slot not found');
    error.statusCode = 404;
    error.errorCode = 'TIME_SLOT_NOT_FOUND';
    throw error;
  }

  // Check if slot time has passed
  const now = new Date();
  const slotStartTime = new Date(timeSlot.startTime);
  
  if (slotStartTime < now) {
    const error = new Error('Cannot confirm a booking for a time slot that has already started');
    error.statusCode = 400;
    error.errorCode = 'CANNOT_CONFIRM_PAST_SLOT';
    throw error;
  }

  // Verify slot is still booked (should be, but double-check)
  if (timeSlot.status !== 'booked') {
    const error = new Error('Time slot is not in booked status');
    error.statusCode = 400;
    error.errorCode = 'SLOT_NOT_BOOKED';
    throw error;
  }

  // Confirm booking (status remains 'booked' for the slot)
  const confirmedBooking = await Booking.confirm(bookingId, paymentReference);

  return confirmedBooking;
};

/**
 * Get pending bookings for a facility (for facility owner)
 * @param {number} facilityId - Facility ID
 * @param {number} ownerId - Facility owner user ID (for authorization check)
 * @param {Object} [options={}] - Query options
 * @param {number} [options.limit=50] - Number of records to return
 * @param {number} [options.offset=0] - Number of records to skip
 * @returns {Promise<Object>} Object with bookings array and total count
 * @throws {Error} If facility not found or user is not the owner
 */
const getPendingBookingsForFacility = async (facilityId, ownerId, options = {}) => {
  const { limit = 50, offset = 0 } = options;

  // Verify facility exists and user is the owner
  const facility = await Facility.findById(facilityId);
  if (!facility) {
    const error = new Error('Facility not found');
    error.statusCode = 404;
    error.errorCode = 'FACILITY_NOT_FOUND';
    throw error;
  }

  if (facility.ownerId !== ownerId) {
    const error = new Error('You can only view bookings for your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Get pending bookings for this facility
  // Join: bookings -> time_slots -> courts -> facilities
  const query = `
    SELECT 
      b.id, b.user_id, b.time_slot_id, b.final_price, b.booking_status,
      b.payment_reference, b.cancellation_reason, b.created_at, b.updated_at,
      ts.start_time, ts.end_time,
      c.id as court_id, c.name as court_name, c.price_per_hour,
      u.first_name, u.last_name, u.email, u.phone
    FROM bookings b
    INNER JOIN time_slots ts ON b.time_slot_id = ts.id
    INNER JOIN courts c ON ts.court_id = c.id
    INNER JOIN facilities f ON c.facility_id = f.id
    INNER JOIN users u ON b.user_id = u.id
    WHERE f.id = $1 AND b.booking_status = 'pending'
    ORDER BY b.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM bookings b
    INNER JOIN time_slots ts ON b.time_slot_id = ts.id
    INNER JOIN courts c ON ts.court_id = c.id
    INNER JOIN facilities f ON c.facility_id = f.id
    WHERE f.id = $1 AND b.booking_status = 'pending'
  `;

  const [result, countResult] = await Promise.all([
    pool.query(query, [facilityId, limit, offset]),
    pool.query(countQuery, [facilityId])
  ]);

  const bookings = result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    timeSlotId: row.time_slot_id,
    finalPrice: parseFloat(row.final_price),
    bookingStatus: row.booking_status,
    paymentReference: row.payment_reference,
    cancellationReason: row.cancellation_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    timeSlot: {
      id: row.time_slot_id,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time)
    },
    court: {
      id: row.court_id,
      name: row.court_name,
      pricePerHour: parseFloat(row.price_per_hour)
    },
    user: {
      id: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone
    }
  }));

  return {
    bookings,
    total: parseInt(countResult.rows[0].total),
    limit,
    offset
  };
};

/**
 * Accept a pending booking (by facility owner)
 * @param {number} bookingId - Booking ID
 * @param {number} ownerId - Facility owner user ID (for authorization check)
 * @param {string} [paymentReference] - Payment transaction reference
 * @returns {Promise<Object>} Updated booking object
 * @throws {Error} If booking not found, user not authorized, or acceptance not allowed
 */
const acceptBooking = async (bookingId, ownerId, paymentReference = null) => {
  // Get booking with facility information
  const bookingQuery = `
    SELECT 
      b.id, b.user_id, b.time_slot_id, b.final_price, b.booking_status,
      b.payment_reference, b.cancellation_reason, b.created_at, b.updated_at,
      f.id as facility_id, f.owner_id
    FROM bookings b
    INNER JOIN time_slots ts ON b.time_slot_id = ts.id
    INNER JOIN courts c ON ts.court_id = c.id
    INNER JOIN facilities f ON c.facility_id = f.id
    WHERE b.id = $1
  `;
  const bookingResult = await pool.query(bookingQuery, [bookingId]);

  if (bookingResult.rows.length === 0) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    error.errorCode = 'BOOKING_NOT_FOUND';
    throw error;
  }

  const bookingRow = bookingResult.rows[0];

  // Check if user is the facility owner
  if (bookingRow.owner_id !== ownerId) {
    const error = new Error('You can only accept bookings for your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Check if booking can be accepted
  if (bookingRow.booking_status !== 'pending') {
    const error = new Error('Only pending bookings can be accepted');
    error.statusCode = 400;
    error.errorCode = 'CANNOT_ACCEPT_NON_PENDING';
    throw error;
  }

  // Accept booking (status changes to 'confirmed', slot remains 'booked')
  const acceptedBooking = await Booking.accept(bookingId, paymentReference);

  return acceptedBooking;
};

/**
 * Reject a pending booking (by facility owner)
 * @param {number} bookingId - Booking ID
 * @param {number} ownerId - Facility owner user ID (for authorization check)
 * @param {string} [rejectionReason] - Reason for rejection
 * @returns {Promise<Object>} Updated booking object
 * @throws {Error} If booking not found, user not authorized, or rejection not allowed
 */
const rejectBooking = async (bookingId, ownerId, rejectionReason = null) => {
  // Get booking with facility information
  const bookingQuery = `
    SELECT 
      b.id, b.user_id, b.time_slot_id, b.final_price, b.booking_status,
      b.payment_reference, b.cancellation_reason, b.created_at, b.updated_at,
      f.id as facility_id, f.owner_id
    FROM bookings b
    INNER JOIN time_slots ts ON b.time_slot_id = ts.id
    INNER JOIN courts c ON ts.court_id = c.id
    INNER JOIN facilities f ON c.facility_id = f.id
    WHERE b.id = $1
  `;
  const bookingResult = await pool.query(bookingQuery, [bookingId]);

  if (bookingResult.rows.length === 0) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    error.errorCode = 'BOOKING_NOT_FOUND';
    throw error;
  }

  const bookingRow = bookingResult.rows[0];

  // Check if user is the facility owner
  if (bookingRow.owner_id !== ownerId) {
    const error = new Error('You can only reject bookings for your own facilities');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN';
    throw error;
  }

  // Check if booking can be rejected
  if (bookingRow.booking_status !== 'pending') {
    const error = new Error('Only pending bookings can be rejected');
    error.statusCode = 400;
    error.errorCode = 'CANNOT_REJECT_NON_PENDING';
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Reject booking
    const rejectedBooking = await Booking.reject(bookingId, rejectionReason);

    // Mark time slot as available again
    const slotUpdateResult = await client.query(
      'UPDATE time_slots SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status',
      ['available', bookingRow.time_slot_id]
    );

    // Verify the slot was updated
    if (slotUpdateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Failed to update time slot status');
      error.statusCode = 500;
      error.errorCode = 'SLOT_UPDATE_FAILED';
      throw error;
    }

    // Double-check the status was set correctly
    if (slotUpdateResult.rows[0].status !== 'available') {
      await client.query('ROLLBACK');
      const error = new Error('Time slot status was not set to available');
      error.statusCode = 500;
      error.errorCode = 'SLOT_STATUS_UPDATE_FAILED';
      throw error;
    }

    await client.query('COMMIT');

    return rejectedBooking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get user's bookings with related details (time slot, court, facility)
 * @param {number} userId - User ID
 * @param {Object} [options={}] - Query options
 * @param {string} [options.status] - Filter by booking status
 * @param {number} [options.limit=50] - Number of records to return
 * @param {number} [options.offset=0] - Number of records to skip
 * @returns {Promise<Object>} Object with bookings array and total count
 */
const getUserBookings = async (userId, options = {}) => {
  const { status, limit = 50, offset = 0 } = options;

  // Build query with joins to get related data
  const conditions = ['b.user_id = $1'];
  const values = [userId];
  let paramCount = 2;

  if (status) {
    conditions.push(`b.booking_status = $${paramCount}`);
    values.push(status);
    paramCount++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT 
      b.id, b.user_id, b.time_slot_id, b.final_price, b.booking_status,
      b.payment_reference, b.cancellation_reason, b.created_at, b.updated_at,
      ts.start_time, ts.end_time, ts.status as slot_status,
      c.id as court_id, c.name as court_name, c.description as court_description,
      c.price_per_hour, c.is_indoor,
      f.id as facility_id, f.name as facility_name, f.address as facility_address,
      f.city as facility_city, f.contact_phone as facility_phone, f.contact_email as facility_email
    FROM bookings b
    INNER JOIN time_slots ts ON b.time_slot_id = ts.id
    INNER JOIN courts c ON ts.court_id = c.id
    INNER JOIN facilities f ON c.facility_id = f.id
    ${whereClause}
    ORDER BY b.created_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM bookings b
    ${whereClause}
  `;

  values.push(limit, offset);
  const [result, countResult] = await Promise.all([
    pool.query(query, values),
    pool.query(countQuery, values.slice(0, -2))
  ]);

  const bookings = result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    timeSlotId: row.time_slot_id,
    finalPrice: parseFloat(row.final_price),
    bookingStatus: row.booking_status,
    paymentReference: row.payment_reference,
    cancellationReason: row.cancellation_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    timeSlot: {
      id: row.time_slot_id,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      status: row.slot_status
    },
    court: {
      id: row.court_id,
      name: row.court_name,
      description: row.court_description,
      pricePerHour: parseFloat(row.price_per_hour),
      isIndoor: row.is_indoor
    },
    facility: {
      id: row.facility_id,
      name: row.facility_name,
      address: row.facility_address,
      city: row.facility_city,
      contactPhone: row.facility_phone,
      contactEmail: row.facility_email
    }
  }));

  return {
    bookings,
    total: parseInt(countResult.rows[0].total),
    limit,
    offset
  };
};

module.exports = {
  createBooking,
  getBookingDetails,
  cancelBooking,
  confirmBooking,
  getPendingBookingsForFacility,
  acceptBooking,
  rejectBooking,
  getUserBookings
};

