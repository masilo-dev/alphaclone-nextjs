-- Guard SECURITY DEFINER convert_lead_to_contact so it cannot operate cross-tenant.

CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(
    lead_id uuid,
    create_company boolean DEFAULT false,
    company_name text DEFAULT NULL::text,
    contact_name_override text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_new_contact_id uuid;
    v_new_company_id uuid;
    v_new_client_id uuid;
    v_lead_record public.leads%ROWTYPE;
    v_full_name text;
    v_first_name text;
    v_last_name text;
BEGIN
    SELECT * INTO v_lead_record FROM public.leads WHERE id = lead_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    IF NOT public.user_belongs_to_tenant(v_lead_record.tenant_id) AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    IF v_lead_record.stage = 'converted' OR v_lead_record.client_id IS NOT NULL THEN
        RAISE EXCEPTION 'Lead already converted';
    END IF;

    v_full_name := COALESCE(NULLIF(trim(contact_name_override), ''), v_lead_record.business_name, 'Contact');
    v_first_name := split_part(v_full_name, ' ', 1);
    IF position(' ' in v_full_name) > 0 THEN
        v_last_name := substring(v_full_name from position(' ' in v_full_name) + 1);
    ELSE
        v_first_name := 'Contact';
        v_last_name := v_full_name;
    END IF;

    IF create_company AND company_name IS NOT NULL THEN
        INSERT INTO public.companies (
            tenant_id,
            name,
            industry,
            city,
            phone,
            email,
            owner_id
        ) VALUES (
            v_lead_record.tenant_id,
            company_name,
            v_lead_record.industry,
            v_lead_record.location,
            v_lead_record.phone,
            v_lead_record.email,
            auth.uid()
        ) RETURNING id INTO v_new_company_id;
    END IF;

    INSERT INTO public.contacts (
        tenant_id,
        first_name,
        last_name,
        email,
        phone,
        company_id,
        lead_source,
        owner_id,
        original_lead_id,
        converted_from_lead_at
    ) VALUES (
        v_lead_record.tenant_id,
        v_first_name,
        v_last_name,
        v_lead_record.email,
        v_lead_record.phone,
        v_new_company_id,
        v_lead_record.source,
        auth.uid(),
        lead_id,
        NOW()
    ) RETURNING id INTO v_new_contact_id;

    INSERT INTO public.business_clients (
        tenant_id,
        name,
        email,
        phone,
        company,
        sales_stage,
        value,
        description,
        custom_fields,
        location,
        is_active,
        industry,
        website,
        created_at,
        updated_at
    ) VALUES (
        v_lead_record.tenant_id,
        COALESCE(company_name, v_lead_record.business_name),
        v_lead_record.email,
        v_lead_record.phone,
        COALESCE(company_name, v_lead_record.business_name),
        'customer',
        COALESCE(v_lead_record.value, 0),
        v_lead_record.notes,
        jsonb_build_object(
            'lead_source', 'Converted Lead',
            'original_lead_source', v_lead_record.source,
            'original_lead_id', lead_id
        ),
        v_lead_record.location,
        true,
        v_lead_record.industry,
        v_lead_record.website,
        NOW(),
        NOW()
    ) RETURNING id INTO v_new_client_id;

    UPDATE public.leads
    SET
        stage = 'converted',
        client_id = v_new_client_id
    WHERE id = lead_id;

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
        jsonb_build_object(
            'contact_id', v_new_contact_id,
            'company_id', v_new_company_id,
            'client_id', v_new_client_id
        )
    );

    RETURN jsonb_build_object(
        'contact_id', v_new_contact_id,
        'company_id', v_new_company_id,
        'client_id', v_new_client_id
    );
END;
$function$;

