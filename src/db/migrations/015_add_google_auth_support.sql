-- Add Google authentication support to users table
-- Supports multiple auth providers (email, google, etc.) for future extensibility
-- Backward compatible with existing email-based users

-- Add auth provider field (default 'email' for existing users)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email' 
    CHECK (auth_provider IN ('email', 'google'));

-- Add provider ID (e.g., Google user ID) - nullable for email-based users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);

-- Add avatar URL field
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar VARCHAR(500);

-- Make password_hash nullable (Google users don't have passwords)
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- Make username nullable (can be generated for Google users later)
-- Drop the existing unique constraint (PostgreSQL auto-names it as users_username_key)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_username_key;

-- Drop the existing index if it exists (created separately in migration 001)
DROP INDEX IF EXISTS idx_users_username;

-- Re-add username constraint as nullable unique using partial index
-- Note: This allows NULL usernames but ensures uniqueness when username is provided
-- The unique index also serves as a regular index for username lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username 
  ON users(username) 
  WHERE username IS NOT NULL;

-- Add unique constraint on (auth_provider, provider_id) for OAuth providers
-- This ensures one Google account can only be linked to one user
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_unique 
  ON users(auth_provider, provider_id) 
  WHERE provider_id IS NOT NULL;

-- Create index for provider lookups (fast OAuth login)
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider_id) WHERE provider_id IS NOT NULL;

-- Update comments
COMMENT ON COLUMN users.auth_provider IS 'Authentication provider: email (password-based) or google (OAuth)';
COMMENT ON COLUMN users.provider_id IS 'Provider-specific user ID (e.g., Google user ID from sub claim)';
COMMENT ON COLUMN users.avatar IS 'User profile picture URL (from OAuth provider or uploaded)';
COMMENT ON COLUMN users.password_hash IS 'Hashed password (NULL for OAuth users like Google)';
COMMENT ON COLUMN users.username IS 'Unique username (NULL for OAuth users, can be generated later)';

-- Note: Existing users will have:
--   - auth_provider = 'email' (default)
--   - provider_id = NULL
--   - password_hash = existing hash (not null)
--   - username = existing username (not null)

