-- Create sports table for SportsArena MVP
-- Predefined list of sports available on the platform

CREATE TABLE IF NOT EXISTS sports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on name for faster lookups
CREATE INDEX idx_sports_name ON sports(name);

-- Create index on is_active for filtering active sports
CREATE INDEX idx_sports_is_active ON sports(is_active);

-- Add comment to table
COMMENT ON TABLE sports IS 'Predefined list of sports available on the platform';
COMMENT ON COLUMN sports.icon_url IS 'URL to sport icon/image (optional)';

-- Insert initial sports (common sports for Pakistani market)
INSERT INTO sports (name, description) VALUES
    ('Padel', 'Racquet sport played in an enclosed court'),
    ('Tennis', 'Racquet sport played on a rectangular court'),
    ('Badminton', 'Racquet sport played with shuttlecock'),
    ('Football', 'Team sport played with a ball'),
    ('Cricket', 'Bat and ball game'),
    ('Basketball', 'Team sport played on a rectangular court'),
    ('Squash', 'Racquet sport played in a four-walled court'),
    ('Table Tennis', 'Racquet sport played on a table'),
    ('Volleyball', 'Team sport played with a ball over a net')
ON CONFLICT (name) DO NOTHING;

