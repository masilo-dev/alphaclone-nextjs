-- Function to get comprehensive dashboard stats in one go
CREATE OR REPLACE FUNCTION get_tenant_dashboard_stats(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (important for RLS bypass if needed, though we should check RLS policies)
AS $$
DECLARE
    v_total_revenue numeric;
    v_total_clients int;
    v_active_projects int;
    v_pending_invoices int;
    v_recent_activity jsonb;
    v_monthly_revenue jsonb;
    v_start_date date;
BEGIN
    -- 1. Total Revenue (Paid Invoices)
    SELECT COALESCE(SUM(total), 0)
    INTO v_total_revenue
    FROM business_invoices
    WHERE tenant_id = p_tenant_id AND status = 'paid';

    -- 2. Total Clients
    SELECT COUNT(*)
    INTO v_total_clients
    FROM business_clients
    WHERE tenant_id = p_tenant_id;

    -- 3. Active Projects
    SELECT COUNT(*)
    INTO v_active_projects
    FROM projects -- Assuming this is the business projects table, businessProjectService.ts queried 'projects'
    WHERE tenant_id = p_tenant_id AND status != 'done';

    -- 4. Pending Invoices
    SELECT COUNT(*)
    INTO v_pending_invoices
    FROM business_invoices
    WHERE tenant_id = p_tenant_id AND status != 'paid';

    -- 5. Recent Activity (Union of recent events)
    -- We'll construct a lightweight json array
    WITH recent_events AS (
        SELECT 'client' as type, 'New client: ' || name as text, created_at as time
        FROM business_clients
        WHERE tenant_id = p_tenant_id
        
        UNION ALL
        
        SELECT 'project' as type, 'Project updated: ' || name as text, updated_at as time
        FROM projects
        WHERE tenant_id = p_tenant_id
        
        UNION ALL
        
        SELECT 'invoice' as type, 'Invoice ' || invoice_number || ' ' || status as text, created_at as time
        FROM business_invoices
        WHERE tenant_id = p_tenant_id
    )
    SELECT jsonb_agg(events)
    INTO v_recent_activity
    FROM (
        SELECT * FROM recent_events
        ORDER BY time DESC
        LIMIT 5
    ) events;

    -- 6. Monthly Revenue (Last 6 months)
    v_start_date := date_trunc('month', (CURRENT_DATE - INTERVAL '5 months'));
    
    WITH monthly_data AS (
        SELECT 
            to_char(date_trunc('month', issue_date), 'Mon') as month,
            EXTRACT(MONTH FROM issue_date) as month_num,
            EXTRACT(YEAR FROM issue_date) as year,
            COALESCE(SUM(total), 0) as revenue
        FROM business_invoices
        WHERE tenant_id = p_tenant_id 
          AND status = 'paid'
          AND issue_date >= v_start_date
        GROUP BY 1, 2, 3
    )
    SELECT jsonb_agg(md ORDER BY year, month_num)
    INTO v_monthly_revenue
    FROM monthly_data md;

    -- Build final JSON
    RETURN json_build_object(
        'totalRevenue', v_total_revenue,
        'totalClients', v_total_clients,
        'activeProjects', v_active_projects,
        'pendingInvoices', v_pending_invoices,
        'recentActivity', COALESCE(v_recent_activity, '[]'::jsonb),
        'monthlyRevenue', COALESCE(v_monthly_revenue, '[]'::jsonb)
    );
END;
$$;
