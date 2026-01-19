-- Fix get_user_tenants function to return correct column names
-- This fixes the "Failed to load user tenants" error

DROP FUNCTION IF EXISTS get_user_tenants(UUID);

CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    slug VARCHAR,
    domain VARCHAR,
    logo_url TEXT,
    settings JSONB,
    subscription_plan VARCHAR,
    subscription_status VARCHAR,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    role VARCHAR,
    joined_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        t.domain,
        t.logo_url,
        t.settings,
        t.subscription_plan,
        t.subscription_status,
        t.trial_ends_at,
        t.created_at,
        t.updated_at,
        tu.role,
        tu.joined_at
    FROM tenants t
    INNER JOIN tenant_users tu ON t.id = tu.tenant_id
    WHERE tu.user_id = p_user_id
    ORDER BY tu.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tenants IS 'Returns all tenants a user belongs to with their role';
