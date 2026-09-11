-- =============================================================================
-- Alphaclone PR #65 — ALL database migrations to apply (copy/paste into Supabase SQL Editor)
-- Apply in this exact order. Idempotent where possible (IF NOT EXISTS / OR REPLACE).
-- Generated: 2026-07-24
-- =============================================================================

-- >>> FILE 1/4: 20260724120000_social_publishing_repair.sql

-- Social publishing repair: lifecycle columns + extend social_post_status enum.
-- Safe / idempotent. Does NOT auto-republish (avoids duplicates).
-- NOTE: UPDATEs that write new enum values live in 20260724120001_* so they
-- run in a later transaction after ADD VALUE is committed (PG requirement).

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS live_url text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS social_posts_tenant_idempotency_uidx
  ON public.social_posts (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS checksum_sha256 text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer;

DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'validating',
    'awaiting_approval',
    'approved',
    'uploading_media',
    'verification_failed',
    'retrying',
    'orphaned',
    'deleted',
    'pending_review',
    'published_sandbox'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TYPE public.social_post_status ADD VALUE IF NOT EXISTS %L', v);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

DO $$
BEGIN
  ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- >>> FILE 2/4: 20260724120001_social_publishing_orphan_repair.sql

-- Apply new social_post_status values after ADD VALUE commits (separate txn).

UPDATE public.social_posts
SET
  status = 'orphaned',
  error_message = COALESCE(
    error_message,
    'Marked orphaned by social publishing repair: ok=true after DB insert without Facebook provider_post_id. Not auto-republished.'
  ),
  last_error = 'fake_success_no_provider_id',
  updated_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'repair',
    jsonb_build_object(
      'repaired_at', now(),
      'reason', 'fake_success_no_provider_id',
      'migration', '20260724120001_social_publishing_orphan_repair'
    )
  )
WHERE id = '1854057c-abea-4333-8a3a-9354be9217d0'
  AND facebook_post_id IS NULL
  AND COALESCE(linkedin_post_urn, '') = '';

UPDATE public.social_posts
SET
  status = 'orphaned',
  last_error = COALESCE(last_error, 'fake_success_no_provider_id'),
  error_message = COALESCE(
    error_message,
    'Marked orphaned: published without provider post id'
  ),
  updated_at = now()
WHERE status = 'published'
  AND facebook_post_id IS NULL
  AND COALESCE(linkedin_post_urn, '') = ''
  AND COALESCE(live_url, '') = '';

UPDATE public.social_posts
SET
  status = 'failed',
  last_error = COALESCE(last_error, 'stuck_publishing_timeout'),
  error_message = COALESCE(error_message, 'Publishing timed out; marked failed for retry'),
  updated_at = now()
WHERE status = 'publishing'
  AND updated_at < now() - interval '30 minutes';

-- >>> FILE 3/4: 20260724130000_multitenant_social_connections.sql

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
  can_publish = EXCLUDED.can_publish,
  can_upload_media = EXCLUDED.can_upload_media,
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

-- Pick at most one LinkedIn connection per tenant to avoid
-- "ON CONFLICT DO UPDATE cannot affect row a second time".
INSERT INTO public.social_identities (
  tenant_id, connection_id, provider, identity_type, provider_identity_id,
  provider_identity_urn, display_name, can_publish, can_upload_media, is_active, metadata, updated_at
)
SELECT DISTINCT ON (lid.tenant_id, lid.linkedin_organization_id)
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
LEFT JOIN LATERAL (
  SELECT sc0.id
  FROM public.social_connections sc0
  WHERE sc0.tenant_id = lid.tenant_id
    AND sc0.provider = 'linkedin'
  ORDER BY
    CASE WHEN sc0.connection_status = 'active' THEN 0 ELSE 1 END,
    sc0.updated_at DESC NULLS LAST,
    sc0.created_at DESC NULLS LAST
  LIMIT 1
) sc ON true
WHERE lid.type = 'organization'
  AND lid.linkedin_organization_id IS NOT NULL
  AND lid.tenant_id IS NOT NULL
ORDER BY lid.tenant_id, lid.linkedin_organization_id, lid.updated_at DESC NULLS LAST
ON CONFLICT (tenant_id, provider, identity_type, provider_identity_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  can_publish = EXCLUDED.can_publish,
  provider_identity_urn = EXCLUDED.provider_identity_urn,
  connection_id = COALESCE(EXCLUDED.connection_id, public.social_identities.connection_id),
  updated_at = now();

-- Facebook can_publish must not be blindly true — require active connection only
-- (page task verification happens at sync time in app code).
UPDATE public.social_identities si
SET can_publish = (sc.connection_status = 'active'),
    can_upload_media = (sc.connection_status = 'active'),
    updated_at = now()
FROM public.social_connections sc
WHERE si.connection_id = sc.id
  AND si.provider = 'facebook'
  AND si.identity_type = 'facebook_page';

-- >>> FILE 4/4: 20260724140000_platform_multitenant_foundation.sql

-- Platform-wide multi-tenant helpers + harden set_tenant_context
-- Alphaclone Systems is one ordinary tenant — never a global default.

-- ─── Membership helpers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tu.tenant_id
  FROM public.tenant_users tu
  WHERE tu.user_id = auth.uid()
    AND (
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenant_users' AND column_name = 'status'
      )
      OR COALESCE(tu.status, 'active') = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = auth.uid()
      AND (
        NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'tenant_users' AND column_name = 'status'
        )
        OR COALESCE(tu.status, 'active') = 'active'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_belongs_to_tenant(p_tenant_id);
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_owner(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id
      AND tu.user_id = auth.uid()
      AND lower(COALESCE(tu.role, '')) IN ('owner', 'admin', 'administrator', 'super_admin')
      AND (
        NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'tenant_users' AND column_name = 'status'
        )
        OR COALESCE(tu.status, 'active') = 'active'
      )
  );
$$;

-- Prefer explicit session setting only after membership validation (below).
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid text;
  tid uuid;
BEGIN
  sid := nullif(current_setting('app.current_tenant_id', true), '');
  IF sid IS NOT NULL THEN
    BEGIN
      tid := sid::uuid;
    EXCEPTION WHEN others THEN
      tid := NULL;
    END;
    IF tid IS NOT NULL AND public.user_belongs_to_tenant(tid) THEN
      RETURN tid;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tenant_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;

-- ─── Harden set_tenant_context: membership required for authenticated ───────
CREATE OR REPLACE FUNCTION public.set_tenant_context(tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  -- Service role (no auth.uid) may set context for workers.
  -- Authenticated callers must be active members of the tenant.
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.user_belongs_to_tenant(tenant_id) THEN
      RAISE EXCEPTION 'Not a member of tenant %', tenant_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM set_config('app.current_tenant_id', tenant_id::text, true); -- transaction-local
END;
$$;

REVOKE ALL ON FUNCTION public.set_tenant_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_tenant_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_context(uuid) TO service_role;

COMMENT ON FUNCTION public.set_tenant_context(uuid) IS
  'Sets app.current_tenant_id for RLS. Authenticated callers must be tenant members. Transaction-local.';

-- ─── Stage B: add tenant_id to critical child tables (nullable first, backfill) ─
DO $$
BEGIN
  IF to_regclass('public.project_milestones') IS NOT NULL THEN
    ALTER TABLE public.project_milestones ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;
  IF to_regclass('public.ticket_comments') IS NOT NULL THEN
    ALTER TABLE public.ticket_comments ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;
  IF to_regclass('public.lead_activities') IS NOT NULL THEN
    ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;
  IF to_regclass('public.campaign_recipients') IS NOT NULL THEN
    ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;
  IF to_regclass('public.campaign_messages') IS NOT NULL THEN
    ALTER TABLE public.campaign_messages ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;
  IF to_regclass('public.email_sequence_steps') IS NOT NULL THEN
    ALTER TABLE public.email_sequence_steps ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;
  IF to_regclass('public.email_sequence_enrollments') IS NOT NULL THEN
    ALTER TABLE public.email_sequence_enrollments ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;
  IF to_regclass('public.messenger_messages') IS NOT NULL THEN
    ALTER TABLE public.messenger_messages ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;
END $$;

-- Quarantine table for ambiguous orphan rows (do NOT auto-delete)
CREATE TABLE IF NOT EXISTS public.tenant_isolation_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  reason text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  resolution text
);

CREATE INDEX IF NOT EXISTS tenant_isolation_quarantine_table_idx
  ON public.tenant_isolation_quarantine (table_name, created_at DESC);

-- Backfill from parents where possible (safe, no reassignment of orphans)
DO $$
BEGIN
  IF to_regclass('public.project_milestones') IS NOT NULL AND to_regclass('public.projects') IS NOT NULL THEN
    UPDATE public.project_milestones pm
    SET tenant_id = p.tenant_id
    FROM public.projects p
    WHERE pm.tenant_id IS NULL AND pm.project_id = p.id AND p.tenant_id IS NOT NULL;
  END IF;

  IF to_regclass('public.ticket_comments') IS NOT NULL AND to_regclass('public.tickets') IS NOT NULL THEN
    UPDATE public.ticket_comments tc
    SET tenant_id = t.tenant_id
    FROM public.tickets t
    WHERE tc.tenant_id IS NULL AND tc.ticket_id = t.id AND t.tenant_id IS NOT NULL;
  END IF;

  IF to_regclass('public.lead_activities') IS NOT NULL AND to_regclass('public.leads') IS NOT NULL THEN
    UPDATE public.lead_activities la
    SET tenant_id = l.tenant_id
    FROM public.leads l
    WHERE la.tenant_id IS NULL AND la.lead_id = l.id AND l.tenant_id IS NOT NULL;
  END IF;

  IF to_regclass('public.campaign_recipients') IS NOT NULL AND to_regclass('public.email_campaigns') IS NOT NULL THEN
    UPDATE public.campaign_recipients cr
    SET tenant_id = c.tenant_id
    FROM public.email_campaigns c
    WHERE cr.tenant_id IS NULL AND cr.campaign_id = c.id AND c.tenant_id IS NOT NULL;
  ELSIF to_regclass('public.campaign_recipients') IS NOT NULL AND to_regclass('public.campaigns') IS NOT NULL THEN
    UPDATE public.campaign_recipients cr
    SET tenant_id = c.tenant_id
    FROM public.campaigns c
    WHERE cr.tenant_id IS NULL AND cr.campaign_id = c.id AND c.tenant_id IS NOT NULL;
  END IF;

  IF to_regclass('public.campaign_messages') IS NOT NULL AND to_regclass('public.email_campaigns') IS NOT NULL THEN
    UPDATE public.campaign_messages cm
    SET tenant_id = c.tenant_id
    FROM public.email_campaigns c
    WHERE cm.tenant_id IS NULL AND cm.campaign_id = c.id AND c.tenant_id IS NOT NULL;
  ELSIF to_regclass('public.campaign_messages') IS NOT NULL AND to_regclass('public.campaigns') IS NOT NULL THEN
    UPDATE public.campaign_messages cm
    SET tenant_id = c.tenant_id
    FROM public.campaigns c
    WHERE cm.tenant_id IS NULL AND cm.campaign_id = c.id AND c.tenant_id IS NOT NULL;
  END IF;

  IF to_regclass('public.email_sequence_steps') IS NOT NULL AND to_regclass('public.email_sequences') IS NOT NULL THEN
    UPDATE public.email_sequence_steps ess
    SET tenant_id = es.tenant_id
    FROM public.email_sequences es
    WHERE ess.tenant_id IS NULL AND ess.sequence_id = es.id AND es.tenant_id IS NOT NULL;
  END IF;

  IF to_regclass('public.email_sequence_enrollments') IS NOT NULL AND to_regclass('public.email_sequences') IS NOT NULL THEN
    UPDATE public.email_sequence_enrollments ese
    SET tenant_id = es.tenant_id
    FROM public.email_sequences es
    WHERE ese.tenant_id IS NULL AND ese.sequence_id = es.id AND es.tenant_id IS NOT NULL;
  END IF;

  IF to_regclass('public.messenger_messages') IS NOT NULL AND to_regclass('public.messenger_conversations') IS NOT NULL THEN
    UPDATE public.messenger_messages mm
    SET tenant_id = mc.tenant_id
    FROM public.messenger_conversations mc
    WHERE mm.tenant_id IS NULL AND mm.conversation_id = mc.id AND mc.tenant_id IS NOT NULL;
  END IF;
END $$;

-- Quarantine orphans after backfill (manual review — do not auto-delete)
DO $$
BEGIN
  IF to_regclass('public.project_milestones') IS NOT NULL THEN
    INSERT INTO public.tenant_isolation_quarantine (table_name, record_id, reason, payload)
    SELECT 'project_milestones', pm.id, 'missing_tenant_id_after_backfill', to_jsonb(pm)
    FROM public.project_milestones pm
    WHERE pm.tenant_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_isolation_quarantine q
        WHERE q.table_name = 'project_milestones' AND q.record_id = pm.id
      );
  END IF;

  IF to_regclass('public.ticket_comments') IS NOT NULL THEN
    INSERT INTO public.tenant_isolation_quarantine (table_name, record_id, reason, payload)
    SELECT 'ticket_comments', tc.id, 'missing_tenant_id_after_backfill', to_jsonb(tc)
    FROM public.ticket_comments tc
    WHERE tc.tenant_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_isolation_quarantine q
        WHERE q.table_name = 'ticket_comments' AND q.record_id = tc.id
      );
  END IF;

  IF to_regclass('public.lead_activities') IS NOT NULL THEN
    INSERT INTO public.tenant_isolation_quarantine (table_name, record_id, reason, payload)
    SELECT 'lead_activities', la.id, 'missing_tenant_id_after_backfill', to_jsonb(la)
    FROM public.lead_activities la
    WHERE la.tenant_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_isolation_quarantine q
        WHERE q.table_name = 'lead_activities' AND q.record_id = la.id
      );
  END IF;

  IF to_regclass('public.campaign_recipients') IS NOT NULL THEN
    INSERT INTO public.tenant_isolation_quarantine (table_name, record_id, reason, payload)
    SELECT 'campaign_recipients', cr.id, 'missing_tenant_id_after_backfill', to_jsonb(cr)
    FROM public.campaign_recipients cr
    WHERE cr.tenant_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_isolation_quarantine q
        WHERE q.table_name = 'campaign_recipients' AND q.record_id = cr.id
      );
  END IF;

  IF to_regclass('public.campaign_messages') IS NOT NULL THEN
    INSERT INTO public.tenant_isolation_quarantine (table_name, record_id, reason, payload)
    SELECT 'campaign_messages', cm.id, 'missing_tenant_id_after_backfill', to_jsonb(cm)
    FROM public.campaign_messages cm
    WHERE cm.tenant_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_isolation_quarantine q
        WHERE q.table_name = 'campaign_messages' AND q.record_id = cm.id
      );
  END IF;

  IF to_regclass('public.email_sequence_steps') IS NOT NULL THEN
    INSERT INTO public.tenant_isolation_quarantine (table_name, record_id, reason, payload)
    SELECT 'email_sequence_steps', ess.id, 'missing_tenant_id_after_backfill', to_jsonb(ess)
    FROM public.email_sequence_steps ess
    WHERE ess.tenant_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_isolation_quarantine q
        WHERE q.table_name = 'email_sequence_steps' AND q.record_id = ess.id
      );
  END IF;

  IF to_regclass('public.email_sequence_enrollments') IS NOT NULL THEN
    INSERT INTO public.tenant_isolation_quarantine (table_name, record_id, reason, payload)
    SELECT 'email_sequence_enrollments', ese.id, 'missing_tenant_id_after_backfill', to_jsonb(ese)
    FROM public.email_sequence_enrollments ese
    WHERE ese.tenant_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_isolation_quarantine q
        WHERE q.table_name = 'email_sequence_enrollments' AND q.record_id = ese.id
      );
  END IF;

  IF to_regclass('public.messenger_messages') IS NOT NULL THEN
    INSERT INTO public.tenant_isolation_quarantine (table_name, record_id, reason, payload)
    SELECT 'messenger_messages', mm.id, 'missing_tenant_id_after_backfill', to_jsonb(mm)
    FROM public.messenger_messages mm
    WHERE mm.tenant_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_isolation_quarantine q
        WHERE q.table_name = 'messenger_messages' AND q.record_id = mm.id
      );
  END IF;
END $$;

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS project_milestones_tenant_idx ON public.project_milestones (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ticket_comments_tenant_idx ON public.ticket_comments (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lead_activities_tenant_idx ON public.lead_activities (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_recipients_tenant_idx ON public.campaign_recipients (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_messages_tenant_idx ON public.campaign_messages (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_sequence_steps_tenant_idx ON public.email_sequence_steps (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_sequence_enrollments_tenant_idx ON public.email_sequence_enrollments (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messenger_messages_tenant_idx ON public.messenger_messages (tenant_id) WHERE tenant_id IS NOT NULL;

-- Facebook integrations: tenant-scoped uniqueness (same user+page can exist per tenant)
DO $$
BEGIN
  IF to_regclass('public.facebook_integrations') IS NOT NULL THEN
    -- Drop legacy user+page unique if present (name may vary)
    ALTER TABLE public.facebook_integrations DROP CONSTRAINT IF EXISTS facebook_integrations_user_id_page_id_key;
    DROP INDEX IF EXISTS facebook_integrations_user_id_page_id_key;
    DROP INDEX IF EXISTS facebook_integrations_user_page_uidx;
    CREATE UNIQUE INDEX IF NOT EXISTS facebook_integrations_tenant_user_page_uidx
      ON public.facebook_integrations (tenant_id, user_id, page_id)
      WHERE tenant_id IS NOT NULL AND page_id IS NOT NULL;
  END IF;
END $$;

-- Enable RLS on tasks / child tables if present
DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tasks_tenant_select ON public.tasks;
    DROP POLICY IF EXISTS tasks_tenant_write ON public.tasks;
    CREATE POLICY tasks_tenant_select ON public.tasks
      FOR SELECT USING (public.user_belongs_to_tenant(tenant_id));
    CREATE POLICY tasks_tenant_write ON public.tasks
      FOR ALL USING (public.user_belongs_to_tenant(tenant_id))
      WITH CHECK (public.user_belongs_to_tenant(tenant_id));
  END IF;

  IF to_regclass('public.project_milestones') IS NOT NULL THEN
    ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS project_milestones_tenant_select ON public.project_milestones;
    DROP POLICY IF EXISTS project_milestones_tenant_write ON public.project_milestones;
    CREATE POLICY project_milestones_tenant_select ON public.project_milestones
      FOR SELECT USING (tenant_id IS NOT NULL AND public.user_belongs_to_tenant(tenant_id));
    CREATE POLICY project_milestones_tenant_write ON public.project_milestones
      FOR ALL USING (tenant_id IS NOT NULL AND public.user_belongs_to_tenant(tenant_id))
      WITH CHECK (tenant_id IS NOT NULL AND public.user_belongs_to_tenant(tenant_id));
  END IF;

  IF to_regclass('public.ticket_comments') IS NOT NULL THEN
    ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ticket_comments_tenant_select ON public.ticket_comments;
    DROP POLICY IF EXISTS ticket_comments_tenant_write ON public.ticket_comments;
    CREATE POLICY ticket_comments_tenant_select ON public.ticket_comments
      FOR SELECT USING (tenant_id IS NOT NULL AND public.user_belongs_to_tenant(tenant_id));
    CREATE POLICY ticket_comments_tenant_write ON public.ticket_comments
      FOR ALL USING (tenant_id IS NOT NULL AND public.user_belongs_to_tenant(tenant_id))
      WITH CHECK (tenant_id IS NOT NULL AND public.user_belongs_to_tenant(tenant_id));
  END IF;

  IF to_regclass('public.lead_activities') IS NOT NULL THEN
    ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS lead_activities_tenant_select ON public.lead_activities;
    DROP POLICY IF EXISTS lead_activities_tenant_write ON public.lead_activities;
    CREATE POLICY lead_activities_tenant_select ON public.lead_activities
      FOR SELECT USING (tenant_id IS NOT NULL AND public.user_belongs_to_tenant(tenant_id));
    CREATE POLICY lead_activities_tenant_write ON public.lead_activities
      FOR ALL USING (tenant_id IS NOT NULL AND public.user_belongs_to_tenant(tenant_id))
      WITH CHECK (tenant_id IS NOT NULL AND public.user_belongs_to_tenant(tenant_id));
  END IF;
END $$;

-- =============================================================================
-- END PR #65 migrations
-- =============================================================================
