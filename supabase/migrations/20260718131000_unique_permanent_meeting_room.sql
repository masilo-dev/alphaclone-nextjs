-- Keep permanent meeting-room provisioning idempotent under concurrent requests.
-- Cancelled rooms are excluded so an administrator can intentionally replace one.
ALTER TABLE public.video_calls
  ADD COLUMN IF NOT EXISTS daily_room_url text,
  ADD COLUMN IF NOT EXISTS daily_room_name text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_policy_hours integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS allow_client_cancellation boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS duration_limit_minutes integer DEFAULT 40,
  ADD COLUMN IF NOT EXISTS auto_end_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_reason text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.meeting_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.video_calls(id) ON DELETE CASCADE,
  link_token varchar(160) UNIQUE NOT NULL,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  used_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL DEFAULT 100,
  use_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT meeting_links_positive_max_uses CHECK (max_uses > 0),
  CONSTRAINT meeting_links_nonnegative_use_count CHECK (use_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_meeting_links_meeting_id
  ON public.meeting_links (meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_links_expires_at
  ON public.meeting_links (expires_at);

ALTER TABLE public.meeting_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_links_tenant_members_select ON public.meeting_links;
CREATE POLICY meeting_links_tenant_members_select
  ON public.meeting_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.video_calls calls
      JOIN public.tenant_users members ON members.tenant_id = calls.tenant_id
      WHERE calls.id = meeting_links.meeting_id
        AND members.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.set_meeting_auto_end()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_permanent = true THEN
    NEW.auto_end_scheduled_at := NULL;
  ELSIF NEW.status = 'active' AND NEW.started_at IS NOT NULL AND OLD.started_at IS NULL THEN
    NEW.auto_end_scheduled_at := NEW.started_at
      + (COALESCE(NEW.duration_limit_minutes, 40) || ' minutes')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_meeting_auto_end ON public.video_calls;
CREATE TRIGGER trigger_set_meeting_auto_end
  BEFORE UPDATE ON public.video_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.set_meeting_auto_end();

WITH ranked_rooms AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id
      ORDER BY created_at ASC, id ASC
    ) AS room_rank
  FROM public.video_calls
  WHERE tenant_id IS NOT NULL
    AND is_permanent = true
    AND status <> 'cancelled'
)
UPDATE public.video_calls AS calls
SET
  status = 'cancelled',
  ended_at = COALESCE(calls.ended_at, now()),
  ended_reason = COALESCE(calls.ended_reason, 'duplicate_permanent_room_cleanup'),
  updated_at = now()
FROM ranked_rooms
WHERE calls.id = ranked_rooms.id
  AND ranked_rooms.room_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_calls_one_active_permanent_room
  ON public.video_calls (tenant_id)
  WHERE is_permanent = true AND status <> 'cancelled';
