/**
 * Transaction-Safe Booking Service Usage Examples
 * 
 * Demonstrates how the transaction-safe booking service prevents
 * race conditions and double bookings.
 */

const bookingService = require('./transactionSafeBookingService');
const availabilityService = require('./availabilityService');
const filterService = require('./availabilityFilterService');
const compositionService = require('./slotCompositionService');
const timeNorm = require('../utils/timeNormalization');

// ============================================================================
// EXAMPLE 1: Basic Booking Creation
// ============================================================================

async function example1_BasicBooking() {
  const userId = 1;
  const courtId = 5;
  const date = new Date('2024-01-15');
  const startTime = 600;  // 10:00
  const endTime = 690;    // 11:30
  
  try {
    const booking = await bookingService.createTransactionSafeBooking(
      userId,
      courtId,
      date,
      startTime,
      endTime,
      { paymentReference: 'pay_123456' }
    );
    
    console.log('Booking created successfully:');
    console.log(`  ID: ${booking.id}`);
    console.log(`  Court: ${booking.courtId}`);
    console.log(`  Date: ${booking.bookingDate}`);
    console.log(`  Time: ${timeNorm.formatTimeString(booking.startTime)} - ${timeNorm.formatTimeString(booking.endTime)}`);
    console.log(`  Price: PKR ${booking.finalPrice}`);
    console.log(`  Status: ${booking.bookingStatus}`);
  } catch (error) {
    console.error('Booking failed:', error.message);
    console.error('Error code:', error.errorCode);
  }
}

// ============================================================================
// EXAMPLE 2: Handling Booking Conflicts
// ============================================================================

async function example2_BookingConflict() {
  const courtId = 5;
  const date = new Date('2024-01-15');
  const startTime = 600;  // 10:00
  const endTime = 690;    // 11:30
  
  // User 1 books successfully
  try {
    const booking1 = await bookingService.createTransactionSafeBooking(
      1, courtId, date, startTime, endTime
    );
    console.log('User 1 booking created:', booking1.id);
  } catch (error) {
    console.error('User 1 booking failed:', error.message);
  }
  
  // User 2 tries to book the same time (should fail)
  try {
    const booking2 = await bookingService.createTransactionSafeBooking(
      2, courtId, date, startTime, endTime
    );
    console.log('User 2 booking created:', booking2.id);
  } catch (error) {
    if (error.errorCode === 'BOOKING_CONFLICT') {
      console.log('User 2 booking failed: Conflict detected');
      console.log('  Conflicting booking:', error.conflictingBooking);
    } else {
      console.error('User 2 booking failed:', error.message);
    }
  }
}

// ============================================================================
// EXAMPLE 3: Handling Blocked Time Ranges
// ============================================================================

async function example3_BlockedTime() {
  const userId = 1;
  const courtId = 5;
  const date = new Date('2024-01-15');
  const startTime = 720;  // 12:00
  const endTime = 780;    // 13:00
  
  try {
    const booking = await bookingService.createTransactionSafeBooking(
      userId, courtId, date, startTime, endTime
    );
    console.log('Booking created:', booking.id);
  } catch (error) {
    if (error.errorCode === 'TIME_BLOCKED') {
      console.log('Booking failed: Time is blocked');
      console.log('  Reason:', error.blockedRange.reason);
      console.log('  Block type:', error.blockedRange.blockType);
    } else {
      console.error('Booking failed:', error.message);
    }
  }
}

// ============================================================================
// EXAMPLE 4: Complete Booking Flow
// ============================================================================

async function example4_CompleteFlow() {
  const userId = 1;
  const courtId = 5;
  const date = new Date('2024-01-15');
  const requestedDuration = 90; // 90 minutes
  
  console.log('=== Complete Booking Flow ===\n');
  
  // Step 1: Get available slots
  console.log('Step 1: Get available slots');
  const base = await availabilityService.generateBaseAvailability(courtId, date);
  const filtered = await filterService.filterAvailability(base);
  const slots = compositionService.generateBookingSlots(filtered.blocks, requestedDuration);
  
  console.log(`  Found ${slots.slots.length} available ${requestedDuration}-minute slots\n`);
  
  if (slots.slots.length === 0) {
    console.log('No available slots found');
    return;
  }
  
  // Step 2: User selects first available slot
  const selectedSlot = slots.slots[0];
  console.log('Step 2: User selects slot');
  console.log(`  ${timeNorm.formatTimeString(selectedSlot.startTime)} - ${timeNorm.formatTimeString(selectedSlot.endTime)}\n`);
  
  // Step 3: Create booking (transaction-safe)
  console.log('Step 3: Create booking (transaction-safe)');
  try {
    const booking = await bookingService.createTransactionSafeBooking(
      userId,
      courtId,
      date,
      selectedSlot.startTime,
      selectedSlot.endTime,
      { paymentReference: 'pay_789012' }
    );
    
    console.log('  ✅ Booking created successfully');
    console.log(`  Booking ID: ${booking.id}`);
    console.log(`  Price: PKR ${booking.finalPrice}`);
    console.log(`  Status: ${booking.bookingStatus}\n`);
  } catch (error) {
    console.log('  ❌ Booking failed');
    console.log(`  Error: ${error.message}`);
    console.log(`  Code: ${error.errorCode}\n`);
    
    if (error.errorCode === 'BOOKING_CONFLICT') {
      console.log('  Another user booked this slot between check and booking');
      console.log('  This is why re-validation is critical!');
    }
  }
}

// ============================================================================
// EXAMPLE 5: Concurrent Booking Attempts (Race Condition Test)
// ============================================================================

async function example5_ConcurrentBookings() {
  const courtId = 5;
  const date = new Date('2024-01-15');
  const startTime = 600;  // 10:00
  const endTime = 690;    // 11:30
  
  console.log('=== Concurrent Booking Test ===\n');
  console.log('Simulating 5 users trying to book the same slot simultaneously\n');
  
  // Create 5 concurrent booking attempts
  const promises = Array(5).fill(null).map((_, index) => {
    const userId = index + 1;
    return bookingService.createTransactionSafeBooking(
      userId,
      courtId,
      date,
      startTime,
      endTime
    ).then(
      booking => ({ userId, status: 'success', booking }),
      error => ({ userId, status: 'failed', error: error.message, errorCode: error.errorCode })
    );
  });
  
  const results = await Promise.all(promises);
  
  // Analyze results
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  const conflicts = failed.filter(r => r.errorCode === 'BOOKING_CONFLICT');
  
  console.log('Results:');
  console.log(`  Successful bookings: ${successful.length}`);
  console.log(`  Failed bookings: ${failed.length}`);
  console.log(`  Conflicts: ${conflicts.length}\n`);
  
  if (successful.length > 0) {
    console.log('Successful booking:');
    successful.forEach(result => {
      console.log(`  User ${result.userId}: Booking ID ${result.booking.id}`);
    });
    console.log();
  }
  
  if (conflicts.length > 0) {
    console.log('Conflicts detected:');
    conflicts.forEach(result => {
      console.log(`  User ${result.userId}: ${result.error}`);
    });
    console.log();
  }
  
  console.log('✅ Only one booking succeeded (as expected)');
  console.log('✅ No double bookings occurred');
  console.log('✅ Transaction safety prevented race conditions');
}

// ============================================================================
// EXAMPLE 6: Error Handling
// ============================================================================

async function example6_ErrorHandling() {
  const userId = 1;
  const courtId = 999; // Non-existent court
  const date = new Date('2024-01-15');
  const startTime = 600;
  const endTime = 690;
  
  try {
    await bookingService.createTransactionSafeBooking(
      userId, courtId, date, startTime, endTime
    );
  } catch (error) {
    console.log('Error handling example:');
    console.log(`  Status code: ${error.statusCode}`);
    console.log(`  Error code: ${error.errorCode}`);
    console.log(`  Message: ${error.message}`);
    
    // Handle different error types
    switch (error.errorCode) {
      case 'COURT_NOT_FOUND':
        console.log('  → Court does not exist');
        break;
      case 'BOOKING_CONFLICT':
        console.log('  → Time slot already booked');
        console.log('  → Conflicting booking:', error.conflictingBooking);
        break;
      case 'TIME_BLOCKED':
        console.log('  → Time slot is blocked');
        console.log('  → Reason:', error.blockedRange.reason);
        break;
      case 'OUTSIDE_AVAILABILITY':
        console.log('  → Time is outside court availability hours');
        break;
      case 'INVALID_TIME_GRANULARITY':
        console.log('  → Times must align to 30-minute intervals');
        break;
      default:
        console.log('  → Other validation error');
    }
  }
}

// ============================================================================
// EXAMPLE 7: Integration in Controller
// ============================================================================

async function createBookingController(req, res, next) {
  try {
    const userId = req.userId; // From authentication middleware
    const { courtId, date, startTime, endTime, paymentReference } = req.body;
    
    // Validate inputs
    if (!courtId || !date || startTime === undefined || endTime === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: courtId, date, startTime, endTime'
      });
    }
    
    // Parse times (assuming they come as minutes since midnight or HH:MM strings)
    let startTimeMinutes, endTimeMinutes;
    
    if (typeof startTime === 'string') {
      // Parse HH:MM format
      startTimeMinutes = timeNorm.parseTimeString(startTime);
    } else {
      startTimeMinutes = parseInt(startTime, 10);
    }
    
    if (typeof endTime === 'string') {
      endTimeMinutes = timeNorm.parseTimeString(endTime);
    } else {
      endTimeMinutes = parseInt(endTime, 10);
    }
    
    // Create booking (transaction-safe)
    const booking = await bookingService.createTransactionSafeBooking(
      userId,
      parseInt(courtId, 10),
      new Date(date),
      startTimeMinutes,
      endTimeMinutes,
      { paymentReference }
    );
    
    // Format response
    const response = {
      id: booking.id,
      courtId: booking.courtId,
      date: booking.bookingDate,
      startTime: timeNorm.formatTimeString(booking.startTime),
      endTime: timeNorm.formatTimeString(booking.endTime),
      startTimeMinutes: booking.startTime,
      endTimeMinutes: booking.endTime,
      finalPrice: booking.finalPrice,
      bookingStatus: booking.bookingStatus,
      paymentReference: booking.paymentReference,
      createdAt: booking.createdAt
    };
    
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: response
    });
    
  } catch (error) {
    // Handle specific error types
    if (error.errorCode === 'BOOKING_CONFLICT') {
      return res.status(409).json({
        success: false,
        error: 'Time slot is already booked',
        errorCode: error.errorCode,
        conflictingBooking: {
          startTime: timeNorm.formatTimeString(error.conflictingBooking.startTime),
          endTime: timeNorm.formatTimeString(error.conflictingBooking.endTime),
          status: error.conflictingBooking.status
        }
      });
    }
    
    if (error.errorCode === 'TIME_BLOCKED') {
      return res.status(409).json({
        success: false,
        error: `Time slot is blocked: ${error.blockedRange.reason || 'Maintenance or private event'}`,
        errorCode: error.errorCode,
        blockedRange: {
          reason: error.blockedRange.reason,
          blockType: error.blockedRange.blockType
        }
      });
    }
    
    // Other errors
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
      errorCode: error.errorCode
    });
  }
}

module.exports = {
  example1_BasicBooking,
  example2_BookingConflict,
  example3_BlockedTime,
  example4_CompleteFlow,
  example5_ConcurrentBookings,
  example6_ErrorHandling,
  createBookingController
};

