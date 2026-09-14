CREATE TABLE IF NOT EXISTS public.client_portal_read_state (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.business_clients(id) ON DELETE CASCADE,
  last_messages_read_at timestamptz,
  last_activity_read_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id)
);

ALTER TABLE public.client_portal_read_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_portal_read_state_tenant_access ON public.client_portal_read_state;
CREATE POLICY client_portal_read_state_tenant_access ON public.client_portal_read_state FOR ALL
USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
