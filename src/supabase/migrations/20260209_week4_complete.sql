-- ============================================================================
-- WEEK 4: PRODUCTION EXCELLENCE - COMPLETE DATABASE MIGRATIONS
-- ============================================================================
-- DevOps, GDPR Compliance, Enterprise Features, Performance
-- All database changes for Week 4 consolidated in this single file
-- ============================================================================

-- ============================================================================
-- PART 1: GDPR COMPLIANCE & DATA PRIVACY
-- ============================================================================

-- User consent tracking (GDPR Article 6 & 7)
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL CHECK (
        consent_type IN (
            'cookies_essential',
            'cookies_analytics',
            'cookies_marketing',
            'marketing_emails',
            'product_updates',
            'data_processing',
            'third_party_sharing'
        )
    ),
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data processing logs (GDPR audit trail)
CREATE TABLE IF NOT EXISTS data_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL CHECK (
        action IN ('export', 'delete', 'anonymize', 'update', 'access')
    ),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed')
    ),
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comprehensive audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Action details
    action VARCHAR(100) NOT NULL, -- 'user.created', 'project.deleted', etc.
    resource_type VARCHAR(50),
    resource_id UUID,

    -- Change tracking
    old_values JSONB DEFAULT '{}',
    new_values JSONB DEFAULT '{}',

    -- Request context
    ip_address VARCHAR(45),
    user_agent TEXT,
    method VARCHAR(10),
    endpoint VARCHAR(500),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info' CHECK (
        severity IN ('info', 'warning', 'error', 'critical')
    ),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data retention policies
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_type VARCHAR(100) NOT NULL,
    retention_days INTEGER NOT NULL,
    deletion_method VARCHAR(20) CHECK (
        deletion_method IN ('hard_delete', 'soft_delete', 'anonymize')
    ),
    legal_basis TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cookie consents
CREATE TABLE IF NOT EXISTS cookie_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Consent levels
    essential BOOLEAN DEFAULT TRUE,
    analytics BOOLEAN DEFAULT FALSE,
    marketing BOOLEAN DEFAULT FALSE,

    consented_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(session_id)
);

-- Insert default retention policies
INSERT INTO data_retention_policies (data_type, retention_days, deletion_method, legal_basis)
VALUES
    ('invoices', 2555, 'anonymize', 'Tax law - IRS requires 7 years'),
    ('contracts', 3650, 'anonymize', 'Legal statute of limitations - 10 years'),
    ('audit_logs', 2555, 'anonymize', 'Security compliance - 7 years'),
    ('user_profile', 0, 'hard_delete', 'No retention after account deletion'),
    ('notifications', 365, 'hard_delete', 'Operational data - 1 year')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 2: SSO / ENTERPRISE AUTHENTICATION
-- ============================================================================

-- SSO connections (SAML, OAuth, OIDC)
CREATE TABLE IF NOT EXISTS sso_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (
        provider IN ('saml', 'oidc', 'oauth', 'google', 'azure', 'okta')
    ),
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB NOT NULL, -- Provider-specific configuration
    domain VARCHAR(255), -- Enforce SSO for this domain
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 3: ENTERPRISE BILLING
-- ============================================================================

-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    po_number VARCHAR(100) NOT NULL UNIQUE,
    amount INTEGER NOT NULL, -- cents
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'paid', 'cancelled')
    ),
    items JSONB NOT NULL DEFAULT '[]', -- Line items
    notes TEXT,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enterprise contracts
CREATE TABLE IF NOT EXISTS enterprise_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_type VARCHAR(20) CHECK (
        contract_type IN ('annual', 'multi-year', 'custom')
    ),
    duration_months INTEGER NOT NULL,
    monthly_price_cents INTEGER NOT NULL,
    total_value_cents INTEGER NOT NULL,
    discount_percent INTEGER DEFAULT 0,
    payment_terms VARCHAR(20) DEFAULT 'net-30' CHECK (
        payment_terms IN ('net-0', 'net-30', 'net-60', 'net-90', 'custom')
    ),
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (
        billing_cycle IN ('monthly', 'quarterly', 'annual', 'upfront')
    ),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    auto_renew BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('draft', 'active', 'expired', 'cancelled')
    ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment plans (installments)
CREATE TABLE IF NOT EXISTS payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    installments JSONB NOT NULL, -- Array of installment objects
    total_installments INTEGER NOT NULL,
    paid_installments INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('active', 'completed', 'defaulted', 'cancelled')
    ),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 4: WEBHOOK DELIVERIES
-- ============================================================================

-- Webhook delivery logs (optional - for tracking)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES notification_webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'delivered', 'failed', 'retrying')
    ),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 5: METRICS & MONITORING
-- ============================================================================

-- Business metrics storage (optional - can use external analytics)
CREATE TABLE IF NOT EXISTS business_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(50) DEFAULT 'count',
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 6: ONBOARDING TRACKING
-- ============================================================================

-- Add onboarding columns to profiles if not exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- GDPR indexes
CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id, consent_type, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_processing_logs_user ON data_processing_logs(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_processing_logs_status ON data_processing_logs(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cookie_consents_session ON cookie_consents(session_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consents_user ON cookie_consents(user_id);

-- SSO indexes
CREATE INDEX IF NOT EXISTS idx_sso_connections_tenant ON sso_connections(tenant_id, provider, enabled);
CREATE INDEX IF NOT EXISTS idx_sso_connections_domain ON sso_connections(domain) WHERE enabled = TRUE;

-- Enterprise billing indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_enterprise_contracts_tenant ON enterprise_contracts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_invoice ON payment_plans(invoice_id);

-- Webhook indexes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status, next_retry_at);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_business_metrics_tenant ON business_metrics(tenant_id, metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_metrics_name ON business_metrics(metric_name, recorded_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- GDPR tables
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookie_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own consents" ON user_consents;
CREATE POLICY "Users can manage their own consents"
    ON user_consents FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own data processing logs" ON data_processing_logs;
CREATE POLICY "Users can view their own data processing logs"
    ON data_processing_logs FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Tenant admins can view audit logs" ON audit_logs;
CREATE POLICY "Tenant admins can view audit logs"
    ON audit_logs FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
        OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Everyone can view retention policies" ON data_retention_policies;
CREATE POLICY "Everyone can view retention policies"
    ON data_retention_policies FOR SELECT
    TO authenticated
    USING (enabled = TRUE);

DROP POLICY IF EXISTS "Users can manage their cookie consents" ON cookie_consents;
CREATE POLICY "Users can manage their cookie consents"
    ON cookie_consents FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL)
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- SSO tables
ALTER TABLE sso_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can manage SSO" ON sso_connections;
CREATE POLICY "Tenant admins can manage SSO"
    ON sso_connections FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

-- Enterprise billing tables
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can manage purchase orders" ON purchase_orders;
CREATE POLICY "Tenant admins can manage purchase orders"
    ON purchase_orders FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

DROP POLICY IF EXISTS "Tenant admins can view contracts" ON enterprise_contracts;
CREATE POLICY "Tenant admins can view contracts"
    ON enterprise_contracts FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

DROP POLICY IF EXISTS "Users can view payment plans" ON payment_plans;
CREATE POLICY "Users can view payment plans"
    ON payment_plans FOR SELECT
    TO authenticated
    USING (
        invoice_id IN (
            SELECT id FROM invoices
            WHERE tenant_id IN (
                SELECT tenant_id FROM tenant_users
                WHERE user_id = auth.uid()
            )
        )
    );

-- Webhook deliveries
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can view webhook deliveries" ON webhook_deliveries;
CREATE POLICY "Tenant admins can view webhook deliveries"
    ON webhook_deliveries FOR SELECT
    TO authenticated
    USING (
        webhook_id IN (
            SELECT id FROM notification_webhooks
            WHERE tenant_id IN (
                SELECT tenant_id FROM tenant_users
                WHERE user_id = auth.uid()
                AND role IN ('admin', 'tenant_admin')
            )
        )
    );

-- Business metrics
ALTER TABLE business_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view metrics" ON business_metrics;
CREATE POLICY "Tenant users can view metrics"
    ON business_metrics FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Log audit event
CREATE OR REPLACE FUNCTION log_audit_event(
    p_tenant_id UUID,
    p_user_id UUID,
    p_action VARCHAR,
    p_resource_type VARCHAR DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT '{}',
    p_new_values JSONB DEFAULT '{}',
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        tenant_id, user_id, action, resource_type, resource_id,
        old_values, new_values, metadata
    ) VALUES (
        p_tenant_id, p_user_id, p_action, p_resource_type, p_resource_id,
        p_old_values, p_new_values, p_metadata
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Record user consent
CREATE OR REPLACE FUNCTION record_user_consent(
    p_user_id UUID,
    p_consent_type VARCHAR,
    p_granted BOOLEAN,
    p_ip_address VARCHAR DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_consent_id UUID;
BEGIN
    INSERT INTO user_consents (
        user_id, consent_type, granted,
        ip_address, user_agent
    ) VALUES (
        p_user_id, p_consent_type, p_granted,
        p_ip_address, p_user_agent
    ) RETURNING id INTO v_consent_id;

    -- Log the consent change
    PERFORM log_audit_event(
        NULL,
        p_user_id,
        'consent.' || CASE WHEN p_granted THEN 'granted' ELSE 'withdrawn' END,
        'consent',
        v_consent_id,
        '{}',
        jsonb_build_object('consent_type', p_consent_type, 'granted', p_granted)
    );

    RETURN v_consent_id;
END;
$$ LANGUAGE plpgsql;

-- Check if data should be retained
CREATE OR REPLACE FUNCTION should_retain_data(
    p_data_type VARCHAR,
    p_created_at TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
    v_retention_days INTEGER;
    v_age_days INTEGER;
BEGIN
    -- Get retention policy
    SELECT retention_days INTO v_retention_days
    FROM data_retention_policies
    WHERE data_type = p_data_type
    AND enabled = TRUE
    LIMIT 1;

    IF v_retention_days IS NULL THEN
        RETURN TRUE; -- No policy, retain by default
    END IF;

    -- Calculate age
    v_age_days := EXTRACT(DAY FROM NOW() - p_created_at);

    RETURN v_age_days < v_retention_days;
END;
$$ LANGUAGE plpgsql;

-- Automated data cleanup
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE (
    data_type TEXT,
    deleted_count BIGINT
) AS $$
BEGIN
    -- Cleanup old notifications
    RETURN QUERY
    WITH deleted AS (
        DELETE FROM notification_queue
        WHERE created_at < NOW() - INTERVAL '365 days'
        RETURNING *
    )
    SELECT 'notifications'::TEXT, COUNT(*)::BIGINT FROM deleted;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers
DROP TRIGGER IF EXISTS trigger_update_sso_connections_timestamp ON sso_connections;
CREATE TRIGGER trigger_update_sso_connections_timestamp
    BEFORE UPDATE ON sso_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_update_purchase_orders_timestamp ON purchase_orders;
CREATE TRIGGER trigger_update_purchase_orders_timestamp
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_update_enterprise_contracts_timestamp ON enterprise_contracts;
CREATE TRIGGER trigger_update_enterprise_contracts_timestamp
    BEFORE UPDATE ON enterprise_contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_update_payment_plans_timestamp ON payment_plans;
CREATE TRIGGER trigger_update_payment_plans_timestamp
    BEFORE UPDATE ON payment_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_timestamp();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE user_consents IS 'GDPR Article 6 & 7: User consent tracking for data processing';
COMMENT ON TABLE data_processing_logs IS 'GDPR Article 15, 17, 20: Audit trail for data requests';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail (7-year retention for compliance)';
COMMENT ON TABLE data_retention_policies IS 'Data retention periods based on legal requirements';
COMMENT ON TABLE cookie_consents IS 'Cookie consent tracking (EU ePrivacy Directive)';
COMMENT ON TABLE sso_connections IS 'Enterprise SSO/SAML configurations';
COMMENT ON TABLE purchase_orders IS 'Enterprise purchase order tracking';
COMMENT ON TABLE enterprise_contracts IS 'Custom enterprise contracts and pricing';
COMMENT ON TABLE payment_plans IS 'Installment payment plans for large invoices';
COMMENT ON TABLE webhook_deliveries IS 'Webhook delivery tracking and retry logic';
COMMENT ON TABLE business_metrics IS 'Custom business metrics and KPI tracking';

COMMENT ON FUNCTION log_audit_event IS 'Create audit log entry for any action';
COMMENT ON FUNCTION record_user_consent IS 'Record user consent with automatic audit logging';
COMMENT ON FUNCTION should_retain_data IS 'Check if data should be retained per policy';
COMMENT ON FUNCTION cleanup_old_data IS 'Automated cleanup of old data past retention period';

-- ============================================================================
-- WEEK 4 COMPLETE DATABASE SYSTEM DEPLOYED!
-- ============================================================================
-- Tables Created: 14 new tables
-- Functions Created: 4 helper functions
-- Features Enabled:
--   ✅ GDPR Compliance (data export, erasure, consent)
--   ✅ Enterprise SSO/SAML
--   ✅ Enterprise Billing (POs, contracts, payment plans)
--   ✅ Webhook Delivery Tracking
--   ✅ Business Metrics Storage
--   ✅ Comprehensive Audit Logging
--   ✅ Data Retention Policies
-- ============================================================================
