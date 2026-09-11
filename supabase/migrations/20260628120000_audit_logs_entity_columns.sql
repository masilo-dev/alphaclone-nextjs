-- Align audit_logs schema for MCP (entity_*) and activityService (resource_*) writers.
-- Production was missing entity_id / entity_type, causing PGRST204 on MCP audit inserts.

BEGIN;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS new_values JSONB,
  ADD COLUMN IF NOT EXISTS old_values JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB,
  ADD COLUMN IF NOT EXISTS old_value JSONB;

-- Mirror legacy resource_* into entity_* when only resource columns were populated.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'resource_id'
  ) THEN
    UPDATE public.audit_logs
    SET entity_id = COALESCE(entity_id, resource_id::text)
    WHERE entity_id IS NULL AND resource_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'resource_type'
  ) THEN
    UPDATE public.audit_logs
    SET entity_type = COALESCE(entity_type, resource_type)
    WHERE entity_type IS NULL AND resource_type IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs (resource_type, resource_id);

COMMIT;
