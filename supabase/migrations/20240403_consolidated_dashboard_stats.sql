-- Consolidated Dashboard Stats RPC
-- Purpose: Fetches all metrics and recent activity for the dashboard in a single trip.
-- Optimized with 60-second caching in the application layer.

CREATE OR REPLACE FUNCTION get_consolidated_dashboard_stats(p_tenant_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    v_start_date date;
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
BEGIN
    -- 1. Revenue Metrics (Invoices)
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

    -- 3. Lead & Pipeline Metrics
    SELECT COUNT(*)
    INTO v_total_leads
    FROM leads
    WHERE tenant_id = p_tenant_id;

    -- 3a. Client Metrics
    SELECT COUNT(*)
    INTO v_client_count
    FROM tenant_users tu
    JOIN profiles p ON tu.user_id = p.id
    WHERE tu.tenant_id = p_tenant_id AND p.role = 'client';

    -- 4. Momentum & Activity Calculations
    -- Activity in last 24h
    SELECT COUNT(*)
    INTO v_activity_24h
    FROM activity_logs
    WHERE tenant_id = p_tenant_id 
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND created_at >= v_now - INTERVAL '24 hours';

    -- New leads in last 24h
    SELECT COUNT(*)
    INTO v_new_leads_24h
    FROM leads
    WHERE tenant_id = p_tenant_id 
      AND created_at >= v_now - INTERVAL '24 hours';

    -- Stale leads (no status change or activity in 7 days)
    SELECT COUNT(*)
    INTO v_stale_leads
    FROM leads
    WHERE tenant_id = p_tenant_id 
      AND updated_at < v_now - INTERVAL '7 days'
      AND status NOT IN ('closed_won', 'closed_lost');

    -- Calculate Momentum Score (Scale 0-100)
    -- Base: Activity intensity + Pipeline freshness
    v_momentum_score := LEAST(100, (v_activity_24h * 5) + (v_new_leads_24h * 10));
    
    -- Penalize for stale leads if high
    IF v_stale_leads > 10 THEN
        v_momentum_score := GREATEST(0, v_momentum_score - 20);
    END IF;

    -- Calculate Login Streak (Days with at least one activity log)
    IF p_user_id IS NOT NULL THEN
        WITH daily_activity AS (
            SELECT DISTINCT date_trunc('day', created_at) as activity_day
            FROM activity_logs
            WHERE user_id = p_user_id
            ORDER BY activity_day DESC
        ),
        streaks AS (
            SELECT 
                activity_day,
                activity_day - (ROW_NUMBER() OVER (ORDER BY activity_day DESC) * INTERVAL '1 day') as group_id
            FROM daily_activity
        )
        SELECT COUNT(*)
        INTO v_login_streak
        FROM streaks
        WHERE group_id = (SELECT group_id FROM streaks LIMIT 1);
    END IF;

    -- 5. Deal Metrics (Weighted Pipeline & Forecast)
    SELECT 
        COALESCE(SUM(value * (CAST(probability AS numeric) / 100)), 0),
        COALESCE(SUM(CASE 
            WHEN stage = 'closed_won' THEN value 
            WHEN expected_close_date >= CURRENT_DATE THEN value * (CAST(probability AS numeric) / 100)
            ELSE 0 
        END), 0)
    INTO v_weighted_pipeline, v_sales_forecast
    FROM deals
    WHERE tenant_id = p_tenant_id AND stage != 'closed_lost';

    -- 6. Pipeline Stages (JSON map)
    SELECT jsonb_object_agg(stage, count)
    INTO v_pipeline_data
    FROM (
        SELECT COALESCE(status, 'new') as stage, COUNT(*) as count
        FROM leads
        WHERE tenant_id = p_tenant_id
        GROUP BY 1
    ) pipeline_counts;

    -- 7. Return Integrated JSON
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
        'monthlyRevenue', COALESCE(v_monthly_revenue, '[]'::jsonb),
        'pipeline', COALESCE(v_pipeline_data, '{}'::jsonb),
        'momentumScore', v_momentum_score,
        'loginStreak', v_login_streak,
        'activity24h', v_activity_24h,
        'newLeads24h', v_new_leads_24h,
        'staleLeads', v_stale_leads,
        'serverTime', v_now
    );
END;
$$;
