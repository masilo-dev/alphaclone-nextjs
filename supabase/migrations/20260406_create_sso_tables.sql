-- Create sso_configs table for SSO/SAML configuration
CREATE TABLE IF NOT EXISTS sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('okta', 'auth0', 'azure_ad', 'onelogin', 'saml_custom')),
  entity_id TEXT NOT NULL,
  sso_url TEXT NOT NULL,
  certificate TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Create indexes
CREATE INDEX idx_sso_configs_tenant_id ON sso_configs(tenant_id);
CREATE INDEX idx_sso_configs_provider ON sso_configs(provider);
CREATE INDEX idx_sso_configs_enabled ON sso_configs(enabled);

-- Add RLS policies
ALTER TABLE sso_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SSO config for their tenant"
  ON sso_configs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert SSO config"
  ON sso_configs FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

CREATE POLICY "Admins can update SSO config"
  ON sso_configs FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

CREATE POLICY "Admins can delete SSO config"
  ON sso_configs FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

-- Create saml_requests table for SAML request tracking
CREATE TABLE IF NOT EXISTS saml_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  relay_state TEXT,
  saml_request TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_saml_requests_request_id ON saml_requests(request_id);
CREATE INDEX idx_saml_requests_tenant_id ON saml_requests(tenant_id);
CREATE INDEX idx_saml_requests_expires_at ON saml_requests(expires_at);

-- Add RLS policies
ALTER TABLE saml_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert SAML requests"
  ON saml_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can view SAML requests"
  ON saml_requests FOR SELECT
  USING (true);

-- Create saml_responses table for SAML response tracking
CREATE TABLE IF NOT EXISTS saml_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL REFERENCES saml_requests(request_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  saml_response TEXT NOT NULL,
  validated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_saml_responses_request_id ON saml_responses(request_id);
CREATE INDEX idx_saml_responses_tenant_id ON saml_responses(tenant_id);
CREATE INDEX idx_saml_responses_user_id ON saml_responses(user_id);

-- Add RLS policies
ALTER TABLE saml_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert SAML responses"
  ON saml_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view SAML responses for their tenant"
  ON saml_responses FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Add updated_at trigger for sso_configs
CREATE TRIGGER update_sso_configs_updated_at
  BEFORE UPDATE ON sso_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add is_sso_enabled column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_sso_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50);

-- Create index
CREATE INDEX IF NOT EXISTS idx_tenants_is_sso_enabled ON tenants(is_sso_enabled);
