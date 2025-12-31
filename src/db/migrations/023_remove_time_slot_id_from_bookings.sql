-- Remove time_slot_id column from bookings table
-- 
-- This migration removes the deprecated time_slot_id column and related index
-- after migrating to the rule-based availability system.
--
-- Prerequisites:
-- - All bookings must use the new structure (court_id, booking_date, start_time, end_time)
-- - No bookings should reference time_slot_id anymore

-- Step 1: Drop the index on time_slot_id
DROP INDEX IF EXISTS idx_bookings_time_slot_id;

-- Step 2: Drop the foreign key constraint (if it exists)
-- Note: The constraint name may vary, so we check if it exists first
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'bookings_time_slot_id_fkey'
        AND table_name = 'bookings'
    ) THEN
        ALTER TABLE bookings DROP CONSTRAINT bookings_time_slot_id_fkey;
    END IF;
END $$;

-- Step 3: Remove the time_slot_id column
ALTER TABLE bookings DROP COLUMN IF EXISTS time_slot_id;

-- Add comment
COMMENT ON TABLE bookings IS 'Bookings use rule-based availability system with court_id, booking_date, start_time, and end_time';

