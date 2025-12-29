/**
 * Booking Expiration Service Usage Examples
 * 
 * Demonstrates how booking expiration works and how it integrates
 * with the availability system.
 */

const expirationService = require('./bookingExpirationService');
const availabilityService = require('./availabilityService');
const filterService = require('./availabilityFilterService');

// ============================================================================
// EXAMPLE 1: Expire Pending Bookings (Batch Processing)
// ============================================================================

async function example1_ExpireBookings() {
  console.log('=== Expiring Pending Bookings ===\n');
  
  // Check how many bookings are expired
  const expiredCount = await expirationService.getExpiredBookingsCount();
  console.log(`Found ${expiredCount} expired bookings\n`);
  
  if (expiredCount > 0) {
    // Expire them in batches
    const result = await expirationService.expirePendingBookings({ batchSize: 100 });
    
    console.log(`Expired ${result.expiredCount} bookings`);
    console.log(`Booking IDs: ${result.expiredBookingIds.join(', ')}\n`);
    
    // These bookings are now marked as 'expired'
    // Their time slots are now available again
  }
}

// ============================================================================
// EXAMPLE 2: Check if Specific Booking is Expired
// ============================================================================

async function example2_CheckExpiration() {
  const bookingId = 123;
  
  const isExpired = await expirationService.isBookingExpired(bookingId);
  
  if (isExpired) {
    console.log(`Booking ${bookingId} has expired`);
    console.log('Time slot is now available for other users');
  } else {
    console.log(`Booking ${bookingId} is still valid`);
  }
}

// ============================================================================
// EXAMPLE 3: Availability After Expiration
// ============================================================================

async function example3_AvailabilityAfterExpiration() {
  const courtId = 1;
  const date = new Date('2024-01-15');
  
  console.log('=== Availability Before Expiration ===\n');
  
  // Get availability (expired bookings automatically excluded)
  const base = await availabilityService.generateBaseAvailability(courtId, date);
  const filtered = await filterService.filterAvailability(base);
  
  console.log(`Available blocks: ${filtered.blocks.length}`);
  console.log(`Active bookings: ${filtered.bookings.length}`);
  
  // Expire any expired bookings
  await expirationService.expirePendingBookings();
  
  console.log('\n=== Availability After Expiration ===\n');
  
  // Get availability again (should include previously expired slots)
  const filteredAfter = await filterService.filterAvailability(base);
  
  console.log(`Available blocks: ${filteredAfter.blocks.length}`);
  console.log(`Active bookings: ${filteredAfter.bookings.length}`);
  
  // Note: Query-based expiration means this happens automatically
  // The second query will automatically exclude expired bookings
}

// ============================================================================
// EXAMPLE 4: Cron Job Integration
// ============================================================================

function example4_CronJob() {
  // Optional: Run expiration cleanup as a cron job
  // This is for data hygiene, not required for functionality
  // (Query-based expiration handles it automatically)
  
  const cron = require('node-cron');
  
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await expirationService.expirePendingBookings();
      if (result.expiredCount > 0) {
        console.log(`[Cron] Expired ${result.expiredCount} bookings at ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('[Cron] Error expiring bookings:', error.message);
    }
  });
  
  console.log('Cron job scheduled: Expire bookings every hour');
}

// ============================================================================
// EXAMPLE 5: Manual Expiration (Admin Tool)
// ============================================================================

async function example5_ManualExpiration() {
  // Admin can manually expire bookings if needed
  console.log('=== Manual Expiration ===\n');
  
  const result = await expirationService.expirePendingBookings({
    batchSize: 1000  // Process up to 1000 at once
  });
  
  console.log(`Manually expired ${result.expiredCount} bookings`);
  console.log('These bookings are now marked as "expired"');
  console.log('Their time slots are available for new bookings');
}

module.exports = {
  example1_ExpireBookings,
  example2_CheckExpiration,
  example3_AvailabilityAfterExpiration,
  example4_CronJob,
  example5_ManualExpiration
};

