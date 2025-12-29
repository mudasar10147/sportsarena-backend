-- Add 'rejected' status to bookings table
-- Allows facility owners to reject pending bookings
--
-- Note: 'expired' status is added in migration 021_add_booking_expiration.sql
-- This migration only adds 'rejected' status

-- Drop existing constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

-- Add new constraint with 'rejected' status
-- Note: 'expired' will be added in a later migration
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_status_check 
  CHECK (booking_status IN ('pending', 'confirmed', 'cancelled', 'completed', 'rejected'));

-- Update comments
COMMENT ON COLUMN bookings.booking_status IS 'Status: pending, confirmed, cancelled, completed, or rejected (expired added in migration 021)';
COMMENT ON COLUMN bookings.cancellation_reason IS 'Reason for cancellation or rejection (used for both cancelled and rejected bookings)';

