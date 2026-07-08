-- Fix production schema drift: missing columns, lead delete FKs, KPI RPC, pg_net, RLS.

-- ─── pg_net for cron HTTP jobs ───
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── Compatibility columns expected by dashboard / services ───
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

UPDATE public.activity_logs
SET entity_type = COALESCE(entity_type, metadata->>'entity_type', action)
WHERE entity_type IS NULL;

UPDATE public.activity_logs
SET details = COALESCE(NULLIF(details, '{}'::jsonb), metadata, '{}'::jsonb)
WHERE details IS NULL OR details = '{}'::jsonb;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS lead_source TEXT;

UPDATE public.deals
SET lead_source = COALESCE(lead_source, source::text)
WHERE lead_source IS NULL AND source IS NOT NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS project_id UUID;

UPDATE public.tasks
SET project_id = related_to_project
WHERE project_id IS NULL AND related_to_project IS NOT NULL;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS value NUMERIC,
  ADD COLUMN IF NOT EXISTS total_value NUMERIC;

UPDATE public.contracts
SET
  value = COALESCE(value, contract_value),
  total_value = COALESCE(total_value, contract_value, value)
WHERE value IS NULL OR total_value IS NULL;

ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'other';

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS tax_country TEXT DEFAULT 'ZW';

ALTER TABLE public.custom_playbooks
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.mcp_sessions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.mcp_sessions
SET updated_at = COALESCE(last_activity_at, created_at, updated_at)
WHERE updated_at IS NULL;

ALTER TABLE public.slack_integrations
  ADD COLUMN IF NOT EXISTS scope TEXT;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS created_by UUID;

UPDATE public.tenants
SET created_by = admin_user_id
WHERE created_by IS NULL AND admin_user_id IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

UPDATE public.profiles p
SET tenant_id = sub.tenant_id
FROM (
  SELECT DISTINCT ON (tu.user_id) tu.user_id, tu.tenant_id
  FROM public.tenant_users tu
  ORDER BY tu.user_id, tu.joined_at ASC NULLS LAST, tu.id ASC
) sub
WHERE p.id = sub.user_id
  AND p.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles (tenant_id);

-- ─── Zoho triage_status: app uses 'scheduled' ───
ALTER TABLE public.zoho_auto_responder_logs
  DROP CONSTRAINT IF EXISTS zoho_auto_responder_logs_triage_status_check;

ALTER TABLE public.zoho_auto_responder_logs
  ADD CONSTRAINT zoho_auto_responder_logs_triage_status_check
  CHECK (triage_status = ANY (ARRAY[
    'pending', 'qualified', 'ignored', 'replied', 'error', 'scheduled'
  ]::text[]));

-- ─── Lead delete: unlink NO ACTION FKs before delete ───
CREATE OR REPLACE FUNCTION public.delete_tenant_lead(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_deleted integer;
BEGIN
  SELECT l.tenant_id
  INTO v_tenant_id
  FROM public.leads l
  WHERE l.id = p_lead_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Lead not found');
  END IF;

  IF NOT public.user_belongs_to_tenant(v_tenant_id) AND NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  UPDATE public.tasks SET related_to_lead = NULL WHERE related_to_lead = p_lead_id;
  UPDATE public.calendar_events SET related_to_lead = NULL WHERE related_to_lead = p_lead_id;
  UPDATE public.contacts SET original_lead_id = NULL WHERE original_lead_id = p_lead_id;

  DELETE FROM public.lead_activities WHERE lead_id = p_lead_id;
  DELETE FROM public.leads WHERE id = p_lead_id AND tenant_id = v_tenant_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Lead not deleted');
  END IF;

  RETURN jsonb_build_object('ok', true, 'lead_id', p_lead_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_tenant_lead(uuid) TO authenticated, service_role;

-- ─── RLS: stop using unset app.current_tenant_id / JWT tenant_id alone ───
DROP POLICY IF EXISTS "Users can manage own tenant google calendar tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can view own tenant google calendar tokens" ON public.google_calendar_tokens;

CREATE POLICY "Tenant members manage google calendar tokens"
  ON public.google_calendar_tokens
  FOR ALL
  USING (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  )
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  );

DROP POLICY IF EXISTS tenant_isolation ON public.deal_stage_history;

CREATE POLICY "Tenant members manage deal stage history"
  ON public.deal_stage_history
  FOR ALL
  USING (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  )
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  );

NOTIFY pgrst, 'reload schema';
