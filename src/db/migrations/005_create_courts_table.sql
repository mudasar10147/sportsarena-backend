-- Create courts table for SportsArena MVP
-- Represents individual courts/grounds at a facility

CREATE TABLE IF NOT EXISTS courts (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    sport_id INTEGER NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_per_hour DECIMAL(10, 2) NOT NULL,
    is_indoor BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on facility_id for faster facility queries
CREATE INDEX idx_courts_facility_id ON courts(facility_id);

-- Create index on sport_id for faster sport queries
CREATE INDEX idx_courts_sport_id ON courts(sport_id);

-- Create index on is_active for filtering
CREATE INDEX idx_courts_is_active ON courts(is_active);

-- Create composite index for facility and active status
CREATE INDEX idx_courts_facility_active ON courts(facility_id, is_active);

-- Add comment to table
COMMENT ON TABLE courts IS 'Represents individual courts/grounds at a facility';
COMMENT ON COLUMN courts.price_per_hour IS 'Price per hour in PKR (Pakistani Rupees)';
COMMENT ON COLUMN courts.is_indoor IS 'TRUE for indoor court, FALSE for outdoor court';
COMMENT ON COLUMN courts.facility_id IS 'Reference to facility that owns this court';
COMMENT ON COLUMN courts.sport_id IS 'Reference to sport type this court is designed for';

