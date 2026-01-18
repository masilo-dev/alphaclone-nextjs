-- =====================================================
-- BUSINESS OS - ADVANCED SECURITY
-- Phase 6: Security & Compliance System
-- =====================================================
-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Two-Factor Authentication
CREATE TABLE IF NOT EXISTS user_2fa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    secret VARCHAR(200) NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    backup_codes TEXT [],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);
-- IP Whitelist
CREATE TABLE IF NOT EXISTS tenant_ip_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    key_hash VARCHAR(200) NOT NULL UNIQUE,
    permissions JSONB DEFAULT '[]',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Security Events
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),
    description TEXT NOT NULL,
    metadata JSONB,
    ip_address INET,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Indexes
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_ip_whitelist_tenant ON tenant_ip_whitelist(tenant_id);
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_security_events_tenant ON security_events(tenant_id);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created ON security_events(created_at DESC);
-- Function to log audit event
CREATE OR REPLACE FUNCTION log_audit_event(
        p_tenant_id UUID,
        p_user_id UUID,
        p_action VARCHAR,
        p_resource_type VARCHAR DEFAULT NULL,
        p_resource_id UUID DEFAULT NULL,
        p_changes JSONB DEFAULT NULL,
        p_ip_address INET DEFAULT NULL
    ) RETURNS VOID AS $$ BEGIN
INSERT INTO audit_logs (
        tenant_id,
        user_id,
        action,
        resource_type,
        resource_id,
        changes,
        ip_address
    )
VALUES (
        p_tenant_id,
        p_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_changes,
        p_ip_address
    );
END;
$$ LANGUAGE plpgsql;
-- Function to log security event
CREATE OR REPLACE FUNCTION log_security_event(
        p_tenant_id UUID,
        p_event_type VARCHAR,
        p_severity VARCHAR,
        p_description TEXT,
        p_metadata JSONB DEFAULT NULL,
        p_user_id UUID DEFAULT NULL
    ) RETURNS VOID AS $$ BEGIN
INSERT INTO security_events (
        tenant_id,
        event_type,
        severity,
        description,
        metadata,
        user_id
    )
VALUES (
        p_tenant_id,
        p_event_type,
        p_severity,
        p_description,
        p_metadata,
        p_user_id
    );
-- Publish security event
PERFORM publish_event(
    'security.' || p_event_type,
    'security_system',
    jsonb_build_object(
        'tenantId',
        p_tenant_id,
        'severity',
        p_severity,
        'description',
        p_description
    )
);
END;
$$ LANGUAGE plpgsql;
COMMENT ON TABLE audit_logs IS 'Complete audit trail of all actions';
COMMENT ON TABLE user_2fa IS 'Two-factor authentication settings';
COMMENT ON TABLE tenant_ip_whitelist IS 'IP whitelist per tenant';
COMMENT ON TABLE api_keys IS 'API key management';
COMMENT ON TABLE security_events IS 'Security event monitoring';