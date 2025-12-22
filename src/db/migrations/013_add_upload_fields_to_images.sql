-- Add upload lifecycle fields to images table
-- Supports tracking upload status, file metadata, and upload timestamps

ALTER TABLE images
  ADD COLUMN IF NOT EXISTS upload_status VARCHAR(20) DEFAULT 'pending' 
    CHECK (upload_status IN ('pending', 'uploaded', 'failed')),
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS content_type TEXT;

-- Create index on upload_status for filtering
CREATE INDEX IF NOT EXISTS idx_images_upload_status ON images(upload_status);

-- Create composite index for entity + upload_status queries
CREATE INDEX IF NOT EXISTS idx_images_entity_upload_status 
  ON images(entity_type, entity_id, upload_status);

-- Update comments
COMMENT ON COLUMN images.upload_status IS 'Upload lifecycle status: pending (awaiting upload), uploaded (successfully uploaded), failed (upload failed)';
COMMENT ON COLUMN images.uploaded_at IS 'Timestamp when image was successfully uploaded to S3';
COMMENT ON COLUMN images.file_size IS 'File size in bytes';
COMMENT ON COLUMN images.content_type IS 'MIME type of the uploaded file (image/jpeg, image/png, image/webp)';

-- Note: storage_key and url are already in the table from migration 012
-- We store S3 object keys (storage_key), not public URLs
-- URLs can be generated from storage_key when needed

