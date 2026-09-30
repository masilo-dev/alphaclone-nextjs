-- ==============================================================================
-- Migration: 20260930120000_harden_business_clients_and_projects_rls.sql
-- Description: Critical security hardening for business_clients, projects, and tasks
-- Eliminates unauthenticated anon key leakage of client data and cross-tenant projects
-- ==============================================================================

-- 1. Revoke public/anon table-level privileges
REVOKE ALL ON public.business_clients FROM anon;
REVOKE ALL ON public.projects FROM anon;
REVOKE ALL ON public.tasks FROM anon;

-- Ensure authenticated users and service_role have full access governed by RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_clients TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated, service_role;

-- 2. Force Enable Row Level Security
ALTER TABLE public.business_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_clients FORCE ROW LEVEL SECURITY;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

-- 3. Drop all legacy and overly permissive policies
DROP POLICY IF EXISTS "Tenant members manage business clients" ON public.business_clients;
DROP POLICY IF EXISTS "Tenant isolation for business_clients" ON public.business_clients;
DROP POLICY IF EXISTS "Tenant Admins can manage business clients" ON public.business_clients;
DROP POLICY IF EXISTS "Public clients viewable" ON public.business_clients;

DROP POLICY IF EXISTS "Public projects are viewable by link" ON public.projects;
DROP POLICY IF EXISTS "Public projects are viewable" ON public.projects;
DROP POLICY IF EXISTS "Tenant isolation for projects" ON public.projects;
DROP POLICY IF EXISTS "Tenant members manage projects" ON public.projects;
DROP POLICY IF EXISTS "tenant_member_access" ON public.projects;

DROP POLICY IF EXISTS "Tenant members manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "tenant_member_access" ON public.tasks;

-- 4. Create strict, tenant-isolated RLS policies restricted TO authenticated
CREATE POLICY "Tenant members manage business clients"
  ON public.business_clients
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

CREATE POLICY "Tenant members manage projects"
  ON public.projects
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

CREATE POLICY "Tenant members manage tasks"
  ON public.tasks
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

-- 5. Add migration tracking comment
COMMENT ON TABLE public.business_clients IS 'Hardened tenant-isolated CRM clients with strict RLS (2026-09-30)';
COMMENT ON TABLE public.projects IS 'Hardened tenant-isolated projects with strict RLS (2026-09-30)';
COMMENT ON TABLE public.tasks IS 'Hardened tenant-isolated tasks with strict RLS (2026-09-30)';
