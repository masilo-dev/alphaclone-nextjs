-- Security Logs Table for IP Tracking and Activity Monitoring
CREATE TABLE IF NOT EXISTS security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'login', 'logout', 'failed_login', 'data_access', 'settings_change', etc.
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    location TEXT, -- City, Country from IP
    device_info JSONB, -- Browser, OS, Device type
    event_details JSONB, -- Additional context
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_security_logs_tenant ON security_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_user ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON security_logs(ip_address);

-- Enable RLS
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view all security logs
CREATE POLICY "Admins can view all security logs"
ON security_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Policy: Tenant admins can only view their own tenant's logs
CREATE POLICY "Tenant admins can view their tenant logs"
ON security_logs
FOR SELECT
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid()
    )
);

-- Policy: System can insert logs
CREATE POLICY "System can insert security logs"
ON security_logs
FOR INSERT
WITH CHECK (true);

COMMENT ON TABLE security_logs IS 'Security event logs with IP tracking for SIEM';
