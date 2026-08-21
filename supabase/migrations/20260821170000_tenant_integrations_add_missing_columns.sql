-- Migration: add missing columns to tenant_integrations
-- The live table was created with only id/tenant_id/status/created_at/updated_at.
-- All OAuth callbacks and integration services expect these additional columns.

ALTER TABLE public.tenant_integrations
  ADD COLUMN IF NOT EXISTS integration_id    text,
  ADD COLUMN IF NOT EXISTS configured_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS connected_at      timestamptz,
  ADD COLUMN IF NOT EXISTS metadata          jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add the unique constraint that callbacks rely on (onConflict: 'tenant_id,integration_id')
ALTER TABLE public.tenant_integrations
  DROP CONSTRAINT IF EXISTS tenant_integrations_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'tenant_integrations'
      AND constraint_name = 'tenant_integrations_tenant_integration_unique'
  ) THEN
    ALTER TABLE public.tenant_integrations
      ADD CONSTRAINT tenant_integrations_tenant_integration_unique
      UNIQUE (tenant_id, integration_id);
  END IF;
END $$;

-- Reload PostgREST schema cache so PGRST204 errors are resolved immediately
NOTIFY pgrst, 'reload schema';
