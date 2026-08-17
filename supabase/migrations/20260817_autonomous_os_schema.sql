-- Autonomous Business OS Database Migration
-- 20260817_autonomous_os_schema.sql

-- 1. Durable Jobs Table
CREATE TABLE IF NOT EXISTS public.durable_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'running', 'completed', 'failed', 'retrying', 'dead_letter', 'cancelled')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    claimed_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    last_error TEXT,
    worker_id TEXT,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_durable_jobs_queue ON public.durable_jobs(status, scheduled_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_durable_jobs_tenant ON public.durable_jobs(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_durable_jobs_idempotency ON public.durable_jobs(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Domain Events Table
CREATE TABLE IF NOT EXISTS public.domain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor_type TEXT NOT NULL DEFAULT 'system',
    actor_id TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_type ON public.domain_events(tenant_id, event_type, created_at DESC);

-- 3. Business Goals Table
CREATE TABLE IF NOT EXISTS public.business_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    goal_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    target_metric TEXT NOT NULL,
    target_value NUMERIC NOT NULL,
    current_value NUMERIC NOT NULL DEFAULT 0,
    unit TEXT,
    period TEXT NOT NULL DEFAULT 'continuous',
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, goal_key)
);

-- 4. Autonomy Policies Table
CREATE TABLE IF NOT EXISTS public.autonomy_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    module TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'AUTOPILOT' CHECK (mode IN ('COPILOT', 'SUPERVISED_AUTOPILOT', 'AUTOPILOT')),
    max_daily_actions INT DEFAULT 100,
    max_financial_value NUMERIC DEFAULT 1000,
    require_approval_above_value NUMERIC DEFAULT 500,
    allowed_channels JSONB DEFAULT '["email", "linkedin", "facebook"]'::jsonb,
    suppression_rules JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, module)
);

-- 5. Human Approvals Table
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

-- 6. Commercial Services Table
CREATE TABLE IF NOT EXISTS public.commercial_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    service_name TEXT NOT NULL,
    description TEXT,
    pricing_model TEXT NOT NULL DEFAULT 'fixed',
    base_price NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    setup_fee NUMERIC DEFAULT 0,
    recurring_fee NUMERIC DEFAULT 0,
    add_ons JSONB DEFAULT '[]'::jsonb,
    min_price NUMERIC DEFAULT 0,
    max_discount_pct NUMERIC DEFAULT 15,
    approval_threshold NUMERIC DEFAULT 5000,
    delivery_timeline TEXT,
    payment_terms TEXT DEFAULT 'Net 30',
    deposit_pct NUMERIC DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Lead Generation Targets Table
CREATE TABLE IF NOT EXISTS public.lead_generation_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    target_lead_count INT NOT NULL DEFAULT 100,
    target_industries JSONB DEFAULT '[]'::jsonb,
    target_locations JSONB DEFAULT '[]'::jsonb,
    company_size_range TEXT,
    website_criteria TEXT,
    review_criteria TEXT,
    is_active BOOLEAN DEFAULT true,
    last_replenished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- 8. Activity Feed Table
CREATE TABLE IF NOT EXISTS public.activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    module TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    summary TEXT NOT NULL,
    explainability JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_tenant ON public.activity_feed(tenant_id, created_at DESC);

-- 9. Worker Heartbeats Table
CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'healthy',
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metrics JSONB DEFAULT '{}'::jsonb
);

-- 10. Atomic Job Claim RPC Function
CREATE OR REPLACE FUNCTION public.claim_next_durable_job(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 1
)
RETURNS SETOF public.durable_jobs
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
BEGIN
    RETURN QUERY
    WITH candidate_jobs AS (
        SELECT id
        FROM public.durable_jobs
        WHERE status IN ('pending', 'retrying')
          AND scheduled_at <= v_now
          AND (next_retry_at IS NULL OR next_retry_at <= v_now)
        ORDER BY scheduled_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.durable_jobs j
    SET status = 'claimed',
        claimed_at = v_now,
        started_at = v_now,
        worker_id = p_worker_id,
        attempts = j.attempts + 1,
        updated_at = v_now
    FROM candidate_jobs c
    WHERE j.id = c.id
    RETURNING j.*;
END;
$$;
