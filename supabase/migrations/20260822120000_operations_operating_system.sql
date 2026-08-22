-- Migration: 20260822120000_operations_operating_system.sql
-- Description: Core Operations Layer for AlphaClone Systems — Work Records, Decision Records, ALAMOS Protocol, Failures, Communication SLAs, Blockers, SOPs & Handovers

-- 1. Universal Work Records Table
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

-- 2. Decision Records Table
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

-- 3. ALAMOS Evaluations Table (AlphaClone Learning, Accountability, Measurement & Operating System)
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

-- 4. Failure Records Table
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

-- 5. Communication SLAs Table
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

-- 6. Operational Blockers Table
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

-- 7. Project Change Logs Table
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

-- 8. Standard Operating Procedures (SOPs) & Runs
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

-- 9. Operational Handovers Table
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

-- RLS Policies
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
