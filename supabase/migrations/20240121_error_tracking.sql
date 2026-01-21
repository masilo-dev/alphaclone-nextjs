-- Add error tracking tables for SIEM
-- This enables tracking of failed logins, client errors, and server errors

-- Failed Login Attempts Table
CREATE TABLE IF NOT EXISTS failed_logins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    location TEXT,
    device_info JSONB,
    failure_reason TEXT NOT NULL, -- 'invalid_password', 'user_not_found', 'account_locked', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error Logs Table (client-side and server-side errors)
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    error_type TEXT NOT NULL, -- 'client_error', 'server_error', 'api_error'
    error_message TEXT NOT NULL,
    error_stack TEXT,
    component_stack TEXT, -- For React errors
    endpoint TEXT, -- For API errors
    status_code INTEGER, -- For HTTP errors
    severity TEXT DEFAULT 'error', -- 'error', 'warning', 'critical'
    user_agent TEXT,
    ip_address TEXT,
    metadata JSONB, -- Additional context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_failed_logins_tenant_created 
ON failed_logins(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_failed_logins_email 
ON failed_logins(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_created 
ON error_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_user 
ON error_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_type 
ON error_logs(error_type, created_at DESC);

-- RLS Policies
ALTER TABLE failed_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all failed logins
CREATE POLICY "Admins can view all failed logins"
ON failed_logins
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Admins can view all error logs
CREATE POLICY "Admins can view all error logs"
ON error_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Users can view their own error logs
CREATE POLICY "Users can view their own error logs"
ON error_logs
FOR SELECT
USING (user_id = auth.uid());

-- System can insert failed logins (no auth required for login failures)
CREATE POLICY "System can insert failed logins"
ON failed_logins
FOR INSERT
WITH CHECK (true);

-- System can insert error logs
CREATE POLICY "System can insert error logs"
ON error_logs
FOR INSERT
WITH CHECK (true);
