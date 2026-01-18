-- Create guest_participants table to track external guests joining via permanent links
-- BUSINESS-FRIENDLY: Allows anyone to join and see all participants
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS guest_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    room_id TEXT NOT NULL,
    room_url TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_guest_participants_room_id ON guest_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_guest_participants_joined_at ON guest_participants(joined_at DESC);

-- OPEN ACCESS: No authentication required for business ease
-- Disable RLS to allow anyone to see all participants
ALTER TABLE guest_participants DISABLE ROW LEVEL SECURITY;

-- Grant full public access for business flexibility
GRANT ALL ON guest_participants TO anon;
GRANT ALL ON guest_participants TO authenticated;

-- Add updated_at trigger (only if function doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_guest_participants_updated_at ON guest_participants;
CREATE TRIGGER update_guest_participants_updated_at
    BEFORE UPDATE ON guest_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE guest_participants IS 'Tracks external guests who join meetings via permanent links - OPEN ACCESS for easy business use';
