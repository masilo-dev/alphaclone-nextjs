+
- ============================================================================
-- PHASE 10: CALENDAR SYSTEM
-- ============================================================================
-- Adds calendar events table with video call integration

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  type TEXT CHECK (type IN ('meeting', 'call', 'reminder', 'deadline', 'task')),
  video_room_id TEXT,
  attendees UUID[],
  location TEXT,
  recurrence_rule TEXT,
  color TEXT DEFAULT '#3b82f6',
  is_all_day BOOLEAN DEFAULT FALSE,
  reminder_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(type);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own events" ON calendar_events;
CREATE POLICY "Users can view their own events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR auth.uid() = ANY(attendees));

DROP POLICY IF EXISTS "Admins can view all events" ON calendar_events;
CREATE POLICY "Admins can view all events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can create their own events" ON calendar_events;
CREATE POLICY "Users can create their own events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own events" ON calendar_events;
CREATE POLICY "Users can update their own events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own events" ON calendar_events;
CREATE POLICY "Users can delete their own events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_event_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_calendar_event_timestamp ON calendar_events;
CREATE TRIGGER trigger_update_calendar_event_timestamp
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_event_timestamp();

-- ============================================================================
-- CALENDAR SYSTEM DEPLOYED!
-- ============================================================================
