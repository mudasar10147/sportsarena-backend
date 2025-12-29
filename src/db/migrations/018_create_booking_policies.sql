-- Create booking_policies table
-- Stores booking window limits and policies per facility or court
--
-- Policies can be set at facility level (applies to all courts) or
-- court level (overrides facility policy for specific court).
--
-- Example: Facility allows 30-day advance booking, but Court 1 only allows 7 days

CREATE TABLE IF NOT EXISTS booking_policies (
    id SERIAL PRIMARY KEY,
    
    -- Policy scope: 'facility' or 'court'
    -- NULL facility_id means facility-level policy
    -- NULL court_id means facility-level policy
    -- If both are set, court_id takes precedence (court-level override)
    facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE,
    court_id INTEGER REFERENCES courts(id) ON DELETE CASCADE,
    
    -- Maximum advance booking window in days
    -- NULL means use system default (30 days)
    max_advance_booking_days INTEGER CHECK (max_advance_booking_days > 0),
    
    -- Minimum booking duration in minutes
    -- NULL means use system default (30 minutes)
    min_booking_duration_minutes INTEGER CHECK (min_booking_duration_minutes > 0),
    
    -- Maximum booking duration in minutes
    -- NULL means use system default (8 hours = 480 minutes)
    max_booking_duration_minutes INTEGER CHECK (max_booking_duration_minutes > 0),
    
    -- Buffer time between bookings in minutes (e.g., 15 minutes between bookings)
    -- NULL means no buffer required
    booking_buffer_minutes INTEGER CHECK (booking_buffer_minutes >= 0),
    
    -- Minimum notice required for booking in minutes
    -- NULL means no minimum notice (can book immediately)
    -- Example: 60 = must book at least 1 hour in advance
    min_advance_notice_minutes INTEGER CHECK (min_advance_notice_minutes >= 0),
    
    -- Whether this policy is currently active
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure only one policy per scope
    -- Facility-level: facility_id set, court_id NULL
    -- Court-level: both facility_id and court_id set
    CONSTRAINT check_policy_scope CHECK (
        (facility_id IS NOT NULL AND court_id IS NULL) OR
        (facility_id IS NOT NULL AND court_id IS NOT NULL)
    )
);

-- Create indexes
CREATE INDEX idx_booking_policies_facility ON booking_policies(facility_id);
CREATE INDEX idx_booking_policies_court ON booking_policies(court_id);
CREATE INDEX idx_booking_policies_active ON booking_policies(is_active);
CREATE INDEX idx_booking_policies_facility_active ON booking_policies(facility_id, is_active);
CREATE INDEX idx_booking_policies_court_active ON booking_policies(court_id, is_active);

-- Add comments
COMMENT ON TABLE booking_policies IS 
'Booking window limits and policies. Can be set at facility level (applies to all courts) or court level (overrides facility policy).';

COMMENT ON COLUMN booking_policies.facility_id IS 
'Facility ID. If court_id is NULL, this is a facility-level policy.';

COMMENT ON COLUMN booking_policies.court_id IS 
'Court ID. If set, this is a court-level policy that overrides facility policy.';

COMMENT ON COLUMN booking_policies.max_advance_booking_days IS 
'Maximum days in advance bookings can be made. NULL uses system default (30 days).';

COMMENT ON COLUMN booking_policies.min_booking_duration_minutes IS 
'Minimum booking duration in minutes. NULL uses system default (30 minutes).';

COMMENT ON COLUMN booking_policies.max_booking_duration_minutes IS 
'Maximum booking duration in minutes. NULL uses system default (8 hours = 480 minutes).';

COMMENT ON COLUMN booking_policies.booking_buffer_minutes IS 
'Buffer time required between bookings in minutes. NULL means no buffer required.';

COMMENT ON COLUMN booking_policies.min_advance_notice_minutes IS 
'Minimum notice required for booking in minutes. NULL means can book immediately.';

