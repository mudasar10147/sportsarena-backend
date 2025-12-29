# PENDING Booking Reservation Mechanism Guide

## Overview

The system implements a PENDING booking reservation mechanism where:
- Users submit booking requests → Status becomes `PENDING`
- PENDING bookings block availability for other users
- Bookings expire after a configurable duration
- Expired/Rejected/Cancelled bookings do NOT block availability

## Booking Status Model

### Status Values

| Status | Description | Blocks Availability? |
|--------|-------------|---------------------|
| `pending` | Awaiting payment/approval | ✅ Yes (if not expired) |
| `confirmed` | Approved by facility admin | ✅ Yes |
| `completed` | Booking has passed | ✅ Yes (if still in progress) |
| `cancelled` | Cancelled by user | ❌ No |
| `rejected` | Rejected by facility admin | ❌ No |
| `expired` | PENDING booking expired | ❌ No |

### State Transitions

```
User submits booking
    ↓
PENDING (with expires_at)
    ↓
    ├─→ APPROVED → CONFIRMED
    ├─→ REJECTED → REJECTED
    └─→ Time passes → EXPIRED
```

**Important:** Once a booking is CONFIRMED, it can only transition to:
- `cancelled` (by user, before booking time)
- `completed` (automatically, after booking time passes)

## Why PENDING Bookings Must Block Availability

### The Problem Without Blocking

**Scenario:**
1. User A submits booking request → PENDING
2. User B checks availability → Slot appears available
3. User B submits booking request → Also PENDING
4. Both users think they have the slot
5. Facility admin approves User A → CONFIRMED
6. User B's booking is rejected → Conflict!

**Result:** User B wasted time, facility admin wasted time rejecting

### The Solution: PENDING Blocks Availability

**Correct Flow:**
1. User A submits booking request → PENDING (blocks slot)
2. User B checks availability → Slot appears unavailable
3. User B cannot book the same slot
4. Facility admin approves User A → CONFIRMED
5. User B books a different slot

**Benefits:**
- ✅ Prevents double-booking attempts
- ✅ Clear availability for users
- ✅ Reduces admin workload
- ✅ Better user experience

### Expiration Mechanism

PENDING bookings expire after a configurable duration (default: 24 hours):

- **Before expiration**: Blocks availability
- **After expiration**: Status becomes `expired`, slot becomes available

This ensures:
- Slots don't remain reserved indefinitely
- Users have time to upload payment proof
- Expired bookings free up slots automatically

## Database Schema

### Bookings Table

```sql
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    court_id INTEGER NOT NULL,
    booking_date DATE NOT NULL,
    start_time INTEGER NOT NULL,  -- Minutes since midnight
    end_time INTEGER NOT NULL,    -- Minutes since midnight
    final_price DECIMAL(10, 2) NOT NULL,
    booking_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP,          -- Expiration for PENDING bookings
    payment_reference VARCHAR(255),
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (booking_status IN ('pending', 'confirmed', 'cancelled', 'completed', 'rejected', 'expired'))
);
```

### Indexes for Performance

```sql
-- Fast expiration queries
CREATE INDEX idx_bookings_expires_at ON bookings(expires_at) 
  WHERE booking_status = 'pending';

-- Fast availability queries (excludes expired/rejected/cancelled)
CREATE INDEX idx_bookings_active ON bookings(court_id, booking_date, start_time, end_time)
  WHERE booking_status IN ('pending', 'confirmed', 'completed')
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
```

## Availability Computation Logic

### Updated Query Logic

**Availability Filter Service** now excludes:
- `cancelled` bookings
- `rejected` bookings
- `expired` bookings
- Expired `pending` bookings (expires_at < CURRENT_TIMESTAMP)

**Query:**
```sql
SELECT * FROM bookings
WHERE court_id = $1
  AND booking_date = $2
  AND booking_status IN ('pending', 'confirmed', 'completed')
  AND booking_status NOT IN ('cancelled', 'rejected', 'expired')
  -- Exclude expired PENDING bookings
  AND (
    booking_status != 'pending' OR
    (booking_status = 'pending' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP))
  )
```

### Transaction-Safe Booking Creation

**Overlap Detection** uses the same logic:
```sql
SELECT * FROM bookings
WHERE court_id = $1
  AND booking_date = $2
  AND booking_status NOT IN ('cancelled', 'rejected', 'expired')
  AND (
    booking_status != 'pending' OR
    (booking_status = 'pending' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP))
  )
  AND start_time < $4
  AND end_time > $3
FOR UPDATE
```

## Expiration Enforcement

### Three Approaches

#### 1. Query-Based (Lazy Evaluation) ✅ Recommended

**How it works:**
- Check expiration when querying availability
- Use SQL `CURRENT_TIMESTAMP` in WHERE clause
- No background jobs needed
- Always up-to-date

**Pros:**
- Simple to implement
- No additional infrastructure
- Always accurate
- No race conditions

**Cons:**
- Slightly slower queries (negligible with indexes)

**Implementation:**
```sql
-- Automatically excludes expired bookings
WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
```

#### 2. Cron Job (Scheduled Task)

**How it works:**
- Scheduled task runs every hour/day
- Finds expired bookings
- Updates status to 'expired'

**Implementation:**
```javascript
// Run every hour
const cron = require('node-cron');
cron.schedule('0 * * * *', async () => {
  const result = await bookingExpirationService.expirePendingBookings();
  console.log(`Expired ${result.expiredCount} bookings`);
});
```

**Pros:**
- Clean database (no expired PENDING bookings)
- Can send notifications before expiration

**Cons:**
- Requires cron infrastructure
- Delay between expiration and status update
- More complex

#### 3. Background Job Queue

**How it works:**
- Queue expiration jobs when booking is created
- Process jobs when expiration time arrives
- Update booking status

**Pros:**
- Precise timing
- Can send notifications

**Cons:**
- Requires job queue infrastructure (Bull, BullMQ, etc.)
- More complex setup
- Overkill for this use case

### Recommended Approach: Query-Based

**Why query-based is best:**
1. **Simplicity**: No additional infrastructure
2. **Accuracy**: Always up-to-date (uses CURRENT_TIMESTAMP)
3. **Performance**: Indexed queries are fast
4. **Reliability**: No background jobs to fail
5. **Scalability**: Works at any scale

**The query automatically handles expiration:**
```sql
-- This query automatically excludes expired bookings
WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
```

**Optional: Batch Cleanup**

You can still run a periodic cleanup job to mark expired bookings:
```javascript
// Optional: Run daily to clean up expired bookings
// This is for data hygiene, not required for functionality
await bookingExpirationService.expirePendingBookings();
```

## Transaction-Safe Booking Creation

### Updated Flow

```javascript
BEGIN TRANSACTION
  ↓
Lock court row (FOR UPDATE)
  ↓
Check overlapping bookings (excludes expired PENDING)
  ↓
Check availability rules
  ↓
Check blocked ranges
  ↓
Calculate price
  ↓
Calculate expires_at (current time + expiration hours)
  ↓
Insert booking with status='pending' and expires_at
  ↓
COMMIT
```

### Key Changes

1. **Sets expires_at** when creating PENDING booking
2. **Excludes expired PENDING** in overlap detection
3. **Uses transaction** for atomicity

## How This Design Scales

### Performance

**Indexes ensure fast queries:**
- `idx_bookings_expires_at` - Fast expiration checks
- `idx_bookings_active` - Fast availability queries
- Partial indexes (WHERE clauses) reduce index size

**Query performance:**
- Typical query: < 10ms with indexes
- Handles thousands of bookings per court/date
- Scales linearly with data

### Future Online Payments

**Current (Bank Transfer):**
```
User submits → PENDING → Admin approves → CONFIRMED
```

**Future (Online Payment):**
```
User submits → PENDING → Payment gateway → CONFIRMED
```

**Design supports both:**
- PENDING status works for both flows
- Expiration prevents indefinite reservations
- Same availability logic works for both
- Easy to add payment gateway integration

**Migration path:**
1. Keep PENDING mechanism
2. Add payment gateway webhook
3. Auto-confirm on successful payment
4. Keep manual approval as fallback

## Usage Examples

### Creating a PENDING Booking

```javascript
const bookingService = require('./transactionSafeBookingService');

const booking = await bookingService.createTransactionSafeBooking(
  userId,
  courtId,
  date,
  startTimeMinutes,
  endTimeMinutes
);

// Booking is created with:
// - status: 'pending'
// - expires_at: current_time + 24 hours (default)
```

### Checking Availability (Excludes Expired PENDING)

```javascript
const filterService = require('./availabilityFilterService');

const filtered = await filterService.filterAvailability(baseAvailability);
// Automatically excludes expired PENDING bookings
```

### Expiring Bookings (Optional Cleanup)

```javascript
const expirationService = require('./bookingExpirationService');

// Run periodically (e.g., daily cron)
const result = await expirationService.expirePendingBookings();
console.log(`Expired ${result.expiredCount} bookings`);
```

## State Transition Functions

### Approve Booking (PENDING → CONFIRMED)

```javascript
// In bookingService.js (already implemented)
const confirmedBooking = await Booking.accept(bookingId, paymentReference);
// Status changes to 'confirmed', expires_at becomes NULL
```

### Reject Booking (PENDING → REJECTED)

```javascript
// In bookingService.js (already implemented)
const rejectedBooking = await Booking.reject(bookingId, rejectionReason);
// Status changes to 'rejected', slot becomes available
```

### Expire Booking (PENDING → EXPIRED)

```javascript
// Automatic via query-based expiration
// Or manual via expirationService.expirePendingBookings()
```

## Summary

### Key Features

1. ✅ **PENDING bookings block availability** (prevents double-booking)
2. ✅ **Expiration mechanism** (prevents indefinite reservations)
3. ✅ **Transaction-safe creation** (prevents race conditions)
4. ✅ **Query-based expiration** (simple, accurate, scalable)
5. ✅ **Configurable expiration** (per facility/court)
6. ✅ **Clear state transitions** (PENDING → CONFIRMED/REJECTED/EXPIRED)

### Why This Design Works

- **Prevents conflicts**: PENDING blocks availability
- **Auto-cleanup**: Expiration frees up slots
- **Transaction-safe**: No race conditions
- **Scalable**: Query-based expiration works at any scale
- **Future-proof**: Supports online payments

The system is ready for production use with bank transfer payments and can easily extend to online payment gateways.

