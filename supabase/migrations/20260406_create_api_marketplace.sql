-- Create api_integrations table for marketplace listings
CREATE TABLE IF NOT EXISTS api_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  version VARCHAR(50) DEFAULT '1.0.0',
  author VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  icon TEXT,
  pricing JSONB DEFAULT '{"type": "free"}',
  endpoints JSONB DEFAULT '[]',
  documentation TEXT,
  rating DECIMAL(3, 2) DEFAULT 0,
  install_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_api_integrations_category ON api_integrations(category);
CREATE INDEX idx_api_integrations_featured ON api_integrations(featured);
CREATE INDEX idx_api_integrations_published ON api_integrations(published);
CREATE INDEX idx_api_integrations_rating ON api_integrations(rating DESC);

-- Add RLS policies
ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published integrations"
  ON api_integrations FOR SELECT
  USING (published = true);

CREATE POLICY "Admins can insert integrations"
  ON api_integrations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin')
    )
  );

CREATE POLICY "Admins can update integrations"
  ON api_integrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin')
    )
  );

CREATE POLICY "Admins can delete integrations"
  ON api_integrations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin')
    )
  );

-- Create tenant_api_installations table for installed integrations
CREATE TABLE IF NOT EXISTS tenant_api_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES api_integrations(id) ON DELETE CASCADE,
  api_key VARCHAR(100) UNIQUE NOT NULL,
  api_secret VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  usage_stats JSONB DEFAULT '{"requests": 0, "last_used": null}',
  installed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(tenant_id, integration_id)
);

-- Create indexes
CREATE INDEX idx_tenant_api_installations_tenant_id ON tenant_api_installations(tenant_id);
CREATE INDEX idx_tenant_api_installations_integration_id ON tenant_api_installations(integration_id);
CREATE INDEX idx_tenant_api_installations_api_key ON tenant_api_installations(api_key);
CREATE INDEX idx_tenant_api_installations_enabled ON tenant_api_installations(enabled);

-- Add RLS policies
ALTER TABLE tenant_api_installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's installations"
  ON tenant_api_installations FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert installations"
  ON tenant_api_installations FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

CREATE POLICY "Admins can update installations"
  ON tenant_api_installations FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

CREATE POLICY "Admins can delete installations"
  ON tenant_api_installations FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

-- Create api_usage_logs table for tracking API usage
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES api_integrations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time DECIMAL(10, 2),
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_api_usage_logs_tenant_id ON api_usage_logs(tenant_id);
CREATE INDEX idx_api_usage_logs_integration_id ON api_usage_logs(integration_id);
CREATE INDEX idx_api_usage_logs_timestamp ON api_usage_logs(timestamp DESC);
CREATE INDEX idx_api_usage_logs_status_code ON api_usage_logs(status_code);

-- Add RLS policies
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's usage logs"
  ON api_usage_logs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "System can insert usage logs"
  ON api_usage_logs FOR INSERT
  WITH CHECK (true);

-- Create api_ratings table for integration ratings
CREATE TABLE IF NOT EXISTS api_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES api_integrations(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, integration_id)
);

-- Create indexes
CREATE INDEX idx_api_ratings_tenant_id ON api_ratings(tenant_id);
CREATE INDEX idx_api_ratings_integration_id ON api_ratings(integration_id);
CREATE INDEX idx_api_ratings_rating ON api_ratings(rating);

-- Add RLS policies
ALTER TABLE api_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ratings"
  ON api_ratings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their ratings"
  ON api_ratings FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update their ratings"
  ON api_ratings FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Add updated_at triggers
CREATE TRIGGER update_api_integrations_updated_at
  BEFORE UPDATE ON api_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_api_installations_updated_at
  BEFORE UPDATE ON tenant_api_installations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_ratings_updated_at
  BEFORE UPDATE ON api_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
