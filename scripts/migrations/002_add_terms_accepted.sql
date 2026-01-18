-- Migration: Add terms acceptance tracking to users table
-- This tracks when users accepted the terms of service and privacy policy

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

-- Comment on the new column
COMMENT ON COLUMN users.terms_accepted_at IS 'Timestamp when the user last accepted the terms of service and privacy policy';
