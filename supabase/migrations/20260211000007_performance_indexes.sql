-- Index for filtering tasks by tenant, status, assigned_to
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_assigned ON public.tasks (tenant_id, status, assigned_to);

-- Index for sorting tasks by due_date
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date);

-- Index for searching clients by name/email within a tenant
CREATE INDEX IF NOT EXISTS idx_clients_tenant_search ON public.business_clients (tenant_id, name, email);

-- Index for filtering projects by status
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON public.projects (tenant_id, status);

-- Composite index for client activity timeline
CREATE INDEX IF NOT EXISTS idx_client_activity_client_created ON public.client_activity (client_id, created_at DESC);
