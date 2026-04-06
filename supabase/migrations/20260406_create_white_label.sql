-- Create white_label_configs table for customization
CREATE TABLE IF NOT EXISTS white_label_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branding JSONB DEFAULT '{}',
  colors JSONB DEFAULT '{}',
  domain JSONB DEFAULT '{}',
  email JSONB DEFAULT '{}',
  ui JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Create indexes
CREATE INDEX idx_white_label_configs_tenant_id ON white_label_configs(tenant_id);
CREATE INDEX idx_white_label_configs_enabled ON white_label_configs(enabled);

-- Add RLS policies
ALTER TABLE white_label_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view white-label config for their tenant"
  ON white_label_configs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert white-label config"
  ON white_label_configs FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

CREATE POLICY "Admins can update white-label config"
  ON white_label_configs FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

CREATE POLICY "Admins can delete white-label config"
  ON white_label_configs FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_white_label_configs_updated_at
  BEFORE UPDATE ON white_label_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for white-label assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('white-label-assets', 'white-label-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for storage bucket
CREATE POLICY "Users can upload white-label assets for their tenant"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'white-label-assets'
    AND (storage.foldername(name))[1] IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Public can view white-label assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'white-label-assets');

CREATE POLICY "Users can delete their white-label assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'white-label-assets'
    AND (storage.foldername(name))[1] IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Add is_white_label_enabled column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_white_label_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);

-- Create index
CREATE INDEX IF NOT EXISTS idx_tenants_is_white_label_enabled ON tenants(is_white_label_enabled);
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain);
