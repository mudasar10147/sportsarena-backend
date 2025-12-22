-- Create time_slots table for SportsArena MVP
-- Represents available booking slots created by the facility

CREATE TABLE IF NOT EXISTS time_slots (
    id SERIAL PRIMARY KEY,
    court_id INTEGER NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'blocked', 'booked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create index on court_id for faster court queries
CREATE INDEX idx_time_slots_court_id ON time_slots(court_id);

-- Create index on status for filtering
CREATE INDEX idx_time_slots_status ON time_slots(status);

-- Create index on start_time for date range queries
CREATE INDEX idx_time_slots_start_time ON time_slots(start_time);

-- Create composite index for court and status
CREATE INDEX idx_time_slots_court_status ON time_slots(court_id, status);

-- Create composite index for date range queries (court + start_time)
CREATE INDEX idx_time_slots_court_start ON time_slots(court_id, start_time);

-- Add comment to table
COMMENT ON TABLE time_slots IS 'Represents available booking slots created by the facility';
COMMENT ON COLUMN time_slots.status IS 'Status: available, blocked, or booked';
COMMENT ON COLUMN time_slots.start_time IS 'Slot start time (timestamp)';
COMMENT ON COLUMN time_slots.end_time IS 'Slot end time (timestamp)';

