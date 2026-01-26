-- Migration: Create saved_journeys table
-- This stores user's saved train journeys for quick access

CREATE TABLE IF NOT EXISTS saved_journeys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    train_number INTEGER NOT NULL,
    departure_date VARCHAR(10) NOT NULL,
    train_type VARCHAR(10),
    train_commuter_line VARCHAR(10),
    origin_station_uic INTEGER NOT NULL,
    origin_stop_index INTEGER NOT NULL DEFAULT 0,
    destination_station_uic INTEGER NOT NULL,
    origin_station_name VARCHAR(255),
    destination_station_name VARCHAR(255),
    final_destination_name VARCHAR(255),
    scheduled_departure TIMESTAMP WITH TIME ZONE,
    scheduled_arrival TIMESTAMP WITH TIME ZONE,
    
    -- Ensure a user can't save the same journey twice
    CONSTRAINT unique_user_journey UNIQUE (user_id, train_number, departure_date, origin_station_uic, destination_station_uic)
);

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_saved_journeys_user_id ON saved_journeys(user_id);

-- Index for journey lookups
CREATE INDEX IF NOT EXISTS idx_saved_journeys_train ON saved_journeys(train_number, departure_date);

-- Index for recent journeys by scheduled departure
CREATE INDEX IF NOT EXISTS idx_saved_journeys_scheduled_departure ON saved_journeys(scheduled_departure DESC);

-- Comments
COMMENT ON TABLE saved_journeys IS 'User saved train journeys for quick access and history';
COMMENT ON COLUMN saved_journeys.train_number IS 'Train number from Digitraffic API';
COMMENT ON COLUMN saved_journeys.departure_date IS 'Train departure date';
COMMENT ON COLUMN saved_journeys.origin_station_uic IS 'UIC code of the departure station';
COMMENT ON COLUMN saved_journeys.destination_station_uic IS 'UIC code of the arrival station';
