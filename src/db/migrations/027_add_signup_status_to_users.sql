-- Add signup_status field to users table
-- This tracks the signup progress: pending_verification, pending_completion, active

-- Add signup_status column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS signup_status VARCHAR(20) DEFAULT 'active'
CHECK (signup_status IN ('pending_verification', 'pending_completion', 'active'));

-- Make password_hash nullable (for accounts created after email verification but before password setup)
ALTER TABLE users 
ALTER COLUMN password_hash DROP NOT NULL;

-- Make first_name and last_name nullable (for accounts created after email verification but before profile completion)
ALTER TABLE users 
ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE users 
ALTER COLUMN last_name DROP NOT NULL;

-- Update existing users to 'active' status (they have passwords and names)
UPDATE users 
SET signup_status = 'active' 
WHERE password_hash IS NOT NULL 
  AND first_name IS NOT NULL 
  AND last_name IS NOT NULL;

-- Update users without password to 'pending_completion' (OAuth users or incomplete signups)
UPDATE users 
SET signup_status = 'pending_completion' 
WHERE password_hash IS NULL 
  AND signup_status = 'active';

-- Create index on signup_status for faster queries
CREATE INDEX IF NOT EXISTS idx_users_signup_status ON users(signup_status);

-- Add comment
COMMENT ON COLUMN users.signup_status IS 'Signup progress: pending_verification (code sent), pending_completion (verified, no password), active (complete)';

