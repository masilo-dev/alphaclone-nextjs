-- Fix convert_lead_to_contact function schema errors
-- 1. Remove lead_source from business_clients insert
-- 2. Map location to city for companies insert 
-- 3. Use client_id instead of converted_contact_id for leads update

CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(
    lead_id uuid,
    create_company boolean DEFAULT false,
    company_name text DEFAULT NULL::text,
    contact_name_override text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
    IF lead_record.stage = 'converted' THEN
        RAISE EXCEPTION 'Lead already converted';
    END IF;

    -- Determine Name (Use override, or fallback to business_name)
    v_full_name := COALESCE(contact_name_override, lead_record.business_name);
    
    -- Split Name Logic
    v_first_name := split_part(v_full_name, ' ', 1);
    
    IF position(' ' in v_full_name) > 0 THEN
        v_last_name := substring(v_full_name from position(' ' in v_full_name) + 1);
    ELSE
        v_first_name := 'Contact';
        v_last_name := v_full_name;
    END IF;

    -- Create Company if requested
    -- companies table uses city/country instead of a single 'location' column
    IF create_company AND company_name IS NOT NULL THEN
        INSERT INTO public.companies (
            tenant_id,
            name,
            industry,
            city,       -- map lead.location -> city (closest field match)
            phone,
            email,
            owner_id
        ) VALUES (
            lead_record.tenant_id,
            company_name,
            lead_record.industry,
            lead_record.location,  -- lead has a single text location field
            lead_record.phone,
            lead_record.email,
            auth.uid()
        ) RETURNING id INTO new_company_id;
    END IF;

    -- Create Contact
    -- contacts table has lead_source column
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
        lead_record.source,  -- leads.source -> contacts.lead_source
        auth.uid()
    ) RETURNING id INTO new_contact_id;

    -- Create Business Client
    -- business_clients table does NOT have a 'lead_source' column; store it in custom_fields
    -- business_clients DOES have a 'location' column
    INSERT INTO public.business_clients (
        tenant_id,
        name,
        email,
        phone,
        industry,
        location,
        sales_stage,
        is_active,
        custom_fields,
        created_at,
        updated_at
    ) VALUES (
        lead_record.tenant_id,
        lead_record.business_name,
        lead_record.email,
        lead_record.phone,
        lead_record.industry,
        lead_record.location,
        'customer',
        true,
        jsonb_build_object('lead_source', 'Converted Lead', 'original_lead_source', lead_record.source),
        NOW(),
        NOW()
    ) RETURNING id INTO new_client_id;

    -- Update Lead status
    -- leads table has client_id, not converted_contact_id
    UPDATE public.leads
    SET 
        stage = 'converted',
        client_id = new_client_id,
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
        jsonb_build_object('client_id', new_client_id, 'contact_id', new_contact_id)
    );

    RETURN new_contact_id;
END;
$function$;
