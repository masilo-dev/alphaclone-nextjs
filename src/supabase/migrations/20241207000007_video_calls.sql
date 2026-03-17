-- ============================================================================
-- PHASE 11: REAL VIDEO CALLS (LIVEKIT)
-- ============================================================================
-- Adds video calls table for LiveKit integration

-- Video Calls Table
CREATE TABLE IF NOT EXISTS video_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')) DEFAULT 'scheduled',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  participants UUID[],
  max_participants INTEGER DEFAULT 10,
  recording_enabled BOOLEAN DEFAULT FALSE,
  recording_url TEXT,
  screen_share_enabled BOOLEAN DEFAULT TRUE,
  chat_enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call Participants Table
CREATE TABLE IF NOT EXISTS call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES video_calls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  is_host BOOLEAN DEFAULT FALSE,
  camera_enabled BOOLEAN DEFAULT TRUE,
  microphone_enabled BOOLEAN DEFAULT TRUE,
  screen_sharing BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_calls_room_id ON video_calls(room_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_host_id ON video_calls(host_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_status ON video_calls(status);
CREATE INDEX IF NOT EXISTS idx_video_calls_started_at ON video_calls(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_participants_call_id ON call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user_id ON call_participants(user_id);

-- Enable RLS
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for video_calls
DROP POLICY IF EXISTS "Users can view calls they're part of" ON video_calls;
CREATE POLICY "Users can view calls they're part of"
  ON video_calls FOR SELECT
  TO authenticated
  USING (host_id = auth.uid() OR auth.uid() = ANY(participants));

DROP POLICY IF EXISTS "Admins can view all calls" ON video_calls;
CREATE POLICY "Admins can view all calls"
  ON video_calls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can create calls" ON video_calls;
CREATE POLICY "Users can create calls"
  ON video_calls FOR INSERT
  TO authenticated
  WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "Hosts can update their calls" ON video_calls;
CREATE POLICY "Hosts can update their calls"
  ON video_calls FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid());

DROP POLICY IF EXISTS "Hosts can delete their calls" ON video_calls;
CREATE POLICY "Hosts can delete their calls"
  ON video_calls FOR DELETE
  TO authenticated
  USING (host_id = auth.uid());

-- RLS Policies for call_participants
DROP POLICY IF EXISTS "Users can view their own participation" ON call_participants;
CREATE POLICY "Users can view their own participation"
  ON call_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all participants" ON call_participants;
CREATE POLICY "Admins can view all participants"
  ON call_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "System can manage participants" ON call_participants;
CREATE POLICY "System can manage participants"
  ON call_participants FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to calculate call duration
CREATE OR REPLACE FUNCTION calculate_call_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
    NEW.status := 'ended';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for call duration
DROP TRIGGER IF EXISTS trigger_calculate_call_duration ON video_calls;
CREATE TRIGGER trigger_calculate_call_duration
  BEFORE UPDATE ON video_calls
  FOR EACH ROW
  EXECUTE FUNCTION calculate_call_duration();

-- Function to calculate participant duration
CREATE OR REPLACE FUNCTION calculate_participant_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.left_at IS NOT NULL AND OLD.left_at IS NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.left_at - NEW.joined_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for participant duration
DROP TRIGGER IF EXISTS trigger_calculate_participant_duration ON call_participants;
CREATE TRIGGER trigger_calculate_participant_duration
  BEFORE UPDATE ON call_participants
  FOR EACH ROW
  EXECUTE FUNCTION calculate_participant_duration();

-- Function to update video_calls timestamp
CREATE OR REPLACE FUNCTION update_video_call_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_video_call_timestamp ON video_calls;
CREATE TRIGGER trigger_update_video_call_timestamp
  BEFORE UPDATE ON video_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_video_call_timestamp();

-- ============================================================================
-- VIDEO CALLS SYSTEM DEPLOYED!
-- ============================================================================
