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

-- Backfill from parents where possible (safe, no reassignment of orphans)
UPDATE public.project_milestones pm
SET tenant_id = p.tenant_id
FROM public.projects p
WHERE pm.tenant_id IS NULL AND pm.project_id = p.id AND p.tenant_id IS NOT NULL;

UPDATE public.ticket_comments tc
SET tenant_id = t.tenant_id
FROM public.tickets t
WHERE tc.tenant_id IS NULL AND tc.ticket_id = t.id AND t.tenant_id IS NOT NULL;

UPDATE public.lead_activities la
SET tenant_id = l.tenant_id
FROM public.leads l
WHERE la.tenant_id IS NULL AND la.lead_id = l.id AND l.tenant_id IS NOT NULL;

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

-- Capture orphan milestones without parent tenant (manual review — do not auto-delete)
INSERT INTO public.tenant_isolation_quarantine (table_name, record_id, reason, payload)
SELECT 'project_milestones', pm.id, 'missing_tenant_id_after_backfill', to_jsonb(pm)
FROM public.project_milestones pm
WHERE pm.tenant_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_isolation_quarantine q
    WHERE q.table_name = 'project_milestones' AND q.record_id = pm.id
  );

-- Indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS project_milestones_tenant_idx ON public.project_milestones (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ticket_comments_tenant_idx ON public.ticket_comments (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lead_activities_tenant_idx ON public.lead_activities (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_recipients_tenant_idx ON public.campaign_recipients (tenant_id) WHERE tenant_id IS NOT NULL;

-- Enable RLS on tasks if present
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
END $$;
