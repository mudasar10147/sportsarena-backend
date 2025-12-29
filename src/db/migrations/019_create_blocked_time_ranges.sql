-- Create blocked_time_ranges table
-- Stores admin-blocked time ranges for maintenance, private events, etc.
--
-- Blocked ranges can be:
-- - One-time (specific date + time range)
-- - Recurring (day of week + time range, applies to all dates)
-- - Date range (blocks all times within a date range)
--
-- Blocked ranges can be at facility level (all courts) or court level (specific court)

CREATE TABLE IF NOT EXISTS blocked_time_ranges (
    id SERIAL PRIMARY KEY,
    
    -- Block scope: 'facility' or 'court'
    facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE,
    court_id INTEGER REFERENCES courts(id) ON DELETE CASCADE,
    
    -- Block type: 'one_time', 'recurring', or 'date_range'
    block_type VARCHAR(20) NOT NULL CHECK (block_type IN ('one_time', 'recurring', 'date_range')),
    
    -- For 'one_time' and 'date_range': specific date(s)
    -- For 'recurring': NULL (applies to all dates)
    start_date DATE,
    end_date DATE,
    
    -- For 'one_time' and 'recurring': time range in minutes since midnight
    -- For 'date_range': NULL (blocks entire day)
    start_time INTEGER CHECK (start_time IS NULL OR (start_time >= 0 AND start_time < 1440)),
    end_time INTEGER CHECK (end_time IS NULL OR (end_time >= 0 AND end_time < 1440)),
    
    -- For 'recurring': day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    -- For 'one_time' and 'date_range': NULL
    day_of_week INTEGER CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
    
    -- Reason for blocking (for admin reference)
    reason VARCHAR(255),
    description TEXT,
    
    -- Whether this block is currently active
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Who created this block (admin user)
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure proper scope
    CONSTRAINT check_block_scope CHECK (
        (facility_id IS NOT NULL AND court_id IS NULL) OR
        (facility_id IS NOT NULL AND court_id IS NOT NULL)
    ),
    
    -- Ensure block_type-specific fields are set correctly
    CONSTRAINT check_one_time_block CHECK (
        block_type != 'one_time' OR (
            start_date IS NOT NULL AND
            start_time IS NOT NULL AND
            end_time IS NOT NULL AND
            day_of_week IS NULL
        )
    ),
    CONSTRAINT check_recurring_block CHECK (
        block_type != 'recurring' OR (
            start_date IS NULL AND
            end_date IS NULL AND
            start_time IS NOT NULL AND
            end_time IS NOT NULL AND
            day_of_week IS NOT NULL
        )
    ),
    CONSTRAINT check_date_range_block CHECK (
        block_type != 'date_range' OR (
            start_date IS NOT NULL AND
            end_date IS NOT NULL AND
            start_time IS NULL AND
            end_time IS NULL AND
            day_of_week IS NULL
        )
    )
);

-- Create indexes
CREATE INDEX idx_blocked_ranges_facility ON blocked_time_ranges(facility_id);
CREATE INDEX idx_blocked_ranges_court ON blocked_time_ranges(court_id);
CREATE INDEX idx_blocked_ranges_type ON blocked_time_ranges(block_type);
CREATE INDEX idx_blocked_ranges_active ON blocked_time_ranges(is_active);
CREATE INDEX idx_blocked_ranges_dates ON blocked_time_ranges(start_date, end_date);
CREATE INDEX idx_blocked_ranges_day ON blocked_time_ranges(day_of_week);
CREATE INDEX idx_blocked_ranges_time ON blocked_time_ranges(start_time, end_time);
CREATE INDEX idx_blocked_ranges_court_dates ON blocked_time_ranges(court_id, start_date, end_date);

-- Add comments
COMMENT ON TABLE blocked_time_ranges IS 
'Admin-blocked time ranges for maintenance, private events, etc. Supports one-time, recurring, and date-range blocks.';

COMMENT ON COLUMN blocked_time_ranges.block_type IS 
'Type of block: one_time (specific date+time), recurring (day of week+time), or date_range (all times in date range).';

COMMENT ON COLUMN blocked_time_ranges.start_date IS 
'For one_time and date_range blocks: start date. For recurring: NULL.';

COMMENT ON COLUMN blocked_time_ranges.end_date IS 
'For date_range blocks: end date. For one_time: same as start_date. For recurring: NULL.';

COMMENT ON COLUMN blocked_time_ranges.start_time IS 
'For one_time and recurring blocks: start time in minutes since midnight. For date_range: NULL.';

COMMENT ON COLUMN blocked_time_ranges.end_time IS 
'For one_time and recurring blocks: end time in minutes since midnight. For date_range: NULL.';

COMMENT ON COLUMN blocked_time_ranges.day_of_week IS 
'For recurring blocks: day of week (0=Sunday, 6=Saturday). For one_time and date_range: NULL.';

COMMENT ON COLUMN blocked_time_ranges.reason IS 
'Reason for blocking (e.g., "Maintenance", "Private Event", "Court Renovation").';

