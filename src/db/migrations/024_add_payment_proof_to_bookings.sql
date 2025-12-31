-- Add payment proof image support to bookings table
-- 
-- This migration adds support for bank transfer payment proofs:
-- - Adds payment_proof_image_id column to link booking to payment proof image
-- - Updates images table to support 'booking' entity type and 'payment_proof' image type
-- - Creates index for fast lookups

-- Step 1: Add payment_proof_image_id column to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_proof_image_id UUID REFERENCES images(id) ON DELETE SET NULL;

-- Step 2: Create index for payment proof lookups
CREATE INDEX IF NOT EXISTS idx_bookings_payment_proof_image ON bookings(payment_proof_image_id)
  WHERE payment_proof_image_id IS NOT NULL;

-- Step 3: Update images table to support 'booking' entity type
-- First, drop the existing CHECK constraint
ALTER TABLE images DROP CONSTRAINT IF EXISTS images_entity_type_check;

-- Add new constraint that includes 'booking'
ALTER TABLE images ADD CONSTRAINT images_entity_type_check 
  CHECK (entity_type IN ('user', 'facility', 'court', 'sport', 'review', 'booking'));

-- Step 4: Update images table to support 'payment_proof' image type
-- First, drop the existing CHECK constraint
ALTER TABLE images DROP CONSTRAINT IF EXISTS images_image_type_check;

-- Add new constraint that includes 'payment_proof'
ALTER TABLE images ADD CONSTRAINT images_image_type_check 
  CHECK (image_type IN ('profile', 'cover', 'gallery', 'icon', 'banner', 'main', 'payment_proof'));

-- Add comments
COMMENT ON COLUMN bookings.payment_proof_image_id IS 
'Reference to payment proof image (bank transfer receipt/screenshot). NULL if payment proof not uploaded yet.';

COMMENT ON COLUMN images.entity_type IS 
'Type of entity: user, facility, court, sport, review, or booking';

COMMENT ON COLUMN images.image_type IS 
'Type of image: profile, cover, gallery, icon, banner, main, or payment_proof';

