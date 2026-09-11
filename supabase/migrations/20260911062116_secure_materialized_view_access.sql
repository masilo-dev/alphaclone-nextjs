-- Secure materialized views that cannot enforce RLS themselves.

REVOKE ALL ON TABLE public.conversation_list FROM anon;
REVOKE ALL ON TABLE public.conversation_list FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_general_ledger_entries(
  p_tenant_id uuid,
  p_account_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_account_type text DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_limit integer DEFAULT 1000
)
RETURNS SETOF public.general_ledger
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT gl.*
  FROM public.general_ledger gl
  WHERE gl.tenant_id = p_tenant_id
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.tenant_users tu
        WHERE tu.tenant_id = p_tenant_id
          AND tu.user_id = auth.uid()
      )
    )
    AND (p_account_id IS NULL OR gl.account_id = p_account_id)
    AND (p_start_date IS NULL OR gl.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR gl.entry_date <= p_end_date)
    AND (p_account_type IS NULL OR gl.account_type::text = p_account_type)
    AND (p_source_type IS NULL OR gl.source_type::text = p_source_type)
  ORDER BY gl.entry_date ASC, gl.entry_number ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 1000), 5000));
$$;

REVOKE ALL ON FUNCTION public.get_general_ledger_entries(uuid,uuid,date,date,text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_general_ledger_entries(uuid,uuid,date,date,text,text,integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_general_ledger_entries(uuid,uuid,date,date,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_general_ledger_entries(uuid,uuid,date,date,text,text,integer) TO service_role;

REVOKE ALL ON TABLE public.general_ledger FROM anon;
REVOKE ALL ON TABLE public.general_ledger FROM authenticated;
