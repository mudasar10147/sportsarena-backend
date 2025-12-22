-- Add moderation and soft-delete support to images table
-- Supports content moderation workflow and proper soft deletion

ALTER TABLE images
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'pending' 
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;

-- Create indexes for moderation queries
CREATE INDEX IF NOT EXISTS idx_images_moderation_status ON images(moderation_status);
CREATE INDEX IF NOT EXISTS idx_images_is_deleted ON images(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_images_pending_moderation ON images(moderation_status) WHERE moderation_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_images_moderated_by ON images(moderated_by);

-- Composite index for common queries (active, approved, not deleted)
CREATE INDEX IF NOT EXISTS idx_images_active_approved 
  ON images(is_active, moderation_status, is_deleted) 
  WHERE is_active = TRUE AND moderation_status = 'approved' AND is_deleted = FALSE;

-- Update comments
COMMENT ON COLUMN images.is_deleted IS 'Soft delete flag. Deleted images are never returned in queries.';
COMMENT ON COLUMN images.moderation_status IS 'Moderation status: pending (awaiting review), approved (visible to public), rejected (hidden from public)';
COMMENT ON COLUMN images.moderation_notes IS 'Notes from moderator explaining approval/rejection decision';
COMMENT ON COLUMN images.moderated_by IS 'User ID of admin who moderated this image';
COMMENT ON COLUMN images.moderated_at IS 'Timestamp when image was moderated';

-- Note: is_active is kept for backward compatibility and can be used for temporary hiding
-- is_deleted is for permanent soft deletion (images are never returned if is_deleted = true)
-- moderation_status controls public visibility (only 'approved' images are visible to public)

