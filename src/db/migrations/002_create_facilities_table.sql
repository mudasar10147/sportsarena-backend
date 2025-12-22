-- Create facilities table for SportsArena MVP
-- Represents each sports venue

CREATE TABLE IF NOT EXISTS facilities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    photos JSONB DEFAULT '[]'::jsonb,
    opening_hours JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on owner_id for facility admin queries
CREATE INDEX idx_facilities_owner_id ON facilities(owner_id);

-- Create index on is_active for active facility queries
CREATE INDEX idx_facilities_is_active ON facilities(is_active);

-- Create index on location for geo-based searches
CREATE INDEX idx_facilities_location ON facilities(latitude, longitude);

-- Create index on city for location-based filtering
CREATE INDEX idx_facilities_city ON facilities(city);

-- Add comment to table
COMMENT ON TABLE facilities IS 'Represents each sports venue/facility';
COMMENT ON COLUMN facilities.photos IS 'JSON array of photo URLs (3-5 photos for MVP)';
COMMENT ON COLUMN facilities.opening_hours IS 'JSON object with opening hours by day (e.g., {"monday": {"open": "09:00", "close": "22:00"}})';
COMMENT ON COLUMN facilities.owner_id IS 'Reference to user who owns/manages this facility (facility_admin role)';

