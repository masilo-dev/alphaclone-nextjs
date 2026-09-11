-- Migration: Fix Multi-Tenancy Data Leak and Migrate Users
-- Created: 2026-03-20
-- Description: 
-- 1. Redefines handle_new_user_registration to stop auto-joining Google users to Default Org.
-- 2. Migrates existing non-admin users and their data from Default Org to unique organizations.

-- Part 1: Fix Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Create a profile for the new user but DO NOT automatically link them to a tenant.
  -- The application frontend (TenantContext.tsx) will handle creating a unique 
  -- organization for the user on their first login.
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''),
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role)
  );

  RETURN new;
END;
$function$;

-- Part 2: Migrate Users and Data
DO $$
DECLARE
    u RECORD;
    new_tenant_id UUID;
    default_org_id UUID := '2cd1b4ff-6e84-49cb-9f22-56ea8cf1e57f';
BEGIN
    -- Iterate through non-admin users in the Default Organization
    FOR u IN 
        SELECT p.id, p.email, p.name 
        FROM public.profiles p
        JOIN public.tenant_users tu ON p.id = tu.user_id
        WHERE tu.tenant_id = default_org_id
        AND p.role NOT IN ('admin')
    LOOP
        -- 1. Create a new unique tenant for this user
        INSERT INTO public.tenants (name, slug, subscription_plan, subscription_status)
        VALUES (
            COALESCE(u.name, split_part(u.email, '@', 1)) || '''s Organization',
            'org-' || substr(u.id::text, 1, 8),
            'free',
            'active'
        )
        RETURNING id INTO new_tenant_id;

        -- 2. Move the user record in tenant_users to the new tenant
        UPDATE public.tenant_users
        SET tenant_id = new_tenant_id
        WHERE user_id = u.id AND tenant_id = default_org_id;

        -- 3. Move owned data to the new tenant
        UPDATE public.leads SET tenant_id = new_tenant_id WHERE owner_id = u.id AND tenant_id = default_org_id;
        UPDATE public.deals SET tenant_id = new_tenant_id WHERE owner_id = u.id AND tenant_id = default_org_id;
        UPDATE public.projects SET tenant_id = new_tenant_id WHERE owner_id = u.id AND tenant_id = default_org_id;
        UPDATE public.tasks SET tenant_id = new_tenant_id WHERE created_by = u.id AND tenant_id = default_org_id;

    END LOOP;
END $$;
