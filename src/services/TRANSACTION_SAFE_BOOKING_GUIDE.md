# Transaction-Safe Booking Service Guide

## Overview

The `transactionSafeBookingService` creates bookings with transaction-safe concurrency control to prevent race conditions and double bookings. It uses PostgreSQL transactions with row-level locking to ensure atomicity and consistency.

## Why Availability Must Be Re-Checked at Booking Time

### The Problem: Time-of-Check vs Time-of-Use (TOCTOU) Race Condition

**Scenario:**
1. User A checks availability at 10:00:00 → Slot 10:00-11:00 is available
2. User B checks availability at 10:00:01 → Slot 10:00-11:00 is available
3. User A books at 10:00:02 → Booking created
4. User B books at 10:00:03 → **Double booking!** ❌

**Why this happens:**
- Availability is computed dynamically (not stored as slots)
- Between check and booking, another user can book the same time
- Without transaction safety, both bookings succeed

### The Solution: Re-Validation Inside Transaction

**Correct Flow:**
1. Start transaction
2. Lock relevant rows (SELECT FOR UPDATE)
3. Re-check availability **inside transaction**
4. Check for conflicts **inside transaction**
5. Create booking only if still available
6. Commit transaction

**Result:**
- User A and B both try to book at same time
- First transaction locks rows, checks, creates booking
- Second transaction waits for lock, then finds conflict, fails
- **No double booking** ✅

## How This Design Remains Safe Under High Concurrency

### 1. Database Transactions

**PostgreSQL ACID Properties:**
- **Atomicity**: All operations succeed or all fail
- **Consistency**: Database remains in valid state
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed changes persist

**Transaction Isolation Level:**
- Default: `READ COMMITTED`
- Ensures each transaction sees committed data
- Prevents dirty reads

### 2. Row-Level Locking (SELECT FOR UPDATE)

**How it works:**
```sql
SELECT * FROM bookings 
WHERE court_id = $1 AND booking_date = $2
FOR UPDATE;
```

**What this does:**
- Locks matching rows for the duration of the transaction
- Other transactions must wait for lock to be released
- Prevents concurrent modifications

**Example:**
```
Transaction A: SELECT ... FOR UPDATE → Locks rows
Transaction B: SELECT ... FOR UPDATE → Waits for lock
Transaction A: INSERT booking → Creates booking
Transaction A: COMMIT → Releases lock
Transaction B: Gets lock, finds conflict, ROLLBACK
```

### 3. Pessimistic Locking Strategy

**Pessimistic vs Optimistic Locking:**

**Optimistic Locking:**
- Assume no conflicts
- Check version/timestamp
- Fail if changed
- **Problem**: High conflict rate in booking systems

**Pessimistic Locking (This Design):**
- Assume conflicts will happen
- Lock rows before checking
- Prevent conflicts proactively
- **Result**: Safe under high concurrency

### 4. Overlap Detection in Database

**Precise Overlap Detection:**
```sql
SELECT * FROM bookings
WHERE court_id = $1
  AND booking_date = $2
  AND booking_status NOT IN ('cancelled')
  AND start_time < $4    -- New booking end
  AND end_time > $3      -- New booking start
FOR UPDATE;
```

**Why this is precise:**
- Two ranges overlap if: `start1 < end2 AND end1 > start2`
- Handles all cases: full overlap, partial overlap, adjacent
- Database enforces consistency

### 5. All Checks Inside Transaction

**Transaction Flow:**
```
BEGIN TRANSACTION
  ↓
Lock court row (FOR UPDATE)
  ↓
Check overlapping bookings (FOR UPDATE)
  ↓
Check availability rules
  ↓
Check blocked ranges (FOR UPDATE)
  ↓
Calculate price
  ↓
Insert booking
  ↓
COMMIT (or ROLLBACK on error)
```

**Why all checks must be inside:**
- If checks happen outside transaction, state can change
- Inside transaction, all checks see consistent snapshot
- Locked rows prevent concurrent modifications

## Concurrency Safety Mechanisms

### Mechanism 1: Transaction Isolation

**PostgreSQL Isolation Levels:**
- `READ UNCOMMITTED`: Can see uncommitted changes (not used)
- `READ COMMITTED`: See only committed changes (default) ✅
- `REPEATABLE READ`: Consistent snapshot for transaction
- `SERIALIZABLE`: Highest isolation (can cause deadlocks)

**This service uses:** `READ COMMITTED` (default)
- Good balance of safety and performance
- Prevents dirty reads
- Allows concurrent transactions

### Mechanism 2: Row-Level Locking

**What gets locked:**
1. Court row: `SELECT ... FROM courts WHERE id = $1 FOR UPDATE`
2. Existing bookings: `SELECT ... FROM bookings ... FOR UPDATE`
3. Blocked ranges: `SELECT ... FROM blocked_time_ranges ... FOR UPDATE`

**Lock duration:**
- Held for entire transaction
- Released on COMMIT or ROLLBACK
- Other transactions wait for lock

### Mechanism 3: Atomic Operations

**All-or-Nothing:**
- If any check fails → ROLLBACK (no partial state)
- If all checks pass → COMMIT (all changes together)
- No intermediate states visible to other transactions

### Mechanism 4: Conflict Detection

**Three types of conflicts checked:**
1. **Overlapping Bookings**: Another booking already exists
2. **Outside Availability**: Time not in court availability rules
3. **Blocked Time**: Admin has blocked this time range

**All checked inside transaction with locks**

## Example: High Concurrency Scenario

### Scenario: 10 Users Try to Book Same Slot

**Timeline:**
```
T0: User 1 starts transaction, locks rows
T1: User 2-10 start transactions, wait for lock
T2: User 1 checks availability → Available
T3: User 1 creates booking
T4: User 1 COMMIT → Releases lock
T5: User 2 gets lock, checks → Conflict found
T6: User 2 ROLLBACK → Returns conflict error
T7: User 3 gets lock, checks → Conflict found
T8: User 3 ROLLBACK → Returns conflict error
... (Users 4-10 all fail)
```

**Result:**
- Only User 1 succeeds
- Users 2-10 get clear conflict errors
- No double bookings
- Database remains consistent

## Error Handling

### Conflict Errors

**Booking Conflict:**
```javascript
{
  statusCode: 409,
  errorCode: 'BOOKING_CONFLICT',
  message: 'Time slot is already booked',
  conflictingBooking: {
    id: 123,
    startTime: 600,
    endTime: 690,
    status: 'confirmed'
  }
}
```

**Time Blocked:**
```javascript
{
  statusCode: 409,
  errorCode: 'TIME_BLOCKED',
  message: 'Time slot is blocked: Maintenance',
  blockedRange: {
    id: 456,
    reason: 'Maintenance',
    blockType: 'one_time'
  }
}
```

**Outside Availability:**
```javascript
{
  statusCode: 400,
  errorCode: 'OUTSIDE_AVAILABILITY',
  message: 'Requested time is outside court availability hours'
}
```

## Performance Considerations

### Lock Contention

**Potential Issue:**
- Many users booking same court/date
- Lock contention on same rows
- Transactions queue up

**Mitigation:**
1. **Indexes**: Fast lock acquisition
2. **Short Transactions**: Minimize lock duration
3. **Connection Pooling**: Handle concurrent requests
4. **Retry Logic**: Client can retry on conflict

### Deadlock Prevention

**This design avoids deadlocks by:**
- Locking in consistent order (court → bookings → blocks)
- Short transaction duration
- No nested transactions
- Clear error handling

## Usage Example

```javascript
const bookingService = require('./transactionSafeBookingService');

try {
  const booking = await bookingService.createTransactionSafeBooking(
    1,                          // userId
    5,                          // courtId
    new Date('2024-01-15'),     // date
    600,                        // startTimeMinutes (10:00)
    690,                        // endTimeMinutes (11:30)
    { paymentReference: 'pay_123' }
  );
  
  console.log('Booking created:', booking.id);
} catch (error) {
  if (error.errorCode === 'BOOKING_CONFLICT') {
    console.log('Slot already booked:', error.conflictingBooking);
  } else if (error.errorCode === 'TIME_BLOCKED') {
    console.log('Time blocked:', error.blockedRange.reason);
  } else {
    console.error('Booking failed:', error.message);
  }
}
```

## Integration with Availability Services

### Complete Flow

```javascript
// Step 1: Show available slots (no transaction needed)
const base = await availabilityService.generateBaseAvailability(courtId, date);
const filtered = await filterService.filterAvailability(base);
const slots = compositionService.generateBookingSlots(filtered.blocks, 90);

// Step 2: User selects a slot and books (transaction-safe)
const booking = await transactionSafeBookingService.createTransactionSafeBooking(
  userId,
  courtId,
  date,
  selectedSlot.startTime,
  selectedSlot.endTime
);
```

**Why this works:**
- Step 1: Fast, read-only, shows options
- Step 2: Transaction-safe, prevents conflicts
- Re-validation in Step 2 catches any changes since Step 1

## Testing Concurrency

### Test Scenario

```javascript
// Simulate 10 concurrent booking attempts
const promises = Array(10).fill(null).map((_, i) =>
  bookingService.createTransactionSafeBooking(
    i + 1,  // Different users
    1,      // Same court
    date,
    600,    // Same time
    690
  )
);

const results = await Promise.allSettled(promises);

// Only one should succeed
const successful = results.filter(r => r.status === 'fulfilled');
const failed = results.filter(r => r.status === 'rejected');

console.log(`Successful: ${successful.length}`); // Should be 1
console.log(`Failed: ${failed.length}`);         // Should be 9
```

## Summary

### Why Re-Validation is Critical

1. **Availability is Dynamic**: Computed from rules, not stored
2. **Time-of-Check vs Time-of-Use**: State can change between check and use
3. **Concurrent Requests**: Multiple users can book simultaneously
4. **Race Conditions**: Without transactions, double bookings occur

### How Concurrency Safety is Achieved

1. **Transactions**: Atomic all-or-nothing operations
2. **Row-Level Locking**: Prevent concurrent modifications
3. **Pessimistic Locking**: Lock before checking
4. **Database Overlap Detection**: Precise conflict detection
5. **All Checks Inside Transaction**: Consistent snapshot

### Key Design Principles

- ✅ **Re-validate inside transaction**: Never trust pre-computed availability
- ✅ **Lock before checking**: Prevent concurrent modifications
- ✅ **Fail fast on conflict**: Clear error messages
- ✅ **Short transactions**: Minimize lock duration
- ✅ **Atomic operations**: All-or-nothing commits

This design ensures **safe, consistent bookings even under high concurrency**.

