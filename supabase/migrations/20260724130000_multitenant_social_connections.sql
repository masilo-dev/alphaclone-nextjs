-- Multi-tenant social connections & identities (SaaS-safe)
-- Alphaclone Systems is never a global default — every row is tenant-scoped.

-- ─── social_connections ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connected_by_user_id uuid,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  provider_account_name text,
  connection_status text NOT NULL DEFAULT 'active',
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  scopes jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT social_connections_provider_check CHECK (
    provider = ANY (ARRAY['facebook','linkedin','instagram','x','tiktok','youtube'])
  ),
  CONSTRAINT social_connections_status_check CHECK (
    connection_status = ANY (ARRAY['active','inactive','reconnect_required','revoked','expired'])
  ),
  CONSTRAINT social_connections_tenant_provider_account_uid UNIQUE (tenant_id, provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS social_connections_tenant_idx ON public.social_connections (tenant_id);
CREATE INDEX IF NOT EXISTS social_connections_tenant_provider_idx ON public.social_connections (tenant_id, provider);

-- ─── social_identities ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.social_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  identity_type text NOT NULL,
  provider_identity_id text NOT NULL,
  provider_identity_urn text,
  display_name text,
  username text,
  profile_url text,
  avatar_url text,
  can_publish boolean NOT NULL DEFAULT false,
  can_upload_media boolean NOT NULL DEFAULT false,
  can_read_insights boolean NOT NULL DEFAULT false,
  can_manage_comments boolean NOT NULL DEFAULT false,
  permissions jsonb DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_verified_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_identities_type_check CHECK (
    identity_type = ANY (ARRAY[
      'facebook_page',
      'linkedin_person',
      'linkedin_organization',
      'instagram_business',
      'x_account',
      'tiktok_account'
    ])
  ),
  CONSTRAINT social_identities_tenant_provider_type_id_uid
    UNIQUE (tenant_id, provider, identity_type, provider_identity_id)
);

CREATE INDEX IF NOT EXISTS social_identities_tenant_idx ON public.social_identities (tenant_id);
CREATE INDEX IF NOT EXISTS social_identities_tenant_provider_idx ON public.social_identities (tenant_id, provider);
CREATE INDEX IF NOT EXISTS social_identities_connection_idx ON public.social_identities (connection_id);

-- At most one default identity per tenant+provider
CREATE UNIQUE INDEX IF NOT EXISTS social_identities_one_default_per_provider
  ON public.social_identities (tenant_id, provider)
  WHERE is_default = true AND is_active = true;

-- ─── tenant_social_defaults ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_social_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  identity_id uuid NOT NULL REFERENCES public.social_identities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_social_defaults_uid UNIQUE (tenant_id, provider)
);

-- ─── social_posts FK columns (additive) ─────────────────────────────────────
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS connection_id uuid,
  ADD COLUMN IF NOT EXISTS identity_id uuid,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS identity_type text,
  ADD COLUMN IF NOT EXISTS provider_identity_id text,
  ADD COLUMN IF NOT EXISTS provider_post_urn text,
  ADD COLUMN IF NOT EXISTS provider_author_urn text,
  ADD COLUMN IF NOT EXISTS created_by_actor_type text,
  ADD COLUMN IF NOT EXISTS error_code text;

CREATE INDEX IF NOT EXISTS social_posts_tenant_identity_idx
  ON public.social_posts (tenant_id, identity_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_social_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_connections_tenant_select ON public.social_connections;
CREATE POLICY social_connections_tenant_select ON public.social_connections
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS social_connections_tenant_write ON public.social_connections;
CREATE POLICY social_connections_tenant_write ON public.social_connections
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS social_identities_tenant_select ON public.social_identities;
CREATE POLICY social_identities_tenant_select ON public.social_identities
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS social_identities_tenant_write ON public.social_identities;
CREATE POLICY social_identities_tenant_write ON public.social_identities
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS tenant_social_defaults_select ON public.tenant_social_defaults;
CREATE POLICY tenant_social_defaults_select ON public.tenant_social_defaults
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS tenant_social_defaults_write ON public.tenant_social_defaults;
CREATE POLICY tenant_social_defaults_write ON public.tenant_social_defaults
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

-- Fix Facebook integrations RLS: tenant membership, not user_id alone
DO $$
BEGIN
  IF to_regclass('public.facebook_integrations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own facebook integrations" ON public.facebook_integrations;
    DROP POLICY IF EXISTS "Users can manage own facebook integrations" ON public.facebook_integrations;
    DROP POLICY IF EXISTS "Users can view own tenant facebook integrations" ON public.facebook_integrations;
    DROP POLICY IF EXISTS "Users can manage own tenant facebook integrations" ON public.facebook_integrations;
    DROP POLICY IF EXISTS facebook_integrations_tenant_select ON public.facebook_integrations;
    DROP POLICY IF EXISTS facebook_integrations_tenant_write ON public.facebook_integrations;

    CREATE POLICY facebook_integrations_tenant_select ON public.facebook_integrations
      FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
      );
    CREATE POLICY facebook_integrations_tenant_write ON public.facebook_integrations
      FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
      )
      WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Never expose encrypted token columns via grants to authenticated (service role still has access)
REVOKE ALL ON public.social_connections FROM PUBLIC;
GRANT SELECT (
  id, tenant_id, connected_by_user_id, provider, provider_account_id, provider_account_name,
  connection_status, token_expires_at, scopes, metadata, created_at, updated_at, revoked_at
) ON public.social_connections TO authenticated;
-- Note: encrypted_* columns intentionally omitted from GRANT SELECT

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_identities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_social_defaults TO authenticated;

-- ─── Backfill from legacy tables ────────────────────────────────────────────
INSERT INTO public.social_connections (
  tenant_id, connected_by_user_id, provider, provider_account_id, provider_account_name,
  connection_status, token_expires_at, metadata, created_at, updated_at
)
SELECT
  fi.tenant_id,
  fi.user_id,
  'facebook',
  fi.page_id,
  fi.page_name,
  CASE WHEN fi.is_active THEN 'active' ELSE 'inactive' END,
  fi.expires_at,
  jsonb_build_object('legacy_integration_id', fi.id) || COALESCE(fi.metadata, '{}'::jsonb),
  COALESCE(fi.connected_at, now()),
  COALESCE(fi.updated_at, now())
FROM public.facebook_integrations fi
WHERE fi.tenant_id IS NOT NULL
  AND fi.page_id IS NOT NULL
ON CONFLICT (tenant_id, provider, provider_account_id) DO UPDATE SET
  provider_account_name = EXCLUDED.provider_account_name,
  connection_status = EXCLUDED.connection_status,
  token_expires_at = EXCLUDED.token_expires_at,
  updated_at = now();

INSERT INTO public.social_identities (
  tenant_id, connection_id, provider, identity_type, provider_identity_id,
  display_name, can_publish, can_upload_media, can_read_insights, is_active, metadata, updated_at
)
SELECT
  sc.tenant_id,
  sc.id,
  'facebook',
  'facebook_page',
  sc.provider_account_id,
  COALESCE(sc.provider_account_name, sc.provider_account_id),
  sc.connection_status = 'active',
  sc.connection_status = 'active',
  true,
  sc.connection_status = 'active',
  sc.metadata,
  now()
FROM public.social_connections sc
WHERE sc.provider = 'facebook'
ON CONFLICT (tenant_id, provider, identity_type, provider_identity_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  connection_id = EXCLUDED.connection_id,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.social_connections (
  tenant_id, connected_by_user_id, provider, provider_account_id, provider_account_name,
  connection_status, scopes, metadata, updated_at
)
SELECT
  li.tenant_id,
  li.user_id,
  'linkedin',
  COALESCE(li.linkedin_member_id, li.linkedin_person_urn, li.id::text),
  'LinkedIn',
  CASE WHEN li.is_active THEN 'active' ELSE 'inactive' END,
  to_jsonb(COALESCE(li.scopes, ARRAY[]::text[])),
  jsonb_build_object('legacy_integration_id', li.id) || COALESCE(li.metadata, '{}'::jsonb),
  now()
FROM public.linkedin_integrations li
WHERE li.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, provider, provider_account_id) DO UPDATE SET
  connection_status = EXCLUDED.connection_status,
  scopes = EXCLUDED.scopes,
  updated_at = now();

INSERT INTO public.social_identities (
  tenant_id, connection_id, provider, identity_type, provider_identity_id,
  provider_identity_urn, display_name, can_publish, can_upload_media, is_active, metadata, updated_at
)
SELECT
  sc.tenant_id,
  sc.id,
  'linkedin',
  'linkedin_person',
  sc.provider_account_id,
  li.linkedin_person_urn,
  'LinkedIn Personal',
  COALESCE('w_member_social' = ANY (li.scopes), false),
  COALESCE('w_member_social' = ANY (li.scopes), false),
  li.is_active,
  jsonb_build_object('legacy_integration_id', li.id),
  now()
FROM public.linkedin_integrations li
JOIN public.social_connections sc
  ON sc.tenant_id = li.tenant_id
 AND sc.provider = 'linkedin'
 AND sc.provider_account_id = COALESCE(li.linkedin_member_id, li.linkedin_person_urn, li.id::text)
WHERE li.linkedin_person_urn IS NOT NULL OR li.linkedin_member_id IS NOT NULL
ON CONFLICT (tenant_id, provider, identity_type, provider_identity_id) DO UPDATE SET
  provider_identity_urn = EXCLUDED.provider_identity_urn,
  can_publish = EXCLUDED.can_publish,
  updated_at = now();

INSERT INTO public.social_identities (
  tenant_id, connection_id, provider, identity_type, provider_identity_id,
  provider_identity_urn, display_name, can_publish, can_upload_media, is_active, metadata, updated_at
)
SELECT
  lid.tenant_id,
  sc.id,
  'linkedin',
  'linkedin_organization',
  lid.linkedin_organization_id,
  COALESCE(lid.author_urn, 'urn:li:organization:' || lid.linkedin_organization_id),
  COALESCE(lid.name, 'Organization ' || lid.linkedin_organization_id),
  COALESCE(lid.can_post, false),
  COALESCE(lid.can_post, false),
  true,
  jsonb_build_object('role', lid.role, 'legacy_identity_id', lid.id),
  now()
FROM public.linkedin_identities lid
LEFT JOIN public.social_connections sc
  ON sc.tenant_id = lid.tenant_id AND sc.provider = 'linkedin'
WHERE lid.type = 'organization'
  AND lid.linkedin_organization_id IS NOT NULL
  AND lid.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, provider, identity_type, provider_identity_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  can_publish = EXCLUDED.can_publish,
  provider_identity_urn = EXCLUDED.provider_identity_urn,
  updated_at = now();
