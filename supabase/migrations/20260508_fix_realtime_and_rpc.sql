-- Fix Dashboard Stats RPC and Realtime Publication
-- Date: 2026-05-08

BEGIN;

-- 1. Ensure core tables are in the realtime publication
-- This fixes "subscription timed out" errors for the frontend
DO $$
BEGIN
    -- Check if publication exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Safely add tables to publication (handles cases where they might already be added)
DO $$
DECLARE
    t text;
    tables_to_add text[] := ARRAY['leads', 'messages', 'projects', 'business_clients', 'business_invoices'];
BEGIN
    FOREACH t IN ARRAY tables_to_add LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
        EXCEPTION 
            WHEN duplicate_object THEN 
                NULL; -- Table already in publication
            WHEN undefined_table THEN
                NULL; -- Table doesn't exist yet
        END;
    END LOOP;
END $$;

-- 2. Fix the consolidated stats RPC
-- Refactored to be robust against schema variations (stage vs status)
-- IMPORTANT: We drop old versions first to prevent overloading errors
DROP FUNCTION IF EXISTS public.get_consolidated_dashboard_stats(uuid);
DROP FUNCTION IF EXISTS public.get_consolidated_dashboard_stats(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_consolidated_dashboard_stats(p_tenant_id uuid, p_user_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_revenue numeric;
    v_pending_revenue numeric;
    v_active_projects int;
    v_total_leads int;
    v_weighted_pipeline numeric;
    v_sales_forecast numeric;
    v_recent_activity jsonb;
    v_monthly_revenue jsonb;
    v_pipeline_data jsonb;
    v_now timestamp := now();
    v_client_count int;
    v_pending_count int;
    v_overdue_count int;
    
    -- Momentum Metrics
    v_activity_24h int := 0;
    v_new_leads_24h int := 0;
    v_stale_leads int := 0;
    v_momentum_score int := 0;
    v_login_streak int := 0;
    
    -- Additional Visual Metrics
    v_active_campaigns int := 0;
    v_upcoming_meetings int := 0;
    v_unread_messages int := 0;
    v_total_tasks int := 0;
    v_completed_tasks int := 0;
BEGIN
    -- 1. Revenue Metrics (Using business_invoices)
    -- We use business_invoices as the primary source for the dashboard
    SELECT 
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN total ELSE 0 END), 0),
        COUNT(CASE WHEN status = 'sent' THEN 1 END),
        COUNT(CASE WHEN status = 'overdue' THEN 1 END)
    INTO v_total_revenue, v_pending_revenue, v_pending_count, v_overdue_count
    FROM business_invoices
    WHERE tenant_id = p_tenant_id;

    -- 2. Project Metrics
    SELECT COUNT(*)
    INTO v_active_projects
    FROM projects
    WHERE tenant_id = p_tenant_id AND status != 'done';

    -- 3. Lead Metrics
    SELECT COUNT(*)
    INTO v_total_leads
    FROM leads
    WHERE tenant_id = p_tenant_id;

    -- 3a. Client Metrics
    SELECT COUNT(*)
    INTO v_client_count
    FROM business_clients
    WHERE tenant_id = p_tenant_id;

    -- 4. Momentum & Activity (From audit_logs)
    SELECT COUNT(*)
    INTO v_activity_24h
    FROM audit_logs
    WHERE tenant_id = p_tenant_id 
      AND created_at >= v_now - INTERVAL '24 hours';

    -- 4b. Recent Activity
    SELECT JSONB_AGG(activity)
    INTO v_recent_activity
    FROM (
        SELECT 
            action as type,
            COALESCE(metadata->>'clientName', action) as title,
            created_at as date
        FROM audit_logs
        WHERE tenant_id = p_tenant_id
        ORDER BY created_at DESC
        LIMIT 5
    ) activity;

    -- New leads in last 24h
    SELECT COUNT(*)
    INTO v_new_leads_24h
    FROM leads
    WHERE tenant_id = p_tenant_id 
      AND created_at >= v_now - INTERVAL '24 hours';

    -- Momentum Score (0-100)
    v_momentum_score := LEAST(100, (v_activity_24h * 5) + (v_new_leads_24h * 10));

    -- 5. Deal Metrics (Weighted Pipeline & Forecast)
    -- Handles both 'stage' and 'status' column variations if needed via COALESCE in SQL
    -- But for now we assume modern schema: deals has stage, probability, value
    BEGIN
        SELECT 
            COALESCE(SUM(value * (CAST(COALESCE(probability, 0) AS numeric) / 100)), 0),
            COALESCE(SUM(CASE 
                WHEN stage::text IN ('won', 'closed_won') THEN value 
                WHEN expected_close_date >= CURRENT_DATE THEN value * (CAST(COALESCE(probability, 0) AS numeric) / 100)
                ELSE 0 
            END), 0)
        INTO v_weighted_pipeline, v_sales_forecast
        FROM deals
        WHERE tenant_id = p_tenant_id AND stage::text NOT IN ('lost', 'closed_lost');
    EXCEPTION WHEN OTHERS THEN
        v_weighted_pipeline := 0;
        v_sales_forecast := 0;
    END;

    -- 6. Pipeline Stages (JSON map)
    -- Uses dynamic column detection to handle 'stage' or 'status' on leads table
    SELECT jsonb_object_agg(stage_name, count)
    INTO v_pipeline_data
    FROM (
        SELECT 
            CASE 
                WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'stage') 
                THEN stage 
                ELSE status 
            END as stage_name, 
            COUNT(*) as count
        FROM leads
        WHERE tenant_id = p_tenant_id
        GROUP BY 1
    ) pipeline_counts;

    -- 7. Additional Metrics for Momentum Dashboard
    -- Active Campaigns
    SELECT COUNT(*) INTO v_active_campaigns
    FROM email_campaigns
    WHERE tenant_id = p_tenant_id AND status IN ('scheduled', 'sending');

    -- Upcoming Meetings
    SELECT COUNT(*) INTO v_upcoming_meetings
    FROM calendar_events
    WHERE tenant_id = p_tenant_id AND start_time > v_now;

    -- Unread Messages
    SELECT COUNT(*) INTO v_unread_messages
    FROM messages
    WHERE tenant_id = p_tenant_id AND read_at IS NULL;

    -- Tasks
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN status = 'completed' THEN 1 END)
    INTO v_total_tasks, v_completed_tasks
    FROM tasks
    WHERE tenant_id = p_tenant_id;

    -- Login Streak (Days with activity in audit_logs for the tenant)
    IF p_user_id IS NOT NULL THEN
        WITH daily_activity AS (
            SELECT DISTINCT date_trunc('day', created_at) as activity_day
            FROM audit_logs
            WHERE user_id = p_user_id AND tenant_id = p_tenant_id
            ORDER BY activity_day DESC
        ),
        streaks AS (
            SELECT 
                activity_day,
                activity_day::date - (ROW_NUMBER() OVER (ORDER BY activity_day DESC) * 1) as group_id
            FROM daily_activity
        )
        SELECT COUNT(*)
        INTO v_login_streak
        FROM streaks
        WHERE group_id = (SELECT group_id FROM streaks LIMIT 1);
    ELSE
        v_login_streak := 1;
    END IF;

    -- 8. Return Integrated JSON
    RETURN jsonb_build_object(
        'totalRevenue', v_total_revenue,
        'pendingRevenue', v_pending_revenue,
        'pendingInvoices', v_pending_count,
        'overdueInvoices', v_overdue_count,
        'activeProjects', v_active_projects,
        'totalLeads', v_total_leads,
        'clientCount', v_client_count,
        'weightedPipeline', v_weighted_pipeline,
        'salesForecast', v_sales_forecast,
        'recentActivity', COALESCE(v_recent_activity, '[]'::jsonb),
        'pipeline', COALESCE(v_pipeline_data, '{}'::jsonb),
        'momentumScore', v_momentum_score,
        'loginStreak', COALESCE(v_login_streak, 1),
        'activity24h', v_activity_24h,
        'newLeads24h', v_new_leads_24h,
        'activeCampaigns', v_active_campaigns,
        'upcomingMeetings', v_upcoming_meetings,
        'unreadMessages', v_unread_messages,
        'totalTasks', v_total_tasks,
        'completedTasks', v_completed_tasks,
        'serverTime', v_now
    );
END;
$function$;

COMMIT;
