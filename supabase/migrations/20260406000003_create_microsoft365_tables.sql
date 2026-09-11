-- Create microsoft365_integrations table
CREATE TABLE IF NOT EXISTS microsoft365_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  tenant_domain TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  services JSONB DEFAULT '{"outlook": true, "calendar": true, "onedrive": false, "sharepoint": false, "teams": false}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_microsoft365_tenant_id ON microsoft365_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_microsoft365_enabled ON microsoft365_integrations(enabled);

-- Add RLS policies
ALTER TABLE microsoft365_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view Microsoft 365 config for their tenant" ON microsoft365_integrations;
CREATE POLICY "Users can view Microsoft 365 config for their tenant"
  ON microsoft365_integrations FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert Microsoft 365 config" ON microsoft365_integrations;
CREATE POLICY "Admins can insert Microsoft 365 config"
  ON microsoft365_integrations FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update Microsoft 365 config" ON microsoft365_integrations;
CREATE POLICY "Admins can update Microsoft 365 config"
  ON microsoft365_integrations FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete Microsoft 365 config" ON microsoft365_integrations;
CREATE POLICY "Admins can delete Microsoft 365 config"
  ON microsoft365_integrations FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_microsoft365_updated_at ON microsoft365_integrations;
CREATE TRIGGER update_microsoft365_updated_at
  BEFORE UPDATE ON microsoft365_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
