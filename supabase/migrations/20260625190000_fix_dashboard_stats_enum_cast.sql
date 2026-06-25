-- Fix get_consolidated_dashboard_stats: COALESCE(status, '') fails on enum columns
-- Error: invalid input value for enum project_status: ""

BEGIN;

CREATE OR REPLACE FUNCTION public.get_consolidated_dashboard_stats(p_tenant_id uuid, p_user_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_total_revenue numeric := 0;
    v_pending_revenue numeric := 0;
    v_active_projects int := 0;
    v_total_leads int := 0;
    v_weighted_pipeline numeric := 0;
    v_sales_forecast numeric := 0;
    v_recent_activity jsonb := '[]'::jsonb;
    v_pipeline_data jsonb := '{}'::jsonb;
    v_now timestamp := now();
    v_client_count int := 0;
    v_pending_count int := 0;
    v_overdue_count int := 0;
    v_total_won_value numeric := 0;
    v_activity_24h int := 0;
    v_new_leads_24h int := 0;
    v_stale_leads int := 0;
    v_momentum_score int := 0;
    v_login_streak int := 1;
    v_active_campaigns int := 0;
    v_upcoming_meetings int := 0;
    v_unread_messages int := 0;
    v_total_tasks int := 0;
    v_completed_tasks int := 0;
    v_has_leads_stage boolean := false;
    v_has_leads_status boolean := false;
    v_has_leads_created_at boolean := false;
    v_has_deals_stage boolean := false;
    v_has_deals_status boolean := false;
    v_has_deals_probability boolean := false;
    v_has_deals_expected_close boolean := false;
    v_has_messages_read_at boolean := false;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'stage') INTO v_has_leads_stage;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'status') INTO v_has_leads_status;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'created_at') INTO v_has_leads_created_at;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'stage') INTO v_has_deals_stage;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'status') INTO v_has_deals_status;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'probability') INTO v_has_deals_probability;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'expected_close_date') INTO v_has_deals_expected_close;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'read_at') INTO v_has_messages_read_at;

    -- Revenue
    IF to_regclass('public.journal_entry_lines') IS NOT NULL AND to_regclass('public.chart_of_accounts') IS NOT NULL THEN
        SELECT COALESCE(SUM(
            CASE WHEN coa.normal_balance = 'debit' THEN (jel.debit_amount - jel.credit_amount)
                 ELSE (jel.credit_amount - jel.debit_amount) END
        ), 0) INTO v_total_revenue
        FROM chart_of_accounts coa
        JOIN journal_entry_lines jel ON coa.id = jel.account_id
        JOIN journal_entries je ON jel.entry_id = je.id
        WHERE coa.tenant_id = p_tenant_id
          AND coa.account_type IN ('revenue', 'other_income')
          AND je.status = 'posted' AND je.voided_at IS NULL;

        IF to_regclass('public.business_invoices') IS NOT NULL THEN
            SELECT COALESCE(SUM(total), 0), COUNT(*) FILTER (WHERE status = 'sent'), COUNT(*) FILTER (WHERE status = 'overdue')
            INTO v_pending_revenue, v_pending_count, v_overdue_count
            FROM business_invoices WHERE tenant_id = p_tenant_id AND status IN ('sent', 'overdue');
        END IF;
    ELSIF to_regclass('public.business_invoices') IS NOT NULL THEN
        SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0),
               COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN total ELSE 0 END), 0),
               COUNT(*) FILTER (WHERE status = 'sent'), COUNT(*) FILTER (WHERE status = 'overdue')
        INTO v_total_revenue, v_pending_revenue, v_pending_count, v_overdue_count
        FROM business_invoices WHERE tenant_id = p_tenant_id;
    END IF;

    -- Projects: cast enum to text before COALESCE to avoid "" enum cast error
    IF to_regclass('public.projects') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_active_projects
        FROM projects
        WHERE tenant_id = p_tenant_id
          AND lower(COALESCE(status::text, '')) NOT IN ('done', 'completed', 'cancelled', 'declined');
    END IF;

    -- Leads
    IF to_regclass('public.leads') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_total_leads FROM leads WHERE tenant_id = p_tenant_id;

        IF v_has_leads_created_at THEN
            EXECUTE $sql$ SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND created_at >= $2 - INTERVAL '24 hours' $sql$
            INTO v_new_leads_24h USING p_tenant_id, v_now;
        END IF;

        IF v_has_leads_status THEN
            IF v_has_leads_created_at THEN
                EXECUTE $sql$ SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND created_at < $2 - INTERVAL '7 days'
                    AND COALESCE(status::text, '') NOT IN ('closed_won', 'closed_lost', 'won', 'lost') $sql$
                INTO v_stale_leads USING p_tenant_id, v_now;
            ELSE
                EXECUTE $sql$ SELECT COUNT(*) FROM leads WHERE tenant_id = $1
                    AND COALESCE(status::text, '') NOT IN ('closed_won', 'closed_lost', 'won', 'lost') $sql$
                INTO v_stale_leads USING p_tenant_id;
            END IF;
        ELSIF v_has_leads_stage THEN
            IF v_has_leads_created_at THEN
                EXECUTE $sql$ SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND created_at < $2 - INTERVAL '7 days'
                    AND COALESCE(stage::text, '') NOT IN ('closed_won', 'closed_lost', 'won', 'lost') $sql$
                INTO v_stale_leads USING p_tenant_id, v_now;
            ELSE
                EXECUTE $sql$ SELECT COUNT(*) FROM leads WHERE tenant_id = $1
                    AND COALESCE(stage::text, '') NOT IN ('closed_won', 'closed_lost', 'won', 'lost') $sql$
                INTO v_stale_leads USING p_tenant_id;
            END IF;
        END IF;

        IF v_has_leads_stage THEN
            EXECUTE $sql$ SELECT COALESCE(jsonb_object_agg(stage_name, stage_count), '{}'::jsonb)
                FROM (SELECT COALESCE(stage::text, 'unknown') AS stage_name, COUNT(*) AS stage_count
                      FROM leads WHERE tenant_id = $1 GROUP BY 1) pipeline_counts $sql$
            INTO v_pipeline_data USING p_tenant_id;
        ELSIF v_has_leads_status THEN
            EXECUTE $sql$ SELECT COALESCE(jsonb_object_agg(stage_name, stage_count), '{}'::jsonb)
                FROM (SELECT COALESCE(status::text, 'unknown') AS stage_name, COUNT(*) AS stage_count
                      FROM leads WHERE tenant_id = $1 GROUP BY 1) pipeline_counts $sql$
            INTO v_pipeline_data USING p_tenant_id;
        END IF;
    END IF;

    IF to_regclass('public.business_clients') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_client_count FROM business_clients WHERE tenant_id = p_tenant_id;
    END IF;

    IF to_regclass('public.audit_logs') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_activity_24h FROM audit_logs
        WHERE tenant_id = p_tenant_id AND created_at >= v_now - INTERVAL '24 hours';

        SELECT COALESCE(JSONB_AGG(activity), '[]'::jsonb) INTO v_recent_activity
        FROM (SELECT action as type, COALESCE(metadata->>'clientName', action) as title, created_at as date
              FROM audit_logs WHERE tenant_id = p_tenant_id ORDER BY created_at DESC LIMIT 5) activity;

        IF p_user_id IS NOT NULL THEN
            WITH daily_activity AS (
                SELECT DISTINCT date_trunc('day', created_at)::date as activity_day
                FROM audit_logs WHERE user_id = p_user_id AND tenant_id = p_tenant_id
            ), streaks AS (
                SELECT activity_day, activity_day - ROW_NUMBER() OVER (ORDER BY activity_day DESC)::integer AS group_id
                FROM daily_activity
            )
            SELECT COALESCE(COUNT(*), 1) INTO v_login_streak FROM streaks
            WHERE group_id = (SELECT group_id FROM streaks ORDER BY activity_day DESC LIMIT 1);
        END IF;
    END IF;

    v_momentum_score := LEAST(100, (v_activity_24h * 5) + (v_new_leads_24h * 10));
    IF v_stale_leads > 10 THEN v_momentum_score := GREATEST(0, v_momentum_score - 20); END IF;

    IF to_regclass('public.deals') IS NOT NULL THEN
        BEGIN
            EXECUTE format($sql$
                SELECT COALESCE(SUM(COALESCE(value, 0) * CASE WHEN %1$s THEN COALESCE(probability, 0)::numeric / 100 ELSE 1 END), 0),
                       COALESCE(SUM(CASE WHEN %2$s IN ('won', 'closed_won') THEN COALESCE(value, 0)
                            WHEN %3$s AND expected_close_date >= CURRENT_DATE THEN COALESCE(value, 0) * CASE WHEN %1$s THEN COALESCE(probability, 0)::numeric / 100 ELSE 1 END
                            ELSE 0 END), 0),
                       COALESCE(SUM(CASE WHEN %2$s IN ('won', 'closed_won') THEN COALESCE(value, 0) ELSE 0 END), 0)
                FROM deals WHERE tenant_id = $1 AND %2$s NOT IN ('lost', 'closed_lost')
            $sql$, CASE WHEN v_has_deals_probability THEN 'true' ELSE 'false' END,
                CASE WHEN v_has_deals_stage THEN 'COALESCE(stage::text, '''')' WHEN v_has_deals_status THEN 'COALESCE(status::text, '''')' ELSE '''''' END,
                CASE WHEN v_has_deals_expected_close THEN 'true' ELSE 'false' END)
            INTO v_weighted_pipeline, v_sales_forecast, v_total_won_value USING p_tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_weighted_pipeline := 0; v_sales_forecast := 0; v_total_won_value := 0;
        END;
    END IF;

    IF to_regclass('public.email_campaigns') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_active_campaigns FROM email_campaigns
        WHERE tenant_id = p_tenant_id AND COALESCE(status::text, '') IN ('scheduled', 'sending');
    END IF;

    IF to_regclass('public.calendar_events') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_upcoming_meetings FROM calendar_events
        WHERE tenant_id = p_tenant_id AND start_time > v_now;
    END IF;

    IF to_regclass('public.messages') IS NOT NULL THEN
        IF v_has_messages_read_at THEN
            SELECT COUNT(*) INTO v_unread_messages FROM messages WHERE tenant_id = p_tenant_id AND read_at IS NULL;
        ELSE
            SELECT COUNT(*) INTO v_unread_messages FROM messages WHERE tenant_id = p_tenant_id;
        END IF;
    END IF;

    IF to_regclass('public.tasks') IS NOT NULL THEN
        SELECT COUNT(*), COUNT(*) FILTER (WHERE COALESCE(status::text, '') = 'completed')
        INTO v_total_tasks, v_completed_tasks FROM tasks WHERE tenant_id = p_tenant_id;
    END IF;

    RETURN jsonb_build_object(
        'totalRevenue', COALESCE(v_total_revenue, 0),
        'pendingRevenue', COALESCE(v_pending_revenue, 0),
        'pendingInvoices', COALESCE(v_pending_count, 0),
        'overdueInvoices', COALESCE(v_overdue_count, 0),
        'activeProjects', COALESCE(v_active_projects, 0),
        'totalLeads', COALESCE(v_total_leads, 0),
        'clientCount', COALESCE(v_client_count, 0),
        'weightedPipeline', COALESCE(v_weighted_pipeline, 0),
        'salesForecast', COALESCE(v_sales_forecast, 0),
        'totalWonValue', COALESCE(v_total_won_value, 0),
        'recentActivity', COALESCE(v_recent_activity, '[]'::jsonb),
        'pipeline', COALESCE(v_pipeline_data, '{}'::jsonb),
        'momentumScore', COALESCE(v_momentum_score, 0),
        'loginStreak', COALESCE(v_login_streak, 1),
        'activity24h', COALESCE(v_activity_24h, 0),
        'newLeads24h', COALESCE(v_new_leads_24h, 0),
        'staleLeads', COALESCE(v_stale_leads, 0),
        'activeCampaigns', COALESCE(v_active_campaigns, 0),
        'upcomingMeetings', COALESCE(v_upcoming_meetings, 0),
        'unreadMessages', COALESCE(v_unread_messages, 0),
        'totalTasks', COALESCE(v_total_tasks, 0),
        'completedTasks', COALESCE(v_completed_tasks, 0),
        'serverTime', v_now
    );
END;
$function$;

COMMIT;
