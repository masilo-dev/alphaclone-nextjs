-- Migration: Fix Lead Conversion to populate Business Clients and update Dashboard Stats
-- Date: 2026-02-16

-- 1. Update convert_lead_to_contact to insert into business_clients

-- Drop first to avoid parameter name conflict
DROP FUNCTION IF EXISTS public.convert_lead_to_contact(uuid, boolean, text);

CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(
    lead_id UUID,
    create_company BOOLEAN DEFAULT false,
    company_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_contact_id UUID;
    new_company_id UUID;
    new_client_id UUID;
    lead_record public.leads%ROWTYPE;
BEGIN
    -- Get lead data
    SELECT * INTO lead_record FROM public.leads WHERE id = lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    -- Check if already converted
    IF lead_record.status = 'converted' THEN
        RAISE EXCEPTION 'Lead already converted';
    END IF;

    -- Create Company if requested (for the Contacts/Deals system)
    IF create_company AND company_name IS NOT NULL THEN
        INSERT INTO public.companies (
            tenant_id,
            name,
            industry,
            location,
            phone,
            email,
            owner_id
        ) VALUES (
            lead_record.tenant_id,
            company_name,
            lead_record.industry,
            lead_record.location,
            lead_record.phone,
            lead_record.email,
            auth.uid()
        ) RETURNING id INTO new_company_id;
    END IF;

    -- Create Contact (for the Contacts/Deals system)
    INSERT INTO public.contacts (
        tenant_id,
        first_name,
        last_name,
        email,
        phone,
        company_id,
        lead_source,
        owner_id
    ) VALUES (
        lead_record.tenant_id,
        split_part(lead_record.contact_name, ' ', 1),
        split_part(lead_record.contact_name, ' ', 2),
        lead_record.email,
        lead_record.phone,
        new_company_id,
        lead_record.source,
        auth.uid()
    ) RETURNING id INTO new_contact_id;

    -- ------------------------------------------------------------------
    -- NEW: Create Business Client (for the CRM Directory / Dashboard)
    -- ------------------------------------------------------------------
    INSERT INTO public.business_clients (
        tenant_id,
        owner_id,
        name,
        email,
        phone,
        industry,
        location,
        lead_source,
        sales_stage,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        lead_record.tenant_id,
        auth.uid(),
        COALESCE(company_name, lead_record.business_name, lead_record.contact_name), -- Use Business Name or Contact Name
        lead_record.email,
        lead_record.phone,
        lead_record.industry,
        lead_record.location,
        'Converted Lead',
        'customer', -- Default to customer/active upon conversion
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO new_client_id;

    -- Update Lead status
    UPDATE public.leads
    SET 
        status = 'converted',
        converted_contact_id = new_contact_id,
        updated_at = NOW()
    WHERE id = lead_id;

    -- Log activity
    INSERT INTO public.lead_activities (
        lead_id,
        type,
        description,
        user_id,
        metadata
    ) VALUES (
        lead_id,
        'conversion',
        'Lead converted to Contact and Business Client',
        auth.uid(),
        '{}'::jsonb
    );

    RETURN new_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update get_tenant_dashboard_stats to count business_clients
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

    -- Client Count (UPDATED: Count business_clients instead of profiles)
    SELECT COUNT(*) INTO client_count
    FROM business_clients
    WHERE tenant_id = tenant_id_param AND is_active = true;

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

    -- Recent Activity (Mixed: Deals and Clients)
    -- Explicitly cast columns to ensure text/timestamptz match
    SELECT jsonb_agg(act) INTO recent_activity
    FROM (
        SELECT * FROM (
            SELECT 'deal'::text as type, name::text as title, created_at as date
            FROM deals
            WHERE tenant_id = tenant_id_param
            UNION ALL
            SELECT 'client'::text as type, name::text as title, created_at as date
            FROM business_clients
            WHERE tenant_id = tenant_id_param
        ) as combined_activity
        ORDER BY date DESC
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure RLS Policies for business_clients

-- Allow Tenant Admins to manage their clients
DROP POLICY IF EXISTS "Tenant Admins can manage business clients" ON public.business_clients;
CREATE POLICY "Tenant Admins can manage business clients" ON public.business_clients
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND (role = 'tenant_admin' OR role = 'admin')
        )
    );

-- Also add a policy for authenticated users to view if they belong to the tenant?
-- Or stick to strict role checking? Assuming strict for now.
