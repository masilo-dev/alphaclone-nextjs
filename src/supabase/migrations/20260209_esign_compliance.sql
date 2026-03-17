-- ============================================================================
-- WEEK 1 SECURITY FIX: ESIGN ACT COMPLIANCE FOR ELECTRONIC SIGNATURES
-- ============================================================================
-- Makes contract signatures legally binding under the ESIGN Act (2000)

-- Contract Audit Trail
-- Complete audit trail for every action taken on a contract
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
    actor_role VARCHAR(20), -- 'admin', 'client', 'system'
    actor_name VARCHAR(255),
    actor_email VARCHAR(255),
    ip_address VARCHAR(45), -- Supports IPv6
    user_agent TEXT,
    geolocation JSONB, -- { country, region, city, lat, lon }
    details JSONB DEFAULT '{}', -- Additional action-specific details
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- E-Signature Consent Records
-- Tracks consent to use electronic signatures (ESIGN Act requirement)
CREATE TABLE IF NOT EXISTS esignature_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    consent_given BOOLEAN NOT NULL DEFAULT TRUE,
    consent_text TEXT NOT NULL, -- The disclosure text shown to user
    consent_method VARCHAR(50) NOT NULL, -- 'checkbox', 'button_click', 'signature_action'
    ip_address VARCHAR(45),
    user_agent TEXT,
    geolocation JSONB,
    withdrawn_at TIMESTAMPTZ, -- If user withdraws consent
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signature Events (Detailed signature process tracking)
CREATE TABLE IF NOT EXISTS signature_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    signer_id UUID REFERENCES auth.users(id),
    signer_role VARCHAR(20) NOT NULL, -- 'client' or 'admin'
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
    signature_data TEXT, -- Base64 signature image
    authentication_method VARCHAR(50), -- 'email', 'sms', '2fa', 'password'
    intent_statement TEXT, -- "I intend to sign this document"
    device_info JSONB, -- Browser, OS, device type
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    content_hash_at_signing VARCHAR(64), -- SHA-256 hash of content when signed
    tamper_seal VARCHAR(128), -- Cryptographic seal
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certificate of Completion
-- Official certificate proving document was legally executed
CREATE TABLE IF NOT EXISTS signature_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id VARCHAR(100) UNIQUE NOT NULL, -- Human-readable cert ID
    contract_id UUID NOT NULL UNIQUE REFERENCES contracts(id) ON DELETE CASCADE,
    document_title VARCHAR(500) NOT NULL,
    completion_date TIMESTAMPTZ NOT NULL,
    signers JSONB NOT NULL, -- Array of signer details
    document_hash VARCHAR(64) NOT NULL, -- Final document hash
    certificate_hash VARCHAR(64) NOT NULL, -- Hash of this certificate
    tamper_seal VARCHAR(128) NOT NULL, -- Cryptographic seal
    retention_period_years INTEGER DEFAULT 7, -- Legal retention period
    retention_expires_at TIMESTAMPTZ,
    pdf_url TEXT, -- Stored certificate PDF
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Versions (Track all content changes)
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

-- Indexes for performance
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

-- RLS Policies: Users can view their own contract audit trails
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

-- Admins can view all audit trails
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

-- Similar policies for other tables
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
        MD5(v_cert_number || p_document_hash), -- Certificate hash
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
        RETURN FALSE; -- No certificate found
    END IF;

    RETURN v_original_hash = p_current_content_hash;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE contract_audit_trail IS 'Complete audit trail for ESIGN Act compliance';
COMMENT ON TABLE esignature_consents IS 'Records consent to use electronic signatures (ESIGN Act requirement)';
COMMENT ON TABLE signature_events IS 'Detailed tracking of all signature events';
COMMENT ON TABLE signature_certificates IS 'Official certificates of completion for signed documents';
COMMENT ON TABLE contract_versions IS 'Version history for document change tracking';

-- ============================================================================
-- ESIGN ACT COMPLIANCE SYSTEM DEPLOYED!
-- ============================================================================
