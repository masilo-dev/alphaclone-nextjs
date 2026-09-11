-- Outcome-based email usage metrics + delivery audit trail (additive only)

ALTER TABLE IF EXISTS public.quota_usage
  ADD COLUMN IF NOT EXISTS emails_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_replies integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_transactional integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.tenant_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NULL,
  operation_id text NULL,
  initiation_source text NOT NULL,
  business_action text NOT NULL,
  provider text NULL,
  success boolean NOT NULL DEFAULT false,
  quota_charged boolean NOT NULL DEFAULT false,
  quota_reason text NULL,
  failure_fingerprint text NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  workflow_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_usage_events_tenant_created_idx
  ON public.tenant_usage_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tenant_usage_events_operation_idx
  ON public.tenant_usage_events (tenant_id, operation_id)
  WHERE operation_id IS NOT NULL;

ALTER TABLE public.tenant_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_usage_events_service_role ON public.tenant_usage_events;
CREATE POLICY tenant_usage_events_service_role ON public.tenant_usage_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.email_delivery_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NULL,
  category text NOT NULL,
  initiation_source text NOT NULL,
  recipient_hash text NOT NULL,
  subject_preview text NULL,
  status text NOT NULL,
  provider text NULL,
  template_version text NULL,
  branding_version text NULL,
  error_code text NULL,
  idempotency_key text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_delivery_audit_tenant_created_idx
  ON public.email_delivery_audit (tenant_id, created_at DESC);

ALTER TABLE public.email_delivery_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_delivery_audit_service_role ON public.email_delivery_audit;
CREATE POLICY email_delivery_audit_service_role ON public.email_delivery_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);
