-- ============================================================================
-- WEEK 2: GDPR/CCPA COMPLIANCE
-- ============================================================================
-- Implements data privacy compliance features

-- User Consent Management
-- Tracks all user consents for GDPR compliance
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type VARCHAR(100) NOT NULL, -- 'terms_of_service', 'privacy_policy', 'marketing', 'analytics', 'cookies'
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_version VARCHAR(50) NOT NULL, -- Version of T&C/Privacy Policy
    consent_text TEXT, -- Full text of what user consented to
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
    file_url TEXT, -- URL to download export file
    file_size_bytes BIGINT,
    expires_at TIMESTAMPTZ, -- Export files expire after 7 days
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
    reason TEXT, -- Why deletion was requested
    rejection_reason TEXT, -- Why request was rejected (if applicable)
    specific_data JSONB, -- For partial deletion requests
    scheduled_deletion_date TIMESTAMPTZ, -- Grace period (30 days)
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Processing Activities Log (GDPR Article 30)
CREATE TABLE IF NOT EXISTS data_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL, -- 'data_collection', 'data_processing', 'data_transfer', 'data_deletion'
    data_category VARCHAR(100) NOT NULL, -- 'personal_data', 'financial_data', 'location_data', etc.
    purpose TEXT NOT NULL, -- Purpose of processing
    legal_basis VARCHAR(100), -- 'consent', 'contract', 'legal_obligation', 'legitimate_interest'
    data_recipients TEXT, -- Who has access to this data
    retention_period VARCHAR(100), -- How long data is kept
    security_measures JSONB, -- Security measures in place
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

-- Indexes for performance
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

-- RLS Policies: Users can view their own data
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

-- Admins can view all privacy-related data
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

-- Everyone can view current privacy policy and terms
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
    -- Export files expire after 7 days
    v_expires_at := NOW() + INTERVAL '7 days';

    INSERT INTO data_export_requests (
        user_id, tenant_id, export_format, expires_at, status
    ) VALUES (
        p_user_id, p_tenant_id, p_export_format, v_expires_at, 'pending'
    ) RETURNING id INTO v_request_id;

    -- Log data processing activity
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
    -- 30-day grace period before deletion
    v_scheduled_date := NOW() + INTERVAL '30 days';

    INSERT INTO data_deletion_requests (
        user_id, tenant_id, reason, scheduled_deletion_date, status
    ) VALUES (
        p_user_id, p_tenant_id, p_reason, v_scheduled_date, 'under_review'
    ) RETURNING id INTO v_request_id;

    -- Log data processing activity
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

-- Function to anonymize user data (GDPR-compliant deletion)
CREATE OR REPLACE FUNCTION anonymize_user_data(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Anonymize user profile
    UPDATE profiles SET
        name = 'Deleted User',
        email = CONCAT('deleted_', p_user_id, '@anonymized.local'),
        avatar_url = NULL,
        phone = NULL,
        address = NULL,
        metadata = '{}'
    WHERE id = p_user_id;

    -- Mark contracts as anonymized
    UPDATE contracts SET
        signer_name = 'Anonymized',
        signer_email = 'anonymized@local'
    WHERE user_id = p_user_id;

    -- Keep audit logs but anonymize
    UPDATE audit_logs SET
        metadata = jsonb_set(
            COALESCE(metadata, '{}'),
            '{anonymized}',
            'true'::jsonb
        )
    WHERE user_id = p_user_id;

    -- Log the anonymization
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

-- Comments for documentation
COMMENT ON TABLE user_consents IS 'Tracks all user consents for GDPR compliance';
COMMENT ON TABLE data_export_requests IS 'GDPR Right to Access - User data export requests';
COMMENT ON TABLE data_deletion_requests IS 'GDPR Right to Erasure - User deletion requests';
COMMENT ON TABLE data_processing_log IS 'GDPR Article 30 - Record of processing activities';

-- ============================================================================
-- GDPR/CCPA COMPLIANCE SYSTEM DEPLOYED!
-- ============================================================================
