-- Create email_verification_codes table
-- Stores email verification codes for user email verification
-- Codes are hashed before storage for security

CREATE TABLE IF NOT EXISTS email_verification_codes (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP NULL,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    is_used BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Create index on email for faster lookups
CREATE INDEX idx_email_verification_codes_email ON email_verification_codes(email);

-- Create index on expires_at for cleanup operations
CREATE INDEX idx_email_verification_codes_expires_at ON email_verification_codes(expires_at);

-- Create index on code_hash for verification lookups
CREATE INDEX idx_email_verification_codes_code_hash ON email_verification_codes(code_hash);

-- Create composite index on (email, expires_at) for active code lookups
CREATE INDEX idx_email_verification_codes_email_expires ON email_verification_codes(email, expires_at);

-- Create index on is_used for filtering used codes
CREATE INDEX idx_email_verification_codes_is_used ON email_verification_codes(is_used);

-- Add unique constraint to prevent duplicate active codes per email
-- This ensures only one active (non-expired, unused) code exists per email at a time
-- Note: PostgreSQL doesn't support partial unique indexes with OR conditions directly,
-- so we'll handle this in application logic, but add a regular unique constraint
-- on (email, code_hash) to prevent exact duplicates
CREATE UNIQUE INDEX idx_email_verification_codes_email_code_hash ON email_verification_codes(email, code_hash);

-- Add check constraint for expiration validation
-- Ensures expires_at is in the future when code is created
ALTER TABLE email_verification_codes 
ADD CONSTRAINT chk_email_verification_expires_future 
CHECK (expires_at > created_at);

-- Add check constraint for attempts validation
-- Ensures attempts don't exceed max_attempts
ALTER TABLE email_verification_codes 
ADD CONSTRAINT chk_email_verification_attempts 
CHECK (attempts >= 0 AND attempts <= max_attempts);

-- Add check constraint for max_attempts validation
-- Ensures max_attempts is a positive value
ALTER TABLE email_verification_codes 
ADD CONSTRAINT chk_email_verification_max_attempts 
CHECK (max_attempts > 0);

-- Optional: Add foreign key to users table
-- This creates a relationship but allows codes for unregistered emails during signup
-- We'll make it nullable and optional to support signup flow
-- Note: This assumes users.email exists and is the reference
-- ALTER TABLE email_verification_codes
-- ADD CONSTRAINT fk_email_verification_users_email
-- FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE;

-- Add comments to table and columns
COMMENT ON TABLE email_verification_codes IS 'Stores email verification codes for user email verification. Codes are hashed before storage.';
COMMENT ON COLUMN email_verification_codes.email IS 'Email address to verify';
COMMENT ON COLUMN email_verification_codes.code_hash IS 'Hashed verification code (bcrypt). Never store plain codes.';
COMMENT ON COLUMN email_verification_codes.expires_at IS 'Timestamp when code expires (typically 10-15 minutes after creation)';
COMMENT ON COLUMN email_verification_codes.verified_at IS 'Timestamp when code was successfully verified (NULL if not verified)';
COMMENT ON COLUMN email_verification_codes.attempts IS 'Number of verification attempts made (incremented on each failed attempt)';
COMMENT ON COLUMN email_verification_codes.max_attempts IS 'Maximum allowed verification attempts (default: 5)';
COMMENT ON COLUMN email_verification_codes.is_used IS 'Whether code has been successfully verified and used';
COMMENT ON COLUMN email_verification_codes.ip_address IS 'IP address of the request that generated the code (for security tracking)';
COMMENT ON COLUMN email_verification_codes.user_agent IS 'User agent of the request that generated the code (for security tracking)';

