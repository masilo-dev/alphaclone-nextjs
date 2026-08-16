-- Idempotent repair for columns referenced by the production application but
-- missing from databases that created these tables before later migrations.

ALTER TABLE IF EXISTS public.user_registration_events
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notification_error TEXT,
  ADD COLUMN IF NOT EXISTS user_motivation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_motivation_error TEXT;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.lead_outreach_log
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_tenant_user_created
  ON public.lead_outreach_log (tenant_id, user_id, created_at DESC);

ALTER TABLE IF EXISTS public.mcp_action_receipts
  ADD COLUMN IF NOT EXISTS action_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_action_receipts_action_id
  ON public.mcp_action_receipts (action_id);

NOTIFY pgrst, 'reload schema';
