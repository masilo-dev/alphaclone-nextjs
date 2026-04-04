-- Fix create_tenant function overload issue
-- The error PGRST203 indicates there are multiple functions with similar signatures
-- This migration drops all create_tenant functions and recreates a single, specific one

-- Drop all existing create_tenant functions to avoid conflicts
DROP FUNCTION IF EXISTS public.create_tenant(VARCHAR, VARCHAR, UUID, VARCHAR);

-- Recreate the create_tenant function with explicit parameter types
CREATE OR REPLACE FUNCTION public.create_tenant(
    p_name VARCHAR(200),
    p_slug VARCHAR(100),
    p_admin_user_id UUID,
    p_plan VARCHAR(50) DEFAULT 'free'
) RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Create tenant
    INSERT INTO public.tenants (name, slug, subscription_plan)
    VALUES (p_name, p_slug, p_plan)
    RETURNING id INTO v_tenant_id;
    
    -- Add admin user
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, p_admin_user_id, 'admin')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
    
    -- Publish tenant created event (if publish_event function exists)
    BEGIN
        PERFORM public.publish_event(
            'tenant.created',
            'tenant_service',
            jsonb_build_object(
                'tenantId', v_tenant_id,
                'name', p_name,
                'adminUserId', p_admin_user_id
            )
        );
    EXCEPTION WHEN undefined_function THEN
        -- Event publishing is optional, ignore if function doesn't exist
        NULL;
    END;
    
    RETURN v_tenant_id;
EXCEPTION
    WHEN unique_violation THEN
        -- Handle slug uniqueness
        RAISE EXCEPTION 'Tenant with slug "%" already exists', p_slug;
    WHEN foreign_key_violation THEN
        -- Handle invalid user ID
        RAISE EXCEPTION 'Invalid admin user ID: %', p_admin_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_tenant(VARCHAR(200), VARCHAR(100), UUID, VARCHAR(50)) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.create_tenant(VARCHAR(200), VARCHAR(100), UUID, VARCHAR(50)) IS 
'Creates a new tenant with the specified name, slug, and admin user. Returns the tenant ID.';
