-- LinkedIn security hardening: encrypted token secrets, identities table, legacy token column nullable

CREATE TABLE IF NOT EXISTS public.linkedin_integration_secrets (
  integration_id UUID PRIMARY KEY REFERENCES public.linkedin_integrations(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.linkedin_integration_secrets ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only service_role bypasses RLS

CREATE TABLE IF NOT EXISTS public.linkedin_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_urn TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, author_urn)
);

ALTER TABLE public.linkedin_identities
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES public.linkedin_integrations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_organization_id TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS vanity_name TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS can_post BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.linkedin_identities
SET type = 'person'
WHERE type IS NULL;

ALTER TABLE public.linkedin_identities
  ALTER COLUMN type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'linkedin_identities_type_check'
      AND conrelid = 'public.linkedin_identities'::regclass
  ) THEN
    ALTER TABLE public.linkedin_identities
      ADD CONSTRAINT linkedin_identities_type_check
      CHECK (type IN ('person', 'organization'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_linkedin_identities_tenant_type
  ON public.linkedin_identities (tenant_id, type);

CREATE INDEX IF NOT EXISTS idx_linkedin_identities_integration
  ON public.linkedin_identities (integration_id);

ALTER TABLE public.linkedin_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS linkedin_identities_select_tenant_members ON public.linkedin_identities;
CREATE POLICY linkedin_identities_select_tenant_members
  ON public.linkedin_identities
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Allow tenant members to see integration metadata but not raw tokens
ALTER TABLE public.linkedin_integrations
  ALTER COLUMN access_token DROP NOT NULL;

COMMENT ON COLUMN public.linkedin_integrations.access_token IS
  'Deprecated — tokens live in linkedin_integration_secrets. Column cleared after migration.';

NOTIFY pgrst, 'reload schema';
