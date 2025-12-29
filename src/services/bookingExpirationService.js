/**
 * Booking Expiration Service
 * 
 * Handles expiration of PENDING bookings. Expired bookings are automatically
 * marked as 'expired' status, making their time slots available again.
 * 
 * This service can be run:
 * - As a cron job (scheduled task)
 * - As a background job (queue-based)
 * - On-demand (query-based, called before availability checks)
 * 
 * Architecture:
 * - Query-based: Check expiration when needed (lazy evaluation)
 * - Batch processing: Mark multiple expired bookings at once
 * - Transaction-safe: Uses transactions for atomic updates
 */

const { pool } = require('../config/database');

/**
 * Mark expired PENDING bookings as 'expired'
 * 
 * This function:
 * 1. Finds all PENDING bookings where expires_at < CURRENT_TIMESTAMP
 * 2. Updates their status to 'expired' in a transaction
 * 3. Returns count of expired bookings
 * 
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.batchSize=100] - Maximum number of bookings to expire per call
 * @returns {Promise<Object>} Result object with expiredCount and expiredBookingIds
 * 
 * @example
 * const result = await expirePendingBookings();
 * console.log(`Expired ${result.expiredCount} bookings`);
 */
async function expirePendingBookings(options = {}) {
  const { batchSize = 100 } = options;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Find expired PENDING bookings
    // Use FOR UPDATE to lock rows and prevent concurrent expiration
    const findQuery = `
      SELECT id
      FROM bookings
      WHERE booking_status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at <= CURRENT_TIMESTAMP
      ORDER BY expires_at ASC
      LIMIT $1
      FOR UPDATE
    `;
    
    const findResult = await client.query(findQuery, [batchSize]);
    
    if (findResult.rows.length === 0) {
      await client.query('COMMIT');
      return {
        expiredCount: 0,
        expiredBookingIds: []
      };
    }
    
    const expiredIds = findResult.rows.map(row => row.id);
    
    // Update status to 'expired'
    const updateQuery = `
      UPDATE bookings
      SET booking_status = 'expired',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($1::INTEGER[])
        AND booking_status = 'pending'
        AND expires_at <= CURRENT_TIMESTAMP
      RETURNING id
    `;
    
    const updateResult = await client.query(updateQuery, [expiredIds]);
    
    await client.query('COMMIT');
    
    return {
      expiredCount: updateResult.rows.length,
      expiredBookingIds: updateResult.rows.map(row => row.id)
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if a specific booking is expired (without updating)
 * 
 * @param {number} bookingId - Booking ID
 * @returns {Promise<boolean>} True if booking is expired
 */
async function isBookingExpired(bookingId) {
  const query = `
    SELECT 
      booking_status,
      expires_at
    FROM bookings
    WHERE id = $1
  `;
  
  const result = await pool.query(query, [bookingId]);
  
  if (result.rows.length === 0) {
    return false;
  }
  
  const booking = result.rows[0];
  
  // Booking is expired if:
  // - Status is 'pending'
  // - expires_at is set
  // - expires_at is in the past
  if (booking.booking_status === 'pending' && 
      booking.expires_at && 
      new Date(booking.expires_at) <= new Date()) {
    return true;
  }
  
  return false;
}

/**
 * Get count of expired PENDING bookings (without updating)
 * 
 * @returns {Promise<number>} Count of expired bookings
 */
async function getExpiredBookingsCount() {
  const query = `
    SELECT COUNT(*) as count
    FROM bookings
    WHERE booking_status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at <= CURRENT_TIMESTAMP
  `;
  
  const result = await pool.query(query);
  return parseInt(result.rows[0].count, 10);
}

module.exports = {
  expirePendingBookings,
  isBookingExpired,
  getExpiredBookingsCount
};

