-- Unified cross-entity workspace activity feed.
-- Idempotent IF NOT EXISTS migration.
BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
    client_id UUID NULL REFERENCES public.business_clients(id) ON DELETE SET NULL,
    invoice_id UUID NULL REFERENCES public.business_invoices(id) ON DELETE SET NULL,
    contract_id UUID NULL REFERENCES public.contracts(id) ON DELETE SET NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('system','team_user','client','external','ai')),
    actor_id UUID NULL,
    actor_display_name TEXT NULL,
    event_type TEXT NOT NULL CHECK (char_length(event_type) <= 256),
    summary TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_tenant_created
    ON public.workspace_activity (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_project
    ON public.workspace_activity (project_id, created_at DESC)
    WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_activity_client
    ON public.workspace_activity (client_id, created_at DESC)
    WHERE client_id IS NOT NULL;

ALTER TABLE IF EXISTS public.workspace_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.workspace_activity;
CREATE POLICY tenant_isolation ON public.workspace_activity
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.tenant_users tu
            WHERE tu.tenant_id = workspace_activity.tenant_id
              AND auth.uid() IS NOT DISTINCT FROM tu.user_id
        )
    );

COMMIT;
