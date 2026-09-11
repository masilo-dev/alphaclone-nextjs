-- ============================================================================
-- ALPHACLONE CONSOLIDATED DATABASE SCHEMA UPDATE
-- ============================================================================
-- Safe to run: All commands use IF NOT EXISTS/IF EXISTS guards.
-- No tables will be dropped and no data will be deleted.
-- Copy and paste this script directly into your Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: CORE UTILITY FUNCTIONS & TRIGGER HELPER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fix public.secure_read_only_query RPC (change json_agg to jsonb_agg to fix type mismatch)
CREATE OR REPLACE FUNCTION public.secure_read_only_query(query_string text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- Strict Postgres guard against write and diagnostic sequences
  IF query_string ILIKE '%insert%' OR
     query_string ILIKE '%update%' OR
     query_string ILIKE '%delete%' OR
     query_string ILIKE '%drop%' OR
     query_string ILIKE '%truncate%' OR
     query_string ILIKE '%alter%' OR
     query_string ILIKE '%create%' OR
     query_string ILIKE '%grant%' OR
     query_string ILIKE '%revoke%' OR
     query_string ILIKE '%pg_%' OR
     query_string ILIKE '%information_schema%' THEN
    RAISE EXCEPTION 'Action rejected: Secure read-only queries only support SELECT operations.';
  END IF;

  -- Dynamic execution returning a single cohesive JSON array
  EXECUTE 'SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM (' || query_string || ') t' INTO result;

  RETURN result;
END;
$function$;


-- ============================================================================
-- PART 2: AUTONOMOUS RUNNER INFRASTRUCTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.autonomous_runner_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial_success', 'failed')),
    trigger_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autonomous_runner_runs_tenant_created_at
    ON public.autonomous_runner_runs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.autonomous_runner_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.autonomous_runner_runs(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    action_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
    details TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autonomous_runner_actions_run_id
    ON public.autonomous_runner_actions (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.autonomous_runner_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
    auto_send_confidence_threshold INTEGER NOT NULL DEFAULT 85 CHECK (auto_send_confidence_threshold BETWEEN 0 AND 100),
    high_risk_approval_required BOOLEAN NOT NULL DEFAULT true,
    stale_deal_days INTEGER NOT NULL DEFAULT 7 CHECK (stale_deal_days >= 1 AND stale_deal_days <= 60),
    social_inactivity_days INTEGER NOT NULL DEFAULT 3 CHECK (social_inactivity_days >= 1 AND social_inactivity_days <= 30),
    updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend autonomous_runner_rules with custom fields
ALTER TABLE public.autonomous_runner_rules 
ADD COLUMN IF NOT EXISTS lead_action_mode TEXT NOT NULL DEFAULT 'draft_and_task',
ADD COLUMN IF NOT EXISTS email_provider TEXT NOT NULL DEFAULT 'system_default';

ALTER TABLE public.autonomous_runner_rules DROP CONSTRAINT IF EXISTS chk_lead_action_mode;
ALTER TABLE public.autonomous_runner_rules ADD CONSTRAINT chk_lead_action_mode CHECK (lead_action_mode IN ('draft_and_task', 'task_only', 'draft_only'));

ALTER TABLE public.autonomous_runner_rules DROP CONSTRAINT IF EXISTS chk_email_provider;
ALTER TABLE public.autonomous_runner_rules ADD CONSTRAINT chk_email_provider CHECK (email_provider IN ('system_default', 'zoho', 'brevo', 'sendgrid', 'resend', 'microsoft365'));

CREATE TABLE IF NOT EXISTS public.autonomous_runner_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    run_id UUID NULL REFERENCES public.autonomous_runner_runs(id) ON DELETE SET NULL,
    action_key TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
    reason TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autonomous_runner_approvals_tenant_status
    ON public.autonomous_runner_approvals (tenant_id, status, created_at DESC);

-- Enable RLS
ALTER TABLE public.autonomous_runner_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_runner_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_runner_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_runner_approvals ENABLE ROW LEVEL SECURITY;

-- Policies for Runner Runs
DROP POLICY IF EXISTS "Tenant users can read autonomous runner runs" ON public.autonomous_runner_runs;
CREATE POLICY "Tenant users can read autonomous runner runs" ON public.autonomous_runner_runs
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can create autonomous runner runs" ON public.autonomous_runner_runs;
CREATE POLICY "Tenant users can create autonomous runner runs" ON public.autonomous_runner_runs
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can update autonomous runner runs" ON public.autonomous_runner_runs;
CREATE POLICY "Tenant users can update autonomous runner runs" ON public.autonomous_runner_runs
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Policies for Runner Actions
DROP POLICY IF EXISTS "Tenant users can read autonomous runner actions" ON public.autonomous_runner_actions;
CREATE POLICY "Tenant users can read autonomous runner actions" ON public.autonomous_runner_actions
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can create autonomous runner actions" ON public.autonomous_runner_actions;
CREATE POLICY "Tenant users can create autonomous runner actions" ON public.autonomous_runner_actions
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

-- Policies for Runner Rules
DROP POLICY IF EXISTS "Tenant users can read autonomous runner rules" ON public.autonomous_runner_rules;
CREATE POLICY "Tenant users can read autonomous runner rules" ON public.autonomous_runner_rules
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can write autonomous runner rules" ON public.autonomous_runner_rules;
CREATE POLICY "Tenant admins can write autonomous runner rules" ON public.autonomous_runner_rules
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'admin', 'owner')));

-- Policies for Runner Approvals
DROP POLICY IF EXISTS "Tenant users can read autonomous runner approvals" ON public.autonomous_runner_approvals;
CREATE POLICY "Tenant users can read autonomous runner approvals" ON public.autonomous_runner_approvals
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can create autonomous runner approvals" ON public.autonomous_runner_approvals;
CREATE POLICY "Tenant users can create autonomous runner approvals" ON public.autonomous_runner_approvals
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can update autonomous runner approvals" ON public.autonomous_runner_approvals;
CREATE POLICY "Tenant admins can update autonomous runner approvals" ON public.autonomous_runner_approvals
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'admin', 'owner')));


-- ============================================================================
-- PART 3: BACK-OFFICE OPERATING SYSTEM MODULES
-- ============================================================================

-- 3.1. Extend contacts table for Onboarding Portal
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS client_portal_token UUID DEFAULT gen_random_uuid();
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'in_progress', 'completed'));
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill tokens
UPDATE public.contacts SET client_portal_token = gen_random_uuid() WHERE client_portal_token IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_portal_token ON public.contacts(client_portal_token);

-- 3.2. Client Onboarding Steps table
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

ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "Tenant users can view onboarding_steps" ON public.onboarding_steps
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can insert onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "Tenant users can insert onboarding_steps" ON public.onboarding_steps
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can update onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "Tenant users can update onboarding_steps" ON public.onboarding_steps
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can delete onboarding_steps" ON public.onboarding_steps;
CREATE POLICY "Tenant users can delete onboarding_steps" ON public.onboarding_steps
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_tenant ON public.onboarding_steps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_order ON public.onboarding_steps(tenant_id, step_order);

-- 3.3. Client Onboarding Submissions table
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

ALTER TABLE public.onboarding_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view onboarding_submissions" ON public.onboarding_submissions;
CREATE POLICY "Tenant users can view onboarding_submissions" ON public.onboarding_submissions
  FOR SELECT USING (contact_id IN (SELECT id FROM public.contacts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Tenant users can insert onboarding_submissions" ON public.onboarding_submissions;
CREATE POLICY "Tenant users can insert onboarding_submissions" ON public.onboarding_submissions
  FOR INSERT WITH CHECK (contact_id IN (SELECT id FROM public.contacts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Tenant users can update onboarding_submissions" ON public.onboarding_submissions;
CREATE POLICY "Tenant users can update onboarding_submissions" ON public.onboarding_submissions
  FOR UPDATE USING (contact_id IN (SELECT id FROM public.contacts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Tenant users can delete onboarding_submissions" ON public.onboarding_submissions;
CREATE POLICY "Tenant users can delete onboarding_submissions" ON public.onboarding_submissions
  FOR DELETE USING (contact_id IN (SELECT id FROM public.contacts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_contact ON public.onboarding_submissions(contact_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_step ON public.onboarding_submissions(step_id);

-- 3.4. Cash Flow Projections table
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

ALTER TABLE public.cash_flow_projections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view cash_flow_projections" ON public.cash_flow_projections;
CREATE POLICY "Tenant users can view cash_flow_projections" ON public.cash_flow_projections
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can insert cash_flow_projections" ON public.cash_flow_projections;
CREATE POLICY "Tenant users can insert cash_flow_projections" ON public.cash_flow_projections
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can delete cash_flow_projections" ON public.cash_flow_projections;
CREATE POLICY "Tenant users can delete cash_flow_projections" ON public.cash_flow_projections
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_cash_flow_tenant_date ON public.cash_flow_projections(tenant_id, forecast_date DESC);

-- 3.5. Document Vault table
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

ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view vault_documents" ON public.vault_documents;
CREATE POLICY "Tenant users can view vault_documents" ON public.vault_documents
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can insert vault_documents" ON public.vault_documents;
CREATE POLICY "Tenant users can insert vault_documents" ON public.vault_documents
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can update vault_documents" ON public.vault_documents;
CREATE POLICY "Tenant users can update vault_documents" ON public.vault_documents
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can delete vault_documents" ON public.vault_documents;
CREATE POLICY "Tenant users can delete vault_documents" ON public.vault_documents
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_vault_docs_tenant ON public.vault_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vault_docs_contact ON public.vault_documents(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vault_docs_category ON public.vault_documents(tenant_id, category);

-- 3.6. Tax Records table
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

ALTER TABLE public.tax_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view tax_records" ON public.tax_records;
CREATE POLICY "Tenant users can view tax_records" ON public.tax_records
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can insert tax_records" ON public.tax_records;
CREATE POLICY "Tenant users can insert tax_records" ON public.tax_records
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can update tax_records" ON public.tax_records;
CREATE POLICY "Tenant users can update tax_records" ON public.tax_records
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant users can delete tax_records" ON public.tax_records;
CREATE POLICY "Tenant users can delete tax_records" ON public.tax_records
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_tax_records_tenant ON public.tax_records(tenant_id, tax_year);

-- Triggers for updated_at tracking
DROP TRIGGER IF EXISTS update_onboarding_steps_updated_at ON public.onboarding_steps;
CREATE TRIGGER update_onboarding_steps_updated_at BEFORE UPDATE ON public.onboarding_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_onboarding_submissions_updated_at ON public.onboarding_submissions;
CREATE TRIGGER update_onboarding_submissions_updated_at BEFORE UPDATE ON public.onboarding_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vault_documents_updated_at ON public.vault_documents;
CREATE TRIGGER update_vault_documents_updated_at BEFORE UPDATE ON public.vault_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tax_records_updated_at ON public.tax_records;
CREATE TRIGGER update_tax_records_updated_at BEFORE UPDATE ON public.tax_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- PART 4: INVOICE INTELLIGENCE UPGRADES
-- ============================================================================

ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING','DELIVERED','BOUNCED','OPENED')),
  ADD COLUMN IF NOT EXISTS auto_followup_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disputed_reason TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE public.business_invoices DROP CONSTRAINT IF EXISTS business_invoices_status_check;
ALTER TABLE public.business_invoices ADD CONSTRAINT business_invoices_status_check
  CHECK (status IN ('draft','sent','viewed','partially_paid','paid','overdue','disputed','void','cancelled'));

-- Invoice Views Table
CREATE TABLE IF NOT EXISTS public.invoice_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.business_invoices(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    TEXT,
  user_agent    TEXT,
  source        TEXT DEFAULT 'page_load'
);

CREATE INDEX IF NOT EXISTS idx_invoice_views_invoice_id ON public.invoice_views(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_views_tenant_id ON public.invoice_views(tenant_id);

ALTER TABLE public.invoice_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_views_service_insert" ON public.invoice_views;
CREATE POLICY "invoice_views_service_insert" ON public.invoice_views FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "invoice_views_tenant_select" ON public.invoice_views;
CREATE POLICY "invoice_views_tenant_select" ON public.invoice_views FOR SELECT USING (tenant_id = (SELECT id FROM public.tenants WHERE id = tenant_id LIMIT 1));

-- Invoice Audit Log Table
CREATE TABLE IF NOT EXISTS public.invoice_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.business_invoices(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  event_type    TEXT NOT NULL,
  event_data    JSONB,
  performed_by  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_audit_invoice_id ON public.invoice_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_tenant_id ON public.invoice_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_event_type ON public.invoice_audit_log(event_type);

ALTER TABLE public.invoice_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_audit_log_service_insert" ON public.invoice_audit_log;
CREATE POLICY "invoice_audit_log_service_insert" ON public.invoice_audit_log FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "invoice_audit_log_tenant_select" ON public.invoice_audit_log;
CREATE POLICY "invoice_audit_log_tenant_select" ON public.invoice_audit_log FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

REVOKE UPDATE, DELETE ON public.invoice_audit_log FROM service_role;

-- Tax Rules Table
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL,
  tax_name     TEXT NOT NULL,
  rate         DECIMAL(5,2) NOT NULL,
  applies_to   TEXT NOT NULL DEFAULT 'all'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rules_country_type ON public.tax_rules(country_code, applies_to);

ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_rules_public_read" ON public.tax_rules;
CREATE POLICY "tax_rules_public_read" ON public.tax_rules FOR SELECT USING (true);

-- Seed Tax Rules
INSERT INTO public.tax_rules (country_code, tax_name, rate, applies_to) VALUES
  ('GB', 'VAT',        20.00, 'all'),
  ('DE', 'VAT',        19.00, 'all'),
  ('FR', 'VAT',        20.00, 'all'),
  ('NL', 'VAT',        21.00, 'all'),
  ('BE', 'VAT',        21.00, 'all'),
  ('ES', 'VAT',        21.00, 'all'),
  ('IT', 'VAT',        22.00, 'all'),
  ('PL', 'VAT',        23.00, 'all'),
  ('SE', 'VAT',        25.00, 'all'),
  ('DK', 'VAT',        25.00, 'all'),
  ('NO', 'VAT',        25.00, 'all'),
  ('AU', 'GST',        10.00, 'all'),
  ('NZ', 'GST',        15.00, 'all'),
  ('CA', 'GST',         5.00, 'all'),
  ('IN', 'GST',        18.00, 'services'),
  ('IN', 'GST',        12.00, 'products'),
  ('ZA', 'VAT',        15.00, 'all'),
  ('SG', 'GST',         9.00, 'all'),
  ('JP', 'Consumption', 10.00, 'all'),
  ('MX', 'IVA',        16.00, 'all'),
  ('BR', 'ICMS',       17.00, 'products'),
  ('AE', 'VAT',         5.00, 'all'),
  ('SA', 'VAT',        15.00, 'all'),
  ('US', 'Sales Tax',   0.00, 'all'),
  ('KE', 'VAT',        16.00, 'all')
ON CONFLICT (country_code, applies_to) DO NOTHING;

-- Invoice Delivery Log Table
CREATE TABLE IF NOT EXISTS public.invoice_delivery_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.business_invoices(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_to_email   TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING','DELIVERED','BOUNCED','OPENED')),
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  bounced_at      TIMESTAMPTZ,
  bounce_reason   TEXT,
  email_provider  TEXT,
  provider_msg_id TEXT,
  raw_webhook     JSONB
);

CREATE INDEX IF NOT EXISTS idx_invoice_delivery_invoice_id ON public.invoice_delivery_log(invoice_id);

ALTER TABLE public.invoice_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_delivery_service_insert" ON public.invoice_delivery_log;
CREATE POLICY "invoice_delivery_service_insert" ON public.invoice_delivery_log FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "invoice_delivery_service_update" ON public.invoice_delivery_log;
CREATE POLICY "invoice_delivery_service_update" ON public.invoice_delivery_log FOR UPDATE TO service_role USING (true);

DROP POLICY IF EXISTS "invoice_delivery_tenant_select" ON public.invoice_delivery_log;
CREATE POLICY "invoice_delivery_tenant_select" ON public.invoice_delivery_log FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));


-- ============================================================================
-- PART 5: WHATSAPP MESSAGING INFRASTRUCTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES public.whatsapp_integrations(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    client_id UUID,
    chat_id TEXT,
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT NOT NULL DEFAULT 'text',
    body TEXT NOT NULL DEFAULT '',
    media JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider TEXT NOT NULL DEFAULT 'green-api',
    provider_message_id TEXT,
    provider_receipt_id TEXT,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'received')),
    sent_by TEXT NOT NULL DEFAULT 'unknown' CHECK (sent_by IN ('contact', 'human', 'api', 'bot', 'phone', 'unknown')),
    needs_response BOOLEAN NOT NULL DEFAULT false,
    auto_replied BOOLEAN NOT NULL DEFAULT false,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider_message_id)
);

ALTER TABLE public.whatsapp_outreach_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.whatsapp_outreach_logs ALTER COLUMN lead_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant_created ON public.whatsapp_messages (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_thread ON public.whatsapp_messages (tenant_id, phone_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact ON public.whatsapp_messages (contact_id, created_at DESC) WHERE contact_id IS NOT NULL;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_whatsapp_messages_read" ON public.whatsapp_messages;
CREATE POLICY "tenant_whatsapp_messages_read" ON public.whatsapp_messages FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "tenant_whatsapp_messages_manage" ON public.whatsapp_messages;
CREATE POLICY "tenant_whatsapp_messages_manage" ON public.whatsapp_messages FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())) WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO service_role;

DROP TRIGGER IF EXISTS trg_whatsapp_messages_updated_at ON public.whatsapp_messages;
CREATE TRIGGER trg_whatsapp_messages_updated_at BEFORE UPDATE ON public.whatsapp_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- PART 6: WORKSPACE FILES & SOCIAL POSTS REPAIR
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_files (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id            UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by        UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  anthropic_file_id  TEXT NULL,
  filename           TEXT NOT NULL,
  file_name          TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  file_type          TEXT NOT NULL,
  file_size          BIGINT NOT NULL DEFAULT 0,
  storage_url        TEXT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.workspace_files;
CREATE POLICY tenant_isolation ON public.workspace_files FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);

CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content       TEXT,
  platform      VARCHAR(255),
  scheduled_at  TIMESTAMPTZ,
  status        VARCHAR(50) DEFAULT 'pending',
  asset_id      UUID NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.scheduled_posts;
CREATE POLICY tenant_isolation ON public.scheduled_posts FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);


-- ============================================================================
-- PART 7: PROJECT & CRM INTELLIGENCE FOUNDATION
-- ============================================================================

-- Project extensions
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS budget_total       DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS budget_used        DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS velocity_score     DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS health_score       INT CHECK (health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS portal_token       UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS portal_enabled     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_completion_date DATE,
  ADD COLUMN IF NOT EXISTS auto_invoice_enabled BOOLEAN DEFAULT false;

-- Task extensions
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS depends_on        UUID[],
  ADD COLUMN IF NOT EXISTS estimated_hours   DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS actual_hours      DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_rate       DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS phase             TEXT,
  ADD COLUMN IF NOT EXISTS start_date        DATE,
  ADD COLUMN IF NOT EXISTS blocked_reason    TEXT;

-- Project Time Logs
CREATE TABLE IF NOT EXISTS project_time_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  logged_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  hours       DECIMAL(6,2) NOT NULL CHECK (hours > 0),
  logged_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_logs_project ON project_time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_task ON project_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_tenant ON project_time_logs(tenant_id);

ALTER TABLE project_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage time logs" ON project_time_logs;
CREATE POLICY "Tenant members can manage time logs" ON project_time_logs FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Project Comments
CREATE TABLE IF NOT EXISTS project_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  author_email TEXT,
  content      TEXT NOT NULL,
  is_client    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_tenant ON project_comments(tenant_id);

ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view project comments" ON project_comments;
CREATE POLICY "Tenant members can view project comments" ON project_comments FOR SELECT TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can submit project comments" ON project_comments;
CREATE POLICY "Anyone can submit project comments" ON project_comments FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Project Snapshots
CREATE TABLE IF NOT EXISTS project_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks_total     INT NOT NULL DEFAULT 0,
  tasks_complete  INT NOT NULL DEFAULT 0,
  budget_used     DECIMAL(12,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project ON project_snapshots(project_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_tenant ON project_snapshots(tenant_id);

ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view project snapshots" ON project_snapshots;
CREATE POLICY "Tenant members can view project snapshots" ON project_snapshots FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_portal_token ON projects(portal_token) WHERE portal_token IS NOT NULL;

-- CRM Contacts extensions
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS health_score       INT CHECK (health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS lead_score         INT CHECK (lead_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS health_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contacted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_rate      DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_value     DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_source    TEXT,
  ADD COLUMN IF NOT EXISTS referred_by        UUID REFERENCES crm_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_health_score ON crm_contacts(health_score) WHERE health_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_lead_score ON crm_contacts(lead_score) WHERE lead_score IS NOT NULL;

-- Contact Interactions
CREATE TABLE IF NOT EXISTS contact_interactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('email', 'whatsapp', 'call', 'meeting', 'note', 'invoice', 'contract', 'deal', 'portal_comment')),
  direction   TEXT CHECK (direction IN ('inbound', 'outbound', 'internal')),
  summary     TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_interactions_contact ON contact_interactions(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_tenant ON contact_interactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON contact_interactions(type);

ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage contact interactions" ON contact_interactions;
CREATE POLICY "Tenant members can manage contact interactions" ON contact_interactions FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Strike Intel Log
CREATE TABLE IF NOT EXISTS strike_intel_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id        UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  reason            TEXT,
  angle             TEXT,
  suggested_message TEXT,
  best_channel      TEXT,
  best_time         TEXT,
  generated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strike_intel_contact ON strike_intel_log(contact_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_strike_intel_tenant ON strike_intel_log(tenant_id);

ALTER TABLE strike_intel_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view strike intel" ON strike_intel_log;
CREATE POLICY "Tenant members can view strike intel" ON strike_intel_log FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Follow-Up Queue
CREATE TABLE IF NOT EXISTS follow_up_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  reason          TEXT,
  priority_score  DECIMAL(8,2) DEFAULT 0,
  action_type     TEXT CHECK (action_type IN ('call', 'email', 'whatsapp', 'review_deal', 'send_invoice', 'check_in')),
  snoozed_until   TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  queue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_tenant_date ON follow_up_queue(tenant_id, queue_date, completed_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follow_up_contact ON follow_up_queue(contact_id);

ALTER TABLE follow_up_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage follow-up queue" ON follow_up_queue;
CREATE POLICY "Tenant members can manage follow-up queue" ON follow_up_queue FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Lead Score History
CREATE TABLE IF NOT EXISTS lead_score_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  score         INT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_lead_score_history_lead ON lead_score_history(lead_id, snapshot_date DESC);

ALTER TABLE lead_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view lead score history" ON lead_score_history;
CREATE POLICY "Tenant members can view lead score history" ON lead_score_history FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Cross Module Triggers
CREATE TABLE IF NOT EXISTS cross_module_triggers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_module   TEXT NOT NULL CHECK (trigger_module IN ('contracts', 'invoices', 'projects', 'crm', 'deals')),
  trigger_event    TEXT NOT NULL CHECK (trigger_event IN ('signed', 'paid', 'completed', 'overdue', 'created', 'stage_changed', 'viewed')),
  action_module    TEXT NOT NULL,
  action_type      TEXT NOT NULL,
  action_config    JSONB DEFAULT '{}',
  enabled          BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_tenant ON cross_module_triggers(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_triggers_event ON cross_module_triggers(trigger_module, trigger_event, enabled);

ALTER TABLE cross_module_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage triggers" ON cross_module_triggers;
CREATE POLICY "Tenant members can manage triggers" ON cross_module_triggers FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Cross Module Trigger Log
CREATE TABLE IF NOT EXISTS cross_module_trigger_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_id  UUID REFERENCES cross_module_triggers(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  success     BOOLEAN NOT NULL DEFAULT true,
  error       TEXT,
  context     JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_trigger_log_tenant ON cross_module_trigger_log(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_log_trigger ON cross_module_trigger_log(trigger_id, executed_at DESC);

ALTER TABLE cross_module_trigger_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view trigger log" ON cross_module_trigger_log;
CREATE POLICY "Tenant members can view trigger log" ON cross_module_trigger_log FOR SELECT TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Business Score Snapshots
CREATE TABLE IF NOT EXISTS business_score_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  total_score        INT NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  revenue_score      INT NOT NULL CHECK (revenue_score BETWEEN 0 AND 25),
  pipeline_score     INT NOT NULL CHECK (pipeline_score BETWEEN 0 AND 25),
  delivery_score     INT NOT NULL CHECK (delivery_score BETWEEN 0 AND 25),
  relationship_score INT NOT NULL CHECK (relationship_score BETWEEN 0 AND 25),
  ai_explanation     TEXT,
  snapshot_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_biz_score_tenant ON business_score_snapshots(tenant_id, snapshot_date DESC);

ALTER TABLE business_score_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view business scores" ON business_score_snapshots;
CREATE POLICY "Tenant members can view business scores" ON business_score_snapshots FOR SELECT TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Daily Briefs
CREATE TABLE IF NOT EXISTS daily_briefs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brief_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  content      JSONB NOT NULL DEFAULT '{}',
  delivered_at TIMESTAMPTZ,
  opened_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, brief_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_tenant ON daily_briefs(tenant_id, brief_date DESC);

ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view daily briefs" ON daily_briefs;
CREATE POLICY "Tenant members can view daily briefs" ON daily_briefs FOR ALL TO authenticated USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Extend tenants table
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS brief_delivery_time TEXT DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS timezone            TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS revenue_goal        DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS quiet_hours_start   INT CHECK (quiet_hours_start BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS quiet_hours_end     INT CHECK (quiet_hours_end BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS momentum_target     INT DEFAULT 70;

-- Trigger Templates
CREATE TABLE IF NOT EXISTS system_trigger_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_module TEXT NOT NULL,
  trigger_event  TEXT NOT NULL,
  action_module  TEXT NOT NULL,
  action_type    TEXT NOT NULL,
  action_config  JSONB DEFAULT '{}',
  label          TEXT NOT NULL,
  description    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_trigger_templates (trigger_module, trigger_event, action_module, action_type, action_config, label, description)
VALUES
  ('contracts', 'signed', 'projects', 'create_project', '{"auto_name": true}', 'Contract Signed → Create Project', 'When a contract is signed, automatically create a new project linked to the client'),
  ('contracts', 'signed', 'invoices', 'create_draft_invoice', '{"auto_populate": true}', 'Contract Signed → Draft Invoice', 'When a contract is signed, create a draft invoice for the first payment'),
  ('contracts', 'signed', 'crm', 'log_interaction', '{"type": "contract", "summary": "Contract signed"}', 'Contract Signed → Log CRM Interaction', 'When a contract is signed, log it as a CRM interaction'),
  ('invoices', 'paid', 'crm', 'update_deal_won', '{}', 'Invoice Paid → Close Deal Won', 'When an invoice is paid, mark the associated deal as Closed Won'),
  ('invoices', 'paid', 'crm', 'log_interaction', '{"type": "invoice", "summary": "Invoice paid"}', 'Invoice Paid → Log CRM Interaction', 'When an invoice is paid, log it in the contact timeline'),
  ('invoices', 'overdue', 'crm', 'add_to_follow_up', '{"priority": "high"}', 'Invoice Overdue → Add to Follow-Up Queue', 'When an invoice goes overdue, add the client to the high-priority follow-up queue'),
  ('projects', 'completed', 'invoices', 'create_final_invoice', '{}', 'Project Complete → Final Invoice', 'When all tasks are done, create the final invoice draft'),
  ('projects', 'completed', 'contracts', 'mark_completed', '{}', 'Project Complete → Close Contract', 'When a project completes, update the linked contract to COMPLETED status'),
  ('crm', 'created', 'crm', 'calculate_lead_score', '{}', 'Lead Created → Score Lead', 'When a lead is created, automatically calculate their lead score'),
  ('deals', 'stage_changed', 'crm', 'update_health_score', '{}', 'Deal Stage Changed → Update Health Score', 'When a deal moves stage, recalculate the contact relationship health score')
ON CONFLICT DO NOTHING;

-- Documents Master Table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT,
  name TEXT NOT NULL DEFAULT 'Untitled Document',
  description TEXT,
  document_type TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  owner_user_id UUID,
  uploaded_by UUID,
  mime_type TEXT DEFAULT 'application/octet-stream',
  size_bytes BIGINT,
  storage_path TEXT,
  expiry_date DATE,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_updated
  ON public.documents (tenant_id, updated_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage documents" ON public.documents;
CREATE POLICY "Tenant members can manage documents" ON public.documents
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Document Relationships
CREATE TABLE IF NOT EXISTS public.document_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'attachment',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_relationships_entity
  ON public.document_relationships (tenant_id, entity_type, entity_id);

ALTER TABLE public.document_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can manage document relationships" ON public.document_relationships;
CREATE POLICY "Tenant members can manage document relationships" ON public.document_relationships
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- Document Activity Log
CREATE TABLE IF NOT EXISTS public.document_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_activity_doc
  ON public.document_activity (document_id, created_at DESC);

ALTER TABLE public.document_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view document activity" ON public.document_activity;
CREATE POLICY "Tenant members can view document activity" ON public.document_activity
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

COMMIT;
