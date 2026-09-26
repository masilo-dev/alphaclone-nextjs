-- Production schema-drift repair applied on 2026-09-26.
-- Additive only: restores columns expected by src/lib/auth/registrationEvents.ts.
ALTER TABLE public.user_registration_events
  ADD COLUMN IF NOT EXISTS signup_method TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS selected_plan TEXT,
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN,
  ADD COLUMN IF NOT EXISTS legal_accepted BOOLEAN,
  ADD COLUMN IF NOT EXISTS eu_consent BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_user_registration_events_signup_method
  ON public.user_registration_events (signup_method);
