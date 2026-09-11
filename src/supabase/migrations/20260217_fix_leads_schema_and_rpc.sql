-- Add client_id to leads if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'client_id') THEN
        ALTER TABLE leads ADD COLUMN client_id UUID REFERENCES business_clients(id);
    END IF;
END $$;

-- Fix convert_lead_to_contact function
CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(lead_id uuid, create_company boolean DEFAULT false, company_name text DEFAULT NULL::text)
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
        split_part(lead_record.business_name, ' ', 1), -- fallback if contact_name missing
        split_part(lead_record.business_name, ' ', 2),
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
        COALESCE(company_name, lead_record.business_name),
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

    -- Update Lead status using STAGE and CLIENT_ID
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
        '{}'::jsonb
    );

    RETURN new_client_id; -- Return Client ID as it's more useful now
END;
$function$;
