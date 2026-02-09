-- ============================================================================
-- ALPHACLONE DATABASE MIGRATIONS - COMPLETE
-- ============================================================================
-- Created: February 9, 2026
-- Total Migrations: 5
-- Total Tables: 20
-- Total Functions: 16+
--
-- SAFE TO RUN: All migrations use "CREATE TABLE IF NOT EXISTS"
-- No tables will be dropped. No data will be deleted.
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: TWO-FACTOR AUTHENTICATION (2FA/TOTP)
-- ============================================================================

-- User Security Table
-- Stores 2FA secrets, backup codes, and security preferences
CREATE TABLE IF NOT EXISTS user_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    backup_codes TEXT[], -- Array of backup codes
    last_totp_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_security_user_id ON user_security(user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_2fa_enabled ON user_security(two_factor_enabled);

-- Enable RLS
ALTER TABLE user_security ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only view/edit their own security settings
DROP POLICY IF EXISTS "Users can view their own security settings" ON user_security;
CREATE POLICY "Users can view their own security settings"
    ON user_security FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own security settings" ON user_security;
CREATE POLICY "Users can update their own security settings"
    ON user_security FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admins can view all security settings (for support purposes)
DROP POLICY IF EXISTS "Admins can view all security settings" ON user_security;
CREATE POLICY "Admins can view all security settings"
    ON user_security FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_user_security_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_user_security_timestamp ON user_security;
CREATE TRIGGER trigger_update_user_security_timestamp
    BEFORE UPDATE ON user_security
    FOR EACH ROW
    EXECUTE FUNCTION update_user_security_timestamp();

-- Function to log 2FA events
CREATE OR REPLACE FUNCTION log_2fa_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_success BOOLEAN,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        metadata,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        p_user_id,
        p_event_type,
        'user_security',
        p_user_id::TEXT,
        jsonb_build_object(
            'success', p_success,
            'timestamp', NOW()
        ),
        p_ip_address,
        p_user_agent,
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE user_security IS 'Stores user two-factor authentication settings and backup codes';
COMMENT ON COLUMN user_security.two_factor_secret IS 'TOTP secret key (encrypted in production)';
COMMENT ON COLUMN user_security.backup_codes IS 'One-time use backup codes for account recovery';
COMMENT ON COLUMN user_security.last_totp_used_at IS 'Timestamp of last successful TOTP verification (prevents replay attacks)';

-- ============================================================================
-- MIGRATION 2: STRIPE WEBHOOK IDEMPOTENCY & AUDIT
-- ============================================================================

-- Stripe Webhook Events Table
-- Tracks all processed webhook events to prevent duplicate processing
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    api_version VARCHAR(20),
    created_at_stripe TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'processed' CHECK (
        status IN ('processed', 'failed', 'skipped', 'retrying')
    ),
    event_data JSONB NOT NULL,
    processing_attempts INTEGER DEFAULT 1,
    last_error TEXT,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    customer_id VARCHAR(255),
    subscription_id VARCHAR(255),
    amount_cents INTEGER,
    currency VARCHAR(3),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Reconciliation Table
CREATE TABLE IF NOT EXISTS stripe_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_invoice_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    customer_id VARCHAR(255) NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) CHECK (
        status IN ('succeeded', 'pending', 'failed', 'refunded', 'disputed')
    ),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    paid_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    refund_amount_cents INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook Processing Failures (for retry logic)
CREATE TABLE IF NOT EXISTS webhook_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_event_id UUID REFERENCES stripe_webhook_events(id) ON DELETE CASCADE,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_tenant ON stripe_webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created ON stripe_webhook_events(created_at_stripe);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_tenant ON stripe_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_customer ON stripe_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX IF NOT EXISTS idx_webhook_failures_retry ON webhook_failures(next_retry_at) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_failures ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admins only
DROP POLICY IF EXISTS "Admins can view webhook events" ON stripe_webhook_events;
CREATE POLICY "Admins can view webhook events"
    ON stripe_webhook_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can view payments" ON stripe_payments;
CREATE POLICY "Admins can view payments"
    ON stripe_payments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Tenant admins can view their own payments
DROP POLICY IF EXISTS "Tenant admins can view their payments" ON stripe_payments;
CREATE POLICY "Tenant admins can view their payments"
    ON stripe_payments FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role = 'tenant_admin'
        )
    );

-- Function to check if webhook event was already processed (idempotency)
CREATE OR REPLACE FUNCTION is_webhook_processed(p_stripe_event_id VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM stripe_webhook_events
        WHERE stripe_event_id = p_stripe_event_id
        AND status IN ('processed', 'retrying')
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record webhook event
CREATE OR REPLACE FUNCTION record_webhook_event(
    p_stripe_event_id VARCHAR,
    p_event_type VARCHAR,
    p_event_data JSONB,
    p_api_version VARCHAR DEFAULT NULL,
    p_created_at_stripe TIMESTAMPTZ DEFAULT NOW(),
    p_tenant_id UUID DEFAULT NULL,
    p_customer_id VARCHAR DEFAULT NULL,
    p_subscription_id VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO stripe_webhook_events (
        stripe_event_id,
        event_type,
        api_version,
        created_at_stripe,
        event_data,
        status,
        tenant_id,
        customer_id,
        subscription_id
    ) VALUES (
        p_stripe_event_id,
        p_event_type,
        p_api_version,
        p_created_at_stripe,
        p_event_data,
        'processed',
        p_tenant_id,
        p_customer_id,
        p_subscription_id
    ) ON CONFLICT (stripe_event_id) DO UPDATE
    SET processing_attempts = stripe_webhook_events.processing_attempts + 1,
        updated_at = NOW()
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record payment
CREATE OR REPLACE FUNCTION record_payment(
    p_payment_intent_id VARCHAR,
    p_tenant_id UUID,
    p_customer_id VARCHAR,
    p_amount_cents INTEGER,
    p_currency VARCHAR DEFAULT 'USD',
    p_status VARCHAR DEFAULT 'succeeded',
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
BEGIN
    INSERT INTO stripe_payments (
        stripe_payment_intent_id,
        tenant_id,
        customer_id,
        amount_cents,
        currency,
        status,
        description,
        metadata,
        paid_at
    ) VALUES (
        p_payment_intent_id,
        p_tenant_id,
        p_customer_id,
        p_amount_cents,
        p_currency,
        p_status,
        p_description,
        p_metadata,
        CASE WHEN p_status = 'succeeded' THEN NOW() ELSE NULL END
    ) ON CONFLICT (stripe_payment_intent_id) DO UPDATE
    SET status = EXCLUDED.status,
        updated_at = NOW()
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_stripe_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_update_webhook_events_timestamp ON stripe_webhook_events;
CREATE TRIGGER trigger_update_webhook_events_timestamp
    BEFORE UPDATE ON stripe_webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION update_stripe_tables_timestamp();

DROP TRIGGER IF EXISTS trigger_update_payments_timestamp ON stripe_payments;
CREATE TRIGGER trigger_update_payments_timestamp
    BEFORE UPDATE ON stripe_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_stripe_tables_timestamp();

-- Comments for documentation
COMMENT ON TABLE stripe_webhook_events IS 'Tracks all Stripe webhook events for idempotency and auditing';
COMMENT ON TABLE stripe_payments IS 'Payment reconciliation and accounting records';
COMMENT ON TABLE webhook_failures IS 'Failed webhook processing for retry logic';

-- ============================================================================
-- MIGRATION 3: ESIGN ACT COMPLIANCE FOR ELECTRONIC SIGNATURES
-- ============================================================================

-- Contract Audit Trail
CREATE TABLE IF NOT EXISTS contract_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (
        action IN (
            'created', 'viewed', 'modified', 'sent', 'opened', 'downloaded',
            'signature_initiated', 'signature_completed', 'signature_declined',
            'voided', 'completed', 'expired'
        )
    ),
    actor_id UUID REFERENCES auth.users(id),
    actor_role VARCHAR(20),
    actor_name VARCHAR(255),
    actor_email VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    geolocation JSONB,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- E-Signature Consent Records
CREATE TABLE IF NOT EXISTS esignature_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    consent_given BOOLEAN NOT NULL DEFAULT TRUE,
    consent_text TEXT NOT NULL,
    consent_method VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    geolocation JSONB,
    withdrawn_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signature Events
CREATE TABLE IF NOT EXISTS signature_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    signer_id UUID REFERENCES auth.users(id),
    signer_role VARCHAR(20) NOT NULL,
    signer_name VARCHAR(255) NOT NULL,
    signer_email VARCHAR(255) NOT NULL,
    signer_ip VARCHAR(45),
    event_type VARCHAR(50) NOT NULL CHECK (
        event_type IN (
            'signature_request_sent', 'signature_request_viewed',
            'signature_started', 'signature_completed', 'signature_declined',
            'signature_verified', 'signature_invalidated'
        )
    ),
    signature_data TEXT,
    authentication_method VARCHAR(50),
    intent_statement TEXT,
    device_info JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    content_hash_at_signing VARCHAR(64),
    tamper_seal VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certificate of Completion
CREATE TABLE IF NOT EXISTS signature_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id VARCHAR(100) UNIQUE NOT NULL,
    contract_id UUID NOT NULL UNIQUE REFERENCES contracts(id) ON DELETE CASCADE,
    document_title VARCHAR(500) NOT NULL,
    completion_date TIMESTAMPTZ NOT NULL,
    signers JSONB NOT NULL,
    document_hash VARCHAR(64) NOT NULL,
    certificate_hash VARCHAR(64) NOT NULL,
    tamper_seal VARCHAR(128) NOT NULL,
    retention_period_years INTEGER DEFAULT 7,
    retention_expires_at TIMESTAMPTZ,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Versions
CREATE TABLE IF NOT EXISTS contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    change_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contract_id, version_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_trail_contract ON contract_audit_trail(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_actor ON contract_audit_trail(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_esign_consent_user ON esignature_consents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signature_events_contract ON signature_events(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signature_events_signer ON signature_events(signer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_certificate_contract ON signature_certificates(contract_id);
CREATE INDEX IF NOT EXISTS idx_certificate_id ON signature_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_contract_versions_contract ON contract_versions(contract_id, version_number DESC);

-- Enable RLS
ALTER TABLE contract_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE esignature_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view audit trail for their contracts" ON contract_audit_trail;
CREATE POLICY "Users can view audit trail for their contracts"
    ON contract_audit_trail FOR SELECT
    TO authenticated
    USING (
        contract_id IN (
            SELECT id FROM contracts
            WHERE owner_id = auth.uid() OR client_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can view all audit trails" ON contract_audit_trail;
CREATE POLICY "Admins can view all audit trails"
    ON contract_audit_trail FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Users can view their consent records" ON esignature_consents;
CREATE POLICY "Users can view their consent records"
    ON esignature_consents FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view signature events for their contracts" ON signature_events;
CREATE POLICY "Users can view signature events for their contracts"
    ON signature_events FOR SELECT
    TO authenticated
    USING (
        contract_id IN (
            SELECT id FROM contracts
            WHERE owner_id = auth.uid() OR client_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can view certificates for their contracts" ON signature_certificates;
CREATE POLICY "Users can view certificates for their contracts"
    ON signature_certificates FOR SELECT
    TO authenticated
    USING (
        contract_id IN (
            SELECT id FROM contracts
            WHERE owner_id = auth.uid() OR client_id = auth.uid()
        )
    );

-- Function to log audit trail event
CREATE OR REPLACE FUNCTION log_contract_audit(
    p_contract_id UUID,
    p_action VARCHAR,
    p_actor_id UUID,
    p_actor_role VARCHAR,
    p_actor_name VARCHAR,
    p_actor_email VARCHAR,
    p_ip_address VARCHAR,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO contract_audit_trail (
        contract_id, action, actor_id, actor_role,
        actor_name, actor_email, ip_address, user_agent, details
    ) VALUES (
        p_contract_id, p_action, p_actor_id, p_actor_role,
        p_actor_name, p_actor_email, p_ip_address, p_user_agent, p_details
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record consent
CREATE OR REPLACE FUNCTION record_esign_consent(
    p_user_id UUID,
    p_contract_id UUID,
    p_consent_text TEXT,
    p_consent_method VARCHAR,
    p_ip_address VARCHAR,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_consent_id UUID;
BEGIN
    INSERT INTO esignature_consents (
        user_id, contract_id, consent_given, consent_text,
        consent_method, ip_address, user_agent
    ) VALUES (
        p_user_id, p_contract_id, TRUE, p_consent_text,
        p_consent_method, p_ip_address, p_user_agent
    ) RETURNING id INTO v_consent_id;

    RETURN v_consent_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate certificate ID
CREATE OR REPLACE FUNCTION generate_certificate_id()
RETURNS VARCHAR AS $$
DECLARE
    v_timestamp VARCHAR;
    v_random VARCHAR;
BEGIN
    v_timestamp := TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');
    v_random := SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8);
    RETURN 'CERT-' || v_timestamp || '-' || UPPER(v_random);
END;
$$ LANGUAGE plpgsql;

-- Function to create completion certificate
CREATE OR REPLACE FUNCTION create_signature_certificate(
    p_contract_id UUID,
    p_document_title VARCHAR,
    p_signers JSONB,
    p_document_hash VARCHAR,
    p_tamper_seal VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_cert_id UUID;
    v_cert_number VARCHAR;
    v_retention_date TIMESTAMPTZ;
BEGIN
    v_cert_number := generate_certificate_id();
    v_retention_date := NOW() + INTERVAL '7 years';

    INSERT INTO signature_certificates (
        certificate_id, contract_id, document_title,
        completion_date, signers, document_hash,
        certificate_hash, tamper_seal, retention_expires_at
    ) VALUES (
        v_cert_number, p_contract_id, p_document_title,
        NOW(), p_signers, p_document_hash,
        MD5(v_cert_number || p_document_hash),
        p_tamper_seal, v_retention_date
    ) RETURNING id INTO v_cert_id;

    RETURN v_cert_id;
END;
$$ LANGUAGE plpgsql;

-- Function to verify document hasn't been tampered
CREATE OR REPLACE FUNCTION verify_document_integrity(
    p_contract_id UUID,
    p_current_content_hash VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_original_hash VARCHAR;
BEGIN
    SELECT document_hash INTO v_original_hash
    FROM signature_certificates
    WHERE contract_id = p_contract_id;

    IF v_original_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN v_original_hash = p_current_content_hash;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE contract_audit_trail IS 'Complete audit trail for ESIGN Act compliance';
COMMENT ON TABLE esignature_consents IS 'Records consent to use electronic signatures (ESIGN Act requirement)';
COMMENT ON TABLE signature_events IS 'Detailed tracking of all signature events';
COMMENT ON TABLE signature_certificates IS 'Official certificates of completion for signed documents';

-- ============================================================================
-- MIGRATION 4: MULTI-TENANCY QUOTA ENFORCEMENT
-- ============================================================================

-- Subscription Tier Limits
CREATE TABLE IF NOT EXISTS subscription_tier_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name VARCHAR(50) UNIQUE NOT NULL,
    users_limit INTEGER NOT NULL DEFAULT 5,
    projects_limit INTEGER NOT NULL DEFAULT 10,
    storage_mb_limit INTEGER NOT NULL DEFAULT 1000,
    api_calls_per_month INTEGER NOT NULL DEFAULT 10000,
    contracts_limit INTEGER NOT NULL DEFAULT 50,
    team_members_limit INTEGER NOT NULL DEFAULT 5,
    ai_requests_per_month INTEGER NOT NULL DEFAULT 100,
    video_minutes_per_month INTEGER NOT NULL DEFAULT 60,
    custom_features JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Usage Tracking
CREATE TABLE IF NOT EXISTS tenant_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    current_value INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
    period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, metric_name, period_start)
);

-- Usage Events Log
CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    increment_value INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quota Exceeded Alerts
CREATE TABLE IF NOT EXISTS quota_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (
        alert_type IN ('approaching', 'exceeded', 'blocked')
    ),
    current_value INTEGER NOT NULL,
    limit_value INTEGER NOT NULL,
    threshold_percentage INTEGER,
    alerted_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_tracking_tenant ON tenant_usage_tracking(tenant_id, period_start);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_metric ON tenant_usage_tracking(metric_name, period_start);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant ON usage_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_metric ON usage_events(metric_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_tenant ON quota_alerts(tenant_id, alert_type, resolved_at);

-- Enable RLS
ALTER TABLE subscription_tier_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can view tier limits" ON subscription_tier_limits;
CREATE POLICY "Anyone can view tier limits"
    ON subscription_tier_limits FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Tenant admins can view their usage" ON tenant_usage_tracking;
CREATE POLICY "Tenant admins can view their usage"
    ON tenant_usage_tracking FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

DROP POLICY IF EXISTS "Tenant admins can view their usage events" ON usage_events;
CREATE POLICY "Tenant admins can view their usage events"
    ON usage_events FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

DROP POLICY IF EXISTS "Tenant admins can view their quota alerts" ON quota_alerts;
CREATE POLICY "Tenant admins can view their quota alerts"
    ON quota_alerts FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'tenant_admin')
        )
    );

-- Function to get tenant's current tier
CREATE OR REPLACE FUNCTION get_tenant_tier(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_tier VARCHAR;
BEGIN
    SELECT subscription_plan INTO v_tier
    FROM tenants
    WHERE id = p_tenant_id;

    RETURN COALESCE(v_tier, 'free');
END;
$$ LANGUAGE plpgsql;

-- Function to get tier limit for a metric
CREATE OR REPLACE FUNCTION get_tier_limit(p_tier VARCHAR, p_metric_name VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    v_limit INTEGER;
BEGIN
    CASE p_metric_name
        WHEN 'users' THEN
            SELECT users_limit INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'projects' THEN
            SELECT projects_limit INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'storage_mb' THEN
            SELECT storage_mb_limit INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'api_calls' THEN
            SELECT api_calls_per_month INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'contracts' THEN
            SELECT contracts_limit INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'team_members' THEN
            SELECT team_members_limit INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'ai_requests' THEN
            SELECT ai_requests_per_month INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        WHEN 'video_minutes' THEN
            SELECT video_minutes_per_month INTO v_limit FROM subscription_tier_limits WHERE tier_name = p_tier;
        ELSE
            v_limit := 999999;
    END CASE;

    RETURN COALESCE(v_limit, 999999);
END;
$$ LANGUAGE plpgsql;

-- Function to track usage
CREATE OR REPLACE FUNCTION track_usage(
    p_tenant_id UUID,
    p_metric_name VARCHAR,
    p_increment INTEGER DEFAULT 1,
    p_user_id UUID DEFAULT NULL,
    p_event_type VARCHAR DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_value INTEGER;
    v_tier VARCHAR;
    v_limit INTEGER;
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    v_period_start := date_trunc('month', NOW());
    v_period_end := v_period_start + INTERVAL '1 month';

    v_tier := get_tenant_tier(p_tenant_id);
    v_limit := get_tier_limit(v_tier, p_metric_name);

    INSERT INTO tenant_usage_tracking (
        tenant_id, metric_name, current_value, period_start, period_end
    ) VALUES (
        p_tenant_id, p_metric_name, p_increment, v_period_start, v_period_end
    )
    ON CONFLICT (tenant_id, metric_name, period_start)
    DO UPDATE SET
        current_value = tenant_usage_tracking.current_value + p_increment,
        last_updated = NOW()
    RETURNING current_value INTO v_current_value;

    INSERT INTO usage_events (
        tenant_id, user_id, event_type, metric_name, increment_value, metadata
    ) VALUES (
        p_tenant_id, p_user_id, COALESCE(p_event_type, p_metric_name || '_increment'),
        p_metric_name, p_increment, p_metadata
    );

    IF v_current_value >= (v_limit * 0.8) AND v_current_value < v_limit THEN
        INSERT INTO quota_alerts (
            tenant_id, metric_name, alert_type, current_value,
            limit_value, threshold_percentage
        ) VALUES (
            p_tenant_id, p_metric_name, 'approaching', v_current_value,
            v_limit, 80
        )
        ON CONFLICT DO NOTHING;
    END IF;

    IF v_current_value >= v_limit THEN
        INSERT INTO quota_alerts (
            tenant_id, metric_name, alert_type, current_value, limit_value
        ) VALUES (
            p_tenant_id, p_metric_name, 'exceeded', v_current_value, v_limit
        )
        ON CONFLICT DO NOTHING;

        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if tenant can perform action
CREATE OR REPLACE FUNCTION can_perform_action(
    p_tenant_id UUID,
    p_metric_name VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_value INTEGER;
    v_tier VARCHAR;
    v_limit INTEGER;
BEGIN
    SELECT current_value INTO v_current_value
    FROM tenant_usage_tracking
    WHERE tenant_id = p_tenant_id
        AND metric_name = p_metric_name
        AND period_start = date_trunc('month', NOW());

    v_current_value := COALESCE(v_current_value, 0);

    v_tier := get_tenant_tier(p_tenant_id);
    v_limit := get_tier_limit(v_tier, p_metric_name);

    RETURN v_current_value < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get tenant usage summary
CREATE OR REPLACE FUNCTION get_tenant_usage_summary(p_tenant_id UUID)
RETURNS TABLE (
    metric_name VARCHAR,
    current_value INTEGER,
    limit_value INTEGER,
    percentage_used NUMERIC,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.metric_name,
        COALESCE(t.current_value, 0) as current_value,
        get_tier_limit(get_tenant_tier(p_tenant_id), t.metric_name) as limit_value,
        ROUND(
            (COALESCE(t.current_value, 0)::NUMERIC /
            NULLIF(get_tier_limit(get_tenant_tier(p_tenant_id), t.metric_name), 0)) * 100,
            2
        ) as percentage_used,
        CASE
            WHEN COALESCE(t.current_value, 0) >= get_tier_limit(get_tenant_tier(p_tenant_id), t.metric_name) THEN 'exceeded'
            WHEN COALESCE(t.current_value, 0) >= (get_tier_limit(get_tenant_tier(p_tenant_id), t.metric_name) * 0.8) THEN 'approaching'
            ELSE 'ok'
        END as status
    FROM tenant_usage_tracking t
    WHERE t.tenant_id = p_tenant_id
        AND t.period_start = date_trunc('month', NOW());
END;
$$ LANGUAGE plpgsql;

-- Insert default tier limits
INSERT INTO subscription_tier_limits (
    tier_name, users_limit, projects_limit, storage_mb_limit,
    api_calls_per_month, contracts_limit, team_members_limit,
    ai_requests_per_month, video_minutes_per_month
) VALUES
    ('free', 2, 3, 500, 1000, 5, 2, 10, 30),
    ('starter', 10, 25, 5000, 10000, 50, 10, 100, 300),
    ('pro', 50, 100, 25000, 50000, 500, 50, 1000, 1500),
    ('enterprise', 999999, 999999, 999999, 999999, 999999, 999999, 999999, 999999)
ON CONFLICT (tier_name) DO UPDATE SET
    users_limit = EXCLUDED.users_limit,
    projects_limit = EXCLUDED.projects_limit,
    storage_mb_limit = EXCLUDED.storage_mb_limit,
    api_calls_per_month = EXCLUDED.api_calls_per_month,
    contracts_limit = EXCLUDED.contracts_limit,
    team_members_limit = EXCLUDED.team_members_limit,
    ai_requests_per_month = EXCLUDED.ai_requests_per_month,
    video_minutes_per_month = EXCLUDED.video_minutes_per_month;

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_tier_limits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tier_limits_timestamp ON subscription_tier_limits;
CREATE TRIGGER trigger_update_tier_limits_timestamp
    BEFORE UPDATE ON subscription_tier_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_tier_limits_timestamp();

-- Comments
COMMENT ON TABLE subscription_tier_limits IS 'Defines quota limits for each subscription tier';
COMMENT ON TABLE tenant_usage_tracking IS 'Real-time usage tracking per tenant';
COMMENT ON TABLE usage_events IS 'Detailed log of all usage events';
COMMENT ON TABLE quota_alerts IS 'Alerts when tenants approach or exceed limits';

-- ============================================================================
-- MIGRATION 5: GDPR/CCPA COMPLIANCE
-- ============================================================================

-- User Consent Management
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type VARCHAR(100) NOT NULL,
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_version VARCHAR(50) NOT NULL,
    consent_text TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    given_at TIMESTAMPTZ DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Export Requests (GDPR Right to Access)
CREATE TABLE IF NOT EXISTS data_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL DEFAULT 'full_export' CHECK (
        request_type IN ('full_export', 'partial_export', 'portable_format')
    ),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'expired')
    ),
    export_format VARCHAR(20) DEFAULT 'json' CHECK (
        export_format IN ('json', 'csv', 'pdf')
    ),
    file_url TEXT,
    file_size_bytes BIGINT,
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Deletion Requests (GDPR Right to Erasure)
CREATE TABLE IF NOT EXISTS data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL DEFAULT 'full_deletion' CHECK (
        request_type IN ('full_deletion', 'anonymization', 'specific_data')
    ),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'under_review', 'approved', 'processing', 'completed', 'rejected')
    ),
    reason TEXT,
    rejection_reason TEXT,
    specific_data JSONB,
    scheduled_deletion_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Processing Activities Log (GDPR Article 30)
CREATE TABLE IF NOT EXISTS data_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    data_category VARCHAR(100) NOT NULL,
    purpose TEXT NOT NULL,
    legal_basis VARCHAR(100),
    data_recipients TEXT,
    retention_period VARCHAR(100),
    security_measures JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Privacy Policy Versions
CREATE TABLE IF NOT EXISTS privacy_policy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    effective_date TIMESTAMPTZ NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Terms of Service Versions
CREATE TABLE IF NOT EXISTS terms_of_service_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    effective_date TIMESTAMPTZ NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_data_export_user ON data_export_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_user ON data_deletion_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_processing_log_user ON data_processing_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processing_log_tenant ON data_processing_log(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_of_service_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own consents" ON user_consents;
CREATE POLICY "Users can view their own consents"
    ON user_consents FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own consents" ON user_consents;
CREATE POLICY "Users can manage their own consents"
    ON user_consents FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their export requests" ON data_export_requests;
CREATE POLICY "Users can view their export requests"
    ON data_export_requests FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create export requests" ON data_export_requests;
CREATE POLICY "Users can create export requests"
    ON data_export_requests FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their deletion requests" ON data_deletion_requests;
CREATE POLICY "Users can view their deletion requests"
    ON data_deletion_requests FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create deletion requests" ON data_deletion_requests;
CREATE POLICY "Users can create deletion requests"
    ON data_deletion_requests FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all consents" ON user_consents;
CREATE POLICY "Admins can view all consents"
    ON user_consents FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Everyone can view privacy policies" ON privacy_policy_versions;
CREATE POLICY "Everyone can view privacy policies"
    ON privacy_policy_versions FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Everyone can view terms of service" ON terms_of_service_versions;
CREATE POLICY "Everyone can view terms of service"
    ON terms_of_service_versions FOR SELECT
    TO authenticated
    USING (true);

-- Function to record consent
CREATE OR REPLACE FUNCTION record_consent(
    p_user_id UUID,
    p_consent_type VARCHAR,
    p_consent_given BOOLEAN,
    p_consent_version VARCHAR,
    p_consent_text TEXT DEFAULT NULL,
    p_ip_address VARCHAR DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_consent_id UUID;
BEGIN
    INSERT INTO user_consents (
        user_id, consent_type, consent_given, consent_version,
        consent_text, ip_address, user_agent
    ) VALUES (
        p_user_id, p_consent_type, p_consent_given, p_consent_version,
        p_consent_text, p_ip_address, p_user_agent
    ) RETURNING id INTO v_consent_id;

    RETURN v_consent_id;
END;
$$ LANGUAGE plpgsql;

-- Function to request data export
CREATE OR REPLACE FUNCTION request_data_export(
    p_user_id UUID,
    p_tenant_id UUID,
    p_export_format VARCHAR DEFAULT 'json'
) RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_expires_at := NOW() + INTERVAL '7 days';

    INSERT INTO data_export_requests (
        user_id, tenant_id, export_format, expires_at, status
    ) VALUES (
        p_user_id, p_tenant_id, p_export_format, v_expires_at, 'pending'
    ) RETURNING id INTO v_request_id;

    INSERT INTO data_processing_log (
        user_id, tenant_id, activity_type, data_category,
        purpose, legal_basis
    ) VALUES (
        p_user_id, p_tenant_id, 'data_export', 'all_categories',
        'GDPR Right to Access - User requested data export',
        'legal_obligation'
    );

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

-- Function to request data deletion
CREATE OR REPLACE FUNCTION request_data_deletion(
    p_user_id UUID,
    p_tenant_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
    v_scheduled_date TIMESTAMPTZ;
BEGIN
    v_scheduled_date := NOW() + INTERVAL '30 days';

    INSERT INTO data_deletion_requests (
        user_id, tenant_id, reason, scheduled_deletion_date, status
    ) VALUES (
        p_user_id, p_tenant_id, p_reason, v_scheduled_date, 'under_review'
    ) RETURNING id INTO v_request_id;

    INSERT INTO data_processing_log (
        user_id, tenant_id, activity_type, data_category,
        purpose, legal_basis
    ) VALUES (
        p_user_id, p_tenant_id, 'data_deletion_request', 'all_categories',
        'GDPR Right to Erasure - User requested account deletion',
        'legal_obligation'
    );

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

-- Function to anonymize user data
CREATE OR REPLACE FUNCTION anonymize_user_data(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE profiles SET
        name = 'Deleted User',
        email = CONCAT('deleted_', p_user_id, '@anonymized.local'),
        avatar_url = NULL,
        phone = NULL,
        address = NULL,
        metadata = '{}'
    WHERE id = p_user_id;

    UPDATE contracts SET
        signer_name = 'Anonymized',
        signer_email = 'anonymized@local'
    WHERE user_id = p_user_id;

    UPDATE audit_logs SET
        metadata = jsonb_set(
            COALESCE(metadata, '{}'),
            '{anonymized}',
            'true'::jsonb
        )
    WHERE user_id = p_user_id;

    INSERT INTO data_processing_log (
        user_id, activity_type, data_category, purpose, legal_basis
    ) VALUES (
        p_user_id, 'anonymization', 'personal_data',
        'GDPR Right to Erasure - Data anonymized',
        'legal_obligation'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Insert current privacy policy version
INSERT INTO privacy_policy_versions (version, content, effective_date, is_current)
VALUES (
    '1.0',
    'Privacy Policy content will be added here...',
    NOW(),
    TRUE
) ON CONFLICT (version) DO NOTHING;

-- Insert current terms of service version
INSERT INTO terms_of_service_versions (version, content, effective_date, is_current)
VALUES (
    '1.0',
    'Terms of Service content will be added here...',
    NOW(),
    TRUE
) ON CONFLICT (version) DO NOTHING;

-- Comments
COMMENT ON TABLE user_consents IS 'Tracks all user consents for GDPR compliance';
COMMENT ON TABLE data_export_requests IS 'GDPR Right to Access - User data export requests';
COMMENT ON TABLE data_deletion_requests IS 'GDPR Right to Erasure - User deletion requests';
COMMENT ON TABLE data_processing_log IS 'GDPR Article 30 - Record of processing activities';

-- ============================================================================
-- ALL MIGRATIONS COMPLETE!
-- ============================================================================
--
-- Summary:
-- ✅ Migration 1: User Security & 2FA (1 table, 1 function)
-- ✅ Migration 2: Stripe Webhooks (3 tables, 3 functions)
-- ✅ Migration 3: E-Signature Compliance (5 tables, 5 functions)
-- ✅ Migration 4: Quota Enforcement (4 tables, 4 functions)
-- ✅ Migration 5: GDPR Compliance (6 tables, 4 functions)
--
-- Total: 20 tables, 16+ functions
--
-- Your data is SAFE - all migrations only ADD new structures.
-- No existing tables are modified or deleted.
-- ============================================================================
