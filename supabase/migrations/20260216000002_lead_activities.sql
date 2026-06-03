
-- Migration: Lead Activities and Dashboard Stats Update
-- Date: 2026-02-16

-- Drop old function first to change return type or signature if needed
DROP FUNCTION IF EXISTS get_tenant_dashboard_stats(UUID);

-- Create lead_activities table
CREATE TABLE IF NOT EXISTS public.lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    type VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
DROP POLICY IF EXISTS "Users can view activities for leads they can see" ON public.lead_activities;
CREATE POLICY "Users can view activities for leads they can see" ON public.lead_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.leads l
            WHERE l.id = lead_id
            AND l.tenant_id IN (
                SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert activities for leads they can see" ON public.lead_activities;
CREATE POLICY "Users can insert activities for leads they can see" ON public.lead_activities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.leads l
            WHERE l.id = lead_id
            AND l.tenant_id IN (
                SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON public.lead_activities(created_at);

-- Function to log lead stage changes
CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.lead_activities (
            lead_id,
            type,
            description,
            metadata
        )
        VALUES (
            NEW.id,
            'stage_change',
            'Stage changed from ' || COALESCE(OLD.status, 'none') || ' to ' || NEW.status,
            jsonb_build_object('old_stage', OLD.status, 'new_stage', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for lead stage changes
DROP TRIGGER IF EXISTS log_lead_stage_change_trigger ON public.leads;
CREATE TRIGGER log_lead_stage_change_trigger
AFTER UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_stage_change();

-- Update get_tenant_dashboard_stats to include pipeline stats
CREATE OR REPLACE FUNCTION get_tenant_dashboard_stats(tenant_id_param UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    total_rev DECIMAL;
    client_count INTEGER;
    active_projects INTEGER;
    pending_invoices INTEGER;
    recent_activity JSONB;
    monthly_rev JSONB;
    pipeline_stats JSONB;
BEGIN
    -- Total Revenue
    SELECT COALESCE(SUM(total_amount), 0) INTO total_rev
    FROM invoices
    WHERE tenant_id = tenant_id_param AND status = 'paid';

    -- Client Count
    SELECT COUNT(*) INTO client_count
    FROM profiles
    WHERE tenant_id = tenant_id_param AND role = 'client';

    -- Active Projects
    SELECT COUNT(*) INTO active_projects
    FROM projects
    WHERE tenant_id = tenant_id_param AND status NOT IN ('completed', 'cancelled');

    -- Pending Invoices
    SELECT COUNT(*) INTO pending_invoices
    FROM invoices
    WHERE tenant_id = tenant_id_param AND status = 'pending';

    -- Pipeline Stats
    SELECT jsonb_object_agg(stage, count) INTO pipeline_stats
    FROM (
        SELECT stage::text, COUNT(*) as count
        FROM deals
        WHERE tenant_id = tenant_id_param
        GROUP BY stage
    ) s;

    -- Recent Activity (simplified)
    SELECT jsonb_agg(act) INTO recent_activity
    FROM (
        SELECT 'deal' as type, name as title, created_at as date
        FROM deals
        WHERE tenant_id = tenant_id_param
        ORDER BY created_at DESC
        LIMIT 5
    ) act;

    -- Monthly Revenue (last 6 months)
    SELECT jsonb_agg(rev) INTO monthly_rev
    FROM (
        SELECT TO_CHAR(date_trunc('month', created_at), 'Mon') as month, SUM(total_amount) as amount
        FROM invoices
        WHERE tenant_id = tenant_id_param AND status = 'paid'
        AND created_at > NOW() - INTERVAL '6 months'
        GROUP BY 1
        ORDER BY MIN(created_at)
    ) rev;

    result := jsonb_build_object(
        'totalRevenue', total_rev,
        'clientCount', client_count,
        'activeProjects', active_projects,
        'pendingInvoices', pending_invoices,
        'recentActivity', COALESCE(recent_activity, '[]'::jsonb),
        'monthlyRevenue', COALESCE(monthly_rev, '[]'::jsonb),
        'pipeline', COALESCE(pipeline_stats, '{}'::jsonb)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;
