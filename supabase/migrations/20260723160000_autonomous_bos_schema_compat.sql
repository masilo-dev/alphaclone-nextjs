-- Autonomous Business OS — schema compatibility + observability
-- Safe to re-run. Prefer mapping to existing tables; add only columns/tables required by MCP/workflows.
-- Rollback: see docs/AUTONOMOUS_BOS_REPAIR_REPORT.md

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) leads — columns expected by MCP CRM tools and automation runtime
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_updated_at
  ON public.leads (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_status
  ON public.leads (tenant_id, status)
  WHERE deleted_at IS NULL;

-- Keep updated_at fresh on write
CREATE OR REPLACE FUNCTION public.touch_leads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_touch_updated_at ON public.leads;
CREATE TRIGGER trg_leads_touch_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_leads_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) social_posts — compatibility columns (canonical: platforms[], caption, analytics)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement NUMERIC DEFAULT 0;

-- Backfill singular platform / content from canonical columns when empty
UPDATE public.social_posts
SET platform = COALESCE(
  platform,
  CASE
    WHEN platforms IS NOT NULL AND array_length(platforms, 1) >= 1 THEN platforms[1]
    ELSE NULL
  END
)
WHERE platform IS NULL;

UPDATE public.social_posts
SET content = COALESCE(content, caption)
WHERE content IS NULL AND caption IS NOT NULL;

UPDATE public.social_posts
SET created_by = COALESCE(created_by, user_id)
WHERE created_by IS NULL AND user_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) invoices / business_invoices — revenue report compatibility
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS total NUMERIC,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due NUMERIC,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC;

-- Mirror amount → total when total is null
UPDATE public.invoices
SET total = COALESCE(total, amount)
WHERE total IS NULL AND amount IS NOT NULL;

UPDATE public.invoices
SET amount_due = COALESCE(amount_due, GREATEST(COALESCE(total, amount, 0) - COALESCE(amount_paid, 0), 0)),
    balance_due = COALESCE(balance_due, GREATEST(COALESCE(total, amount, 0) - COALESCE(amount_paid, 0), 0));

ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supplier_legal_name TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS client_address TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS document_version TEXT DEFAULT '1.0';

UPDATE public.business_invoices
SET balance_due = CASE
  WHEN lower(COALESCE(status, '')) = 'paid' THEN 0
  ELSE GREATEST(COALESCE(total, 0) - COALESCE(amount_paid, 0), 0)
END
WHERE balance_due IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) Compatibility views for missing logical tables (map → existing)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.subscriptions AS
SELECT
  id,
  tenant_id,
  status,
  tier_name AS plan,
  stripe_subscription_id,
  stripe_customer_id,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  cancelled_at,
  base_price_cents,
  final_price_cents,
  created_at,
  updated_at
FROM public.tenant_subscriptions;

CREATE OR REPLACE VIEW public.campaigns AS
SELECT
  id,
  tenant_id,
  name,
  subject,
  status,
  'email'::text AS type,
  total_sent AS sent_count,
  total_opened AS open_count,
  total_clicked AS click_count,
  jsonb_build_object(
    'total_recipients', total_recipients,
    'total_sent', total_sent,
    'total_delivered', total_delivered,
    'total_opened', total_opened,
    'total_clicked', total_clicked,
    'total_bounced', total_bounced
  ) AS metrics,
  jsonb_build_object(
    'total_sent', total_sent,
    'total_opened', total_opened,
    'total_clicked', total_clicked
  ) AS stats,
  scheduled_at,
  sent_at,
  created_at,
  updated_at
FROM public.email_campaigns;

CREATE OR REPLACE VIEW public.appointments AS
SELECT
  id,
  tenant_id,
  title,
  description,
  start_time AS start_at,
  end_time AS end_at,
  location,
  attendees,
  type,
  metadata,
  created_at,
  updated_at
FROM public.calendar_events
WHERE COALESCE(type, '') IN ('appointment', 'meeting', 'booking', '')
   OR type IS NULL;

-- Tenant-scoped documents store (canonical for MCP document tools)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT,
  name TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/octet-stream',
  storage_path TEXT,
  size_bytes BIGINT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  document_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant_updated
  ON public.documents (tenant_id, updated_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_tenant_select ON public.documents;
CREATE POLICY documents_tenant_select ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = documents.tenant_id AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS documents_tenant_write ON public.documents;
CREATE POLICY documents_tenant_write ON public.documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = documents.tenant_id AND tu.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = documents.tenant_id AND tu.user_id = auth.uid()
    )
  );

-- Prefer a tenant-scoped version table that does not collide with legacy document_versions
CREATE TABLE IF NOT EXISTS public.tenant_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT,
  storage_path TEXT,
  checksum TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

ALTER TABLE public.tenant_document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_document_versions_tenant_all ON public.tenant_document_versions;
CREATE POLICY tenant_document_versions_tenant_all ON public.tenant_document_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_document_versions.tenant_id AND tu.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_document_versions.tenant_id AND tu.user_id = auth.uid()
    )
  );

-- Lightweight funnels / landing_pages for marketing tools (optional empty tables)
CREATE TABLE IF NOT EXISTS public.funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  stages JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS funnels_tenant_all ON public.funnels;
CREATE POLICY funnels_tenant_all ON public.funnels
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = funnels.tenant_id AND tu.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = funnels.tenant_id AND tu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS landing_pages_tenant_all ON public.landing_pages;
CREATE POLICY landing_pages_tenant_all ON public.landing_pages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = landing_pages.tenant_id AND tu.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = landing_pages.tenant_id AND tu.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) Workflow step evidence + normalized statuses
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.automation_run_steps
  ADD COLUMN IF NOT EXISTS input JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sanitized_output JSONB,
  ADD COLUMN IF NOT EXISTS approval_id UUID,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS verification_evidence JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Alias finished_at → completed_at when present
UPDATE public.automation_run_steps
SET completed_at = COALESCE(completed_at, finished_at)
WHERE completed_at IS NULL AND finished_at IS NOT NULL;

ALTER TABLE public.automation_approvals
  ADD COLUMN IF NOT EXISTS action_summary TEXT,
  ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approve_tool TEXT DEFAULT 'approve_workflow_step',
  ADD COLUMN IF NOT EXISTS reject_tool TEXT DEFAULT 'reject_workflow_step',
  ADD COLUMN IF NOT EXISTS client_portable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

-- Normalize legacy approval_required → awaiting_approval
UPDATE public.automation_runs
SET status = 'awaiting_approval'
WHERE status = 'approval_required';

UPDATE public.automation_run_steps
SET status = 'awaiting_approval'
WHERE status = 'approval_required';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6) Queue recovery — DLQ, backoff, reclaim stuck processing
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.mcp_event_queue
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS result JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_event_queue_tenant_idempotency
  ON public.mcp_event_queue (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_event_queue_processing_locked
  ON public.mcp_event_queue (status, locked_at)
  WHERE status = 'processing';

CREATE OR REPLACE FUNCTION public.reclaim_stuck_mcp_queue(p_stale_minutes integer DEFAULT 15)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.mcp_event_queue
  SET
    status = 'pending',
    locked_at = NULL,
    locked_by = NULL,
    available_at = now(),
    updated_at = now(),
    last_error = COALESCE(last_error, 'reclaimed_stuck_processing')
  WHERE status = 'processing'
    AND COALESCE(locked_at, updated_at, created_at) < now() - make_interval(mins => p_stale_minutes);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reclaim_stuck_mcp_queue(integer) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7) Action receipts + operational audit layer
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.mcp_action_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  correlation_id UUID,
  idempotency_key TEXT,
  tool TEXT NOT NULL,
  action_id UUID NOT NULL DEFAULT gen_random_uuid(),
  entity_id TEXT,
  entity_type TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  final_status TEXT NOT NULL,
  provider TEXT,
  provider_reference TEXT,
  live_url TEXT,
  verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  rollback_available BOOLEAN NOT NULL DEFAULT false,
  retry_available BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  error_message TEXT,
  sanitized_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  sanitized_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_action_receipts_idempotency
  ON public.mcp_action_receipts (tenant_id, tool, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_action_receipts_tenant_created
  ON public.mcp_action_receipts (tenant_id, created_at DESC);

ALTER TABLE public.mcp_action_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcp_action_receipts_tenant_select ON public.mcp_action_receipts;
CREATE POLICY mcp_action_receipts_tenant_select ON public.mcp_action_receipts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = mcp_action_receipts.tenant_id AND tu.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 8) Tenant memory embeddings
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'vector extension unavailable: %', SQLERRM;
END $$;

CREATE TABLE IF NOT EXISTS public.tenant_memory_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  scope TEXT NOT NULL DEFAULT 'general',
  scope_id TEXT,
  content TEXT NOT NULL,
  embedding JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prefer pgvector column when extension is present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    BEGIN
      ALTER TABLE public.tenant_memory_embeddings
        ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'embedding_vector column skipped: %', SQLERRM;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_memory_embeddings_tenant_scope
  ON public.tenant_memory_embeddings (tenant_id, scope, created_at DESC);

ALTER TABLE public.tenant_memory_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_memory_embeddings_tenant_all ON public.tenant_memory_embeddings;
CREATE POLICY tenant_memory_embeddings_tenant_all ON public.tenant_memory_embeddings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_memory_embeddings.tenant_id AND tu.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_memory_embeddings.tenant_id AND tu.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 9) Model router evidence (provider-neutral)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.model_execution_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  correlation_id UUID,
  workflow_id UUID,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT,
  latency_ms INTEGER,
  token_usage JSONB DEFAULT '{}'::jsonb,
  estimated_cost NUMERIC,
  fallback_reason TEXT,
  output_validation JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_execution_evidence_tenant
  ON public.model_execution_evidence (tenant_id, created_at DESC);

ALTER TABLE public.model_execution_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS model_execution_evidence_tenant_select ON public.model_execution_evidence;
CREATE POLICY model_execution_evidence_tenant_select ON public.model_execution_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = model_execution_evidence.tenant_id AND tu.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 10) mcp_sessions — never allow null tool_name on tool executions
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mcp_sessions'
  ) THEN
    ALTER TABLE public.mcp_sessions
      ALTER COLUMN tool_name SET DEFAULT '_connection';
    UPDATE public.mcp_sessions
    SET tool_name = '_connection'
    WHERE tool_name IS NULL;
  END IF;
END $$;
