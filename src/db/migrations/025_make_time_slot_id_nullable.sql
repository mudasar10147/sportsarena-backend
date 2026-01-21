-- Make time_slot_id nullable as intermediate step before removal
-- 
-- This migration makes time_slot_id nullable to allow the new booking system
-- to work while we transition away from the old time slot system.
--
-- After this migration, migration 023 will remove the column entirely.
-- NOTE: This migration is now conditional - if time_slot_id doesn't exist, it's a no-op.

-- Step 1: Drop the foreign key constraint (if it exists)
-- This allows time_slot_id to be NULL without foreign key violations
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

-- Step 2: Drop the NOT NULL constraint on time_slot_id (if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'time_slot_id'
    ) THEN
        ALTER TABLE bookings ALTER COLUMN time_slot_id DROP NOT NULL;
        COMMENT ON COLUMN bookings.time_slot_id IS 
          'Time slot ID (deprecated - nullable during migration, will be removed in migration 023)';
    END IF;
END $$;

