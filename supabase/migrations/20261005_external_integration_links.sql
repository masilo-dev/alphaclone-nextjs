-- ==============================================================================
-- Migration: 20261005_external_integration_links.sql
-- Description: Universal mapping table for decoupled open-source engines
--              (Paperless-ngx, Documenso, Chatwoot, Mautic).
--              Enforces strict tenant isolation via Row Level Security.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.external_integration_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'paperless' | 'documenso' | 'chatwoot' | 'mautic'
  local_entity_type text NOT NULL, -- 'document' | 'contract' | 'contact' | 'lead'
  local_entity_id uuid NOT NULL,
  external_id text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_integration_link UNIQUE (tenant_id, provider, local_entity_type, local_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_links_lookup
  ON public.external_integration_links (tenant_id, provider, external_id);

-- Enable RLS
ALTER TABLE public.external_integration_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_integration_links FORCE ROW LEVEL SECURITY;

-- Restrict to authenticated tenant members
CREATE POLICY "Tenant members manage external integration links"
  ON public.external_integration_links
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  )
  WITH CHECK (
    public.is_super_admin()
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_tenant_ids())
  );

COMMENT ON TABLE public.external_integration_links IS 'Maps AlphaClone entities to self-hosted open source systems (Paperless, Documenso, Chatwoot, Mautic)';
