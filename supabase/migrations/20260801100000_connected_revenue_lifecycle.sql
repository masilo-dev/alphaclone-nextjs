-- Connected revenue lifecycle: Lead -> Outreach -> Deal -> Contract -> Invoice -> Payment -> Project
-- Additive only. Existing module tables and data remain canonical and intact.
BEGIN;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS current_version_id UUID,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_risk_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS risk_findings JSONB NOT NULL DEFAULT '[]'::JSONB;

CREATE INDEX IF NOT EXISTS idx_contracts_lifecycle
  ON public.contracts (tenant_id, lifecycle_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  body TEXT NOT NULL,
  fallback_body TEXT,
  jurisdiction TEXT,
  language_code TEXT NOT NULL DEFAULT 'en',
  version_number INTEGER NOT NULL DEFAULT 1 CHECK (version_number > 0),
  approval_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft','pending','approved','rejected','retired')),
  risk_level TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low','moderate','high','critical')),
  variables JSONB NOT NULL DEFAULT '[]'::JSONB,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, title, version_number)
);

CREATE TABLE IF NOT EXISTS public.contract_clause_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  contract_version_id UUID REFERENCES public.contract_versions(id) ON DELETE CASCADE,
  clause_id UUID NOT NULL REFERENCES public.contract_clauses(id) ON DELETE RESTRICT,
  position INTEGER,
  rendered_body TEXT NOT NULL,
  modified_from_approved BOOLEAN NOT NULL DEFAULT FALSE,
  modification_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_version_id, clause_id)
);

CREATE TABLE IF NOT EXISTS public.contract_negotiation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  contract_version_id UUID REFERENCES public.contract_versions(id) ON DELETE SET NULL,
  clause_id UUID REFERENCES public.contract_clauses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','accepted','rejected','withdrawn')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contract_negotiation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.contract_negotiation_threads(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email TEXT,
  author_role TEXT NOT NULL DEFAULT 'internal'
    CHECK (author_role IN ('internal','client','legal','bonnie')),
  body TEXT NOT NULL,
  proposed_text TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contract_signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  party_id UUID REFERENCES public.contract_parties(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('requested','delivered','viewed','authenticated','signed','declined','expired','revoked')),
  signer_email TEXT,
  signing_order INTEGER,
  provider TEXT,
  provider_event_id TEXT,
  ip_address INET,
  user_agent TEXT,
  document_hash TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.contract_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'user',
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS intelligence_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS latest_version_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duplicate_of_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS summary TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_content_hash
  ON public.documents (tenant_id, content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_intelligence
  ON public.documents (tenant_id, intelligence_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  storage_path TEXT,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  content_hash TEXT,
  extracted_text TEXT,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_number)
);

-- Production may already have the legacy document_versions table. Bring it
-- forward without replacing rows or relying on CREATE TABLE IF NOT EXISTS to
-- add the canonical columns.
ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS version_number INTEGER,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS change_summary TEXT;

UPDATE public.document_versions versions
SET tenant_id = documents.tenant_id,
    version_number = COALESCE(versions.version_number, versions.version)
FROM public.documents documents
WHERE documents.id = versions.document_id
  AND (versions.tenant_id IS NULL OR versions.version_number IS NULL);

ALTER TABLE public.document_versions
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN version_number SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.document_intelligence_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  document_version_id UUID REFERENCES public.document_versions(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL
    CHECK (job_type IN ('ocr','extract','classify','summarize','compare','validate','obligations')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','failed','retry_scheduled','cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  provider TEXT,
  error TEXT,
  input JSONB NOT NULL DEFAULT '{}'::JSONB,
  output JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.document_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  document_version_id UUID REFERENCES public.document_versions(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL,
  label TEXT NOT NULL,
  value JSONB NOT NULL,
  page_number INTEGER,
  bounding_box JSONB,
  confidence NUMERIC(5,4),
  source_excerpt TEXT,
  requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.document_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  left_version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  right_version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  summary TEXT,
  additions JSONB NOT NULL DEFAULT '[]'::JSONB,
  removals JSONB NOT NULL DEFAULT '[]'::JSONB,
  changes JSONB NOT NULL DEFAULT '[]'::JSONB,
  risk_findings JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.document_data_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','expired','revoked')),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.document_data_room_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data_room_id UUID NOT NULL REFERENCES public.document_data_rooms(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  allow_download BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (data_room_id, document_id)
);

DO $$
BEGIN
  IF to_regclass('public.business_invoices') IS NOT NULL THEN
    ALTER TABLE public.business_invoices
      ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
      ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS payment_link_verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS delivery_verified_at TIMESTAMPTZ;
    ALTER TABLE public.business_invoices
      DROP CONSTRAINT IF EXISTS business_invoices_lifecycle_status_check;
    ALTER TABLE public.business_invoices
      DROP CONSTRAINT IF EXISTS business_invoices_status_check;
    ALTER TABLE public.business_invoices
      ADD CONSTRAINT business_invoices_status_check CHECK (
        status IN ('draft','pending_approval','approved','scheduled','issued','sent','viewed','partially_paid','paid','overdue','disputed','void','voided','written_off','archived','cancelled')
      ) NOT VALID;
    ALTER TABLE public.business_invoices VALIDATE CONSTRAINT business_invoices_status_check;
    ALTER TABLE public.business_invoices
      ADD CONSTRAINT business_invoices_lifecycle_status_check CHECK (
        lifecycle_status IN ('draft','pending_approval','approved','scheduled','issued','sent','viewed','partially_paid','paid','overdue','disputed','void','voided','written_off','archived','cancelled')
      ) NOT VALID;
    ALTER TABLE public.business_invoices VALIDATE CONSTRAINT business_invoices_lifecycle_status_check;
  END IF;
  IF to_regclass('public.invoices') IS NOT NULL THEN
    ALTER TABLE public.invoices
      ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
      ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS payment_link_verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS delivery_verified_at TIMESTAMPTZ;
    ALTER TABLE public.invoices
      DROP CONSTRAINT IF EXISTS invoices_lifecycle_status_check;
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_lifecycle_status_check CHECK (
        lifecycle_status IN ('draft','pending_approval','approved','scheduled','issued','sent','viewed','partially_paid','paid','overdue','disputed','void','voided','written_off','archived','cancelled')
      ) NOT VALID;
    ALTER TABLE public.invoices VALIDATE CONSTRAINT invoices_lifecycle_status_check;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.invoice_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  contract_milestone_id UUID REFERENCES public.contract_milestones(id) ON DELETE SET NULL,
  sequence_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  currency_code TEXT NOT NULL DEFAULT 'USD',
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','due','partially_paid','paid','overdue','waived','cancelled')),
  amount_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, invoice_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS public.invoice_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('credit_note','discount','write_off','refund','fee')),
  amount NUMERIC(18,2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','applied','voided')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','investigating','awaiting_customer','resolved','rejected','written_off')),
  reason TEXT NOT NULL,
  disputed_amount NUMERIC(18,2),
  resolution TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'user',
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outreach_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  normalized_recipient TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, channel, normalized_recipient)
);

CREATE TABLE IF NOT EXISTS public.outreach_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','active','paused','completed','archived')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  frequency_cap JSONB NOT NULL DEFAULT '{"max_per_7_days":3}'::JSONB,
  quiet_hours JSONB NOT NULL DEFAULT '{}'::JSONB,
  stop_on_reply BOOLEAN NOT NULL DEFAULT TRUE,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outreach_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','linkedin','sms','whatsapp','call','task')),
  delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  condition JSONB NOT NULL DEFAULT '{}'::JSONB,
  template JSONB NOT NULL DEFAULT '{}'::JSONB,
  variant_group TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sequence_id, step_order)
);

CREATE TABLE IF NOT EXISTS public.outreach_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID,
  sequence_id UUID REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hypothesis TEXT,
  metric TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','completed','stopped')),
  variants JSONB NOT NULL,
  winner_variant TEXT,
  results JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outreach_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID,
  sequence_id UUID REFERENCES public.outreach_sequences(id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.outreach_sequence_steps(id) ON DELETE SET NULL,
  contact_id UUID,
  lead_id UUID,
  deal_id UUID,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider TEXT,
  provider_event_id TEXT,
  variant TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (tenant_id, provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.revenue_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID,
  outreach_event_id UUID REFERENCES public.outreach_events(id) ON DELETE SET NULL,
  contact_id UUID,
  lead_id UUID,
  deal_id UUID,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  invoice_id UUID,
  project_id UUID,
  attribution_model TEXT NOT NULL DEFAULT 'multi_touch',
  attributed_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  weight NUMERIC(8,6) NOT NULL DEFAULT 1,
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.revenue_lifecycle_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  relationship TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, source_type, source_id, target_type, target_id, relationship)
);

CREATE INDEX IF NOT EXISTS idx_contract_clause_usage_contract ON public.contract_clause_usages (tenant_id, contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_negotiations_contract ON public.contract_negotiation_threads (tenant_id, contract_id, status);
CREATE INDEX IF NOT EXISTS idx_contract_signature_events ON public.contract_signature_events (tenant_id, contract_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_lifecycle_events ON public.contract_lifecycle_events (tenant_id, contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_document ON public.document_versions (tenant_id, document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_jobs_queue ON public.document_intelligence_jobs (status, next_retry_at, created_at) WHERE status IN ('queued','retry_scheduled');
CREATE INDEX IF NOT EXISTS idx_document_findings_document ON public.document_findings (tenant_id, document_id, finding_type);
CREATE INDEX IF NOT EXISTS idx_invoice_schedules_due ON public.invoice_payment_schedules (tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_disputes_status ON public.invoice_disputes (tenant_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_sequence_steps ON public.outreach_sequence_steps (tenant_id, sequence_id, step_order);
CREATE INDEX IF NOT EXISTS idx_outreach_events_contact ON public.outreach_events (tenant_id, contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_events_campaign ON public.outreach_events (tenant_id, campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_attribution_deal ON public.revenue_attribution (tenant_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_revenue_lifecycle_source ON public.revenue_lifecycle_links (tenant_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_revenue_lifecycle_target ON public.revenue_lifecycle_links (tenant_id, target_type, target_id);

DO $rls$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'contract_clauses','contract_clause_usages','contract_negotiation_threads',
    'contract_negotiation_messages','contract_signature_events','contract_lifecycle_events',
    'document_versions','document_intelligence_jobs','document_findings','document_comparisons',
    'document_data_rooms','document_data_room_items','invoice_payment_schedules',
    'invoice_adjustments','invoice_disputes','invoice_lifecycle_events','outreach_suppressions',
    'outreach_sequences','outreach_sequence_steps','outreach_experiments','outreach_events',
    'revenue_attribution','revenue_lifecycle_links'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_tenant_access', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING
       (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = (SELECT auth.uid())))
       WITH CHECK
       (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = (SELECT auth.uid())))',
      table_name || '_tenant_access', table_name, table_name, table_name
    );
  END LOOP;
END $rls$;

COMMIT;
