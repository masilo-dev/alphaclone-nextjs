-- =====================================================
-- BUSINESS OS - MULTI-TENANCY SYSTEM
-- Phase 3: Multi-Tenant Architecture
-- =====================================================
-- Tenants Table
-- Represents individual businesses using the platform
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(200),
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(20) DEFAULT 'active' CHECK (
        subscription_status IN ('active', 'cancelled', 'suspended', 'trial')
    ),
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Tenant Users (Many-to-Many)
-- Links users to tenants with roles
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    permissions JSONB DEFAULT '[]',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);
-- Tenant Subscriptions
-- Billing and subscription management
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'active',
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    stripe_subscription_id VARCHAR(200),
    stripe_customer_id VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Tenant Usage Metrics
-- Track usage for billing and analytics
CREATE TABLE IF NOT EXISTS tenant_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, metric_name, period_start)
);
-- Tenant Invitations
-- Invite users to join a tenant
CREATE TABLE IF NOT EXISTS tenant_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES users(id),
    token VARCHAR(100) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add tenant_id to existing tables
-- This enables multi-tenant data isolation
-- Projects
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'projects'
        AND column_name = 'tenant_id'
) THEN
ALTER TABLE projects
ADD COLUMN tenant_id UUID REFERENCES tenants(id);
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
END IF;
END $$;
-- Contracts
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'contracts'
        AND column_name = 'tenant_id'
) THEN
ALTER TABLE contracts
ADD COLUMN tenant_id UUID REFERENCES tenants(id);
CREATE INDEX idx_contracts_tenant ON contracts(tenant_id);
END IF;
END $$;
-- Messages
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'messages'
        AND column_name = 'tenant_id'
) THEN
ALTER TABLE messages
ADD COLUMN tenant_id UUID REFERENCES tenants(id);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);
END IF;
END $$;
-- Workflows
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'workflows'
        AND column_name = 'tenant_id'
) THEN
ALTER TABLE workflows
ADD COLUMN tenant_id UUID REFERENCES tenants(id);
CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);
END IF;
END $$;
-- Events
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'events'
        AND column_name = 'tenant_id'
) THEN
ALTER TABLE events
ADD COLUMN tenant_id UUID REFERENCES tenants(id);
CREATE INDEX idx_events_tenant ON events(tenant_id);
END IF;
END $$;
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON tenant_invitations(email);
-- Function to create a new tenant
CREATE OR REPLACE FUNCTION create_tenant(
        p_name VARCHAR,
        p_slug VARCHAR,
        p_admin_user_id UUID,
        p_plan VARCHAR DEFAULT 'free'
    ) RETURNS UUID AS $$
DECLARE v_tenant_id UUID;
BEGIN -- Create tenant
INSERT INTO tenants (name, slug, subscription_plan)
VALUES (p_name, p_slug, p_plan)
RETURNING id INTO v_tenant_id;
-- Add admin user
INSERT INTO tenant_users (tenant_id, user_id, role)
VALUES (v_tenant_id, p_admin_user_id, 'admin');
-- Publish tenant created event
PERFORM publish_event(
    'tenant.created',
    'tenant_service',
    jsonb_build_object(
        'tenantId',
        v_tenant_id,
        'name',
        p_name,
        'adminUserId',
        p_admin_user_id
    )
);
RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql;
-- Function to add user to tenant
CREATE OR REPLACE FUNCTION add_user_to_tenant(
        p_tenant_id UUID,
        p_user_id UUID,
        p_role VARCHAR DEFAULT 'member'
    ) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
INSERT INTO tenant_users (tenant_id, user_id, role)
VALUES (p_tenant_id, p_user_id, p_role) ON CONFLICT (tenant_id, user_id) DO
UPDATE
SET role = EXCLUDED.role
RETURNING id INTO v_id;
RETURN v_id;
END;
$$ LANGUAGE plpgsql;
-- Function to check if user has access to tenant
CREATE OR REPLACE FUNCTION user_has_tenant_access(p_user_id UUID, p_tenant_id UUID) RETURNS BOOLEAN AS $$ BEGIN RETURN EXISTS (
        SELECT 1
        FROM tenant_users
        WHERE user_id = p_user_id
            AND tenant_id = p_tenant_id
    );
END;
$$ LANGUAGE plpgsql;
-- Function to get user's tenants
CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id UUID) RETURNS TABLE (
        tenant_id UUID,
        tenant_name VARCHAR,
        tenant_slug VARCHAR,
        user_role VARCHAR,
        joined_at TIMESTAMPTZ
    ) AS $$ BEGIN RETURN QUERY
SELECT t.id,
    t.name,
    t.slug,
    tu.role,
    tu.joined_at
FROM tenants t
    INNER JOIN tenant_users tu ON t.id = tu.tenant_id
WHERE tu.user_id = p_user_id
ORDER BY tu.joined_at DESC;
END;
$$ LANGUAGE plpgsql;
-- Function to track tenant usage
CREATE OR REPLACE FUNCTION track_tenant_usage(
        p_tenant_id UUID,
        p_metric_name VARCHAR,
        p_increment INTEGER DEFAULT 1
    ) RETURNS VOID AS $$
DECLARE v_period_start TIMESTAMPTZ;
v_period_end TIMESTAMPTZ;
BEGIN -- Get current month period
v_period_start := date_trunc('month', NOW());
v_period_end := v_period_start + INTERVAL '1 month';
-- Insert or update usage
INSERT INTO tenant_usage (
        tenant_id,
        metric_name,
        metric_value,
        period_start,
        period_end
    )
VALUES (
        p_tenant_id,
        p_metric_name,
        p_increment,
        v_period_start,
        v_period_end
    ) ON CONFLICT (tenant_id, metric_name, period_start) DO
UPDATE
SET metric_value = tenant_usage.metric_value + p_increment;
END;
$$ LANGUAGE plpgsql;
-- Function to create tenant invitation
CREATE OR REPLACE FUNCTION create_tenant_invitation(
        p_tenant_id UUID,
        p_email VARCHAR,
        p_role VARCHAR,
        p_invited_by UUID
    ) RETURNS UUID AS $$
DECLARE v_invitation_id UUID;
v_token VARCHAR;
BEGIN -- Generate unique token
v_token := encode(gen_random_bytes(32), 'hex');
-- Create invitation
INSERT INTO tenant_invitations (
        tenant_id,
        email,
        role,
        invited_by,
        token,
        expires_at
    )
VALUES (
        p_tenant_id,
        p_email,
        p_role,
        p_invited_by,
        v_token,
        NOW() + INTERVAL '7 days'
    )
RETURNING id INTO v_invitation_id;
-- Publish invitation created event
PERFORM publish_event(
    'tenant.invitation.created',
    'tenant_service',
    jsonb_build_object(
        'invitationId',
        v_invitation_id,
        'tenantId',
        p_tenant_id,
        'email',
        p_email,
        'token',
        v_token
    )
);
RETURN v_invitation_id;
END;
$$ LANGUAGE plpgsql;
-- Row Level Security (RLS) Policies
-- Enable RLS on tenant-scoped tables
-- Projects RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON projects;
CREATE POLICY tenant_isolation_policy ON projects FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id
        FROM tenant_users
        WHERE user_id = auth.uid()
    )
);
-- Contracts RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON contracts;
CREATE POLICY tenant_isolation_policy ON contracts FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id
        FROM tenant_users
        WHERE user_id = auth.uid()
    )
);
-- Messages RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON messages;
CREATE POLICY tenant_isolation_policy ON messages FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id
        FROM tenant_users
        WHERE user_id = auth.uid()
    )
);
-- Workflows RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON workflows;
CREATE POLICY tenant_isolation_policy ON workflows FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id
        FROM tenant_users
        WHERE user_id = auth.uid()
    )
);
-- Events RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON events;
CREATE POLICY tenant_isolation_policy ON events FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id
        FROM tenant_users
        WHERE user_id = auth.uid()
    )
);
-- Insert default tenant for existing data
INSERT INTO tenants (
        name,
        slug,
        subscription_plan,
        subscription_status
    )
VALUES (
        'Default Organization',
        'default',
        'enterprise',
        'active'
    ) ON CONFLICT (slug) DO NOTHING;
COMMENT ON TABLE tenants IS 'Multi-tenant organizations';
COMMENT ON TABLE tenant_users IS 'User-tenant relationships with roles';
COMMENT ON TABLE tenant_subscriptions IS 'Tenant billing and subscriptions';
COMMENT ON TABLE tenant_usage IS 'Usage metrics for billing';
COMMENT ON TABLE tenant_invitations IS 'Pending tenant invitations';