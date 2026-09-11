-- Projects V2 automatic project creation foundation.
-- Additive only. Reuses existing contract/payment/project workflow and feature flags.

CREATE TABLE IF NOT EXISTS public.project_automation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default project kickoff',
  enabled boolean NOT NULL DEFAULT false,
  trigger_event text NOT NULL DEFAULT 'contract.signed',
  template_id uuid REFERENCES public.project_templates(id) ON DELETE SET NULL,
  require_signed_contract boolean NOT NULL DEFAULT true,
  require_deposit boolean NOT NULL DEFAULT false,
  minimum_deposit_amount numeric(14,2),
  minimum_deposit_percent numeric(5,2) CHECK (minimum_deposit_percent IS NULL OR (minimum_deposit_percent >= 0 AND minimum_deposit_percent <= 100)),
  create_calendar_events boolean NOT NULL DEFAULT true,
  create_approval_checkpoints boolean NOT NULL DEFAULT true,
  create_invoice_checkpoints boolean NOT NULL DEFAULT true,
  create_document_requirements boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_project_automation_policies_tenant_enabled
  ON public.project_automation_policies (tenant_id, enabled);

CREATE TABLE IF NOT EXISTS public.project_automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.project_automation_policies(id) ON DELETE SET NULL,
  policy_version integer NOT NULL DEFAULT 1,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  trigger_event text NOT NULL,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','waiting','running','succeeded','failed','skipped')),
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  actor_user_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_project_automation_executions_contract
  ON public.project_automation_executions (tenant_id, contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_automation_executions_status
  ON public.project_automation_executions (tenant_id, status, created_at DESC);

ALTER TABLE public.project_automation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_automation_policies_tenant_access ON public.project_automation_policies;
CREATE POLICY project_automation_policies_tenant_access
  ON public.project_automation_policies
  FOR ALL
  USING (public.is_active_tenant_member(tenant_id))
  WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS project_automation_executions_tenant_access ON public.project_automation_executions;
CREATE POLICY project_automation_executions_tenant_access
  ON public.project_automation_executions
  FOR SELECT
  USING (public.is_active_tenant_member(tenant_id));

COMMENT ON TABLE public.project_automation_policies IS 'Configurable Projects V2 kickoff policy. Execution remains behind PROJECT_AUTOMATION_ENABLED.';
COMMENT ON TABLE public.project_automation_executions IS 'Idempotent, auditable project kickoff execution ledger with correlation and retry metadata.';
