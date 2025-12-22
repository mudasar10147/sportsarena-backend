-- Create images table for SportsArena MVP
-- Stores image metadata and references (actual files stored in S3, not in database)
-- This table tracks image ownership, types, and relationships to entities

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('user', 'facility', 'court', 'sport', 'review')),
    entity_id INTEGER NOT NULL, -- References the ID of the entity (user.id, facility.id, etc.)
    image_type VARCHAR(50) NOT NULL CHECK (image_type IN ('profile', 'cover', 'gallery', 'icon', 'banner', 'main')),
    storage_key TEXT, -- S3 key or storage path (nullable until S3 integration)
    url TEXT, -- Full URL to image (nullable until S3 integration)
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_primary BOOLEAN DEFAULT FALSE, -- For single-image types (profile, cover, icon, banner, main)
    is_active BOOLEAN DEFAULT TRUE, -- Soft delete
    display_order INTEGER DEFAULT 0, -- For ordering gallery images
    metadata JSONB DEFAULT '{}'::jsonb, -- Store additional metadata (dimensions, file size, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    
    -- Note: Single primary image constraint enforced via partial unique index below
);

-- Create indexes for performance (IF NOT EXISTS to handle re-runs)
CREATE INDEX IF NOT EXISTS idx_images_entity ON images(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_images_created_by ON images(created_by);
CREATE INDEX IF NOT EXISTS idx_images_entity_type_image_type ON images(entity_type, image_type);
CREATE INDEX IF NOT EXISTS idx_images_active ON images(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_images_primary ON images(entity_type, entity_id, is_primary) WHERE is_primary = TRUE;

-- Partial unique index: Only one primary image per entity+type combination
-- This ensures single-image types (profile, cover, icon, banner, main) have only one primary
-- Note: UNIQUE INDEX doesn't support IF NOT EXISTS, so we check if it exists first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_images_single_primary'
    ) THEN
        CREATE UNIQUE INDEX idx_images_single_primary 
            ON images(entity_type, entity_id, image_type) 
            WHERE is_primary = TRUE;
    END IF;
END $$;

-- Add comments
COMMENT ON TABLE images IS 'Stores image metadata and references. Actual image files will be stored in S3.';
COMMENT ON COLUMN images.entity_type IS 'Type of entity: user, facility, court, sport, or review';
COMMENT ON COLUMN images.entity_id IS 'ID of the entity this image belongs to';
COMMENT ON COLUMN images.image_type IS 'Type of image: profile, cover, gallery, icon, banner, or main';
COMMENT ON COLUMN images.storage_key IS 'S3 key or storage path (set when S3 integration is complete)';
COMMENT ON COLUMN images.url IS 'Full URL to the image (set when S3 integration is complete)';
COMMENT ON COLUMN images.is_primary IS 'True for single-image types (profile, cover, icon, banner, main). Only one primary per entity+type.';
COMMENT ON COLUMN images.is_active IS 'Soft delete flag. Set to false to hide image without deleting.';
COMMENT ON COLUMN images.display_order IS 'Order for gallery images (lower numbers appear first)';
COMMENT ON COLUMN images.metadata IS 'JSON object for additional metadata (width, height, file_size, mime_type, etc.)';

