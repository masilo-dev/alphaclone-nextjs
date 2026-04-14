CREATE TABLE IF NOT EXISTS public.linkedin_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  linkedin_member_id TEXT NOT NULL,
  linkedin_person_urn TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS linkedin_integrations_tenant_user_member_key
  ON public.linkedin_integrations(tenant_id, user_id, linkedin_member_id);

CREATE INDEX IF NOT EXISTS idx_linkedin_integrations_tenant_active
  ON public.linkedin_integrations(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_linkedin_integrations_user_active
  ON public.linkedin_integrations(user_id, is_active);

ALTER TABLE public.linkedin_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS linkedin_integrations_select_tenant_members ON public.linkedin_integrations;
CREATE POLICY linkedin_integrations_select_tenant_members
  ON public.linkedin_integrations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS linkedin_integrations_insert_tenant_members ON public.linkedin_integrations;
CREATE POLICY linkedin_integrations_insert_tenant_members
  ON public.linkedin_integrations
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS linkedin_integrations_update_tenant_members ON public.linkedin_integrations;
CREATE POLICY linkedin_integrations_update_tenant_members
  ON public.linkedin_integrations
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

NOTIFY pgrst, 'reload schema';
