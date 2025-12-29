/**
 * Transaction-Safe Booking Service
 * 
 * Creates bookings with transaction-safe concurrency control to prevent
 * race conditions and double bookings. This service:
 * 
 * - Re-validates availability inside a database transaction
 * - Uses row-level locking (SELECT FOR UPDATE) to prevent race conditions
 * - Detects overlapping bookings using PostgreSQL
 * - Commits only if the slot is still available
 * 
 * Architecture:
 * - All validation happens inside a transaction
 * - Uses pessimistic locking to prevent concurrent bookings
 * - Returns clear conflict responses for failed bookings
 */

const { pool } = require('../config/database');
const bookingRules = require('../config/bookingRules');
const timeNorm = require('../utils/timeNormalization');
const availabilityService = require('./availabilityService');
const filterService = require('./availabilityFilterService');

/**
 * ============================================================================
 * VALIDATION FUNCTIONS
 * ============================================================================
 */

/**
 * Validate booking request parameters
 * @param {number} courtId - Court ID
 * @param {Date|string} date - Booking date
 * @param {number} startTimeMinutes - Start time in minutes since midnight
 * @param {number} endTimeMinutes - End time in minutes since midnight
 * @throws {Error} If validation fails
 * @private
 */
function validateBookingRequest(courtId, date, startTimeMinutes, endTimeMinutes) {
  // Validate court ID
  if (!courtId || typeof courtId !== 'number') {
    const error = new Error('Invalid court ID');
    error.statusCode = 400;
    error.errorCode = 'INVALID_COURT_ID';
    throw error;
  }
  
  // Validate date
  const bookingDate = date instanceof Date ? date : new Date(date);
  if (isNaN(bookingDate.getTime())) {
    const error = new Error('Invalid booking date');
    error.statusCode = 400;
    error.errorCode = 'INVALID_DATE';
    throw error;
  }
  
  // Validate times
  if (!timeNorm.isValidMinutes(startTimeMinutes) || !timeNorm.isValidMinutes(endTimeMinutes)) {
    const error = new Error('Invalid time values. Times must be 0-1439 (minutes since midnight)');
    error.statusCode = 400;
    error.errorCode = 'INVALID_TIME';
    throw error;
  }
  
  // Validate time range
  if (startTimeMinutes >= endTimeMinutes) {
    const error = new Error('Start time must be before end time');
    error.statusCode = 400;
    error.errorCode = 'INVALID_TIME_RANGE';
    throw error;
  }
  
  // Validate alignment to granularity
  if (!timeNorm.isAlignedToGranularity(startTimeMinutes) || 
      !timeNorm.isAlignedToGranularity(endTimeMinutes)) {
    const error = new Error('Times must align to 30-minute intervals');
    error.statusCode = 400;
    error.errorCode = 'INVALID_TIME_GRANULARITY';
    throw error;
  }
  
  // Validate duration
  const durationMinutes = timeNorm.calculateRangeDuration(startTimeMinutes, endTimeMinutes);
  if (durationMinutes < bookingRules.MIN_BOOKING_DURATION_MINUTES) {
    const error = new Error(
      `Booking duration must be at least ${bookingRules.MIN_BOOKING_DURATION_MINUTES} minutes`
    );
    error.statusCode = 400;
    error.errorCode = 'DURATION_TOO_SHORT';
    throw error;
  }
}

/**
 * ============================================================================
 * TRANSACTION-SAFE BOOKING CREATION
 * ============================================================================
 */

/**
 * Check if a time range overlaps with existing bookings
 * Uses PostgreSQL overlap detection for precision
 * 
 * @param {Object} client - Database client (from transaction)
 * @param {number} courtId - Court ID
 * @param {Date} bookingDate - Booking date
 * @param {number} startTimeMinutes - Start time in minutes since midnight
 * @param {number} endTimeMinutes - End time in minutes since midnight
 * @returns {Promise<Object|null>} Conflicting booking if found, null otherwise
 * @private
 */
async function checkForOverlappingBookings(client, courtId, bookingDate, startTimeMinutes, endTimeMinutes) {
  const dateString = bookingDate.toISOString().split('T')[0];
  
  // Query for overlapping bookings using PostgreSQL overlap detection
  // Two ranges overlap if: start1 < end2 AND end1 > start2
  // We exclude: CANCELLED, REJECTED, EXPIRED bookings
  // PENDING bookings block only if not expired
  const query = `
    SELECT 
      id,
      user_id,
      court_id,
      booking_date,
      start_time,
      end_time,
      booking_status,
      expires_at
    FROM bookings
    WHERE court_id = $1
      AND booking_date = $2
      AND booking_status NOT IN ('cancelled', 'rejected', 'expired')
      -- Exclude expired PENDING bookings
      AND (
        booking_status != 'pending' OR
        (booking_status = 'pending' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP))
      )
      AND start_time < $4
      AND end_time > $3
    ORDER BY start_time ASC
    LIMIT 1
    FOR UPDATE
  `;
  
  const result = await client.query(query, [
    courtId,
    dateString,
    startTimeMinutes,
    endTimeMinutes
  ]);
  
  if (result.rows.length > 0) {
    return {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      courtId: result.rows[0].court_id,
      bookingDate: result.rows[0].booking_date,
      startTime: result.rows[0].start_time,
      endTime: result.rows[0].end_time,
      status: result.rows[0].booking_status,
      expiresAt: result.rows[0].expires_at ? new Date(result.rows[0].expires_at) : null
    };
  }
  
  return null;
}

/**
 * Check if time range is within court availability rules
 * 
 * @param {Object} client - Database client (from transaction)
 * @param {number} courtId - Court ID
 * @param {Date} bookingDate - Booking date
 * @param {number} startTimeMinutes - Start time in minutes since midnight
 * @param {number} endTimeMinutes - End time in minutes since midnight
 * @returns {Promise<boolean>} True if within availability rules
 * @private
 */
async function checkAvailabilityRules(client, courtId, bookingDate, startTimeMinutes, endTimeMinutes) {
  const dayOfWeek = bookingDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  
  // Check if there's an availability rule that covers this time range
  const query = `
    SELECT COUNT(*) as count
    FROM court_availability_rules
    WHERE court_id = $1
      AND day_of_week = $2
      AND is_active = TRUE
      AND (
        -- Normal range: start_time <= booking_start AND end_time >= booking_end
        (start_time <= end_time AND start_time <= $3 AND end_time >= $4) OR
        -- Midnight crossover: booking spans across midnight
        (start_time > end_time AND (start_time <= $3 OR end_time >= $4))
      )
  `;
  
  const result = await client.query(query, [
    courtId,
    dayOfWeek,
    startTimeMinutes,
    endTimeMinutes
  ]);
  
  return parseInt(result.rows[0].count, 10) > 0;
}

/**
 * Check if time range is blocked
 * 
 * @param {Object} client - Database client (from transaction)
 * @param {number} courtId - Court ID
 * @param {Date} bookingDate - Booking date
 * @param {number} startTimeMinutes - Start time in minutes since midnight
 * @param {number} endTimeMinutes - End time in minutes since midnight
 * @returns {Promise<Object|null>} Blocked range if found, null otherwise
 * @private
 */
async function checkBlockedRanges(client, courtId, bookingDate, startTimeMinutes, endTimeMinutes) {
  const dateString = bookingDate.toISOString().split('T')[0];
  const dayOfWeek = bookingDate.getDay();
  
  // Get facility_id from court
  const courtResult = await client.query(
    'SELECT facility_id FROM courts WHERE id = $1 FOR UPDATE',
    [courtId]
  );
  
  if (courtResult.rows.length === 0) {
    return null; // Court not found (will be caught by other validation)
  }
  
  const facilityId = courtResult.rows[0].facility_id;
  
  // Check for blocked ranges that overlap with booking time
  const query = `
    SELECT 
      id,
      block_type,
      reason,
      start_time,
      end_time
    FROM blocked_time_ranges
    WHERE (
      (court_id = $1) OR 
      (court_id IS NULL AND facility_id = $2)
    )
    AND (
      -- One-time block on this specific date
      (block_type = 'one_time' AND start_date = $3) OR
      -- Recurring block on this day of week
      (block_type = 'recurring' AND day_of_week = $4) OR
      -- Date range block covering this date
      (block_type = 'date_range' AND $3 BETWEEN start_date AND end_date)
    )
    AND is_active = TRUE
    AND (
      -- For date_range blocks, start_time/end_time are NULL (blocks entire day)
      (start_time IS NULL AND end_time IS NULL) OR
      -- For other blocks, check overlap
      (start_time < $6 AND end_time > $5)
    )
    LIMIT 1
    FOR UPDATE
  `;
  
  const result = await client.query(query, [
    courtId,
    facilityId,
    dateString,
    dayOfWeek,
    startTimeMinutes,
    endTimeMinutes
  ]);
  
  if (result.rows.length > 0) {
    return {
      id: result.rows[0].id,
      blockType: result.rows[0].block_type,
      reason: result.rows[0].reason,
      startTime: result.rows[0].start_time,
      endTime: result.rows[0].end_time
    };
  }
  
  return null;
}

/**
 * Get booking policy for expiration duration
 * 
 * @param {Object} client - Database client (from transaction)
 * @param {number} courtId - Court ID
 * @returns {Promise<number>} Expiration duration in hours
 * @private
 */
async function getPendingExpirationHours(client, courtId) {
  // Get court's facility_id
  const courtResult = await client.query(
    'SELECT facility_id FROM courts WHERE id = $1',
    [courtId]
  );
  
  if (courtResult.rows.length === 0) {
    return bookingRules.DEFAULT_PENDING_BOOKING_EXPIRATION_HOURS;
  }
  
  const facilityId = courtResult.rows[0].facility_id;
  
  // Get booking policy (court-level or facility-level)
  // Note: pending_booking_expiration_hours column is added in migration 022
  // If column doesn't exist yet, fall back to default
  try {
    const policyQuery = `
      SELECT 
        COALESCE(cp.pending_booking_expiration_hours, fp.pending_booking_expiration_hours, $1) as expiration_hours
      FROM courts c
      LEFT JOIN booking_policies cp ON c.id = cp.court_id AND cp.is_active = TRUE
      LEFT JOIN booking_policies fp ON c.facility_id = fp.facility_id 
        AND fp.court_id IS NULL AND fp.is_active = TRUE
      WHERE c.id = $2
    `;
    
    const policyResult = await client.query(policyQuery, [
      bookingRules.DEFAULT_PENDING_BOOKING_EXPIRATION_HOURS,
      courtId
    ]);
    
    if (policyResult.rows.length === 0) {
      return bookingRules.DEFAULT_PENDING_BOOKING_EXPIRATION_HOURS;
    }
    
    return parseFloat(policyResult.rows[0].expiration_hours) || bookingRules.DEFAULT_PENDING_BOOKING_EXPIRATION_HOURS;
  } catch (error) {
    // If column doesn't exist yet (during migration), use default
    if (error.code === '42703' || error.message.includes('column')) {
      return bookingRules.DEFAULT_PENDING_BOOKING_EXPIRATION_HOURS;
    }
    throw error;
  }
}

/**
 * Calculate booking price based on duration and court price
 * 
 * @param {Object} client - Database client (from transaction)
 * @param {number} courtId - Court ID
 * @param {number} startTimeMinutes - Start time in minutes since midnight
 * @param {number} endTimeMinutes - End time in minutes since midnight
 * @returns {Promise<number>} Final price in PKR
 * @private
 */
async function calculateBookingPrice(client, courtId, startTimeMinutes, endTimeMinutes) {
  // Get court price
  const courtResult = await client.query(
    'SELECT price_per_hour FROM courts WHERE id = $1',
    [courtId]
  );
  
  if (courtResult.rows.length === 0) {
    const error = new Error('Court not found');
    error.statusCode = 404;
    error.errorCode = 'COURT_NOT_FOUND';
    throw error;
  }
  
  const pricePerHour = parseFloat(courtResult.rows[0].price_per_hour);
  
  // Calculate duration in hours
  const durationMinutes = timeNorm.calculateRangeDuration(startTimeMinutes, endTimeMinutes);
  const durationHours = durationMinutes / 60;
  
  // Calculate price
  const price = pricePerHour * durationHours;
  
  // Round to 2 decimal places
  return Math.round(price * 100) / 100;
}

/**
 * Create a booking with transaction-safe concurrency control
 * 
 * This function:
 * 1. Starts a database transaction
 * 2. Validates the booking request
 * 3. Re-checks availability inside the transaction
 * 4. Uses row-level locking to prevent race conditions
 * 5. Checks for overlapping bookings
 * 6. Checks for blocked time ranges
 * 7. Creates the booking only if all checks pass
 * 8. Commits the transaction
 * 
 * @param {number} userId - User ID making the booking
 * @param {number} courtId - Court ID
 * @param {Date|string} date - Booking date
 * @param {number} startTimeMinutes - Start time in minutes since midnight
 * @param {number} endTimeMinutes - End time in minutes since midnight
 * @param {Object} [options] - Optional booking options
 * @param {string} [options.paymentReference] - Payment transaction reference
 * @returns {Promise<Object>} Created booking object
 * @throws {Error} If booking fails (conflict, validation error, etc.)
 * 
 * @example
 * const booking = await createTransactionSafeBooking(
 *   1,                          // userId
 *   5,                          // courtId
 *   new Date('2024-01-15'),     // date
 *   600,                        // startTimeMinutes (10:00)
 *   690,                        // endTimeMinutes (11:30)
 *   { paymentReference: 'pay_123' }
 * );
 */
async function createTransactionSafeBooking(
  userId,
  courtId,
  date,
  startTimeMinutes,
  endTimeMinutes,
  options = {}
) {
  const { paymentReference = null } = options;
  
  // Validate inputs (before transaction)
  validateBookingRequest(courtId, date, startTimeMinutes, endTimeMinutes);
  
  const bookingDate = date instanceof Date ? date : new Date(date);
  const dateString = bookingDate.toISOString().split('T')[0];
  
  // Get database client for transaction
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Step 1: Lock court row to prevent concurrent modifications
    const courtResult = await client.query(
      'SELECT id, facility_id, price_per_hour, is_active FROM courts WHERE id = $1 FOR UPDATE',
      [courtId]
    );
    
    if (courtResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const error = new Error('Court not found');
      error.statusCode = 404;
      error.errorCode = 'COURT_NOT_FOUND';
      throw error;
    }
    
    const court = courtResult.rows[0];
    
    if (!court.is_active) {
      await client.query('ROLLBACK');
      const error = new Error('Court is not active');
      error.statusCode = 400;
      error.errorCode = 'COURT_INACTIVE';
      throw error;
    }
    
    // Step 2: Check for overlapping bookings (with row lock)
    const conflictingBooking = await checkForOverlappingBookings(
      client,
      courtId,
      bookingDate,
      startTimeMinutes,
      endTimeMinutes
    );
    
    if (conflictingBooking) {
      await client.query('ROLLBACK');
      const error = new Error('Time slot is already booked');
      error.statusCode = 409; // Conflict
      error.errorCode = 'BOOKING_CONFLICT';
      error.conflictingBooking = {
        id: conflictingBooking.id,
        startTime: conflictingBooking.startTime,
        endTime: conflictingBooking.endTime,
        status: conflictingBooking.status
      };
      throw error;
    }
    
    // Step 3: Check availability rules
    const isWithinAvailability = await checkAvailabilityRules(
      client,
      courtId,
      bookingDate,
      startTimeMinutes,
      endTimeMinutes
    );
    
    if (!isWithinAvailability) {
      await client.query('ROLLBACK');
      const error = new Error('Requested time is outside court availability hours');
      error.statusCode = 400;
      error.errorCode = 'OUTSIDE_AVAILABILITY';
      throw error;
    }
    
    // Step 4: Check for blocked time ranges
    const blockedRange = await checkBlockedRanges(
      client,
      courtId,
      bookingDate,
      startTimeMinutes,
      endTimeMinutes
    );
    
    if (blockedRange) {
      await client.query('ROLLBACK');
      const error = new Error(`Time slot is blocked: ${blockedRange.reason || 'Maintenance or private event'}`);
      error.statusCode = 409; // Conflict
      error.errorCode = 'TIME_BLOCKED';
      error.blockedRange = {
        id: blockedRange.id,
        reason: blockedRange.reason,
        blockType: blockedRange.blockType
      };
      throw error;
    }
    
    // Step 5: Calculate booking price
    const finalPrice = await calculateBookingPrice(
      client,
      courtId,
      startTimeMinutes,
      endTimeMinutes
    );
    
    // Step 6: Get expiration duration and calculate expires_at
    const expirationHours = await getPendingExpirationHours(client, courtId);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);
    
    // Step 7: Create booking with expiration
    const insertQuery = `
      INSERT INTO bookings (
        user_id,
        court_id,
        booking_date,
        start_time,
        end_time,
        final_price,
        booking_status,
        payment_reference,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
      RETURNING 
        id,
        user_id,
        court_id,
        booking_date,
        start_time,
        end_time,
        final_price,
        booking_status,
        payment_reference,
        expires_at,
        cancellation_reason,
        created_at,
        updated_at
      `;
    
    const insertResult = await client.query(insertQuery, [
      userId,
      courtId,
      dateString,
      startTimeMinutes,
      endTimeMinutes,
      finalPrice,
      paymentReference,
      expiresAt
    ]);
    
    const bookingRow = insertResult.rows[0];
    
    // Step 7: Commit transaction
    await client.query('COMMIT');
    
    // Format booking object
    return {
      id: bookingRow.id,
      userId: bookingRow.user_id,
      courtId: bookingRow.court_id,
      bookingDate: bookingRow.booking_date,
      startTime: bookingRow.start_time,
      endTime: bookingRow.end_time,
      startTimeMinutes: bookingRow.start_time,
      endTimeMinutes: bookingRow.end_time,
      finalPrice: parseFloat(bookingRow.final_price),
      bookingStatus: bookingRow.booking_status,
      paymentReference: bookingRow.payment_reference,
      expiresAt: bookingRow.expires_at ? new Date(bookingRow.expires_at) : null,
      cancellationReason: bookingRow.cancellation_reason,
      createdAt: new Date(bookingRow.created_at),
      updatedAt: new Date(bookingRow.updated_at)
    };
    
  } catch (error) {
    // Rollback transaction on any error
    await client.query('ROLLBACK');
    
    // Re-throw error (with status code if set)
    throw error;
    
  } finally {
    // Always release client back to pool
    client.release();
  }
}

module.exports = {
  createTransactionSafeBooking
};

