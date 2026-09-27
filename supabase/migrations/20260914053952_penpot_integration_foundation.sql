-- Penpot integration foundation. AlphaClone remains the system of record.
-- No Penpot credential is stored here; only tenant-owned mappings and audit state.

CREATE TABLE IF NOT EXISTS public.penpot_project_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  penpot_team_id text,
  penpot_project_id text NOT NULL,
  penpot_project_name text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, project_id),
  UNIQUE (tenant_id, penpot_project_id)
);

CREATE TABLE IF NOT EXISTS public.penpot_file_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  approval_id uuid,
  penpot_project_id text NOT NULL,
  penpot_file_id text NOT NULL,
  name text,
  preview_url text,
  version text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, penpot_file_id)
);

CREATE INDEX IF NOT EXISTS idx_penpot_file_mappings_project
  ON public.penpot_file_mappings (tenant_id, project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_penpot_file_mappings_task
  ON public.penpot_file_mappings (tenant_id, task_id) WHERE task_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.penpot_sync_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  request jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  retry_count integer NOT NULL DEFAULT 0,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, idempotency_key)
);

ALTER TABLE public.penpot_project_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penpot_file_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penpot_sync_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS penpot_project_mappings_tenant_read ON public.penpot_project_mappings;
CREATE POLICY penpot_project_mappings_tenant_read ON public.penpot_project_mappings
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS penpot_file_mappings_tenant_read ON public.penpot_file_mappings;
CREATE POLICY penpot_file_mappings_tenant_read ON public.penpot_file_mappings
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS penpot_sync_operations_tenant_read ON public.penpot_sync_operations;
CREATE POLICY penpot_sync_operations_tenant_read ON public.penpot_sync_operations
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
