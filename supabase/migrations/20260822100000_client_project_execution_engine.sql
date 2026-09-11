-- Migration: 20260822100000_client_project_execution_engine.sql
-- Description: Schema extensions for AlphaClone Project Execution Engine & Client Intelligence Extension

-- 1. Commitments Table
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

-- 2. Client Identity Resolution Merges
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

-- 3. Project Email Dispatches & Safety Levels
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

-- Dynamically attach foreign key if human_approvals table exists
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

-- 4. Projects SLA & Contact Extensions
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS last_client_contact_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_client_response_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS client_sla_status TEXT DEFAULT 'on_track';

-- 5. Structured Task Notes Table
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

-- 6. Meeting Intelligence Briefs
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

-- 7. Proposal Workflows Table
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

-- RLS Policies
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
