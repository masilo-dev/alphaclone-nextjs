-- P1: Unify contacts ↔ business_clients and repair orphaned deals

ALTER TABLE public.business_clients
    ADD COLUMN IF NOT EXISTS crm_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_business_clients_crm_contact
    ON public.business_clients (crm_contact_id)
    WHERE crm_contact_id IS NOT NULL;

-- Backfill contacts from business_clients (dedupe by tenant + email)
INSERT INTO public.contacts (
    tenant_id,
    first_name,
    last_name,
    email,
    phone,
    status,
    custom_fields,
    created_at,
    updated_at
)
SELECT
    bc.tenant_id,
    COALESCE(NULLIF(split_part(trim(bc.name), ' ', 1), ''), 'Contact'),
    COALESCE(
        NULLIF(substring(trim(bc.name) FROM position(' ' IN trim(bc.name)) + 1), ''),
        split_part(trim(bc.name), ' ', 1),
        'Unknown'
    ),
    bc.email,
    bc.phone,
    'active',
    jsonb_build_object(
        'business_client_id', bc.id,
        'synced_from', 'business_clients',
        'industry', bc.industry,
        'value', bc.value,
        'sales_stage', bc.sales_stage
    ),
    COALESCE(bc.created_at, NOW()),
    COALESCE(bc.updated_at, NOW())
FROM public.business_clients bc
WHERE bc.email IS NOT NULL
  AND trim(bc.email) <> ''
  AND NOT EXISTS (
      SELECT 1
      FROM public.contacts c
      WHERE c.tenant_id = bc.tenant_id
        AND lower(c.email) = lower(bc.email)
        AND c.deleted_at IS NULL
  );

-- Link business_clients → contacts
UPDATE public.business_clients bc
SET crm_contact_id = c.id
FROM public.contacts c
WHERE bc.tenant_id = c.tenant_id
  AND bc.email IS NOT NULL
  AND lower(bc.email) = lower(c.email)
  AND bc.crm_contact_id IS NULL
  AND c.deleted_at IS NULL;

-- Repair deals linked to business_clients id instead of contacts id
UPDATE public.deals d
SET contact_id = bc.crm_contact_id,
    updated_at = NOW()
FROM public.business_clients bc
WHERE d.contact_id = bc.id
  AND bc.crm_contact_id IS NOT NULL
  AND d.tenant_id = bc.tenant_id;

-- Repair null contact_id deals via business_clients email match in metadata/name
UPDATE public.deals d
SET contact_id = c.id,
    updated_at = NOW()
FROM public.business_clients bc
JOIN public.contacts c
  ON c.tenant_id = bc.tenant_id
 AND lower(c.email) = lower(bc.email)
 AND c.deleted_at IS NULL
WHERE d.contact_id IS NULL
  AND d.tenant_id = bc.tenant_id
  AND bc.crm_contact_id = c.id
  AND (d.metadata->>'client_id' = bc.id::text OR d.name ILIKE '%' || bc.name || '%');

-- Keep contacts in sync when business_clients are inserted/updated
CREATE OR REPLACE FUNCTION public.sync_business_client_to_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_contact_id uuid;
    v_first_name text;
    v_last_name text;
    v_status text := 'active';
BEGIN
    IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
        RETURN NEW;
    END IF;

    v_first_name := COALESCE(NULLIF(split_part(trim(NEW.name), ' ', 1), ''), 'Contact');
    IF position(' ' IN trim(NEW.name)) > 0 THEN
        v_last_name := COALESCE(NULLIF(substring(trim(NEW.name) FROM position(' ' IN trim(NEW.name)) + 1), ''), v_first_name);
    ELSE
        v_last_name := v_first_name;
    END IF;

    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE tenant_id = NEW.tenant_id
      AND lower(email) = lower(NEW.email)
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_contact_id IS NULL THEN
        INSERT INTO public.contacts (
            tenant_id,
            first_name,
            last_name,
            email,
            phone,
            status,
            custom_fields,
            created_at,
            updated_at
        ) VALUES (
            NEW.tenant_id,
            v_first_name,
            v_last_name,
            NEW.email,
            NEW.phone,
            v_status,
            jsonb_build_object(
                'business_client_id', NEW.id,
                'synced_from', 'business_clients',
                'sales_stage', NEW.sales_stage
            ),
            COALESCE(NEW.created_at, NOW()),
            COALESCE(NEW.updated_at, NOW())
        )
        RETURNING id INTO v_contact_id;
    ELSE
        UPDATE public.contacts
        SET
            first_name = v_first_name,
            last_name = v_last_name,
            phone = COALESCE(NEW.phone, phone),
            custom_fields = COALESCE(custom_fields, '{}'::jsonb) || jsonb_build_object(
                'business_client_id', NEW.id,
                'sales_stage', NEW.sales_stage
            ),
            updated_at = NOW()
        WHERE id = v_contact_id;
    END IF;

    NEW.crm_contact_id := v_contact_id;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_business_client_to_contact ON public.business_clients;
CREATE TRIGGER trg_sync_business_client_to_contact
    BEFORE INSERT OR UPDATE OF name, email, phone, sales_stage, tenant_id
    ON public.business_clients
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_business_client_to_contact();
