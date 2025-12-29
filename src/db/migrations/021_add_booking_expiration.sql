-- Add booking expiration mechanism for PENDING bookings
-- 
-- PENDING bookings must expire after a configurable duration to prevent
-- indefinite reservation of time slots without payment confirmation.
--
-- This migration:
-- - Adds expires_at timestamp column
-- - Updates booking status constraint to include 'expired'
-- - Creates index for expiration queries

-- Step 1: Add expires_at column
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Step 2: Update booking status constraint to include 'expired'
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

ALTER TABLE bookings ADD CONSTRAINT bookings_booking_status_check 
  CHECK (booking_status IN ('pending', 'confirmed', 'cancelled', 'completed', 'rejected', 'expired'));

-- Step 3: Create index for expiration queries
-- This index helps with:
-- - Finding expired bookings to update
-- - Filtering expired bookings in availability queries
CREATE INDEX IF NOT EXISTS idx_bookings_expires_at ON bookings(expires_at) 
  WHERE booking_status = 'pending';

-- Step 4: Create composite index for active bookings (non-expired pending + confirmed)
-- Note: We don't include CURRENT_TIMESTAMP in the index predicate because it's not immutable.
-- Queries will filter by CURRENT_TIMESTAMP at query time, but the index still helps with
-- the other conditions (status, court_id, booking_date, time ranges).
CREATE INDEX IF NOT EXISTS idx_bookings_active ON bookings(court_id, booking_date, start_time, end_time)
  WHERE booking_status IN ('pending', 'confirmed', 'completed');

-- Add comments
COMMENT ON COLUMN bookings.expires_at IS 
'Expiration timestamp for PENDING bookings. NULL for non-pending or non-expiring bookings.';

COMMENT ON COLUMN bookings.booking_status IS 
'Status: pending (awaiting payment/approval), confirmed, cancelled, completed, rejected, or expired';

