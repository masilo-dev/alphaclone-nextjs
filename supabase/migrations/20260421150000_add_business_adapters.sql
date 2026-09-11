BEGIN;

CREATE TABLE IF NOT EXISTS public.adapter_event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    actor_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    adapter_name TEXT NOT NULL CHECK (adapter_name IN ('calendar_booking', 'payment_subscription', 'client_portal_event', 'document_intelligence')),
    action TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial_success')),
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adapter_event_logs_tenant_created_at
    ON public.adapter_event_logs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.client_portal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    actor_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
    client_id UUID NULL REFERENCES public.business_clients(id) ON DELETE SET NULL,
    deliverable_id UUID NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('project_viewed', 'deliverable_downloaded', 'feedback_submitted', 'milestone_acknowledged', 'portal_message_sent', 'custom')),
    feedback_rating SMALLINT NULL CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_comment TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_portal_events_tenant_created_at
    ON public.client_portal_events (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.document_intelligence_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    actor_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    document_url TEXT NULL,
    document_type TEXT NOT NULL DEFAULT 'other' CHECK (document_type IN ('contract', 'proposal', 'invoice', 'nda', 'other')),
    extracted_entities JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT NULL,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_intelligence_runs_tenant_created_at
    ON public.document_intelligence_runs (tenant_id, created_at DESC);

ALTER TABLE public.adapter_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_intelligence_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read adapter event logs" ON public.adapter_event_logs;
CREATE POLICY "Tenant users can read adapter event logs"
    ON public.adapter_event_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = adapter_event_logs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can create adapter event logs" ON public.adapter_event_logs;
CREATE POLICY "Tenant users can create adapter event logs"
    ON public.adapter_event_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = adapter_event_logs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can read client portal events" ON public.client_portal_events;
CREATE POLICY "Tenant users can read client portal events"
    ON public.client_portal_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = client_portal_events.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can create client portal events" ON public.client_portal_events;
CREATE POLICY "Tenant users can create client portal events"
    ON public.client_portal_events
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = client_portal_events.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can read document intelligence runs" ON public.document_intelligence_runs;
CREATE POLICY "Tenant users can read document intelligence runs"
    ON public.document_intelligence_runs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = document_intelligence_runs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant users can create document intelligence runs" ON public.document_intelligence_runs;
CREATE POLICY "Tenant users can create document intelligence runs"
    ON public.document_intelligence_runs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = document_intelligence_runs.tenant_id
              AND tu.user_id = auth.uid()
        )
    );

COMMIT;
