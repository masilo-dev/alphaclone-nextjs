-- Create recurring_invoices table for automated invoice generation
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  description TEXT,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  last_generated TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_tenant_id ON recurring_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_active ON recurring_invoices(active);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_start_date ON recurring_invoices(start_date);

-- Add RLS policies
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view recurring invoices for their tenant" ON recurring_invoices;
CREATE POLICY "Users can view recurring invoices for their tenant"
  ON recurring_invoices FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can insert recurring invoices" ON recurring_invoices;
CREATE POLICY "Admins can insert recurring invoices"
  ON recurring_invoices FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update recurring invoices" ON recurring_invoices;
CREATE POLICY "Admins can update recurring invoices"
  ON recurring_invoices FOR UPDATE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete recurring invoices" ON recurring_invoices;
CREATE POLICY "Admins can delete recurring invoices"
  ON recurring_invoices FOR DELETE
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tenant_admin')
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_recurring_invoices_updated_at ON recurring_invoices;
CREATE TRIGGER update_recurring_invoices_updated_at
  BEFORE UPDATE ON recurring_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add is_recurring flag to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_config_id UUID REFERENCES recurring_invoices(id) ON DELETE SET NULL;

-- Create index for recurring invoices lookup
CREATE INDEX IF NOT EXISTS idx_invoices_recurring_config_id ON invoices(recurring_config_id);
CREATE INDEX IF NOT EXISTS idx_invoices_is_recurring ON invoices(is_recurring);
