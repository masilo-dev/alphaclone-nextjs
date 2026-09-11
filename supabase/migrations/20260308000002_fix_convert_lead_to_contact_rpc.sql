-- Fix convert_lead_to_contact function to match actual schema
CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(
    lead_id uuid, 
    create_company boolean DEFAULT false, 
    company_name text DEFAULT NULL::text,
    contact_name_override text DEFAULT NULL::text -- Added this parameter
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
BEGIN
    -- Get lead data
    SELECT * INTO lead_record FROM public.leads WHERE id = lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    -- Check if already converted (using stage or client_id)
    IF lead_record.stage = 'converted' OR lead_record.client_id IS NOT NULL THEN
        RAISE EXCEPTION 'Lead already converted';
    END IF;

    -- Create Company if requested (for the Contacts/Deals system)
    IF create_company AND company_name IS NOT NULL THEN
        -- The companies table doesn't have a 'location' column in the current schema
        INSERT INTO public.companies (
            tenant_id,
            name,
            industry,
            phone,
            email,
            owner_id
        ) VALUES (
            lead_record.tenant_id,
            company_name,
            lead_record.industry,
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
        split_part(COALESCE(contact_name_override, lead_record.business_name), ' ', 1),
        split_part(COALESCE(contact_name_override, lead_record.business_name), ' ', 2),
        lead_record.email,
        lead_record.phone,
        new_company_id,
        lead_record.source,
        auth.uid()
    ) RETURNING id INTO new_contact_id;

    -- ------------------------------------------------------------------
    -- NEW: Create Business Client (for the CRM Directory / Dashboard)
    -- ------------------------------------------------------------------
    -- The business_clients table doesn't have a 'lead_source' column
    INSERT INTO public.business_clients (
        tenant_id,
        owner_id,
        name,
        email,
        phone,
        industry,
        sales_stage,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        lead_record.tenant_id,
        auth.uid(),
        COALESCE(company_name, lead_record.business_name),
        lead_record.email,
        lead_record.phone,
        lead_record.industry,
        'customer', -- Default to customer/active upon conversion
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO new_client_id;

    -- Update Lead status using STAGE and CLIENT_ID
    -- removed updated_at = NOW() because leads table doesn't have updated_at
    UPDATE public.leads
    SET 
        stage = 'converted',
        client_id = new_client_id
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

    RETURN new_client_id; -- Return Client ID as it's more useful now
END;
$function$;
