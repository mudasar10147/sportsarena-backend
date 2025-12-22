-- Create payment_transactions table for SportsArena MVP
-- Record of every payment attempt/confirmation

CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    gateway_name VARCHAR(50),
    gateway_transaction_id VARCHAR(255),
    gateway_response JSONB,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on booking_id for booking queries
CREATE INDEX idx_payment_transactions_booking_id ON payment_transactions(booking_id);

-- Create index on status for filtering
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);

-- Create index on gateway_transaction_id for gateway lookups
CREATE INDEX idx_payment_transactions_gateway_id ON payment_transactions(gateway_transaction_id);

-- Create index on gateway_name for gateway filtering
CREATE INDEX idx_payment_transactions_gateway_name ON payment_transactions(gateway_name);

-- Create composite index for booking and status
CREATE INDEX idx_payment_transactions_booking_status ON payment_transactions(booking_id, status);

-- Create index on created_at for date-based queries
CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at);

-- Add comment to table
COMMENT ON TABLE payment_transactions IS 'Record of every payment attempt/confirmation';
COMMENT ON COLUMN payment_transactions.amount IS 'Payment amount in PKR (Pakistani Rupees)';
COMMENT ON COLUMN payment_transactions.status IS 'Status: pending, success, failed, or refunded';
COMMENT ON COLUMN payment_transactions.gateway_transaction_id IS 'Transaction ID from payment gateway (Stripe, Razorpay, etc.)';
COMMENT ON COLUMN payment_transactions.gateway_response IS 'Full response from payment gateway (JSON)';

