-- Add pending booking expiration configuration to booking_policies table
-- 
-- Allows facilities/courts to configure how long PENDING bookings remain reserved
-- before expiring and becoming available again.

ALTER TABLE booking_policies
  ADD COLUMN IF NOT EXISTS pending_booking_expiration_hours INTEGER 
    CHECK (pending_booking_expiration_hours > 0);

-- Add comment
COMMENT ON COLUMN booking_policies.pending_booking_expiration_hours IS 
'Expiration duration for PENDING bookings in hours. NULL uses system default (24 hours).';

