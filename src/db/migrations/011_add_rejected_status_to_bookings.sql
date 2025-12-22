-- Add 'rejected' status to bookings table
-- Allows facility owners to reject pending bookings

-- Drop existing constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

-- Add new constraint with 'rejected' status
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_status_check 
  CHECK (booking_status IN ('pending', 'confirmed', 'cancelled', 'completed', 'rejected'));

-- Update comments
COMMENT ON COLUMN bookings.booking_status IS 'Status: pending, confirmed, cancelled, completed, or rejected';
COMMENT ON COLUMN bookings.cancellation_reason IS 'Reason for cancellation or rejection (used for both cancelled and rejected bookings)';

