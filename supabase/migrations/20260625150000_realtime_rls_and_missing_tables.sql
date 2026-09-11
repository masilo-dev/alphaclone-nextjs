-- ============================================================
-- 1. REALTIME PUBLICATION
--    Add every table that has a postgres_changes subscription
--    in the codebase but was missing from supabase_realtime.
-- ============================================================

-- Tables already in the publication (no-op if re-added):
-- business_clients, business_invoices, leads, mcp_messages,
-- messages, messenger_conversations, messenger_messages,
-- notifications, project_comments, projects, worker_sessions

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'audit_logs', 'automation_tasks', 'calendar_events', 'collaboration_documents',
    'deals', 'events', 'meeting_chat_messages', 'missed_calls', 'social_posts',
    'tasks', 'tickets', 'unified_messages', 'user_presence', 'video_calls',
    'whatsapp_messages', 'contracts', 'business_events', 'security_alerts'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- 2. RLS HARDENING
--    Enable RLS on the two tables that had it disabled.
-- ============================================================

-- system_trigger_templates: read-only config, visible to all
-- authenticated users within the platform.
ALTER TABLE public.system_trigger_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read trigger templates" ON public.system_trigger_templates;
CREATE POLICY "Authenticated users can read trigger templates"
    ON public.system_trigger_templates
    FOR SELECT
    TO authenticated
    USING (true);

-- Mutations only by service role (no authenticated INSERT/UPDATE/DELETE policy).

-- mcp_event_queue: internal server-side queue.
-- Service role bypasses RLS; no client access needed.
ALTER TABLE public.mcp_event_queue ENABLE ROW LEVEL SECURITY;

-- Tenant users may enqueue their own events.
DROP POLICY IF EXISTS "Tenants can insert own events" ON public.mcp_event_queue;
CREATE POLICY "Tenants can insert own events"
    ON public.mcp_event_queue
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- Tenant users can read their own queued events.
DROP POLICY IF EXISTS "Tenants can read own events" ON public.mcp_event_queue;
CREATE POLICY "Tenants can read own events"
    ON public.mcp_event_queue
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- 3. MISSING TABLES
-- ============================================================

-- 3a. deal_stakeholders — used by /api/deals/[dealId]/stakeholders
CREATE TABLE IF NOT EXISTS public.deal_stakeholders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    deal_id     UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name        TEXT,
    email       TEXT,
    role        TEXT,
    influence   TEXT CHECK (influence IN ('low','medium','high','champion','blocker')),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.deal_stakeholders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members manage stakeholders" ON public.deal_stakeholders;
CREATE POLICY "Tenant members manage stakeholders"
    ON public.deal_stakeholders
    FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_deal_stakeholders_tenant ON public.deal_stakeholders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_deal_stakeholders_deal ON public.deal_stakeholders (deal_id);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_stakeholders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3b. sms_opt_outs — used by SMS campaign code
CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    phone       TEXT NOT NULL,
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason      TEXT,
    UNIQUE (tenant_id, phone)
);

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members manage SMS opt-outs" ON public.sms_opt_outs;
CREATE POLICY "Tenant members manage SMS opt-outs"
    ON public.sms_opt_outs
    FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_tenant_phone ON public.sms_opt_outs (tenant_id, phone);

-- 3c. notification_preferences — per-user channel preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email_enabled       BOOLEAN NOT NULL DEFAULT true,
    push_enabled        BOOLEAN NOT NULL DEFAULT true,
    sms_enabled         BOOLEAN NOT NULL DEFAULT false,
    in_app_enabled      BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_start   TIME,
    quiet_hours_end     TIME,
    event_types         JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, tenant_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification prefs" ON public.notification_preferences;
CREATE POLICY "Users manage own notification prefs"
    ON public.notification_preferences
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user_tenant ON public.notification_preferences (user_id, tenant_id);

-- 3d. task_dependencies — for task dependency graph
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_id   UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL DEFAULT 'finish_to_start'
        CHECK (dependency_type IN ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, depends_on_id)
);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members manage task dependencies" ON public.task_dependencies;
CREATE POLICY "Tenant members manage task dependencies"
    ON public.task_dependencies
    FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_task_deps_task ON public.task_dependencies (task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON public.task_dependencies (depends_on_id);

-- 3e. mcp_event_subscriptions — referenced in MCP code
CREATE TABLE IF NOT EXISTS public.mcp_event_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id      UUID REFERENCES public.mcp_sessions(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    filter_json     JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

ALTER TABLE public.mcp_event_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants manage own MCP subscriptions" ON public.mcp_event_subscriptions;
CREATE POLICY "Tenants manage own MCP subscriptions"
    ON public.mcp_event_subscriptions
    FOR ALL
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_mcp_event_subs_tenant ON public.mcp_event_subscriptions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_event_subs_expires ON public.mcp_event_subscriptions (expires_at)
    WHERE expires_at IS NOT NULL;

-- ============================================================
-- 4. UPDATED_AT TRIGGERS for new tables
-- ============================================================

DROP TRIGGER IF EXISTS set_deal_stakeholders_updated_at ON public.deal_stakeholders;
CREATE TRIGGER set_deal_stakeholders_updated_at
    BEFORE UPDATE ON public.deal_stakeholders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER set_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 5. MISSING COLUMNS ON EXISTING TABLES
-- ============================================================

-- tasks: add priority if missing (referenced in task views)
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
        CHECK (priority IN ('low','medium','high','urgent'));

-- tasks: add parent_id for subtasks
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks (parent_id) WHERE parent_id IS NOT NULL;

-- deals: add a few columns referenced in pipeline views
ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS expected_close_date DATE,
    ADD COLUMN IF NOT EXISTS lost_reason TEXT;

-- leads: ensure outreach_count exists (referenced in lead scoring)
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS outreach_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_outreach_at TIMESTAMPTZ;

-- tickets: ensure assignee_id exists
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_breach_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON public.tickets (assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status ON public.tickets (tenant_id, status);

-- ============================================================
-- 6. CLEANUP FUNCTION for expired MCP event queue items
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_mcp_queue()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    DELETE FROM public.mcp_event_queue
    WHERE created_at < NOW() - INTERVAL '7 days';

    DELETE FROM public.mcp_event_subscriptions
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
$$;
