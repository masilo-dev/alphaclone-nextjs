-- Create error_logs table for monitoring and debugging
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  stack TEXT,
  user_agent TEXT,
  url TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  severity VARCHAR(20) DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'info')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_error_logs_tenant_id ON error_logs(tenant_id);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);

-- Add RLS policies
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view error logs for their tenant"
  ON error_logs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "System can insert error logs"
  ON error_logs FOR INSERT
  WITH CHECK (true); -- Allow system to insert error logs

-- Create performance_logs table
CREATE TABLE IF NOT EXISTS performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric VARCHAR(100) NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  page TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_performance_logs_tenant_id ON performance_logs(tenant_id);
CREATE INDEX idx_performance_logs_metric ON performance_logs(metric);
CREATE INDEX idx_performance_logs_created_at ON performance_logs(created_at DESC);

-- Add RLS policies
ALTER TABLE performance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view performance logs for their tenant"
  ON performance_logs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "System can insert performance logs"
  ON performance_logs FOR INSERT
  WITH CHECK (true);

-- Create audit_logs table for security auditing
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Add RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their tenant"
  ON audit_logs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);
