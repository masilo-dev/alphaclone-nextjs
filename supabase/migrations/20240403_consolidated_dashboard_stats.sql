-- Consolidated Dashboard Stats RPC
-- Purpose: Fetches all metrics and recent activity for the dashboard in a single trip.
-- Optimized with 60-second caching in the application layer.

CREATE OR REPLACE FUNCTION get_consolidated_dashboard_stats(p_tenant_id uuid)
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
BEGIN
    -- 1. Revenue Metrics (Invoices)
    SELECT 
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN total ELSE 0 END), 0)
    INTO v_total_revenue, v_pending_revenue
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

    -- 4. Deal Metrics (Weighted Pipeline & Forecast)
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

    -- 5. Pipeline Stages (JSON map)
    SELECT jsonb_object_agg(stage, count)
    INTO v_pipeline_data
    FROM (
        SELECT COALESCE(status, 'new') as stage, COUNT(*) as count
        FROM leads
        WHERE tenant_id = p_tenant_id
        GROUP BY 1
    ) pipeline_counts;

    -- 6. Enriched Recent Activity (Cross-module)
    WITH recent_events AS (
        SELECT 'contact' as type, 'New contact: ' || name as title, created_at as date
        FROM business_leads
        WHERE tenant_id = p_tenant_id
        
        UNION ALL
        
        SELECT 'project' as type, 'Project updated: ' || name as title, updated_at as date
        FROM projects
        WHERE tenant_id = p_tenant_id
        
        UNION ALL
        
        SELECT 'invoice' as type, 'Invoice #' || invoice_number || ' ' || status as title, updated_at as date
        FROM business_invoices
        WHERE tenant_id = p_tenant_id
        
        UNION ALL
        
        SELECT 'deal' as type, 'Deal updated: ' || title as title, updated_at as date
        FROM deals
        WHERE tenant_id = p_tenant_id
    )
    SELECT jsonb_agg(events)
    INTO v_recent_activity
    FROM (
        SELECT * FROM recent_events
        ORDER BY date DESC
        LIMIT 10
    ) events;

    -- 7. Monthly Revenue (Last 6 Months)
    v_start_date := date_trunc('month', (CURRENT_DATE - INTERVAL '5 months'));
    
    WITH monthly_data AS (
        SELECT 
            to_char(date_trunc('month', issue_date), 'Mon') as month,
            EXTRACT(MONTH FROM issue_date) as month_num,
            EXTRACT(YEAR FROM issue_date) as year,
            COALESCE(SUM(total), 0) as amount
        FROM business_invoices
        WHERE tenant_id = p_tenant_id 
          AND status = 'paid'
          AND issue_date >= v_start_date
        GROUP BY 1, 2, 3
    )
    SELECT jsonb_agg(md ORDER BY year, month_num)
    INTO v_monthly_revenue
    FROM monthly_data md;

    -- 8. Return Integrated JSON
    RETURN jsonb_build_object(
        'totalRevenue', v_total_revenue,
        'pendingRevenue', v_pending_revenue,
        'activeProjects', v_active_projects,
        'totalLeads', v_total_leads,
        'weightedPipeline', v_weighted_pipeline,
        'salesForecast', v_sales_forecast,
        'recentActivity', COALESCE(v_recent_activity, '[]'::jsonb),
        'monthlyRevenue', COALESCE(v_monthly_revenue, '[]'::jsonb),
        'pipeline', COALESCE(v_pipeline_data, '{}'::jsonb),
        'serverTime', v_now
    );
END;
$$;
