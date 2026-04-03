-- PLATFORM OPTIMIZATION MIGRATION
-- 1. Realtime Subscriptions (fix for 'mismatch between server and client bindings')
-- Required for postgres_changes filter on non-PK columns
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.deals REPLICA IDENTITY FULL;
ALTER TABLE public.business_clients REPLICA IDENTITY FULL;
ALTER TABLE public.business_invoices REPLICA IDENTITY FULL;

-- 2. Performance Indices
-- Ensures multi-tenant lookups are instantaneous
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON public.messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON public.projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_id ON public.deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_clients_tenant_id ON public.business_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_invoices_tenant_id ON public.business_invoices(tenant_id);

-- 3. Consolidated Dashboard Stats RPC
-- Eliminates 5 parallel frontend queries and fixes timeouts
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_projects BIGINT;
    v_total_clients BIGINT;
    v_total_leads BIGINT;
    v_deals_data JSONB;
    v_invoices_data JSONB;
    v_result JSONB;
BEGIN
    -- 1. Aggregate basic counts
    SELECT COUNT(*) INTO v_total_projects FROM public.projects WHERE tenant_id = p_tenant_id;
    SELECT COUNT(*) INTO v_total_clients FROM public.business_clients WHERE tenant_id = p_tenant_id;
    SELECT COUNT(*) INTO v_total_leads FROM public.leads WHERE tenant_id = p_tenant_id;

    -- 2. Fetch deals for calculations
    SELECT json_agg(json_build_object(
        'value', value,
        'probability', probability,
        'expected_close_date', expected_close_date,
        'stage', stage
    )) INTO v_deals_data 
    FROM public.deals 
    WHERE tenant_id = p_tenant_id;

    -- 3. Fetch invoices for revenue calculations
    SELECT json_agg(json_build_object(
        'id', id,
        'status', status,
        'total', total,
        'due_date', due_date
    )) INTO v_invoices_data 
    FROM public.business_invoices 
    WHERE tenant_id = p_tenant_id;

    -- 4. Construct final JSON
    v_result := jsonb_build_object(
        'totalProjects', COALESCE(v_total_projects, 0),
        'totalClients', COALESCE(v_total_clients, 0),
        'totalLeads', COALESCE(v_total_leads, 0),
        'deals', COALESCE(v_deals_data, '[]'::json),
        'invoices', COALESCE(v_invoices_data, '[]'::json)
    );

    RETURN v_result;
END;
$$;
