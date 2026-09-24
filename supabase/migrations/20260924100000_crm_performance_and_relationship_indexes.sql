-- CRM Performance & Relationship Indexes
-- Phase 3: Optimize frequent CRM navigation queries, relationship Lookups, and Client Portal resolution.

-- 1. Business clients: listing active clients ordered by created_at per tenant
CREATE INDEX IF NOT EXISTS idx_business_clients_tenant_active_created 
  ON public.business_clients (tenant_id, is_active, created_at DESC);

-- 2. Leads: board query and stage filtering per tenant
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created 
  ON public.leads (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage 
  ON public.leads (tenant_id, stage);

-- 3. Invoices: relationship lookups by client_id within tenant
CREATE INDEX IF NOT EXISTS idx_business_invoices_tenant_client 
  ON public.business_invoices (tenant_id, client_id);

-- 4. Contracts: relationship lookups by client_id within tenant
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_client 
  ON public.contracts (tenant_id, client_id);

-- 5. Projects: relationship lookups by client_id within tenant
CREATE INDEX IF NOT EXISTS idx_projects_tenant_client 
  ON public.projects (tenant_id, client_id);

-- 6. Client notes: timeline and activity notes by client_id or related_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_notes' AND column_name = 'client_id') THEN
    CREATE INDEX IF NOT EXISTS idx_client_notes_client_created ON public.client_notes (client_id, created_at DESC);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_notes' AND column_name = 'related_id') THEN
    CREATE INDEX IF NOT EXISTS idx_client_notes_related_created ON public.client_notes (related_id, created_at DESC);
  END IF;
END $$;

-- 7. Client Portal token lookup (sparse index for fast auth resolution)
CREATE INDEX IF NOT EXISTS idx_business_clients_portal_token 
  ON public.business_clients (finance_portal_token) 
  WHERE finance_portal_token IS NOT NULL;
