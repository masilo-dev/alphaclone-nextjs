-- Daily.co Integration and Cancellation Policy Migration
-- Adds Daily.co specific fields and cancellation policy management

-- Update video_calls table to use Daily.co
ALTER TABLE video_calls
ADD COLUMN IF NOT EXISTS daily_room_url TEXT,
ADD COLUMN IF NOT EXISTS daily_room_name TEXT,
ADD COLUMN IF NOT EXISTS cancellation_policy_hours INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS allow_client_cancellation BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add index for Daily room name
CREATE INDEX IF NOT EXISTS idx_video_calls_daily_room_name ON video_calls(daily_room_name);

-- Add index for cancellation lookups
CREATE INDEX IF NOT EXISTS idx_video_calls_cancelled_by ON video_calls(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_video_calls_status ON video_calls(status);

-- Add availability tracking table for scheduling
CREATE TABLE IF NOT EXISTS admin_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(admin_id, day_of_week, start_time)
);

-- Enable RLS on admin_availability
ALTER TABLE admin_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_availability
CREATE POLICY "Everyone can view admin availability"
  ON admin_availability FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage their availability"
  ON admin_availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = admin_availability.admin_id
      AND profiles.role = 'admin'
      AND profiles.id = auth.uid()
    )
  );

-- Function to check if meeting can be cancelled
CREATE OR REPLACE FUNCTION can_cancel_meeting(
  meeting_id UUID,
  user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  meeting_record video_calls;
  is_admin BOOLEAN;
  hours_until_meeting INTERVAL;
BEGIN
  -- Get the meeting
  SELECT * INTO meeting_record
  FROM video_calls
  WHERE id = meeting_id;

  -- Check if meeting exists
  IF meeting_record IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if already cancelled or ended
  IF meeting_record.status IN ('cancelled', 'ended') THEN
    RETURN FALSE;
  END IF;

  -- Check if user is admin
  SELECT role = 'admin' INTO is_admin
  FROM profiles
  WHERE id = user_id;

  -- Admins can always cancel
  IF is_admin THEN
    RETURN TRUE;
  END IF;

  -- Check if client cancellation is allowed
  IF NOT meeting_record.allow_client_cancellation THEN
    RETURN FALSE;
  END IF;

  -- Check if meeting is scheduled (has calendar_event_id)
  IF meeting_record.calendar_event_id IS NOT NULL THEN
    -- Get hours until meeting
    SELECT ce.start_time - NOW() INTO hours_until_meeting
    FROM calendar_events ce
    WHERE ce.id = meeting_record.calendar_event_id;

    -- Check if within cancellation window
    IF EXTRACT(EPOCH FROM hours_until_meeting) / 3600 < meeting_record.cancellation_policy_hours THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Client can cancel if they are the host or participant
  RETURN meeting_record.host_id = user_id OR user_id = ANY(meeting_record.participants);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION can_cancel_meeting IS 'Checks if a user can cancel a meeting based on role and cancellation policy';

-- Update existing video_calls to use Daily.co naming
UPDATE video_calls
SET daily_room_name = room_id
WHERE daily_room_name IS NULL;
