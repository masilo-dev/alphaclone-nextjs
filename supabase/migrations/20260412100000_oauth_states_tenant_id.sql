-- Optional tenant context for OAuth flows (e.g. Zoom per workspace)
ALTER TABLE public.oauth_states
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_oauth_states_tenant_id ON public.oauth_states (tenant_id);
