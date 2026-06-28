-- ============================================================
-- Missing RPC functions referenced in the codebase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL DEFAULT 'generic',
    increment_value INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. get_accounts_receivable_aging
--    Used by accounting/management API and Bonnie tools.
CREATE OR REPLACE FUNCTION public.get_accounts_receivable_aging(p_tenant_id UUID)
RETURNS TABLE (
    aging_bucket TEXT,
    invoice_count BIGINT,
    total_amount  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH aged AS (
        SELECT
            CASE
                WHEN due_date >= CURRENT_DATE           THEN 'current'
                WHEN due_date >= CURRENT_DATE - 30      THEN '1-30 days'
                WHEN due_date >= CURRENT_DATE - 60      THEN '31-60 days'
                WHEN due_date >= CURRENT_DATE - 90      THEN '61-90 days'
                ELSE                                         '90+ days'
            END AS bucket,
            COALESCE(total, 0) AS amount
        FROM public.business_invoices
        WHERE tenant_id = p_tenant_id
          AND status IN ('sent', 'overdue', 'partial')
    )
    SELECT bucket, COUNT(*), SUM(amount)
    FROM aged
    GROUP BY bucket
    ORDER BY MIN(
        CASE bucket
            WHEN 'current'    THEN 0
            WHEN '1-30 days'  THEN 1
            WHEN '31-60 days' THEN 2
            WHEN '61-90 days' THEN 3
            ELSE 4
        END
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_accounts_receivable_aging(UUID) TO authenticated;

-- 2. get_accounts_payable_aging
--    Used by accounting/management API and Bonnie tools.
CREATE OR REPLACE FUNCTION public.get_accounts_payable_aging(p_tenant_id UUID)
RETURNS TABLE (
    aging_bucket TEXT,
    bill_count   BIGINT,
    total_amount NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH aged AS (
        SELECT
            CASE
                WHEN due_date >= CURRENT_DATE           THEN 'current'
                WHEN due_date >= CURRENT_DATE - 30      THEN '1-30 days'
                WHEN due_date >= CURRENT_DATE - 60      THEN '31-60 days'
                WHEN due_date >= CURRENT_DATE - 90      THEN '61-90 days'
                ELSE                                         '90+ days'
            END AS bucket,
            COALESCE(total, 0) AS amount
        FROM public.vendor_bills
        WHERE tenant_id = p_tenant_id
          AND status IN ('open', 'partial', 'overdue')
    )
    SELECT bucket, COUNT(*), SUM(amount)
    FROM aged
    GROUP BY bucket
    ORDER BY MIN(
        CASE bucket
            WHEN 'current'    THEN 0
            WHEN '1-30 days'  THEN 1
            WHEN '31-60 days' THEN 2
            WHEN '61-90 days' THEN 3
            ELSE 4
        END
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_accounts_payable_aging(UUID) TO authenticated;

-- 3. get_avg_ticket_resolution_time
--    Support analytics — average hours to resolve a ticket.
DROP FUNCTION IF EXISTS public.get_avg_ticket_resolution_time(UUID);
CREATE OR REPLACE FUNCTION public.get_avg_ticket_resolution_time(p_tenant_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0),
        0
    )
    FROM public.tickets
    WHERE tenant_id  = p_tenant_id
      AND resolved_at IS NOT NULL
      AND status       = 'resolved';
$$;

GRANT EXECUTE ON FUNCTION public.get_avg_ticket_resolution_time(UUID) TO authenticated;

-- 4. update_account_balances
--    Refresh calculated balances in chart_of_accounts from journal entries.
CREATE OR REPLACE FUNCTION public.update_account_balances(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.chart_of_accounts ca
    SET balance = COALESCE((
        SELECT SUM(
            CASE WHEN jel.type = 'debit'  THEN  jel.amount
                 WHEN jel.type = 'credit' THEN -jel.amount
                 ELSE 0
            END
        )
        FROM public.journal_entry_lines jel
        JOIN public.journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id = ca.id
          AND je.tenant_id   = p_tenant_id
          AND je.status       = 'posted'
    ), 0)
    WHERE ca.tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_account_balances(UUID) TO authenticated;

-- 5. track_tenant_usage — alias used in some services
CREATE OR REPLACE FUNCTION public.track_tenant_usage(
    p_tenant_id UUID,
    p_metric    TEXT,
    p_value     NUMERIC DEFAULT 1
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.usage_events (tenant_id, event_type, metric_name, increment_value, created_at)
    VALUES (p_tenant_id, p_metric, p_metric, GREATEST(p_value::integer, 1), NOW());
$$;

GRANT EXECUTE ON FUNCTION public.track_tenant_usage(UUID, TEXT, NUMERIC) TO authenticated;

-- 6. increment_quote_view_count
CREATE OR REPLACE FUNCTION public.increment_quote_view_count(p_quote_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.quotes
    SET view_count   = COALESCE(view_count, 0) + 1,
        last_viewed_at = NOW()
    WHERE id = p_quote_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_quote_view_count(UUID) TO authenticated, anon;

-- 7. increment_article_views (SEO articles)
CREATE OR REPLACE FUNCTION public.increment_article_views(p_article_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.seo_articles
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_article_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_article_views(UUID) TO authenticated, anon;

-- 8. increment_workflow_execution_count
CREATE OR REPLACE FUNCTION public.increment_workflow_execution_count(p_workflow_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.workflow_definitions
    SET execution_count = COALESCE(execution_count, 0) + 1,
        last_executed_at = NOW()
    WHERE id = p_workflow_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_workflow_execution_count(UUID) TO authenticated;

-- 9. get_worker_productivity (worker tracking service)
CREATE OR REPLACE FUNCTION public.get_worker_productivity(
    p_tenant_id UUID,
    p_from      TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_to        TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    user_id          UUID,
    sessions_count   BIGINT,
    total_hours      NUMERIC,
    tasks_completed  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        ws.user_id,
        COUNT(ws.id)                                                         AS sessions_count,
        COALESCE(SUM(EXTRACT(EPOCH FROM (ws.session_end - ws.session_start)) / 3600.0), 0) AS total_hours,
        COALESCE((
            SELECT COUNT(*)
            FROM public.tasks t
            WHERE t.tenant_id   = p_tenant_id
              AND t.assigned_to::text = ws.user_id::text
              AND t.status       = 'completed'
              AND t.updated_at  BETWEEN p_from AND p_to
        ), 0) AS tasks_completed
    FROM public.worker_sessions ws
    WHERE ws.tenant_id  = p_tenant_id
      AND ws.session_start BETWEEN p_from AND p_to
    GROUP BY ws.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_worker_productivity(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- 10. get_popular_searches
CREATE OR REPLACE FUNCTION public.get_popular_searches(
    p_tenant_id UUID,
    p_limit     INT DEFAULT 10
)
RETURNS TABLE (
    query        TEXT,
    search_count BIGINT,
    last_searched_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        query,
        COUNT(*)                AS search_count,
        MAX(created_at)         AS last_searched_at
    FROM public.search_history
    WHERE tenant_id = p_tenant_id
    GROUP BY query
    ORDER BY search_count DESC
    LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_popular_searches(UUID, INT) TO authenticated;

-- 11. calculate_contact_engagement_score
--     Returns 0-100 engagement score for a contact based on activity recency.
CREATE OR REPLACE FUNCTION public.calculate_contact_engagement_score(
    p_contact_id UUID,
    p_tenant_id  UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_score          NUMERIC := 0;
    v_last_activity  TIMESTAMPTZ;
    v_activity_count BIGINT;
    v_email_opens    BIGINT;
BEGIN
    -- Recent activity count (last 90 days)
    SELECT COUNT(*), MAX(created_at)
    INTO v_activity_count, v_last_activity
    FROM public.lead_activities
    WHERE contact_id = p_contact_id
      AND tenant_id  = p_tenant_id
      AND created_at >= NOW() - INTERVAL '90 days';

    -- Email open events
    SELECT COUNT(*) INTO v_email_opens
    FROM public.email_audit_log
    WHERE recipient_id = p_contact_id::TEXT
      AND tenant_id    = p_tenant_id
      AND event_type   = 'opened'
      AND created_at  >= NOW() - INTERVAL '90 days';

    -- Score: up to 50 pts for activity volume, 30 for recency, 20 for email engagement
    v_score := LEAST(v_activity_count * 5, 50)
             + CASE
                 WHEN v_last_activity >= NOW() - INTERVAL '7 days'  THEN 30
                 WHEN v_last_activity >= NOW() - INTERVAL '30 days' THEN 20
                 WHEN v_last_activity >= NOW() - INTERVAL '90 days' THEN 10
                 ELSE 0
               END
             + LEAST(v_email_opens * 4, 20);

    RETURN LEAST(v_score, 100);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_contact_engagement_score(UUID, UUID) TO authenticated;

-- 12. create_tenant_invitation
--     Creates a tenant invitation record and returns the token.
CREATE OR REPLACE FUNCTION public.create_tenant_invitation(
    p_tenant_id UUID,
    p_email     TEXT,
    p_role      TEXT DEFAULT 'member',
    p_invited_by UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.tenant_invitations (
        id, tenant_id, email, role, invited_by,
        token, expires_at, created_at
    ) VALUES (
        gen_random_uuid(),
        p_tenant_id,
        p_email,
        p_role,
        p_invited_by,
        v_token,
        NOW() + INTERVAL '7 days',
        NOW()
    )
    ON CONFLICT (tenant_id, email) DO UPDATE
        SET token      = v_token,
            role       = EXCLUDED.role,
            invited_by = EXCLUDED.invited_by,
            expires_at = NOW() + INTERVAL '7 days';

    RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tenant_invitation(UUID, TEXT, TEXT, UUID) TO authenticated;

-- 13. Plugin management functions
--     These back the PluginManager service.

CREATE TABLE IF NOT EXISTS public.plugins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    version     TEXT NOT NULL DEFAULT '1.0.0',
    config      JSONB DEFAULT '{}',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_plugins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plugin_id   UUID NOT NULL REFERENCES public.plugins(id) ON DELETE CASCADE,
    settings    JSONB DEFAULT '{}',
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    installed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE (tenant_id, plugin_id)
);

CREATE TABLE IF NOT EXISTS public.plugin_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plugin_id   UUID NOT NULL REFERENCES public.plugins(id) ON DELETE CASCADE,
    action      TEXT NOT NULL,
    data        JSONB DEFAULT '{}',
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.plugins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plugin_logs    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read active plugins" ON public.plugins;
CREATE POLICY "Everyone can read active plugins"
    ON public.plugins FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Tenant members read own plugins" ON public.tenant_plugins;
CREATE POLICY "Tenant members read own plugins"
    ON public.tenant_plugins FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant members manage own plugin logs" ON public.plugin_logs;
CREATE POLICY "Tenant members manage own plugin logs"
    ON public.plugin_logs FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.get_tenant_plugins(p_tenant_id UUID)
RETURNS TABLE (
    plugin_id UUID, slug TEXT, name TEXT, version TEXT,
    settings JSONB, installed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.id, p.slug, p.name, p.version, tp.settings, tp.installed_at
    FROM public.tenant_plugins tp
    JOIN public.plugins p ON p.id = tp.plugin_id
    WHERE tp.tenant_id = p_tenant_id
      AND p.is_active  = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_plugins(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_plugin_hooks(p_tenant_id UUID, p_event TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'plugin_id', p.id,
                'slug', p.slug,
                'settings', tp.settings
            )
        ), '[]'::JSONB
    )
    FROM public.tenant_plugins tp
    JOIN public.plugins p ON p.id = tp.plugin_id
    WHERE tp.tenant_id = p_tenant_id
      AND p.is_active  = true
      AND (p.config->>'hooks') IS NOT NULL
      AND p.config->'hooks' ? p_event;
$$;

GRANT EXECUTE ON FUNCTION public.get_plugin_hooks(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.install_plugin(
    p_tenant_id UUID,
    p_slug      TEXT,
    p_settings  JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plugin_id UUID;
    v_tp_id     UUID;
BEGIN
    SELECT id INTO v_plugin_id FROM public.plugins WHERE slug = p_slug AND is_active;
    IF v_plugin_id IS NULL THEN
        RAISE EXCEPTION 'Plugin % not found or inactive', p_slug;
    END IF;

    INSERT INTO public.tenant_plugins (tenant_id, plugin_id, settings, installed_by)
    VALUES (p_tenant_id, v_plugin_id, p_settings, auth.uid())
    ON CONFLICT (tenant_id, plugin_id) DO UPDATE SET settings = EXCLUDED.settings
    RETURNING id INTO v_tp_id;

    RETURN v_tp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.install_plugin(UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.uninstall_plugin(p_tenant_id UUID, p_slug TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.tenant_plugins tp
    USING public.plugins p
    WHERE p.id      = tp.plugin_id
      AND p.slug    = p_slug
      AND tp.tenant_id = p_tenant_id;
$$;

GRANT EXECUTE ON FUNCTION public.uninstall_plugin(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_plugin_activity(
    p_tenant_id UUID,
    p_plugin_id UUID,
    p_action    TEXT,
    p_data      JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.plugin_logs (tenant_id, plugin_id, action, data, user_id)
    VALUES (p_tenant_id, p_plugin_id, p_action, p_data, auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.log_plugin_activity(UUID, UUID, TEXT, JSONB) TO authenticated;

-- ============================================================
-- Supporting column additions for some of these functions
-- ============================================================

-- quotes: add view_count and last_viewed_at
ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS view_count      INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_viewed_at  TIMESTAMPTZ;

-- seo_articles: add view_count
ALTER TABLE public.seo_articles
    ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- workflow_definitions: add execution_count and last_executed_at
ALTER TABLE public.workflow_definitions
    ADD COLUMN IF NOT EXISTS execution_count   INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_executed_at  TIMESTAMPTZ;

-- tenant_invitations: add token column if missing
ALTER TABLE public.tenant_invitations
    ADD COLUMN IF NOT EXISTS token     UUID UNIQUE DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS role      TEXT DEFAULT 'member',
    ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days';

-- chart_of_accounts: add balance column
ALTER TABLE public.chart_of_accounts
    ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;
