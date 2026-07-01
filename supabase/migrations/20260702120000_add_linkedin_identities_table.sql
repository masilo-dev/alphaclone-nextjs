CREATE TABLE IF NOT EXISTS public.linkedin_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'organization',
  linkedin_organization_id TEXT NOT NULL,
  author_urn TEXT NOT NULL,
  name TEXT,
  vanity_name TEXT,
  logo_url TEXT,
  can_post BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT linkedin_identities_type_check CHECK (type = 'organization')
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

INSERT INTO public.linkedin_identities (
  tenant_id,
  user_id,
  type,
  linkedin_organization_id,
  author_urn,
  name,
  vanity_name,
  logo_url,
  can_post,
  metadata,
  updated_at
)
SELECT
  li.tenant_id,
  li.user_id,
  'organization',
  page->>'id',
  'urn:li:organization:' || page->>'id',
  NULLIF(page->>'name', ''),
  NULLIF(page->>'vanityName', ''),
  NULLIF(page->>'logoUrl', ''),
  COALESCE(li.scopes @> ARRAY['w_organization_social']::text[], false),
  jsonb_build_object(
    'source', 'linkedin_integrations.metadata.company_pages',
    'integration_id', li.id,
    'member_id', li.linkedin_member_id
  ),
  NOW()
FROM public.linkedin_integrations li
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(li.metadata->'company_pages', '[]'::jsonb)) AS page
WHERE page ? 'id'
ON CONFLICT (tenant_id, user_id, type, linkedin_organization_id)
DO UPDATE SET
  author_urn = EXCLUDED.author_urn,
  name = EXCLUDED.name,
  vanity_name = EXCLUDED.vanity_name,
  logo_url = EXCLUDED.logo_url,
  can_post = EXCLUDED.can_post,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

NOTIFY pgrst, 'reload schema';
