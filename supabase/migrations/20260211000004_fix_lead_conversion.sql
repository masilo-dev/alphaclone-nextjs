CREATE OR REPLACE FUNCTION convert_lead_to_contact(
    p_lead_id UUID,
    p_create_company BOOLEAN DEFAULT false,
    p_company_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_lead RECORD;
    v_contact_id UUID;
    v_company_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
BEGIN
    -- Get lead data
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;

    -- Check if already converted
    IF v_lead.stage = 'converted' THEN
        RAISE EXCEPTION 'Lead already converted';
    END IF;
    
    -- Extract Name parts from business_name
    v_first_name := SPLIT_PART(v_lead.business_name, ' ', 1);
    v_last_name := TRIM(SUBSTRING(v_lead.business_name FROM LENGTH(v_first_name) + 1));
    
    IF v_last_name = '' THEN
        v_last_name := 'Unknown';
    END IF;


    -- Create company if requested
    IF p_create_company AND p_company_name IS NOT NULL THEN
        INSERT INTO companies (
            tenant_id,
            name,
            industry,
            phone,
            email,
            address_line1,
            stage,
            source,
            owner_id,
            created_by
        ) VALUES (
            v_lead.tenant_id,
            p_company_name,
            v_lead.industry,
            v_lead.phone,
            v_lead.email,
            v_lead.location,
            'prospect',
            v_lead.source,
            v_lead.owner_id,
            auth.uid()
        ) RETURNING id INTO v_company_id;
    END IF;

    -- Create contact
    INSERT INTO contacts (
        tenant_id,
        company_id,
        first_name,
        last_name,
        email,
        phone,
        address_line1,
        status,
        lead_source,
        owner_id,
        original_lead_id,
        converted_from_lead_at,
        notes,
        created_by
    ) VALUES (
        v_lead.tenant_id,
        v_company_id,
        v_first_name,
        v_last_name,
        v_lead.email,
        v_lead.phone,
        v_lead.location,
        'active',
        v_lead.source,
        v_lead.owner_id,
        v_lead.id,
        NOW(),
        v_lead.notes,
        auth.uid()
    ) RETURNING id INTO v_contact_id;

    -- Update lead status
    UPDATE leads
    SET
        stage = 'converted'
    WHERE id = p_lead_id;

    RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
