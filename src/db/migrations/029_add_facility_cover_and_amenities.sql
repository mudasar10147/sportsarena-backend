-- Add cover image and amenities support to facilities table
-- Cover image: Facebook-style cover photo for mobile display
-- Amenities: Array of facility features (max 8)

-- Add amenities column (JSONB array of amenity strings)
ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb;

-- Add comment for amenities
COMMENT ON COLUMN facilities.amenities IS 'JSON array of facility amenities/features (max 8). Valid values: parking, wifi, restroom, cafeteria, lighting, water, seating, pro_shop, locker_room, shower, air_conditioning, first_aid, equipment_rental, coaching, spectator_area, wheelchair_accessible';

-- Create index for amenities search (GIN index for JSONB containment queries)
CREATE INDEX IF NOT EXISTS idx_facilities_amenities ON facilities USING GIN (amenities);

-- Note: Cover image is handled via the images table with entity_type='facility' and image_type='cover'
-- Gallery images are handled via the images table with entity_type='facility' and image_type='gallery'
