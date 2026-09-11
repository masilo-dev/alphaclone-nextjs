-- Ensure all required columns exist on public.linkedin_identities
ALTER TABLE public.linkedin_identities
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS author_urn TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_organization_id TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS vanity_name TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS can_post BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS integration_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Cast author_urn to TEXT if it was stored as JSONB (from older migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'linkedin_identities'
      AND column_name = 'author_urn'
      AND data_type IN ('json', 'jsonb')
  ) THEN
    ALTER TABLE public.linkedin_identities
      ALTER COLUMN author_urn TYPE text USING author_urn::text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.linkedin_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'organization',
  linkedin_organization_id TEXT,
  author_urn TEXT NOT NULL,
  name TEXT,
  vanity_name TEXT,
  logo_url TEXT,
  can_post BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS linkedin_identities_tenant_user_type_org_key
  ON public.linkedin_identities(tenant_id, user_id, type, linkedin_organization_id);

CREATE INDEX IF NOT EXISTS idx_linkedin_identities_tenant_active
  ON public.linkedin_identities(tenant_id, type, can_post);

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

DROP POLICY IF EXISTS linkedin_identities_insert_tenant_members ON public.linkedin_identities;
CREATE POLICY linkedin_identities_insert_tenant_members
  ON public.linkedin_identities
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS linkedin_identities_update_tenant_members ON public.linkedin_identities;
CREATE POLICY linkedin_identities_update_tenant_members
  ON public.linkedin_identities
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Backfill is handled at runtime via the LinkedIn OAuth callback.
-- No bulk INSERT needed here as the table starts empty and rows are populated on connect.

NOTIFY pgrst, 'reload schema';
