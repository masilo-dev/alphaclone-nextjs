-- Fix deals.contact_id FK (was incorrectly referencing profiles) and link orphaned deals

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_contact_id_fkey;

ALTER TABLE public.deals
    ADD CONSTRAINT deals_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

-- 1. Via metadata.leadId -> leads.client_id -> business_clients.crm_contact_id
UPDATE public.deals d
SET contact_id = bc.crm_contact_id,
    updated_at = NOW()
FROM public.leads l
JOIN public.business_clients bc ON bc.id = l.client_id
WHERE d.contact_id IS NULL
  AND d.tenant_id = l.tenant_id
  AND d.metadata->>'leadId' = l.id::text
  AND bc.crm_contact_id IS NOT NULL;

-- 2. Via metadata.leadId -> lead email -> contacts
UPDATE public.deals d
SET contact_id = c.id,
    updated_at = NOW()
FROM public.leads l
JOIN public.contacts c
  ON c.tenant_id = l.tenant_id
 AND lower(c.email) = lower(l.email)
 AND c.deleted_at IS NULL
WHERE d.contact_id IS NULL
  AND d.tenant_id = l.tenant_id
  AND d.metadata->>'leadId' = l.id::text
  AND l.email IS NOT NULL
  AND trim(l.email) <> '';

-- 3. Via deal name prefix match to business_clients (before " - ")
UPDATE public.deals d
SET contact_id = bc.crm_contact_id,
    updated_at = NOW()
FROM public.business_clients bc
WHERE d.contact_id IS NULL
  AND d.tenant_id = bc.tenant_id
  AND bc.crm_contact_id IS NOT NULL
  AND (
    lower(trim(split_part(d.name, ' - ', 1))) = lower(trim(bc.name))
    OR lower(trim(d.name)) = lower(trim(bc.name))
  );

-- 4. Populate contact_name/contact_email when columns exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'contact_name'
    ) THEN
        UPDATE public.deals d
        SET
            contact_name = COALESCE(d.contact_name, c.full_name, c.first_name || ' ' || c.last_name),
            contact_email = COALESCE(d.contact_email, c.email),
            updated_at = NOW()
        FROM public.contacts c
        WHERE d.contact_id = c.id
          AND (d.contact_name IS NULL OR d.contact_email IS NULL);
    END IF;
END $$;
