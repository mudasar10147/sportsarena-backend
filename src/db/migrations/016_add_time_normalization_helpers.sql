-- Time Normalization Helper Functions
-- 
-- PostgreSQL functions to support time normalization using minutes since midnight.
-- These functions help with queries involving time ranges and midnight crossover.
--
-- Note: This migration adds helper functions. Actual table columns should use
-- INTEGER type for time columns (see TIME_NORMALIZATION_GUIDE.md)

-- ============================================================================
-- Function: Check if time is within range (supports midnight crossover)
-- ============================================================================
-- 
-- Usage:
--   SELECT * FROM facility_availability 
--   WHERE is_time_in_range(630, open_time, close_time);
--
CREATE OR REPLACE FUNCTION is_time_in_range(
    check_time INTEGER,
    range_start INTEGER,
    range_end INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    -- Validate inputs
    IF check_time < 0 OR check_time >= 1440 THEN
        RETURN FALSE;
    END IF;
    
    IF range_start < 0 OR range_start >= 1440 OR range_end < 0 OR range_end >= 1440 THEN
        RETURN FALSE;
    END IF;
    
    -- Check if range crosses midnight
    IF range_end < range_start THEN
        -- Range crosses midnight: time must be >= start OR <= end
        RETURN check_time >= range_start OR check_time <= range_end;
    ELSE
        -- Normal range: time must be >= start AND <= end
        RETURN check_time >= range_start AND check_time <= range_end;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Function: Calculate duration of time range (handles midnight crossover)
-- ============================================================================
--
-- Usage:
--   SELECT calculate_range_duration(1080, 120) AS duration;
--   -- Returns 480 (8 hours: 18:00 to 02:00)
--
CREATE OR REPLACE FUNCTION calculate_range_duration(
    start_time INTEGER,
    end_time INTEGER
) RETURNS INTEGER AS $$
BEGIN
    -- Validate inputs
    IF start_time < 0 OR start_time >= 1440 OR end_time < 0 OR end_time >= 1440 THEN
        RAISE EXCEPTION 'Invalid time values. Must be 0-1439';
    END IF;
    
    -- Check if range crosses midnight
    IF end_time < start_time THEN
        -- Range crosses midnight: duration = (1440 - start) + end
        RETURN (1440 - start_time) + end_time;
    ELSE
        -- Normal range: duration = end - start
        RETURN end_time - start_time;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Function: Check if time range overlaps with another range
-- ============================================================================
--
-- Usage:
--   SELECT * FROM booking_slots
--   WHERE time_ranges_overlap(start_time, end_time, 600, 1080);
--
CREATE OR REPLACE FUNCTION time_ranges_overlap(
    range1_start INTEGER,
    range1_end INTEGER,
    range2_start INTEGER,
    range2_end INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    -- Validate all inputs
    IF range1_start < 0 OR range1_start >= 1440 OR 
       range1_end < 0 OR range1_end >= 1440 OR
       range2_start < 0 OR range2_start >= 1440 OR
       range2_end < 0 OR range2_end >= 1440 THEN
        RETURN FALSE;
    END IF;
    
    -- Check if either range crosses midnight
    DECLARE
        range1_crosses BOOLEAN := range1_end < range1_start;
        range2_crosses BOOLEAN := range2_end < range2_start;
    BEGIN
        -- Both ranges cross midnight
        IF range1_crosses AND range2_crosses THEN
            RETURN TRUE; -- Both cross, so they overlap
        END IF;
        
        -- Range 1 crosses midnight
        IF range1_crosses THEN
            RETURN range2_start <= range1_end OR range2_end >= range1_start;
        END IF;
        
        -- Range 2 crosses midnight
        IF range2_crosses THEN
            RETURN range1_start <= range2_end OR range1_end >= range2_start;
        END IF;
        
        -- Neither crosses midnight - standard overlap check
        RETURN range1_start < range2_end AND range1_end > range2_start;
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Function: Format minutes since midnight to HH:MM string
-- ============================================================================
--
-- Usage:
--   SELECT format_time_string(630) AS time;
--   -- Returns '10:30'
--
CREATE OR REPLACE FUNCTION format_time_string(minutes INTEGER) RETURNS TEXT AS $$
DECLARE
    hours INTEGER;
    mins INTEGER;
BEGIN
    -- Validate input
    IF minutes < 0 OR minutes >= 1440 THEN
        RAISE EXCEPTION 'Invalid minutes value. Must be 0-1439';
    END IF;
    
    hours := minutes / 60;
    mins := minutes % 60;
    
    RETURN LPAD(hours::TEXT, 2, '0') || ':' || LPAD(mins::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comments
COMMENT ON FUNCTION is_time_in_range(INTEGER, INTEGER, INTEGER) IS 
'Check if a time (minutes since midnight) falls within a range. Supports midnight crossover.';

COMMENT ON FUNCTION calculate_range_duration(INTEGER, INTEGER) IS 
'Calculate duration in minutes of a time range. Handles midnight crossover correctly.';

COMMENT ON FUNCTION time_ranges_overlap(INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Check if two time ranges overlap. Handles midnight crossover for both ranges.';

COMMENT ON FUNCTION format_time_string(INTEGER) IS 
'Format minutes since midnight (0-1439) to HH:MM string format.';

