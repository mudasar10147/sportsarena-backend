-- Create facility_sports table for SportsArena MVP
-- Linking table between facilities and sports (many-to-many relationship)

CREATE TABLE IF NOT EXISTS facility_sports (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    sport_id INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(facility_id, sport_id)
);

-- Create index on facility_id for faster facility queries
CREATE INDEX idx_facility_sports_facility_id ON facility_sports(facility_id);

-- Create index on sport_id for faster sport queries
CREATE INDEX idx_facility_sports_sport_id ON facility_sports(sport_id);

-- Create index on is_active for filtering
CREATE INDEX idx_facility_sports_is_active ON facility_sports(is_active);

-- Add comment to table
COMMENT ON TABLE facility_sports IS 'Linking table between facilities and sports - many-to-many relationship';
COMMENT ON COLUMN facility_sports.facility_id IS 'Reference to facility';
COMMENT ON COLUMN facility_sports.sport_id IS 'Reference to sport';

