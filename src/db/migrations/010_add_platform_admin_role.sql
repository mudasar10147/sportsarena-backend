-- Add platform_admin role to users table
-- This allows for platform-level administrators who can manage global resources like sports

-- Update the CHECK constraint to include platform_admin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('player', 'facility_admin', 'platform_admin'));

-- Update comment
COMMENT ON COLUMN users.role IS 'User role: player, facility_admin, or platform_admin';

