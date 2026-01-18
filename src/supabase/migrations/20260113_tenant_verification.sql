-- =====================================================
-- BUSINESS ONBOARDING & VERIFICATION UPDATE
-- Adds verification status to tenants table
-- =====================================================
-- 1. Add verification columns to tenants table
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants'
        AND column_name = 'verification_status'
) THEN
ALTER TABLE tenants
ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending' CHECK (
        verification_status IN ('pending', 'verified', 'rejected', 'flagged')
    );
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenants'
        AND column_name = 'verification_data'
) THEN
ALTER TABLE tenants
ADD COLUMN verification_data JSONB DEFAULT '{}';
END IF;
END $$;
-- 2. Create index for fast lookups of pending verifications
CREATE INDEX IF NOT EXISTS idx_tenants_verification ON tenants(verification_status);
-- 3. Update existing tenants to verified
UPDATE tenants
SET verification_status = 'verified'
WHERE verification_status = 'pending';
-- 4. Create function to verify tenant (for AI Agent)
CREATE OR REPLACE FUNCTION verify_tenant(
        p_tenant_id UUID,
        p_status VARCHAR,
        p_data JSONB DEFAULT '{}'
    ) RETURNS VOID AS $$ BEGIN
UPDATE tenants
SET verification_status = p_status,
    verification_data = p_data,
    updated_at = NOW()
WHERE id = p_tenant_id;
-- Log event
PERFORM publish_event(
    'tenant.verification_updated',
    'tenant_service',
    jsonb_build_object(
        'tenantId',
        p_tenant_id,
        'status',
        p_status
    )
);
END;
$$ LANGUAGE plpgsql;