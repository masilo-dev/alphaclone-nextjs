-- Migration: 20260822140000_tenant_operational_events.sql
-- Description: Universal Tenant-Wide Operational Event Store, Activity Timeline & Audit Foundation

CREATE TABLE IF NOT EXISTS public.tenant_operational_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Actor attribution
    actor_id TEXT,
    actor_name TEXT,
    actor_type TEXT NOT NULL DEFAULT 'USER' CHECK (actor_type IN (
        'USER', 'BONNIE', 'AI_AGENT', 'MCP', 'AUTOMATION', 
        'API', 'WEBHOOK', 'SCHEDULED_JOB', 'EXTERNAL_INTEGRATION', 'SYSTEM'
    )),
    
    -- Event Classification
    source_module TEXT NOT NULL CHECK (source_module IN (
        'CRM', 'LEADS', 'SALES', 'EMAIL', 'PROJECTS', 'TASKS', 
        'SOCIAL', 'DOCUMENTS', 'PROPOSALS', 'CONTRACTS', 'INVOICES', 
        'PAYMENTS', 'MEETINGS', 'MARKETING', 'AUTOMATION', 'MCP', 'SYSTEM'
    )),
    action TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Related Business Objects Linkage
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
    
    -- Operational State & Level
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN (
        'PROPOSED', 'APPROVED', 'EXECUTING', 'SUCCESS', 'VERIFIED', 
        'FAILED', 'PARTIAL', 'BLOCKED', 'CANCELLED'
    )),
    notification_level TEXT NOT NULL DEFAULT 'LEVEL_1_RECORD' CHECK (notification_level IN (
        'LEVEL_1_RECORD', 'LEVEL_2_DIGEST', 'LEVEL_3_IMMEDIATE'
    )),
    
    -- Outcome & Evidence
    evidence JSONB DEFAULT '{}'::jsonb,
    next_action JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_tenant_time ON public.tenant_operational_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_tenant_level ON public.tenant_operational_events(tenant_id, notification_level, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_tenant_module ON public.tenant_operational_events(tenant_id, source_module, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_actor ON public.tenant_operational_events(tenant_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_client ON public.tenant_operational_events(tenant_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_lead ON public.tenant_operational_events(tenant_id, lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_project ON public.tenant_operational_events(tenant_id, project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_invoice ON public.tenant_operational_events(tenant_id, invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_op_events_status ON public.tenant_operational_events(tenant_id, status) WHERE status IN ('FAILED', 'PARTIAL', 'BLOCKED');

-- Row Level Security
ALTER TABLE public.tenant_operational_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_op_events_policy ON public.tenant_operational_events;
CREATE POLICY tenant_op_events_policy ON public.tenant_operational_events FOR ALL TO authenticated
USING (public.is_active_tenant_member(tenant_id)) 
WITH CHECK (public.is_active_tenant_member(tenant_id));
