-- Add username field to email_verification_codes table
-- This allows us to store the username during signup so we can create the account during verification

-- Add username column (nullable, as it may not always be present)
ALTER TABLE email_verification_codes 
ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_username ON email_verification_codes(username);

-- Add comment
COMMENT ON COLUMN email_verification_codes.username IS 'Username associated with this verification code (used during signup flow)';

