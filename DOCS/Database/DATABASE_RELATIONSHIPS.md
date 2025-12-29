# 🔗 SportsArena Database Relationships & Constraints

## Complete Relationship Map

### 1. User → Facility (1-to-Many)
**Relationship:** One user (with role 'facility_admin') can own multiple facilities

**Implementation:**
- Foreign Key: `facilities.owner_id` → `users.id`
- Delete Action: `ON DELETE SET NULL`
- Index: `idx_facilities_owner_id`

**Business Logic:**
- Only users with `role = 'facility_admin'` should own facilities
- If user is deleted, facilities remain but `owner_id` becomes NULL

---

### 2. User → Booking (1-to-Many)
**Relationship:** One user can make multiple bookings

**Implementation:**
- Foreign Key: `bookings.user_id` → `users.id`
- Delete Action: `ON DELETE RESTRICT`
- Index: `idx_bookings_user_id`

**Business Logic:**
- Prevents user deletion if they have active bookings
- Users can view all their bookings via `Booking.findByUserId()`

---

### 3. Facility → Court (1-to-Many)
**Relationship:** One facility can have multiple courts

**Implementation:**
- Foreign Key: `courts.facility_id` → `facilities.id`
- Delete Action: `ON DELETE CASCADE`
- Index: `idx_courts_facility_id`

**Business Logic:**
- When facility is deleted, all its courts are automatically deleted
- Courts belong to exactly one facility

---

### 4. Court → TimeSlot (1-to-Many)
**Relationship:** One court can have multiple time slots

**Implementation:**
- Foreign Key: `time_slots.court_id` → `courts.id`
- Delete Action: `ON DELETE CASCADE`
- Index: `idx_time_slots_court_id`

**Business Logic:**
- When court is deleted, all its time slots are automatically deleted
- Time slots are created by facility admins for their courts

---

### 5. TimeSlot → Booking (1-to-1 for confirmed booking)
**Relationship:** One time slot can have one confirmed booking

**Implementation:**
- Foreign Key: `bookings.time_slot_id` → `time_slots.id`
- Delete Action: `ON DELETE RESTRICT`
- Index: `idx_bookings_time_slot_id`

**Business Logic:**
- **Double-Booking Prevention**: Application must check slot availability before creating booking
- Only one booking with status 'confirmed' or 'pending' per time slot
- When booking is created, time slot status should be updated to 'booked'
- Prevents time slot deletion if booking exists

---

### 6. Booking → PaymentTransaction (1-to-Many)
**Relationship:** One booking can have multiple payment transactions (retries, refunds)

**Implementation:**
- Foreign Key: `payment_transactions.booking_id` → `bookings.id`
- Delete Action: `ON DELETE SET NULL`
- Index: `idx_payment_transactions_booking_id`

**Business Logic:**
- Multiple transactions allowed for payment retries
- Refunds create new transaction with status 'refunded'
- Payment history preserved even if booking is deleted

---

### 7. Facility ↔ Sport (Many-to-Many)
**Relationship:** One facility can offer multiple sports, one sport can be at multiple facilities

**Implementation:**
- Junction Table: `facility_sports`
- Foreign Keys:
  - `facility_sports.facility_id` → `facilities.id` (CASCADE)
  - `facility_sports.sport_id` → `sports.id` (CASCADE)
- Unique Constraint: `UNIQUE(facility_id, sport_id)`
- Indexes: `idx_facility_sports_facility_id`, `idx_facility_sports_sport_id`

**Business Logic:**
- Prevents duplicate sport assignments to same facility
- When facility or sport is deleted, relationships are automatically cleaned up

---

### 8. Sport → Court (1-to-Many)
**Relationship:** One sport can have multiple courts (across different facilities)

**Implementation:**
- Foreign Key: `courts.sport_id` → `sports.id`
- Delete Action: `ON DELETE RESTRICT`
- Index: `idx_courts_sport_id`

**Business Logic:**
- Prevents sport deletion if courts exist for that sport
- Each court is designed for one specific sport

---

## Unique Constraints

| Table | Column(s) | Constraint | Purpose |
|-------|-----------|------------|---------|
| `users` | `email` | UNIQUE | One account per email |
| `sports` | `name` | UNIQUE | One sport per name |
| `facility_sports` | `(facility_id, sport_id)` | UNIQUE | No duplicate sport assignments |

---

## Check Constraints

| Table | Column | Constraint | Valid Values |
|-------|--------|------------|--------------|
| `users` | `role` | CHECK | 'player', 'facility_admin' |
| `bookings` | `booking_status` | CHECK | 'pending', 'confirmed', 'cancelled', 'completed' |
| `time_slots` | `status` | CHECK | 'available', 'blocked', 'booked' |
| `time_slots` | `end_time > start_time` | CHECK | Valid time range |
| `payment_transactions` | `status` | CHECK | 'pending', 'success', 'failed', 'refunded' |

---

## Foreign Key Delete Actions

| Foreign Key | From Table | To Table | Action | Reason |
|-------------|------------|----------|--------|--------|
| `facilities.owner_id` | facilities | users | SET NULL | Preserve facilities if owner deleted |
| `bookings.user_id` | bookings | users | RESTRICT | Prevent deletion if bookings exist |
| `bookings.time_slot_id` | bookings | time_slots | RESTRICT | Prevent deletion if booking exists |
| `courts.facility_id` | courts | facilities | CASCADE | Clean up courts when facility deleted |
| `courts.sport_id` | courts | sports | RESTRICT | Prevent deletion if courts exist |
| `time_slots.court_id` | time_slots | courts | CASCADE | Clean up slots when court deleted |
| `payment_transactions.booking_id` | payment_transactions | bookings | SET NULL | Preserve payment history |
| `facility_sports.facility_id` | facility_sports | facilities | CASCADE | Clean up relationships |
| `facility_sports.sport_id` | facility_sports | sports | CASCADE | Clean up relationships |

---

## Slot Availability Rules

### Rule 1: Double-Booking Prevention
**Enforcement:** Application Level + Database Constraints

**Implementation:**
1. Before creating booking, check `TimeSlot.isAvailable(slotId)`
2. Ensure time slot status is 'available'
3. Use database transaction to atomically:
   - Create booking
   - Update time slot status to 'booked'

**Code Pattern:**
```javascript
// Pseudo-code
const slot = await TimeSlot.findById(slotId);
if (slot.status !== 'available') {
  throw new Error('Slot not available');
}

await db.transaction(async (client) => {
  const booking = await Booking.create({ ... });
  await TimeSlot.markAsBooked(slotId);
});
```

### Rule 2: Time Slot Status Transitions
- `available` → `booked`: When booking is confirmed
- `available` → `blocked`: When facility admin blocks slot
- `booked` → `available`: When booking is cancelled
- `blocked` → `available`: When facility admin unblocks slot

### Rule 3: Booking Status Transitions
- `pending` → `confirmed`: After payment success
- `pending` → `cancelled`: Payment failed or user cancelled
- `confirmed` → `cancelled`: Refund scenario
- `confirmed` → `completed`: After time slot ends (automated)

### Rule 4: Payment Transaction Rules
- Multiple transactions allowed per booking (for retries)
- Only one 'success' transaction should exist per booking (application logic)
- Refund creates new transaction with status 'refunded'

---

## Data Integrity Summary

✅ **Prevents Double-Booking**: Application logic + RESTRICT constraint on bookings.time_slot_id
✅ **Preserves Payment History**: SET NULL on payment_transactions.booking_id
✅ **Maintains Referential Integrity**: RESTRICT on critical relationships
✅ **Cleanup Orphaned Records**: CASCADE on facility/court/time_slot deletion
✅ **Validates Data**: CHECK constraints on all status fields
✅ **Ensures Uniqueness**: UNIQUE constraints on email, sport name, facility_sport pairs

---

## Query Patterns

### Get User's Bookings
```sql
SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC;
```

### Get Facility's Courts
```sql
SELECT * FROM courts WHERE facility_id = ? AND is_active = TRUE;
```

### Get Available Slots for Court (Next 7 Days)
```sql
SELECT * FROM time_slots 
WHERE court_id = ? 
  AND status = 'available'
  AND start_time >= NOW()
  AND start_time <= NOW() + INTERVAL '7 days'
ORDER BY start_time ASC;
```

### Get Sports for Facility
```sql
SELECT s.* FROM sports s
INNER JOIN facility_sports fs ON s.id = fs.sport_id
WHERE fs.facility_id = ? AND fs.is_active = TRUE;
```

### Check Slot Availability
```sql
SELECT COUNT(*) FROM bookings 
WHERE time_slot_id = ? 
  AND booking_status IN ('pending', 'confirmed');
```

