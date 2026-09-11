ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS quota_limits jsonb NOT NULL DEFAULT '{"leadsPerDay":40,"contractsPerDay":4,"invoicesPerDay":30,"receiptsPerDay":30}'::jsonb;

CREATE TABLE IF NOT EXISTS public.quota_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  leads integer NOT NULL DEFAULT 0,
  contracts integer NOT NULL DEFAULT 0,
  invoices integer NOT NULL DEFAULT 0,
  receipts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, date)
);

ALTER TABLE public.quota_usage ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS quota_usage_tenant_user_date_key ON public.quota_usage (tenant_id, user_id, date);

ALTER TABLE public.quota_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant members can view their quota usage" ON public.quota_usage;
CREATE POLICY "Tenant members can view their quota usage" ON public.quota_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tenant_users membership
    WHERE membership.tenant_id = quota_usage.tenant_id AND membership.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.consume_daily_resource_quota(
  p_tenant_id uuid,
  p_user_id uuid,
  p_resource text,
  p_amount integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.quota_usage%ROWTYPE;
  v_limits jsonb;
  v_limit integer;
  v_current integer;
BEGIN
  IF p_resource NOT IN ('leads', 'contracts', 'invoices', 'receipts') OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid quota request';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_users WHERE tenant_id = p_tenant_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Tenant membership required';
  END IF;

  SELECT COALESCE(quota_limits, '{}'::jsonb) INTO v_limits FROM public.tenants WHERE id = p_tenant_id;
  v_limit := COALESCE((v_limits ->> (p_resource || 'PerDay'))::integer,
    CASE p_resource WHEN 'leads' THEN 40 WHEN 'contracts' THEN 4 ELSE 30 END);

  INSERT INTO public.quota_usage (tenant_id, user_id, date)
  VALUES (p_tenant_id, p_user_id, CURRENT_DATE)
  ON CONFLICT (tenant_id, user_id, date) DO NOTHING;
  SELECT * INTO v_row FROM public.quota_usage
    WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND date = CURRENT_DATE
    FOR UPDATE;
  v_current := CASE p_resource WHEN 'leads' THEN v_row.leads WHEN 'contracts' THEN v_row.contracts WHEN 'invoices' THEN v_row.invoices ELSE v_row.receipts END;
  IF v_limit >= 0 AND v_current + p_amount > v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'currentUsage', v_current, 'limit', v_limit, 'remaining', GREATEST(v_limit - v_current, 0));
  END IF;

  UPDATE public.quota_usage SET
    leads = leads + CASE WHEN p_resource = 'leads' THEN p_amount ELSE 0 END,
    contracts = contracts + CASE WHEN p_resource = 'contracts' THEN p_amount ELSE 0 END,
    invoices = invoices + CASE WHEN p_resource = 'invoices' THEN p_amount ELSE 0 END,
    receipts = receipts + CASE WHEN p_resource = 'receipts' THEN p_amount ELSE 0 END,
    updated_at = now()
  WHERE id = v_row.id;
  RETURN jsonb_build_object('allowed', true, 'currentUsage', v_current + p_amount, 'limit', v_limit, 'remaining', CASE WHEN v_limit < 0 THEN -1 ELSE GREATEST(v_limit - v_current - p_amount, 0) END);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_daily_resource_quota(
  p_tenant_id uuid,
  p_user_id uuid,
  p_resource text,
  p_amount integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_resource NOT IN ('leads', 'contracts', 'invoices', 'receipts') OR p_amount <= 0 THEN RETURN; END IF;
  UPDATE public.quota_usage SET
    leads = GREATEST(0, leads - CASE WHEN p_resource = 'leads' THEN p_amount ELSE 0 END),
    contracts = GREATEST(0, contracts - CASE WHEN p_resource = 'contracts' THEN p_amount ELSE 0 END),
    invoices = GREATEST(0, invoices - CASE WHEN p_resource = 'invoices' THEN p_amount ELSE 0 END),
    receipts = GREATEST(0, receipts - CASE WHEN p_resource = 'receipts' THEN p_amount ELSE 0 END),
    updated_at = now()
  WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND date = CURRENT_DATE;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_resource_quota(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_daily_resource_quota(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_resource_quota(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_daily_resource_quota(uuid, uuid, text, integer) TO service_role;
