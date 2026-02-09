-- ============================================================================
-- WEEK 1 SECURITY FIX: TWO-FACTOR AUTHENTICATION (2FA/TOTP)
-- ============================================================================
-- Creates user_security table and related infrastructure for real 2FA

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

-- Comment for documentation
COMMENT ON TABLE user_security IS 'Stores user two-factor authentication settings and backup codes';
COMMENT ON COLUMN user_security.two_factor_secret IS 'TOTP secret key (encrypted in production)';
COMMENT ON COLUMN user_security.backup_codes IS 'One-time use backup codes for account recovery';
COMMENT ON COLUMN user_security.last_totp_used_at IS 'Timestamp of last successful TOTP verification (prevents replay attacks)';

-- ============================================================================
-- 2FA SYSTEM DEPLOYED!
-- ============================================================================
