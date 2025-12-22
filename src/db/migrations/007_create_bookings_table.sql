-- Create bookings table for SportsArena MVP
-- A confirmed booking record created after payment

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(id) ON DELETE RESTRICT,
    final_price DECIMAL(10, 2) NOT NULL,
    booking_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (booking_status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    payment_reference VARCHAR(255),
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id for user booking queries
CREATE INDEX idx_bookings_user_id ON bookings(user_id);

-- Create index on time_slot_id for slot queries
CREATE INDEX idx_bookings_time_slot_id ON bookings(time_slot_id);

-- Create index on booking_status for filtering
CREATE INDEX idx_bookings_status ON bookings(booking_status);

-- Create index on payment_reference for payment lookups
CREATE INDEX idx_bookings_payment_reference ON bookings(payment_reference);

-- Create composite index for user and status
CREATE INDEX idx_bookings_user_status ON bookings(user_id, booking_status);

-- Create index on created_at for date-based queries
CREATE INDEX idx_bookings_created_at ON bookings(created_at);

-- Add comment to table
COMMENT ON TABLE bookings IS 'A confirmed booking record created after payment';
COMMENT ON COLUMN bookings.final_price IS 'Final booking price in PKR (Pakistani Rupees)';
COMMENT ON COLUMN bookings.booking_status IS 'Status: pending, confirmed, cancelled, or completed';
COMMENT ON COLUMN bookings.payment_reference IS 'Payment transaction ID or gateway reference';

