# 🟧 Booking Model

### Overview
The `Booking` model represents a confirmed booking record created after payment. It links a user to a time slot with pricing and status tracking.

### Database Schema
**Table:** `bookings`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing booking ID |
| `user_id` | INTEGER | NOT NULL, REFERENCES users(id) | User who made the booking |
| `time_slot_id` | INTEGER | NOT NULL, REFERENCES time_slots(id) | Time slot being booked |
| `final_price` | DECIMAL(10,2) | NOT NULL | Final booking price in PKR |
| `booking_status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | Status: pending, confirmed, cancelled, completed |
| `payment_reference` | VARCHAR(255) | NULL | Payment transaction ID or gateway reference |
| `cancellation_reason` | TEXT | NULL | Reason for cancellation (if cancelled) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Constraints:**
- `CHECK (booking_status IN ('pending', 'confirmed', 'cancelled', 'completed'))` - Valid status values

**Indexes:**
- `idx_bookings_user_id` - Fast user booking queries
- `idx_bookings_time_slot_id` - Slot booking lookups
- `idx_bookings_status` - Filter by status
- `idx_bookings_payment_reference` - Payment lookups
- `idx_bookings_user_status` - Composite index for user + status
- `idx_bookings_created_at` - Date-based queries

### Model Methods

#### `Booking.create(bookingData)`
Creates a new booking.
- **Parameters:** `{ userId, timeSlotId, finalPrice, bookingStatus?, paymentReference? }`
- **Returns:** Booking object
- **Note:** Status defaults to 'pending', price in PKR

#### `Booking.findById(bookingId)`
Finds booking by ID.
- **Parameters:** `bookingId` (number)
- **Returns:** Booking object or `null`

#### `Booking.findByUserId(userId, options?)`
Finds all bookings for a user.
- **Parameters:** `userId` (number), `{ status?, limit?, offset? }`
- **Returns:** `{ bookings: [], total: number, limit: number, offset: number }`

#### `Booking.findByTimeSlotId(timeSlotId)`
Finds booking for a time slot.
- **Parameters:** `timeSlotId` (number)
- **Returns:** Booking object or `null`

#### `Booking.findByPaymentReference(paymentReference)`
Finds booking by payment transaction reference.
- **Parameters:** `paymentReference` (string)
- **Returns:** Booking object or `null`

#### `Booking.findAll(options?)`
Gets all bookings with filtering and pagination.
- **Parameters:** `{ limit?, offset?, status?, userId? }`
- **Returns:** `{ bookings: [], total: number, limit: number, offset: number }`

#### `Booking.update(bookingId, updateData)`
Updates booking information.
- **Parameters:** `bookingId` (number), `updateData` (object)
- **Allowed fields:** `bookingStatus`, `paymentReference`, `cancellationReason`
- **Returns:** Updated booking object or `null`

#### `Booking.confirm(bookingId, paymentReference)`
Confirms booking after payment.
- **Parameters:** `bookingId` (number), `paymentReference` (string)
- **Returns:** Updated booking object or `null`

#### `Booking.cancel(bookingId, cancellationReason?)`
Cancels a booking.
- **Parameters:** `bookingId` (number), `cancellationReason?` (string)
- **Returns:** Updated booking object or `null`

#### `Booking.markAsCompleted(bookingId)`
Marks booking as completed.
- **Parameters:** `bookingId` (number)
- **Returns:** Updated booking object or `null`

### Usage Examples

```javascript
const Booking = require('./models/Booking');

// Create a booking (after payment)
const booking = await Booking.create({
  userId: 1,
  timeSlotId: 5,
  finalPrice: 1500, // PKR
  bookingStatus: 'pending',
  paymentReference: 'txn_123456789'
});

// Confirm booking after payment success
await Booking.confirm(bookingId, 'txn_123456789');

// Get user's bookings
const { bookings } = await Booking.findByUserId(userId, {
  status: 'confirmed',
  limit: 20
});

// Find booking by payment reference
const booking = await Booking.findByPaymentReference('txn_123456789');

// Cancel booking
await Booking.cancel(bookingId, 'User requested cancellation');
```

### Booking Flow (MVP)
1. User selects time slot
2. Create booking with status 'pending'
3. Process payment
4. Confirm booking with payment reference
5. Update time slot status to 'booked'

### Notes
- Status values: 'pending', 'confirmed', 'cancelled', 'completed'
- Price stored as DECIMAL(10,2) for precise PKR amounts
- Restrict delete on user and time_slot (preserves data integrity)
- Payment reference links to payment gateway transaction
- Cancellation reason optional but recommended

