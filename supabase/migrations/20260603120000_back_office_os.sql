-- Migration: Back-Office Operating System Modules
-- Date: 2026-06-03
-- Description: Creates database schema for Unified Inbox, Cash Flow Forecast, Client Onboarding Portal, Document Vault, and Tax Estimator modules.

BEGIN;

-- 1. Extend contacts table for Onboarding Portal
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS client_portal_token UUID DEFAULT gen_random_uuid();
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'in_progress', 'completed'));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill existing NULL tokens if any, then add unique constraint if appropriate
-- (Avoid strict unique constraint if multiple contacts could potentially share a legacy NULL token, but default is gen_random_uuid())
UPDATE public.contacts SET client_portal_token = gen_random_uuid() WHERE client_portal_token IS NULL;

-- Create index for onboarding queries
CREATE INDEX IF NOT EXISTS idx_contacts_portal_token ON public.contacts(client_portal_token);


-- 2. Client Onboarding Steps table
CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_description TEXT,
  step_order INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true,
  step_type TEXT NOT NULL CHECK (step_type IN ('form', 'contract', 'payment', 'upload')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "Tenant users can view onboarding_steps"
  ON public.onboarding_steps FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can insert onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "Tenant users can insert onboarding_steps"
  ON public.onboarding_steps FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can update onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "Tenant users can update onboarding_steps"
  ON public.onboarding_steps FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can delete onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "Tenant users can delete onboarding_steps"
  ON public.onboarding_steps FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_tenant ON public.onboarding_steps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_order ON public.onboarding_steps(tenant_id, step_order);


-- 3. Onboarding Submissions table
CREATE TABLE IF NOT EXISTS public.onboarding_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.onboarding_steps(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved')),
  submitted_data JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_contact_step UNIQUE (contact_id, step_id)
);

-- Enable RLS
ALTER TABLE public.onboarding_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view onboarding_submissions" ON public.onboarding_submissions;
CREATE POLICY "Tenant users can view onboarding_submissions"
  ON public.onboarding_submissions FOR SELECT
  USING (contact_id IN (SELECT id FROM public.contacts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Tenant users can insert onboarding_submissions" ON public.onboarding_submissions;
CREATE POLICY "Tenant users can insert onboarding_submissions"
  ON public.onboarding_submissions FOR INSERT
  WITH CHECK (contact_id IN (SELECT id FROM public.contacts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Tenant users can update onboarding_submissions" ON public.onboarding_submissions;
CREATE POLICY "Tenant users can update onboarding_submissions"
  ON public.onboarding_submissions FOR UPDATE
  USING (contact_id IN (SELECT id FROM public.contacts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Tenant users can delete onboarding_submissions" ON public.onboarding_submissions;
CREATE POLICY "Tenant users can delete onboarding_submissions"
  ON public.onboarding_submissions FOR DELETE
  USING (contact_id IN (SELECT id FROM public.contacts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_contact ON public.onboarding_submissions(contact_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_step ON public.onboarding_submissions(step_id);


-- 4. Cash Flow Projections table
CREATE TABLE IF NOT EXISTS public.cash_flow_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  projected_inflow DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  projected_outflow DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  actual_inflow DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  actual_outflow DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  variance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  confidence_score DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_flow_projections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view cash_flow_projections" ON public.cash_flow_projections;
CREATE POLICY "Tenant users can view cash_flow_projections"
  ON public.cash_flow_projections FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can insert cash_flow_projections" ON public.cash_flow_projections;
CREATE POLICY "Tenant users can insert cash_flow_projections"
  ON public.cash_flow_projections FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can delete cash_flow_projections" ON public.cash_flow_projections;
CREATE POLICY "Tenant users can delete cash_flow_projections"
  ON public.cash_flow_projections FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_cash_flow_tenant_date ON public.cash_flow_projections(tenant_id, forecast_date DESC);


-- 5. Document Vault table
CREATE TABLE IF NOT EXISTS public.vault_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  category TEXT CHECK (category IN ('invoice', 'contract', 'receipt', 'tax', 'other')),
  ocr_text TEXT,
  extracted_metadata JSONB DEFAULT '{}'::jsonb,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view vault_documents" ON public.vault_documents;
CREATE POLICY "Tenant users can view vault_documents"
  ON public.vault_documents FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can insert vault_documents" ON public.vault_documents;
CREATE POLICY "Tenant users can insert vault_documents"
  ON public.vault_documents FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can update vault_documents" ON public.vault_documents;
CREATE POLICY "Tenant users can update vault_documents"
  ON public.vault_documents FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can delete vault_documents" ON public.vault_documents;
CREATE POLICY "Tenant users can delete vault_documents"
  ON public.vault_documents FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_vault_docs_tenant ON public.vault_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vault_docs_contact ON public.vault_documents(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vault_docs_category ON public.vault_documents(tenant_id, category);


-- 6. Tax Records table
CREATE TABLE IF NOT EXISTS public.tax_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
  estimated_income DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  estimated_expenses DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  tax_owed DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  tax_paid DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_tenant_year_quarter UNIQUE (tenant_id, tax_year, quarter)
);

-- Enable RLS
ALTER TABLE public.tax_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view tax_records" ON public.tax_records;
CREATE POLICY "Tenant users can view tax_records"
  ON public.tax_records FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can insert tax_records" ON public.tax_records;
CREATE POLICY "Tenant users can insert tax_records"
  ON public.tax_records FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can update tax_records" ON public.tax_records;
CREATE POLICY "Tenant users can update tax_records"
  ON public.tax_records FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can delete tax_records" ON public.tax_records;
CREATE POLICY "Tenant users can delete tax_records"
  ON public.tax_records FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_tax_records_tenant ON public.tax_records(tenant_id, tax_year);


-- 7. Add Triggers for updated_at tracking
DROP TRIGGER IF EXISTS update_onboarding_steps_updated_at ON onboarding_steps;
CREATE TRIGGER update_onboarding_steps_updated_at
  BEFORE UPDATE ON onboarding_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_onboarding_submissions_updated_at ON onboarding_submissions;
CREATE TRIGGER update_onboarding_submissions_updated_at
  BEFORE UPDATE ON onboarding_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vault_documents_updated_at ON vault_documents;
CREATE TRIGGER update_vault_documents_updated_at
  BEFORE UPDATE ON vault_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tax_records_updated_at ON tax_records;
CREATE TRIGGER update_tax_records_updated_at
  BEFORE UPDATE ON tax_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
