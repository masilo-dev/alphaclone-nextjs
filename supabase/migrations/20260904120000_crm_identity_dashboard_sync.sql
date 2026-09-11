-- CRM identity resolution indexes + dashboard sync support
-- Safe to re-run (IF NOT EXISTS / guarded blocks)

BEGIN;

-- Activity timestamp for identity reconnection
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

UPDATE public.leads
SET last_activity_at = COALESCE(updated_at, created_at)
WHERE last_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_last_activity
  ON public.leads (tenant_id, last_activity_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

-- Fast tenant-scoped email lookup (non-unique — existing duplicates may exist)
CREATE INDEX IF NOT EXISTS idx_leads_tenant_email_lower
  ON public.leads (tenant_id, lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '' AND deleted_at IS NULL;

-- Phone lookup index
CREATE INDEX IF NOT EXISTS idx_leads_tenant_phone_lookup
  ON public.leads (tenant_id, phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- External source id dedup when present
CREATE INDEX IF NOT EXISTS idx_leads_tenant_external_id
  ON public.leads (tenant_id, external_id)
  WHERE external_id IS NOT NULL AND deleted_at IS NULL;

-- Attempt partial unique email index when no duplicate backlog
DO $$
BEGIN
  CREATE UNIQUE INDEX uq_leads_tenant_normalized_email
    ON public.leads (tenant_id, lower(trim(email)))
    WHERE email IS NOT NULL AND trim(email) <> '' AND deleted_at IS NULL;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Skipping uq_leads_tenant_normalized_email — duplicate emails exist; merge required';
END $$;

-- Enable realtime for domain_events (dashboard sync)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'domain_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.domain_events;
    END IF;
  END IF;
END $$;

COMMIT;
