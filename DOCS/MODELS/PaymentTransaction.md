# 🟥 PaymentTransaction Model

### Overview
The `PaymentTransaction` model records every payment attempt and confirmation. It stores payment gateway transaction IDs, amounts, methods, and status to verify payment success and confirm booking validity.

### Database Schema
**Table:** `payment_transactions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing transaction ID |
| `booking_id` | INTEGER | REFERENCES bookings(id) | Associated booking (nullable) |
| `amount` | DECIMAL(10,2) | NOT NULL | Payment amount in PKR |
| `payment_method` | VARCHAR(50) | NOT NULL | Payment method (e.g., 'card', 'bank_transfer') |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | Status: pending, success, failed, refunded |
| `gateway_name` | VARCHAR(50) | NULL | Payment gateway name (e.g., 'stripe', 'razorpay') |
| `gateway_transaction_id` | VARCHAR(255) | NULL | Transaction ID from payment gateway |
| `gateway_response` | JSONB | NULL | Full response from payment gateway (JSON) |
| `failure_reason` | TEXT | NULL | Reason for failure (if failed) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Constraints:**
- `CHECK (status IN ('pending', 'success', 'failed', 'refunded'))` - Valid status values

**Indexes:**
- `idx_payment_transactions_booking_id` - Fast booking queries
- `idx_payment_transactions_status` - Filter by status
- `idx_payment_transactions_gateway_id` - Gateway transaction lookups
- `idx_payment_transactions_gateway_name` - Gateway filtering
- `idx_payment_transactions_booking_status` - Composite index for booking + status
- `idx_payment_transactions_created_at` - Date-based queries

### Model Methods

#### `PaymentTransaction.create(transactionData)`
Creates a new payment transaction.
- **Parameters:** `{ bookingId?, amount, paymentMethod, status?, gatewayName?, gatewayTransactionId?, gatewayResponse?, failureReason? }`
- **Returns:** Payment transaction object
- **Note:** Amount in PKR, gatewayResponse stored as JSONB

#### `PaymentTransaction.findById(transactionId)`
Finds transaction by ID.
- **Parameters:** `transactionId` (number)
- **Returns:** Payment transaction object or `null`

#### `PaymentTransaction.findByBookingId(bookingId)`
Finds all transactions for a booking.
- **Parameters:** `bookingId` (number)
- **Returns:** Array of payment transaction objects

#### `PaymentTransaction.findByGatewayTransactionId(gatewayTransactionId)`
Finds transaction by gateway transaction ID.
- **Parameters:** `gatewayTransactionId` (string)
- **Returns:** Payment transaction object or `null`

#### `PaymentTransaction.findAll(options?)`
Gets all transactions with filtering and pagination.
- **Parameters:** `{ limit?, offset?, status?, bookingId?, gatewayName? }`
- **Returns:** `{ transactions: [], total: number, limit: number, offset: number }`

#### `PaymentTransaction.update(transactionId, updateData)`
Updates transaction information.
- **Parameters:** `transactionId` (number), `updateData` (object)
- **Allowed fields:** `status`, `gatewayTransactionId`, `gatewayResponse`, `failureReason`
- **Returns:** Updated transaction object or `null`

#### `PaymentTransaction.markAsSuccess(transactionId, gatewayTransactionId, gatewayResponse?)`
Marks transaction as successful.
- **Parameters:** `transactionId` (number), `gatewayTransactionId` (string), `gatewayResponse?` (object)
- **Returns:** Updated transaction object or `null`

#### `PaymentTransaction.markAsFailed(transactionId, failureReason, gatewayResponse?)`
Marks transaction as failed.
- **Parameters:** `transactionId` (number), `failureReason` (string), `gatewayResponse?` (object)
- **Returns:** Updated transaction object or `null`

#### `PaymentTransaction.markAsRefunded(transactionId, gatewayResponse?)`
Marks transaction as refunded.
- **Parameters:** `transactionId` (number), `gatewayResponse?` (object)
- **Returns:** Updated transaction object or `null`

### Usage Examples

```javascript
const PaymentTransaction = require('./models/PaymentTransaction');

// Create payment transaction
const transaction = await PaymentTransaction.create({
  bookingId: 1,
  amount: 1500, // PKR
  paymentMethod: 'card',
  status: 'pending',
  gatewayName: 'razorpay'
});

// Update with gateway response after payment
await PaymentTransaction.markAsSuccess(
  transactionId,
  'txn_123456789',
  { id: 'txn_123456789', status: 'captured', ... }
);

// Find by gateway transaction ID
const txn = await PaymentTransaction.findByGatewayTransactionId('txn_123456789');

// Get all transactions for a booking
const transactions = await PaymentTransaction.findByBookingId(bookingId);
```

### Payment Flow (MVP)
1. Create transaction with status 'pending'
2. Initiate payment with gateway (Stripe/Razorpay)
3. Receive gateway callback/webhook
4. Update transaction status (success/failed)
5. Update booking status based on payment result

### Notes
- Status values: 'pending', 'success', 'failed', 'refunded'
- Amount stored as DECIMAL(10,2) for precise PKR amounts
- Gateway response stored as JSONB for flexibility
- SET NULL on booking delete (preserves payment history)
- Supports multiple payment gateways (Stripe, Razorpay, etc.)

