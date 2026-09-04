-- Universal Chaser Brain — canonical chase_instances + chase_attempts
-- Phase 1: observe-only records; execution still routes through Bonnie runtime.

CREATE TABLE IF NOT EXISTS public.chase_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  related_contact_id UUID,
  related_client_id UUID,
  related_project_id UUID,
  related_task_id UUID,
  owner_user_id UUID,
  assignee_user_id UUID,
  state TEXT NOT NULL DEFAULT 'DETECTED'
    CHECK (state IN (
      'DETECTED', 'PLANNED', 'WAITING_FOR_APPROVAL', 'READY', 'EXECUTING',
      'WAITING_FOR_OUTCOME', 'RESOLVED', 'SNOOZED', 'ESCALATED', 'EXHAUSTED', 'CANCELLED'
    )),
  severity TEXT NOT NULL DEFAULT 'normal',
  reason_code TEXT,
  waiting_on TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0 AND max_attempts <= 50),
  last_attempt_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  last_observed_state TEXT,
  expected_outcome TEXT,
  terminal_outcome TEXT,
  channel TEXT,
  automation_mode TEXT NOT NULL DEFAULT 'observe_only'
    CHECK (automation_mode IN ('observe_only', 'internal', 'approval_required', 'automated')),
  approval_required BOOLEAN NOT NULL DEFAULT false,
  approval_id UUID,
  idempotency_key TEXT NOT NULL,
  run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  agent_task_id UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  snoozed_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chase_instances_active_unique
  ON public.chase_instances (tenant_id, policy_key, entity_type, entity_id)
  WHERE state NOT IN ('RESOLVED', 'EXHAUSTED', 'CANCELLED');

CREATE INDEX IF NOT EXISTS idx_chase_instances_due
  ON public.chase_instances (tenant_id, next_action_at)
  WHERE state IN ('DETECTED', 'PLANNED', 'READY', 'WAITING_FOR_OUTCOME', 'SNOOZED');

CREATE INDEX IF NOT EXISTS idx_chase_instances_owner
  ON public.chase_instances (tenant_id, owner_user_id, state);

CREATE TABLE IF NOT EXISTS public.chase_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chase_id UUID NOT NULL REFERENCES public.chase_instances(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  action_key TEXT NOT NULL,
  recipient TEXT,
  assignee_user_id UUID,
  template_key TEXT,
  template_version TEXT,
  provider TEXT,
  provider_request_id TEXT,
  delivery_state TEXT NOT NULL DEFAULT 'queued'
    CHECK (delivery_state IN (
      'queued', 'sent', 'delivered', 'opened', 'replied', 'failed', 'unknown', 'skipped'
    )),
  retry_classification TEXT,
  failure_reason TEXT,
  receipt JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  queued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chase_id, attempt_number),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_chase_attempts_chase
  ON public.chase_attempts (chase_id, attempt_number DESC);

ALTER TABLE public.chase_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chase_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chase_instances'
      AND policyname = 'chase_instances_tenant_isolation'
  ) THEN
    CREATE POLICY chase_instances_tenant_isolation ON public.chase_instances
      FOR ALL
      USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chase_attempts'
      AND policyname = 'chase_attempts_tenant_isolation'
  ) THEN
    CREATE POLICY chase_attempts_tenant_isolation ON public.chase_attempts
      FOR ALL
      USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
END $$;

-- Extend invoice_reminders phase vocabulary for due-date ladder
ALTER TABLE public.invoice_reminders DROP CONSTRAINT IF EXISTS invoice_reminders_reminder_type_check;
ALTER TABLE public.invoice_reminders ADD CONSTRAINT invoice_reminders_reminder_type_check
  CHECK (reminder_type IN (
    'upcoming', 'due_today', 'overdue_1', 'overdue_7', 'overdue_14', 'escalate'
  ));

ALTER TABLE public.communication_slas
  ADD COLUMN IF NOT EXISTS lead_id UUID,
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS opportunity_id UUID,
  ADD COLUMN IF NOT EXISTS contact_id UUID;

-- Owner notification dedupe ledger
CREATE TABLE IF NOT EXISTS public.chase_owner_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  chase_id UUID REFERENCES public.chase_instances(id) ON DELETE SET NULL,
  provider_message_id TEXT,
  delivery_state TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dedupe_key)
);

ALTER TABLE public.chase_owner_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chase_owner_notifications'
      AND policyname = 'chase_owner_notifications_tenant_isolation'
  ) THEN
    CREATE POLICY chase_owner_notifications_tenant_isolation ON public.chase_owner_notifications
      FOR ALL
      USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
      WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
END $$;
