-- Create users table for SportsArena MVP
-- Stores all user accounts (players & facility owners)

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'facility_admin')),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Create index on username for faster lookups
CREATE INDEX idx_users_username ON users(username);

-- Create index on role for filtering
CREATE INDEX idx_users_role ON users(role);

-- Create index on is_active for active user queries
CREATE INDEX idx_users_is_active ON users(is_active);

-- Add comment to table
COMMENT ON TABLE users IS 'Stores all user accounts (players & facility owners)';
COMMENT ON COLUMN users.username IS 'Unique username for user account';
COMMENT ON COLUMN users.role IS 'User role: player or facility_admin';
COMMENT ON COLUMN users.email_verified IS 'Whether user has verified their email address';

