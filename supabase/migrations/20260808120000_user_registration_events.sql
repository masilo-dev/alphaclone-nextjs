CREATE TABLE IF NOT EXISTS public.user_registration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  business_name TEXT,
  signup_method TEXT NOT NULL DEFAULT 'unknown'
    CHECK (signup_method IN ('email', 'google', 'linkedin', 'facebook', 'unknown')),
  selected_plan TEXT,
  referral_code TEXT,
  source_url TEXT,
  user_agent TEXT,
  country TEXT,
  marketing_opt_in BOOLEAN,
  legal_accepted BOOLEAN,
  eu_consent BOOLEAN,
  age_confirmed BOOLEAN,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_sent_at TIMESTAMPTZ,
  notification_error TEXT,
  user_motivation_sent_at TIMESTAMPTZ,
  user_motivation_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_registration_events
  ADD COLUMN IF NOT EXISTS user_motivation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_motivation_error TEXT;

CREATE INDEX IF NOT EXISTS idx_user_registration_events_created_at
  ON public.user_registration_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_registration_events_signup_method
  ON public.user_registration_events (signup_method);

ALTER TABLE public.user_registration_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own registration event" ON public.user_registration_events;
CREATE POLICY "Users can read own registration event"
ON public.user_registration_events
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage registration events" ON public.user_registration_events;
CREATE POLICY "Admins can manage registration events"
ON public.user_registration_events
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
  )
);
