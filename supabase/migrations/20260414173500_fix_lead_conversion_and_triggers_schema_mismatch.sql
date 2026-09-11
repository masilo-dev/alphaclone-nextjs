CREATE OR REPLACE FUNCTION public.convert_lead_to_contact(lead_id uuid, create_company boolean DEFAULT false, company_name text DEFAULT NULL::text, contact_name_override text DEFAULT NULL::text)
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
    SELECT * INTO lead_record FROM public.leads WHERE id = lead_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    IF lead_record.stage = 'converted' OR lead_record.client_id IS NOT NULL THEN
        RAISE EXCEPTION 'Lead already converted';
    END IF;

    IF create_company AND company_name IS NOT NULL THEN
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
        lead_record.tenant_id,
        COALESCE(company_name, lead_record.business_name),
        lead_record.email,
        lead_record.phone,
        COALESCE(company_name, lead_record.business_name),
        'customer',
        COALESCE(lead_record.value, 0),
        lead_record.notes,
        '{}'::jsonb,
        lead_record.location,
        true,
        lead_record.industry,
        lead_record.website,
        NOW(),
        NOW()
    ) RETURNING id INTO new_client_id;

    UPDATE public.leads
    SET
        stage = 'converted',
        client_id = new_client_id
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
        '{}'::jsonb
    );

    RETURN new_client_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_lead_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.owner_id IS NOT NULL AND (OLD.owner_id IS NULL OR OLD.owner_id != NEW.owner_id) THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      old_value,
      new_value,
      created_at
    ) VALUES (
      NEW.owner_id,
      'lead_assigned',
      'lead',
      NEW.id,
      jsonb_build_object('owner_id', OLD.owner_id),
      jsonb_build_object('owner_id', NEW.owner_id),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_lead_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF (OLD.stage IS DISTINCT FROM NEW.stage) THEN
        INSERT INTO public.lead_activities (
            lead_id,
            type,
            description,
            metadata
        )
        VALUES (
            NEW.id,
            'stage_change',
            'Stage changed from ' || COALESCE(OLD.stage, 'none') || ' to ' || NEW.stage,
            jsonb_build_object('old_stage', OLD.stage, 'new_stage', NEW.stage)
        );
    END IF;
    RETURN NEW;
END;
$function$;
