-- 20260309_fix_rls_recursion.sql
-- Breaking the circular dependency in profiles and tenant_users RLS

-- 1. Disable FORCE RLS to allow SECURITY DEFINER functions (owned by postgres) to bypass RLS.
ALTER TABLE public.profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenants NO FORCE ROW LEVEL SECURITY;

-- 2. Redefine security functions as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(t_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
    AND tenant_id = t_id
    AND role::text IN ('admin', 'tenant_admin')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
 RETURNS user_role
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  u_role user_role;
BEGIN
  SELECT role INTO u_role FROM public.profiles WHERE id = user_id;
  RETURN u_role;
END;
$function$;

-- 3. Update Profiles Policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_tenant_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_tenant_admin_select_v2" ON public.profiles;
DROP POLICY IF EXISTS "profiles_tenant_admin_select_v3" ON public.profiles;

DROP POLICY IF EXISTS "profiles_self_all" ON public.profiles;
CREATE POLICY "profiles_self_all" ON public.profiles
FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles
FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "profiles_tenant_admin_select_v3" ON public.profiles;
CREATE POLICY "profiles_tenant_admin_select_v3" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid() 
    AND tu.tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = public.profiles.id
    )
    AND tu.role::text IN ('admin', 'tenant_admin')
  )
);

-- 4. Update Tenant Users Policies
DROP POLICY IF EXISTS "Admins can view all tenant links" ON public.tenant_users;
DROP POLICY IF EXISTS "Admins can link users to tenants" ON public.tenant_users;
DROP POLICY IF EXISTS "Users can view relevant tenant_users" ON public.tenant_users;
DROP POLICY IF EXISTS "Tenant admins can manage tenant_users" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_all_admin" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_self_tenant_select" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_self_select" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_tenant_admin_all" ON public.tenant_users;

DROP POLICY IF EXISTS "tenant_users_all_admin" ON public.tenant_users;
CREATE POLICY "tenant_users_all_admin" ON public.tenant_users
FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "tenant_users_self_select" ON public.tenant_users;
CREATE POLICY "tenant_users_self_select" ON public.tenant_users
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tenant_users_tenant_admin_all" ON public.tenant_users;
CREATE POLICY "tenant_users_tenant_admin_all" ON public.tenant_users
FOR ALL USING (is_tenant_admin(tenant_id));
