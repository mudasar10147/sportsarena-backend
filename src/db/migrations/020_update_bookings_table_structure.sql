-- Update bookings table structure for rule-based availability system
-- 
-- Changes:
-- - Remove time_slot_id reference (time slots removed)
-- - Add court_id, booking_date, start_time, end_time
-- - Keep existing booking_status, payment fields
--
-- This migration handles the transition from slot-based to rule-based bookings

-- Step 1: Add new columns (nullable initially for migration)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS court_id INTEGER REFERENCES courts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS booking_date DATE,
  ADD COLUMN IF NOT EXISTS start_time INTEGER CHECK (start_time >= 0 AND start_time < 1440),
  ADD COLUMN IF NOT EXISTS end_time INTEGER CHECK (end_time >= 0 AND end_time < 1440);

-- Step 2: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_bookings_court_date ON bookings(court_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_time_range ON bookings(court_id, booking_date, start_time, end_time);

-- Step 3: Create index for overlap detection queries
-- This index helps with fast overlap detection: WHERE court_id = X AND booking_date = Y AND overlaps
CREATE INDEX IF NOT EXISTS idx_bookings_overlap_check ON bookings(court_id, booking_date, start_time, end_time) 
  WHERE booking_status NOT IN ('cancelled');

-- Step 4: Add constraint to ensure time range is valid (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_booking_time_range'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT check_booking_time_range CHECK (
        start_time IS NULL OR end_time IS NULL OR start_time < end_time
      );
  END IF;
END $$;

-- Step 5: Add constraint to ensure booking_date is set when using new structure
-- (This allows gradual migration - old bookings can have NULL, new ones must have date)
-- Note: This constraint is commented out initially to allow gradual migration
-- Uncomment after all old bookings are migrated
-- ALTER TABLE bookings
--   ADD CONSTRAINT check_booking_structure CHECK (
--     (time_slot_id IS NOT NULL AND court_id IS NULL AND booking_date IS NULL) OR
--     (time_slot_id IS NULL AND court_id IS NOT NULL AND booking_date IS NOT NULL AND start_time IS NOT NULL AND end_time IS NOT NULL)
--   );

-- Add comments
COMMENT ON COLUMN bookings.court_id IS 'Court ID (new rule-based structure)';
COMMENT ON COLUMN bookings.booking_date IS 'Booking date (YYYY-MM-DD)';
COMMENT ON COLUMN bookings.start_time IS 'Start time in minutes since midnight (0-1439)';
COMMENT ON COLUMN bookings.end_time IS 'End time in minutes since midnight (0-1439)';
-- Note: time_slot_id column comment removed as column may not exist in all environments

