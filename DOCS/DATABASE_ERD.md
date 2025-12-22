# 📊 SportsArena Database ERD (Entity Relationship Diagram)

## Complete Entity Relationship Diagram

```
┌─────────────────┐
│     USERS       │
│─────────────────│
│ id (PK)         │
│ email (UNIQUE)  │◄─────┐
│ password_hash   │      │
│ first_name      │      │
│ last_name       │      │
│ phone           │      │
│ role            │      │
│ is_active       │      │
│ email_verified  │      │
│ created_at      │      │
│ updated_at      │      │
└─────────────────┘      │
         │                │
         │ 1              │
         │                │
         │ has many       │
         │                │
         ▼                │
┌─────────────────┐      │
│   FACILITIES    │      │
│─────────────────│      │
│ id (PK)         │      │
│ name            │      │
│ address         │      │
│ city            │      │
│ latitude        │      │
│ longitude       │      │
│ owner_id (FK)   │──────┘
│ photos          │
│ opening_hours    │
│ is_active       │
│ created_at      │
│ updated_at      │
└─────────────────┘
         │
         │ 1
         │
         │ has many
         │
         ▼
┌─────────────────┐
│     COURTS      │
│─────────────────│
│ id (PK)         │
│ facility_id(FK) │
│ sport_id (FK)   │───┐
│ name            │   │
│ price_per_hour  │   │
│ is_indoor       │   │
│ is_active       │   │
│ created_at      │   │
│ updated_at      │   │
└─────────────────┘   │
         │             │
         │ 1           │
         │             │
         │ has many    │
         │             │
         ▼             │
┌─────────────────┐   │
│   TIME_SLOTS    │   │
│─────────────────│   │
│ id (PK)         │   │
│ court_id (FK)   │   │
│ start_time      │   │
│ end_time        │   │
│ status          │   │
│ created_at      │   │
│ updated_at      │   │
└─────────────────┘   │
         │             │
         │ 1           │
         │             │
         │ has one     │
         │             │
         ▼             │
┌─────────────────┐   │
│    BOOKINGS     │   │
│─────────────────│   │
│ id (PK)         │   │
│ user_id (FK)    │───┼──┐
│ time_slot_id(FK)│   │  │
│ final_price     │   │  │
│ booking_status  │   │  │
│ payment_ref     │   │  │
│ created_at      │   │  │
│ updated_at      │   │  │
└─────────────────┘   │  │
         │             │  │
         │ 1           │  │
         │             │  │
         │ has many    │  │
         │             │  │
         ▼             │  │
┌─────────────────┐   │  │
│PAYMENT_TRANSACTIONS│ │  │
│─────────────────│   │  │
│ id (PK)         │   │  │
│ booking_id (FK) │───┘  │
│ amount          │      │
│ payment_method  │      │
│ status          │      │
│ gateway_name    │      │
│ gateway_txn_id  │      │
│ gateway_response│      │
│ created_at      │      │
│ updated_at      │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│     SPORTS      │      │
│─────────────────│      │
│ id (PK)         │      │
│ name (UNIQUE)   │      │
│ description     │      │
│ icon_url        │      │
│ is_active       │      │
│ created_at      │      │
│ updated_at      │      │
└─────────────────┘      │
         │                │
         │ many           │
         │                │
         │ many-to-many   │
         │                │
         ▼                │
┌─────────────────┐      │
│ FACILITY_SPORTS │      │
│─────────────────│      │
│ id (PK)         │      │
│ facility_id(FK) │──────┘
│ sport_id (FK)   │───────┘
│ is_active       │
│ created_at      │
│ updated_at      │
│ UNIQUE(facility_id, sport_id)
└─────────────────┘
```

## Relationship Summary

### One-to-Many Relationships

1. **User → Facility** (1:N)
   - One user (facility_admin) can own many facilities
   - Foreign Key: `facilities.owner_id` → `users.id`
   - Delete: SET NULL (preserves facilities if user deleted)

2. **User → Booking** (1:N)
   - One user can have many bookings
   - Foreign Key: `bookings.user_id` → `users.id`
   - Delete: RESTRICT (prevents deletion if bookings exist)

3. **Facility → Court** (1:N)
   - One facility can have many courts
   - Foreign Key: `courts.facility_id` → `facilities.id`
   - Delete: CASCADE (deletes courts when facility deleted)

4. **Court → TimeSlot** (1:N)
   - One court can have many time slots
   - Foreign Key: `time_slots.court_id` → `courts.id`
   - Delete: CASCADE (deletes slots when court deleted)

5. **Booking → PaymentTransaction** (1:N)
   - One booking can have many payment transactions (retries, refunds)
   - Foreign Key: `payment_transactions.booking_id` → `bookings.id`
   - Delete: SET NULL (preserves payment history)

### One-to-One Relationships

1. **TimeSlot → Booking** (1:1 for confirmed booking)
   - One time slot can have one confirmed booking
   - Foreign Key: `bookings.time_slot_id` → `time_slots.id`
   - Delete: RESTRICT (prevents deletion if booking exists)
   - **Note:** Business logic ensures only one active booking per slot

### Many-to-Many Relationships

1. **Facility ↔ Sport** (M:N via FacilitySport)
   - One facility can offer many sports
   - One sport can be available at many facilities
   - Junction Table: `facility_sports`
   - Foreign Keys:
     - `facility_sports.facility_id` → `facilities.id` (CASCADE)
     - `facility_sports.sport_id` → `sports.id` (CASCADE)
   - Unique Constraint: `UNIQUE(facility_id, sport_id)`

### Additional Relationships

1. **Sport → Court** (1:N)
   - One sport can have many courts
   - Foreign Key: `courts.sport_id` → `sports.id`
   - Delete: RESTRICT (prevents deletion if courts exist)

## Key Constraints

### Unique Constraints
- `users.email` - Email must be unique
- `sports.name` - Sport name must be unique
- `facility_sports(facility_id, sport_id)` - One facility cannot have duplicate sport assignments

### Check Constraints
- `users.role` IN ('player', 'facility_admin')
- `bookings.booking_status` IN ('pending', 'confirmed', 'cancelled', 'completed')
- `time_slots.status` IN ('available', 'blocked', 'booked')
- `payment_transactions.status` IN ('pending', 'success', 'failed', 'refunded')
- `time_slots.end_time > start_time` - Valid time range

### Foreign Key Constraints
- All foreign keys have appropriate ON DELETE actions
- RESTRICT: Prevents deletion if dependent records exist (data integrity)
- CASCADE: Deletes dependent records (cleanup)
- SET NULL: Preserves records but nullifies reference (history preservation)

## Slot Availability Rules

### Business Rules (Application Level)

1. **Double-Booking Prevention**
   - Only one booking with status 'confirmed' or 'pending' per time slot
   - Enforced at application level (check before creating booking)
   - Time slot status must be 'available' before booking

2. **Time Slot Status Flow**
   ```
   available → booked (when booking confirmed)
   available → blocked (by facility admin)
   booked → available (when booking cancelled)
   blocked → available (when unblocked by admin)
   ```

3. **Booking Status Flow**
   ```
   pending → confirmed (after payment success)
   pending → cancelled (payment failed or user cancelled)
   confirmed → cancelled (refund scenario)
   confirmed → completed (after time slot ends)
   ```

4. **Payment Transaction Rules**
   - Multiple transactions allowed per booking (retries, refunds)
   - Only one 'success' transaction should exist per booking (application logic)
   - Refund creates new transaction with status 'refunded'

## Data Integrity Guarantees

✅ **Prevents Double-Booking**: Application logic + database constraints
✅ **Preserves Payment History**: SET NULL on booking delete
✅ **Maintains Referential Integrity**: RESTRICT on critical relationships
✅ **Cleanup Orphaned Records**: CASCADE on facility/court deletion
✅ **Validates Data**: CHECK constraints on status fields
✅ **Ensures Uniqueness**: UNIQUE constraints on critical fields

