-- Users table for Google OAuth authentication
-- Run this migration to set up the users table

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    picture TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by Google ID
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Index for email lookups (if needed)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Comment on table
COMMENT ON TABLE users IS 'Users authenticated via Google OAuth';
COMMENT ON COLUMN users.google_id IS 'Unique Google account identifier (sub claim from ID token)';
