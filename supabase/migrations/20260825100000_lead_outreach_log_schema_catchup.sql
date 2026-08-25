-- Idempotent catch-up for lead_outreach_log columns referenced by outreach send,
-- webhook reconciliation, and entity timelines. Safe to re-run on production.

ALTER TABLE IF EXISTS public.lead_outreach_log
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_event_status TEXT,
  ADD COLUMN IF NOT EXISTS provider_last_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- lead_name may be NOT NULL on older schemas; ensure inserts with email-only still succeed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_outreach_log'
      AND column_name = 'lead_name'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.lead_outreach_log ALTER COLUMN lead_name DROP NOT NULL;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_tenant_user_created
  ON public.lead_outreach_log (tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_provider_message
  ON public.lead_outreach_log (tenant_id, provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
