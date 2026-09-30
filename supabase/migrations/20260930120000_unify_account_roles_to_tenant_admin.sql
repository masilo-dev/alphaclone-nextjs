-- Migration: 20260930120000_unify_account_roles_to_tenant_admin.sql
-- Description: Unify account architecture by migrating legacy 'client' user roles to 'tenant_admin'
-- and ensuring every registered user has an active business workspace.

-- 1. Upgrade all registered profiles with role = 'client' to 'tenant_admin'
UPDATE public.profiles
SET role = 'tenant_admin'
WHERE role = 'client';

-- 2. Upgrade all tenant_users rows where role = 'client' to 'tenant_admin'
UPDATE public.tenant_users
SET role = 'tenant_admin'
WHERE role = 'client';

-- 3. Upgrade user_tenant_roles rows where role = 'client' to 'tenant_admin'
UPDATE public.user_tenant_roles
SET role = 'tenant_admin'
WHERE role = 'client';

-- 4. Synchronize profiles.tenant_id from tenant_users where profiles.tenant_id is NULL
UPDATE public.profiles p
SET tenant_id = tu.tenant_id
FROM (
    SELECT DISTINCT ON (user_id) user_id, tenant_id
    FROM public.tenant_users
    ORDER BY user_id, joined_at DESC
) tu
WHERE p.id = tu.user_id
  AND p.tenant_id IS NULL;

-- 5. Automatically provision a workspace for any registered user who does not have one
DO $$
DECLARE
    r RECORD;
    v_tenant_id UUID;
    v_slug TEXT;
    v_clean_name TEXT;
BEGIN
    FOR r IN (
        SELECT id, name, email 
        FROM public.profiles 
        WHERE tenant_id IS NULL 
          AND id NOT IN (SELECT user_id FROM public.tenant_users)
          AND role = 'tenant_admin'
    ) LOOP
        v_clean_name := COALESCE(NULLIF(trim(r.name), ''), split_part(r.email, '@', 1), 'User');
        v_slug := 'org-' || substring(r.id::text from 1 for 8);
        
        -- Use the canonical create_tenant function
        v_tenant_id := public.create_tenant(
            v_clean_name || '''s Organization',
            v_slug,
            r.id,
            'free'
        );
        
        UPDATE public.profiles 
        SET tenant_id = v_tenant_id 
        WHERE id = r.id;
    END LOOP;
END;
$$;
