-- Migration: Fix convert_lead_to_contact function removing invalid reference to contact_name
-- Date: 2026-02-18

-- Drop the function with the old signature just in case, or same signature if we don't add param yet.
-- I'll add a contact_name_override parameter to be future-proof.
DROP FUNCTION IF EXISTS public.convert_lead_to_contact(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.convert_lead_to_contact(uuid, boolean, text, text);

CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(
    lead_id UUID,
    create_company BOOLEAN DEFAULT false,
    company_name TEXT DEFAULT NULL,
    contact_name_override TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_contact_id UUID;
    new_company_id UUID;
    new_client_id UUID;
    lead_record public.leads%ROWTYPE;
    
    v_full_name TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
BEGIN
    -- Get lead data
    SELECT * INTO lead_record FROM public.leads WHERE id = lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    -- Check if already converted
    -- Note: 'stage' column is used instead of 'status'
    IF lead_record.stage = 'converted' THEN
        RAISE EXCEPTION 'Lead already converted';
    END IF;

    -- Determine Name (Use override, or fallback to business_name)
    v_full_name := COALESCE(contact_name_override, lead_record.business_name);
    
    -- Split Name Logic
    -- 1. Get first part
    v_first_name := split_part(v_full_name, ' ', 1);
    
    -- 2. Get the rest as last name
    IF position(' ' in v_full_name) > 0 THEN
        v_last_name := substring(v_full_name from position(' ' in v_full_name) + 1);
    ELSE
        -- Single word name (e.g. "Google")
        v_first_name := 'Contact'; -- Placeholder First Name
        v_last_name := v_full_name;
    END IF;

    -- Create Company if requested
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

    -- Create Contact
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
        v_first_name,
        v_last_name,
        lead_record.email,
        lead_record.phone,
        new_company_id,
        lead_record.source,
        auth.uid()
    ) RETURNING id INTO new_contact_id;

    -- Create Business Client
    INSERT INTO public.business_clients (
        tenant_id,
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
        lead_record.business_name, -- Use business_name directly as it exists and is NOT NULL
        lead_record.email,
        lead_record.phone,
        lead_record.industry,
        lead_record.location,
        'Converted Lead',
        'customer',
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO new_client_id;

    -- Update Lead status
    UPDATE public.leads
    SET 
        stage = 'converted',
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
