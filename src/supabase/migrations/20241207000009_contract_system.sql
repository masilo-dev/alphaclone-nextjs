-- ============================================================================
-- PHASE 13: CONTRACT GENERATION
-- ============================================================================
-- Adds tables for Contracts and Templates

-- Contracts Table
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft', 'sent', 'signed', 'rejected', 'expired')) DEFAULT 'draft',
  content JSONB DEFAULT '{}', -- Stores structured contract data/clauses
  template_type TEXT DEFAULT 'generic',
  signed_at TIMESTAMPTZ,
  signer_name TEXT,
  signer_email TEXT,
  signature_url TEXT,
  pdf_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract Templates Table (Optional, for reusable templates)
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  content JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- Enable RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contracts
DROP POLICY IF EXISTS "Users can view their own contracts" ON contracts;
CREATE POLICY "Users can view their own contracts"
  ON contracts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all contracts" ON contracts;
CREATE POLICY "Admins can view all contracts"
  ON contracts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage contracts" ON contracts;
CREATE POLICY "Admins can manage contracts"
  ON contracts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for templates (Read-only for users, Manage for admins)
DROP POLICY IF EXISTS "Everyone can view active templates" ON contract_templates;
CREATE POLICY "Everyone can view active templates"
  ON contract_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage templates" ON contract_templates;
CREATE POLICY "Admins can manage templates"
  ON contract_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update contracts timestamp
CREATE OR REPLACE FUNCTION update_contracts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_contracts_timestamp ON contracts;
CREATE TRIGGER trigger_update_contracts_timestamp
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_contracts_timestamp();

-- ============================================================================
-- CONTRACT SYSTEM DEPLOYED!
-- ============================================================================
