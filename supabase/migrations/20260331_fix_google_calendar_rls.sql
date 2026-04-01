-- Fix Google Calendar Tokens RLS Policies
-- This resolves the 406 errors when querying google_calendar_tokens

-- Enable RLS if not already enabled
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own calendar tokens" ON google_calendar_tokens;
DROP POLICY IF EXISTS "Users can insert own calendar tokens" ON google_calendar_tokens;
DROP POLICY IF EXISTS "Users can update own calendar tokens" ON google_calendar_tokens;
DROP POLICY IF EXISTS "Users can delete own calendar tokens" ON google_calendar_tokens;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view own calendar tokens"
ON google_calendar_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar tokens"
ON google_calendar_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar tokens"
ON google_calendar_tokens
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar tokens"
ON google_calendar_tokens
FOR DELETE
USING (auth.uid() = user_id);
