-- Create court_availability_rules table
-- Stores rule-based availability for courts (day of week + time ranges)
-- Uses minutes since midnight (0-1439) for time storage
--
-- This is a rule-based approach: instead of storing individual time slots,
-- we store availability rules that can generate slots on-demand.
--
-- Example: Court 1 is available Monday-Friday 9:00-18:00, Saturday 10:00-16:00

CREATE TABLE IF NOT EXISTS court_availability_rules (
    id SERIAL PRIMARY KEY,
    court_id INTEGER NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
    
    -- Day of week: 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    
    -- Time range using minutes since midnight (0-1439)
    -- Supports midnight crossover (e.g., 18:00 → 02:00 = 1080 → 120)
    start_time INTEGER NOT NULL CHECK (start_time >= 0 AND start_time < 1440),
    end_time INTEGER NOT NULL CHECK (end_time >= 0 AND end_time < 1440),
    
    -- Whether this rule is currently active
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Optional: Override price for this specific time range
    -- NULL means use court's default price_per_hour
    price_per_hour_override DECIMAL(10, 2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure no duplicate rules for same court/day
    UNIQUE(court_id, day_of_week, start_time, end_time)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_availability_rules_court_id ON court_availability_rules (court_id);
CREATE INDEX IF NOT EXISTS idx_availability_rules_day ON court_availability_rules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_rules_active ON court_availability_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_availability_rules_court_day ON court_availability_rules(court_id, day_of_week, is_active);
CREATE INDEX IF NOT EXISTS idx_availability_rules_time_range ON court_availability_rules(start_time, end_time);

-- Add comments
COMMENT ON TABLE court_availability_rules IS 
'Rule-based availability for courts. Stores day-of-week + time range rules that generate slots on-demand.';

COMMENT ON COLUMN court_availability_rules.day_of_week IS 
'Day of week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';

COMMENT ON COLUMN court_availability_rules.start_time IS 
'Start time in minutes since midnight (0-1439). Supports midnight crossover.';

COMMENT ON COLUMN court_availability_rules.end_time IS 
'End time in minutes since midnight (0-1439). Supports midnight crossover.';

COMMENT ON COLUMN court_availability_rules.price_per_hour_override IS 
'Optional price override for this time range. NULL uses court default price_per_hour.';

