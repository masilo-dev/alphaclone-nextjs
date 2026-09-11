-- Update get_tenant_dashboard_stats to include more activity sources
CREATE OR REPLACE FUNCTION get_tenant_dashboard_stats(tenant_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_revenue numeric;
    v_total_clients int;
    v_active_projects int;
    v_pending_invoices int;
    v_total_messages int;
    v_pending_revenue numeric;
    v_recent_activity jsonb;
    v_monthly_revenue jsonb;
    v_start_date date;
    v_pipeline jsonb;
BEGIN
    -- 1. Total Revenue (Paid Invoices)
    SELECT COALESCE(SUM(total), 0)
    INTO v_total_revenue
    FROM business_invoices
    WHERE tenant_id = tenant_id_param AND status = 'paid';

    -- 2. Total Clients
    SELECT COUNT(*)
    INTO v_total_clients
    FROM business_clients
    WHERE tenant_id = tenant_id_param;

    -- 3. Active Projects
    SELECT COUNT(*)
    INTO v_active_projects
    FROM projects
    WHERE tenant_id = tenant_id_param AND status != 'done';

    -- 4. Pending Invoices Count
    SELECT COUNT(*)
    INTO v_pending_invoices
    FROM business_invoices
    WHERE tenant_id = tenant_id_param AND status IN ('sent', 'draft', 'overdue');

    -- 4a. Pending Revenue
    SELECT COALESCE(SUM(total), 0)
    INTO v_pending_revenue
    FROM business_invoices
    WHERE tenant_id = tenant_id_param AND status IN ('sent', 'overdue');

    -- 4b. Total Messages (approximated by counting channels/dms for now)
    SELECT COUNT(*)
    INTO v_total_messages
    FROM messages
    WHERE tenant_id = tenant_id_param;

    -- Pipeline Data
    SELECT json_object_agg(stage, count)
    INTO v_pipeline
    FROM (
        SELECT status as stage, COUNT(*) as count
        FROM leads
        WHERE tenant_id = tenant_id_param
        GROUP BY status
    ) pipeline_counts;

    -- 5. Recent Activity (Expanded)
    WITH recent_events AS (
        SELECT 'client' as type, 'New contact added: ' || name as title, created_at as date
        FROM business_clients
        WHERE tenant_id = tenant_id_param
        
        UNION ALL
        
        SELECT 'project' as type, 'Project updated: ' || name as title, updated_at as date
        FROM projects
        WHERE tenant_id = tenant_id_param
        
        UNION ALL
        
        SELECT 'invoice' as type, 'Invoice ' || status || ': ' || invoice_number as title, created_at as date
        FROM business_invoices
        WHERE tenant_id = tenant_id_param

        UNION ALL
        
        SELECT 'meeting' as type, 'New booking/meeting created' as title, created_at as date
        FROM meetings
        WHERE tenant_id = tenant_id_param

        UNION ALL
        
        SELECT 'task' as type, 'Task updated: ' || title as title, updated_at as date
        FROM tasks
        WHERE tenant_id = tenant_id_param

        UNION ALL
        
        SELECT 'contract' as type, 'Contract created: ' || title as title, created_at as date
        FROM contracts
        WHERE tenant_id = tenant_id_param
    )
    SELECT jsonb_agg(events)
    INTO v_recent_activity
    FROM (
        SELECT * FROM recent_events
        ORDER BY date DESC
        LIMIT 10
    ) events;

    -- 6. Monthly Revenue (Last 6 months)
    v_start_date := date_trunc('month', (CURRENT_DATE - INTERVAL '5 months'));
    
    WITH monthly_data AS (
        SELECT 
            to_char(date_trunc('month', issue_date), 'Mon') as month,
            EXTRACT(MONTH FROM issue_date) as month_num,
            EXTRACT(YEAR FROM issue_date) as year,
            COALESCE(SUM(total), 0) as amount
        FROM business_invoices
        WHERE tenant_id = tenant_id_param 
          AND status = 'paid'
          AND issue_date >= v_start_date
        GROUP BY 1, 2, 3
    )
    SELECT jsonb_agg(md ORDER BY year, month_num)
    INTO v_monthly_revenue
    FROM monthly_data md;

    -- Build final JSON
    RETURN json_build_object(
        'total_revenue', v_total_revenue,
        'total_clients', v_total_clients,
        'total_projects', v_active_projects,
        'pending_invoices', v_pending_invoices,
        'pending_revenue', v_pending_revenue,
        'total_messages', v_total_messages,
        'recent_activity', COALESCE(v_recent_activity, '[]'::jsonb),
        'monthly_revenue', COALESCE(v_monthly_revenue, '[]'::jsonb),
        'pipeline', COALESCE(v_pipeline, '{}'::jsonb)
    );
END;
$$;
