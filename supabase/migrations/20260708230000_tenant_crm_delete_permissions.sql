-- Allow tenant members to delete their own CRM records (leads, deals, contacts, clients).
-- Fixes blocked deletes when child rows (e.g. lead_activities) had incomplete RLS policies.

-- ─── Helpers (referenced by policies but missing from earlier migrations) ───
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS TABLE(tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tu.tenant_id
  FROM public.tenant_users tu
  WHERE tu.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = p_tenant_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tenant_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_tenant(uuid) TO authenticated, service_role;

-- ─── Leads ───
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for leads" ON public.leads;
DROP POLICY IF EXISTS "Tenant members manage leads" ON public.leads;

CREATE POLICY "Tenant members manage leads"
  ON public.leads
  FOR ALL
  USING (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  )
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  );

-- ─── Lead activities (old policies referenced profiles.tenant_id which does not exist) ───
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view activities for leads they can see" ON public.lead_activities;
DROP POLICY IF EXISTS "Users can insert activities for leads they can see" ON public.lead_activities;
DROP POLICY IF EXISTS "Tenant members manage lead activities" ON public.lead_activities;

CREATE POLICY "Tenant members manage lead activities"
  ON public.lead_activities
  FOR ALL
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_activities.lead_id
        AND l.tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = lead_activities.lead_id
        AND l.tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
    )
  );

-- ─── Deals ───
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for deals" ON public.deals;
DROP POLICY IF EXISTS "Tenant members manage deals" ON public.deals;

CREATE POLICY "Tenant members manage deals"
  ON public.deals
  FOR ALL
  USING (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  )
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  );

-- ─── Deal activities (repair typo policy name from earlier migration) ───
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.deal_activities;

CREATE POLICY "Tenant members manage deal activities"
  ON public.deal_activities
  FOR ALL
  USING (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  )
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  );

-- ─── Contacts & business clients ───
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_contacts" ON public.contacts;
DROP POLICY IF EXISTS "Tenant users can view their contacts" ON public.contacts;
DROP POLICY IF EXISTS "Tenant users can insert their contacts" ON public.contacts;
DROP POLICY IF EXISTS "Tenant users can update their contacts" ON public.contacts;
DROP POLICY IF EXISTS "Tenant users can delete their contacts" ON public.contacts;
DROP POLICY IF EXISTS "Tenant members manage contacts" ON public.contacts;

CREATE POLICY "Tenant members manage contacts"
  ON public.contacts
  FOR ALL
  USING (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  )
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  );

DROP POLICY IF EXISTS "Tenant isolation for business_clients" ON public.business_clients;
DROP POLICY IF EXISTS "Tenant members manage business clients" ON public.business_clients;

CREATE POLICY "Tenant members manage business clients"
  ON public.business_clients
  FOR ALL
  USING (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  )
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  );

-- ─── RPC: delete lead for current tenant (cleans child rows, bypasses fragile cascades) ───
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

  DELETE FROM public.lead_activities WHERE lead_id = p_lead_id;
  DELETE FROM public.leads WHERE id = p_lead_id AND tenant_id = v_tenant_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Lead not deleted');
  END IF;

  RETURN jsonb_build_object('ok', true, 'lead_id', p_lead_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_tenant_deal(p_deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_deleted integer;
BEGIN
  SELECT d.tenant_id
  INTO v_tenant_id
  FROM public.deals d
  WHERE d.id = p_deal_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Deal not found');
  END IF;

  IF NOT public.user_belongs_to_tenant(v_tenant_id) AND NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  DELETE FROM public.deal_activities WHERE deal_id = p_deal_id;
  DELETE FROM public.deals WHERE id = p_deal_id AND tenant_id = v_tenant_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Deal not deleted');
  END IF;

  RETURN jsonb_build_object('ok', true, 'deal_id', p_deal_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_tenant_client(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_contact_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT bc.tenant_id, bc.crm_contact_id
  INTO v_tenant_id, v_contact_id
  FROM public.business_clients bc
  WHERE bc.id = p_client_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Client not found');
  END IF;

  IF NOT public.user_belongs_to_tenant(v_tenant_id) AND NOT public.is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  UPDATE public.business_clients
  SET is_active = false, updated_at = v_now
  WHERE id = p_client_id AND tenant_id = v_tenant_id;

  IF v_contact_id IS NOT NULL THEN
    UPDATE public.contacts
    SET deleted_at = v_now, status = 'inactive', updated_at = v_now
    WHERE id = v_contact_id AND tenant_id = v_tenant_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'client_id', p_client_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_tenant_lead(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_tenant_deal(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_tenant_client(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
