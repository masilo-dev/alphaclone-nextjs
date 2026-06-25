-- Add RLS to support_tickets (tenant isolation)
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_select_tenant_members ON public.support_tickets;
CREATE POLICY support_tickets_select_tenant_members
  ON public.support_tickets
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS support_tickets_insert_tenant_members ON public.support_tickets;
CREATE POLICY support_tickets_insert_tenant_members
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS support_tickets_update_tenant_members ON public.support_tickets;
CREATE POLICY support_tickets_update_tenant_members
  ON public.support_tickets
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS support_tickets_delete_tenant_members ON public.support_tickets;
CREATE POLICY support_tickets_delete_tenant_members
  ON public.support_tickets
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );
