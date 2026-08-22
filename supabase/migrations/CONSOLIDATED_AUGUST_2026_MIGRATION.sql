-- ============================================================================
-- ALPHACLONE SYSTEMS — CONSOLIDATED AUGUST 2026 DATABASE MIGRATION SCRIPT
-- Generated: 2026-08-22
-- Resilient migration script (no hard FK constraints on optional tables)
-- Includes:
--   1. human_approvals & Autonomous OS Prereqs
--   2. workflow_processing_queue (20260820150000)
--   3. add_queued_lead_search_job_status & retrying (20260821110000 / 20260821150000)
--   4. microsoft_connections_fallback_columns (20260821140000)
--   5. tenant_integrations_add_missing_columns (20260821170000)
--   6. client_project_execution_engine (20260822100000)
--   7. operations_operating_system (20260822120000)
--   8. tenant_operational_events (20260822140000)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Human Approvals Table (Standalone definition)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.human_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    module TEXT NOT NULL,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    reason TEXT NOT NULL,
    affected_contact_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    financial_impact NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    decided_by UUID,
    decided_at TIMESTAMPTZ,
    decision_notes TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_human_approvals_tenant ON public.human_approvals(tenant_id, status);

ALTER TABLE public.human_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_member_human_approvals ON public.human_approvals;
CREATE POLICY tenant_member_human_approvals ON public.human_approvals FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

-- ----------------------------------------------------------------------------
-- 2. Workflow Processing Queue (20260820150000)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workflow_processing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_processing_queue
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_queue_workflow_event_uidx
  ON public.workflow_processing_queue (workflow_id, event_id);
CREATE INDEX IF NOT EXISTS workflow_queue_pending_idx
  ON public.workflow_processing_queue (next_run_at, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS workflow_queue_tenant_idx
  ON public.workflow_processing_queue (tenant_id, created_at DESC);

ALTER TABLE public.workflow_processing_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant members view workflow queue" ON public.workflow_processing_queue;
CREATE POLICY "Tenant members view workflow queue" ON public.workflow_processing_queue
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_users member
    WHERE member.tenant_id = workflow_processing_queue.tenant_id
      AND member.user_id = (SELECT auth.uid())
  ));

-- ----------------------------------------------------------------------------
-- 3. Lead Search Job Enums
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_search_job_status') THEN
    ALTER TYPE public.lead_search_job_status ADD VALUE IF NOT EXISTS 'queued' BEFORE 'running';
    ALTER TYPE public.lead_search_job_status ADD VALUE IF NOT EXISTS 'retrying' AFTER 'running';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Microsoft Connections Vault Fallbacks
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'microsoft_connections') THEN
    ALTER TABLE public.microsoft_connections 
      ALTER COLUMN access_token DROP NOT NULL,
      ALTER COLUMN access_token SET DEFAULT '',
      ALTER COLUMN refresh_token DROP NOT NULL,
      ALTER COLUMN refresh_token SET DEFAULT '';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Tenant Integrations Missing Columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.tenant_integrations
  ADD COLUMN IF NOT EXISTS integration_id    text,
  ADD COLUMN IF NOT EXISTS configured_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS connected_at      timestamptz,
  ADD COLUMN IF NOT EXISTS metadata          jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'tenant_integrations'
      AND constraint_name = 'tenant_integrations_tenant_integration_unique'
  ) THEN
    ALTER TABLE public.tenant_integrations
      ADD CONSTRAINT tenant_integrations_tenant_integration_unique
      UNIQUE (tenant_id, integration_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Commitments, Identity Merges & Dispatches
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    client_id UUID,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    commitment TEXT NOT NULL,
    maker_type TEXT NOT NULL CHECK (maker_type IN ('our_team', 'client')),
    maker_name TEXT,
    recipient_name TEXT,
    date_made TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'overdue', 'waived')),
    evidence TEXT,
    source_type TEXT CHECK (source_type IN ('email', 'meeting', 'task_note', 'proposal', 'contract', 'manual')),
    source_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commitments_tenant_project ON public.commitments(tenant_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_commitments_tenant_client ON public.commitments(tenant_id, client_id, status);
CREATE INDEX IF NOT EXISTS idx_commitments_due_date ON public.commitments(tenant_id, due_date) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.client_identity_merges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    primary_client_id UUID NOT NULL,
    candidate_client_id UUID NOT NULL,
    confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN ('pending_confirmation', 'approved', 'rejected')),
    decided_by UUID,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_identity_merges_tenant ON public.client_identity_merges(tenant_id, status);

CREATE TABLE IF NOT EXISTS public.project_email_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    client_id UUID,
    stage TEXT NOT NULL,
    autonomy_level TEXT NOT NULL CHECK (autonomy_level IN ('level_1', 'level_2', 'level_3', 'level_4')),
    approval_status TEXT NOT NULL DEFAULT 'auto_sent' CHECK (approval_status IN ('auto_sent', 'pending_approval', 'approved', 'rejected')),
    human_approval_id UUID,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_email_dispatches_project ON public.project_email_dispatches(tenant_id, project_id, created_at DESC);

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS last_client_contact_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_client_response_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS client_sla_status TEXT DEFAULT 'on_track';

CREATE TABLE IF NOT EXISTS public.task_structured_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    author_id UUID,
    author_name TEXT,
    note_type TEXT NOT NULL CHECK (note_type IN ('progress_update', 'blocker', 'client_feedback', 'technical_detail', 'decision', 'dependency', 'evidence', 'handover')),
    content TEXT NOT NULL,
    evidence_urls JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_structured_notes_task ON public.task_structured_notes(tenant_id, task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_structured_notes_project ON public.task_structured_notes(tenant_id, project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.meeting_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    meeting_id UUID,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    client_id UUID,
    title TEXT NOT NULL,
    objective TEXT,
    brief_content JSONB NOT NULL DEFAULT '{}'::jsonb,
    post_meeting_notes TEXT,
    extracted_decisions JSONB DEFAULT '[]'::jsonb,
    extracted_tasks JSONB DEFAULT '[]'::jsonb,
    extracted_commitments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_briefs_project ON public.meeting_briefs(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS public.proposal_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    proposal_id UUID NOT NULL,
    client_id UUID,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'INTERNAL_REVIEW', 'SENT', 'VIEWED', 'CLIENT_QUESTIONS', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVISED')),
    accepted_at TIMESTAMPTZ,
    executed_actions JSONB DEFAULT '{}'::jsonb,
    last_follow_up_at TIMESTAMPTZ,
    follow_up_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_workflows_tenant ON public.proposal_workflows(tenant_id, status);

ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_identity_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_email_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_structured_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_member_commitments ON public.commitments;
CREATE POLICY tenant_member_commitments ON public.commitments FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_member_identity_merges ON public.client_identity_merges;
CREATE POLICY tenant_member_identity_merges ON public.client_identity_merges FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_member_email_dispatches ON public.project_email_dispatches;
CREATE POLICY tenant_member_email_dispatches ON public.project_email_dispatches FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_member_task_structured_notes ON public.task_structured_notes;
CREATE POLICY tenant_member_task_structured_notes ON public.task_structured_notes FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_member_meeting_briefs ON public.meeting_briefs;
CREATE POLICY tenant_member_meeting_briefs ON public.meeting_briefs FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_member_proposal_workflows ON public.proposal_workflows;
CREATE POLICY tenant_member_proposal_workflows ON public.proposal_workflows FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

-- ----------------------------------------------------------------------------
-- 7. Core Operations Layer
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operations_work_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    work_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    objective TEXT,
    owner_id UUID,
    owner_name TEXT,
    contributors JSONB DEFAULT '[]'::jsonb,
    client_id UUID,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent', 'critical')),
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
        'REQUESTED', 'DEFINED', 'APPROVED', 'IN_PROGRESS', 'BLOCKED', 
        'REVIEW', 'VERIFIED', 'COMPLETED', 'FAILED', 'CANCELLED', 'DEFERRED', 'KILLED'
    )),
    start_date TIMESTAMPTZ,
    target_date TIMESTAMPTZ,
    created_by UUID,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dependencies JSONB DEFAULT '[]'::jsonb,
    risks JSONB DEFAULT '[]'::jsonb,
    related_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    related_contact_id UUID,
    related_documents JSONB DEFAULT '[]'::jsonb,
    related_emails JSONB DEFAULT '[]'::jsonb,
    related_meetings JSONB DEFAULT '[]'::jsonb,
    related_invoices JSONB DEFAULT '[]'::jsonb,
    related_decisions JSONB DEFAULT '[]'::jsonb,
    evidence JSONB DEFAULT '[]'::jsonb,
    completion_criteria TEXT,
    final_result TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_work_tenant ON public.operations_work_records(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ops_work_owner ON public.operations_work_records(tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_ops_work_project ON public.operations_work_records(tenant_id, related_project_id);

CREATE TABLE IF NOT EXISTS public.decision_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    decision_title TEXT NOT NULL,
    context TEXT NOT NULL,
    objective TEXT NOT NULL,
    decision_owner_id UUID,
    decision_owner_name TEXT,
    decision_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alternatives_considered JSONB DEFAULT '[]'::jsonb,
    evidence TEXT,
    evidence_label TEXT NOT NULL DEFAULT 'ESTIMATED' CHECK (evidence_label IN ('MEASURED', 'ESTIMATED', 'PREDICTED', 'UNKNOWN')),
    probability_of_success NUMERIC(5,2) DEFAULT 0.50,
    cost_amount NUMERIC(12,2) DEFAULT 0,
    opportunity_cost TEXT,
    complexity_impact TEXT,
    reversibility TEXT DEFAULT 'reversible' CHECK (reversibility IN ('reversible', 'partially_reversible', 'irreversible')),
    risks JSONB DEFAULT '[]'::jsonb,
    expected_result TEXT,
    review_date TIMESTAMPTZ,
    actual_result TEXT,
    learning TEXT,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'executed', 'reviewed', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_records_tenant ON public.decision_records(tenant_id, status, decision_date DESC);

CREATE TABLE IF NOT EXISTS public.alamos_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    decision_id UUID REFERENCES public.decision_records(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    work_record_id UUID REFERENCES public.operations_work_records(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    alamos_01_outcome_metric TEXT NOT NULL,
    alamos_02_zero_multiplier TEXT NOT NULL,
    alamos_03_success_probability NUMERIC(5,2) NOT NULL DEFAULT 0.50,
    alamos_04_cost_and_tradeoffs TEXT NOT NULL,
    alamos_05_potential_failure_modes TEXT NOT NULL,
    alamos_06_verification_method TEXT NOT NULL,
    alamos_07_post_evidence_plan TEXT NOT NULL,
    resulting_action TEXT NOT NULL DEFAULT 'TEST' CHECK (resulting_action IN (
        'BUILD', 'FIX', 'SCALE', 'KEEP', 'SIMPLIFY', 'TEST', 'DEFER', 'AUTOMATE', 'REMOVE', 'KILL'
    )),
    is_mandatory_gate BOOLEAN DEFAULT false,
    gate_approved BOOLEAN DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alamos_tenant ON public.alamos_evaluations(tenant_id, resulting_action);

CREATE TABLE IF NOT EXISTS public.failure_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'automation', 'api', 'agent', 'email', 'payment', 
        'deployment', 'deliverable', 'deadline', 'integration', 'campaign', 'other'
    )),
    title TEXT NOT NULL,
    expected_result TEXT NOT NULL,
    actual_result TEXT NOT NULL,
    failure_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    failure_owner_id UUID,
    failure_owner_name TEXT,
    business_impact TEXT NOT NULL,
    root_cause TEXT,
    evidence TEXT,
    incorrect_assumptions JSONB DEFAULT '[]'::jsonb,
    recovery_action TEXT,
    permanent_corrective_action TEXT,
    reusable_learning TEXT,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'RECURRING')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failure_records_tenant ON public.failure_records(tenant_id, status, failure_time DESC);

CREATE TABLE IF NOT EXISTS public.communication_slas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('email', 'chat', 'form', 'whatsapp', 'phone', 'meeting')),
    source_id TEXT,
    client_id UUID,
    contact_email TEXT,
    subject TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_owner_id UUID,
    response_deadline_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
        'NEW', 'ASSIGNED', 'ACKNOWLEDGED', 'RESPONDED', 'WAITING_ON_CLIENT', 'ESCALATED', 'CLOSED'
    )),
    actual_response_at TIMESTAMPTZ,
    response_time_minutes INT,
    sla_breached BOOLEAN DEFAULT false,
    escalated_to UUID,
    escalated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communication_slas_tenant ON public.communication_slas(tenant_id, status, response_deadline_at);
CREATE INDEX IF NOT EXISTS idx_communication_slas_breach ON public.communication_slas(tenant_id, sla_breached) WHERE sla_breached = true;

CREATE TABLE IF NOT EXISTS public.operational_blockers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    work_record_id UUID REFERENCES public.operations_work_records(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    blocker_cause TEXT NOT NULL,
    owner_id UUID,
    owner_name TEXT,
    required_action TEXT NOT NULL,
    dependency_id TEXT,
    business_impact TEXT NOT NULL,
    escalation_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED', 'ESCALATED')),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operational_blockers_tenant ON public.operational_blockers(tenant_id, status);

CREATE TABLE IF NOT EXISTS public.project_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    requester_id UUID,
    requester_name TEXT,
    reason TEXT NOT NULL,
    previous_scope TEXT NOT NULL,
    new_scope TEXT NOT NULL,
    timeline_impact_days INT DEFAULT 0,
    cost_impact NUMERIC(12,2) DEFAULT 0,
    resource_impact TEXT,
    risk_impact TEXT,
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_change_logs_project ON public.project_change_logs(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS public.sops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'operations',
    trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'event', 'recurring')),
    owner_id UUID,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_evidence JSONB DEFAULT '[]'::jsonb,
    approval_points JSONB DEFAULT '[]'::jsonb,
    completion_condition TEXT,
    escalation_condition TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sop_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    sop_id UUID NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
    work_record_id UUID REFERENCES public.operations_work_records(id) ON DELETE SET NULL,
    executed_by UUID,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')),
    current_step_index INT NOT NULL DEFAULT 0,
    step_results JSONB DEFAULT '[]'::jsonb,
    evidence_submitted JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sops_tenant ON public.sops(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sop_runs_tenant ON public.sop_runs(tenant_id, status);

CREATE TABLE IF NOT EXISTS public.operational_handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    previous_owner_id UUID NOT NULL,
    previous_owner_name TEXT,
    new_owner_id UUID NOT NULL,
    new_owner_name TEXT,
    reason TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'task', 'client', 'work_record')),
    entity_id UUID NOT NULL,
    entity_title TEXT NOT NULL,
    current_status TEXT NOT NULL,
    outstanding_work TEXT NOT NULL,
    known_problems TEXT,
    relevant_documents JSONB DEFAULT '[]'::jsonb,
    relevant_conversations JSONB DEFAULT '[]'::jsonb,
    next_deadline TIMESTAMPTZ,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handovers_tenant ON public.operational_handovers(tenant_id, new_owner_id, acknowledged);

ALTER TABLE public.operations_work_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alamos_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failure_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_slas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_ops_work_records ON public.operations_work_records;
CREATE POLICY tenant_ops_work_records ON public.operations_work_records FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_decision_records ON public.decision_records;
CREATE POLICY tenant_decision_records ON public.decision_records FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_alamos_evaluations ON public.alamos_evaluations;
CREATE POLICY tenant_alamos_evaluations ON public.alamos_evaluations FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_failure_records ON public.failure_records;
CREATE POLICY tenant_failure_records ON public.failure_records FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_communication_slas ON public.communication_slas;
CREATE POLICY tenant_communication_slas ON public.communication_slas FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_operational_blockers ON public.operational_blockers;
CREATE POLICY tenant_operational_blockers ON public.operational_blockers FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_project_change_logs ON public.project_change_logs;
CREATE POLICY tenant_project_change_logs ON public.project_change_logs FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_sops ON public.sops;
CREATE POLICY tenant_sops ON public.sops FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_sop_runs ON public.sop_runs;
CREATE POLICY tenant_sop_runs ON public.sop_runs FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS tenant_operational_handovers ON public.operational_handovers;
CREATE POLICY tenant_operational_handovers ON public.operational_handovers FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) WITH CHECK (public.is_active_tenant_member(tenant_id));

-- ----------------------------------------------------------------------------
-- 8. Universal Operational Event Store
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_operational_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    actor_type TEXT NOT NULL DEFAULT 'USER' CHECK (actor_type IN (
        'USER', 'BONNIE', 'AI_AGENT', 'MCP', 'AUTOMATION', 
        'API', 'WEBHOOK', 'SCHEDULED_JOB', 'EXTERNAL_INTEGRATION', 'SYSTEM'
    )),
    source_module TEXT NOT NULL CHECK (source_module IN (
        'CRM', 'LEADS', 'SALES', 'EMAIL', 'PROJECTS', 'TASKS', 
        'SOCIAL', 'DOCUMENTS', 'PROPOSALS', 'CONTRACTS', 'INVOICES', 
        'PAYMENTS', 'MEETINGS', 'MARKETING', 'AUTOMATION', 'MCP', 'SYSTEM'
    )),
    action TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    client_id UUID,
    contact_id UUID,
    company_id UUID,
    lead_id UUID,
    opportunity_id UUID,
    project_id UUID,
    task_id UUID,
    proposal_id UUID,
    contract_id UUID,
    invoice_id UUID,
    payment_id UUID,
    meeting_id UUID,
    document_id UUID,
    social_post_id UUID,
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN (
        'PROPOSED', 'APPROVED', 'EXECUTING', 'SUCCESS', 'VERIFIED', 
        'FAILED', 'PARTIAL', 'BLOCKED', 'CANCELLED'
    )),
    notification_level TEXT NOT NULL DEFAULT 'LEVEL_1_RECORD' CHECK (notification_level IN (
        'LEVEL_1_RECORD', 'LEVEL_2_DIGEST', 'LEVEL_3_IMMEDIATE'
    )),
    evidence JSONB DEFAULT '{}'::jsonb,
    next_action JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_op_events_tenant_time ON public.tenant_operational_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_tenant_level ON public.tenant_operational_events(tenant_id, notification_level, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_tenant_module ON public.tenant_operational_events(tenant_id, source_module, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_actor ON public.tenant_operational_events(tenant_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_client ON public.tenant_operational_events(tenant_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_lead ON public.tenant_operational_events(tenant_id, lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_project ON public.tenant_operational_events(tenant_id, project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_invoice ON public.tenant_operational_events(tenant_id, invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_status ON public.tenant_operational_events(tenant_id, status) WHERE status IN ('FAILED', 'PARTIAL', 'BLOCKED');

ALTER TABLE public.tenant_operational_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_op_events_policy ON public.tenant_operational_events;
CREATE POLICY tenant_op_events_policy ON public.tenant_operational_events FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) 
WITH CHECK (public.is_active_tenant_member(tenant_id));

-- Add foreign key dynamically ONLY if human_approvals exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'human_approvals') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_project_email_dispatches_human_approval'
    ) THEN
      ALTER TABLE public.project_email_dispatches
        ADD CONSTRAINT fk_project_email_dispatches_human_approval
        FOREIGN KEY (human_approval_id) REFERENCES public.human_approvals(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
