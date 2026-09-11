-- Link remaining orphaned deals + webhooks tables for Extensions module

-- Backfill crm_contact_id on business_clients via email or phone match
UPDATE public.business_clients bc
SET crm_contact_id = c.id
FROM public.contacts c
WHERE bc.crm_contact_id IS NULL
  AND bc.tenant_id = c.tenant_id
  AND c.deleted_at IS NULL
  AND (
      (bc.email IS NOT NULL AND trim(bc.email) <> '' AND lower(c.email) = lower(bc.email))
      OR (bc.phone IS NOT NULL AND trim(bc.phone) <> '' AND c.phone = bc.phone)
  );

-- Create contacts for business_clients with phone but no linked contact
INSERT INTO public.contacts (
    tenant_id, first_name, last_name, email, phone, status, custom_fields, created_at, updated_at
)
SELECT
    bc.tenant_id,
    COALESCE(NULLIF(split_part(trim(bc.name), ' ', 1), ''), 'Contact'),
    COALESCE(
        NULLIF(substring(trim(bc.name) FROM position(' ' IN trim(bc.name)) + 1), ''),
        split_part(trim(bc.name), ' ', 1),
        'Unknown'
    ),
    COALESCE(
        NULLIF(trim(bc.email), ''),
        'phone+' || regexp_replace(bc.phone, '[^0-9+]', '', 'g') || '@contacts.local'
    ),
    bc.phone,
    'active',
    jsonb_build_object('business_client_id', bc.id, 'synced_from', 'phone_backfill'),
    NOW(),
    NOW()
FROM public.business_clients bc
WHERE bc.crm_contact_id IS NULL
  AND bc.phone IS NOT NULL
  AND trim(bc.phone) <> ''
  AND NOT EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.tenant_id = bc.tenant_id
        AND c.phone = bc.phone
        AND c.deleted_at IS NULL
  );

UPDATE public.business_clients bc
SET crm_contact_id = c.id
FROM public.contacts c
WHERE bc.crm_contact_id IS NULL
  AND bc.tenant_id = c.tenant_id
  AND bc.phone IS NOT NULL
  AND c.phone = bc.phone
  AND c.deleted_at IS NULL;

-- Fuzzy link deals to contacts via business_clients name match
UPDATE public.deals d
SET contact_id = bc.crm_contact_id,
    updated_at = NOW()
FROM public.business_clients bc
WHERE d.contact_id IS NULL
  AND d.tenant_id = bc.tenant_id
  AND bc.crm_contact_id IS NOT NULL
  AND (
      lower(trim(split_part(d.name, ' - ', 1))) = lower(trim(bc.name))
      OR d.name ILIKE bc.name || '%'
      OR bc.name ILIKE trim(split_part(d.name, ' - ', 1)) || '%'
  );

-- Create contacts from leads referenced in deal metadata (phone/email from lead)
INSERT INTO public.contacts (
    tenant_id, first_name, last_name, email, phone, status, original_lead_id, custom_fields, created_at, updated_at
)
SELECT DISTINCT ON (l.id)
    l.tenant_id,
    COALESCE(NULLIF(split_part(trim(COALESCE(l.business_name, l.contact_name, 'Contact')), ' ', 1), ''), 'Contact'),
    COALESCE(
        NULLIF(substring(trim(COALESCE(l.business_name, l.contact_name, 'Contact')) FROM position(' ' IN trim(COALESCE(l.business_name, l.contact_name, 'Contact'))) + 1), ''),
        'Unknown'
    ),
    COALESCE(
        NULLIF(trim(l.email), ''),
        CASE
            WHEN NULLIF(trim(l.phone), '') IS NOT NULL
            THEN 'phone+' || regexp_replace(l.phone, '[^0-9+]', '', 'g') || '@contacts.local'
            ELSE 'lead+' || l.id::text || '@contacts.local'
        END
    ),
    l.phone,
    'active',
    l.id,
    jsonb_build_object('synced_from', 'deal_lead_metadata'),
    NOW(),
    NOW()
FROM public.deals d
JOIN public.leads l ON l.id::text = d.metadata->>'leadId'
WHERE d.contact_id IS NULL
  AND (NULLIF(trim(l.email), '') IS NOT NULL OR NULLIF(trim(l.phone), '') IS NOT NULL)
  AND NOT EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.tenant_id = l.tenant_id
        AND c.original_lead_id = l.id
        AND c.deleted_at IS NULL
  );

UPDATE public.deals d
SET contact_id = c.id,
    updated_at = NOW()
FROM public.leads l
JOIN public.contacts c ON c.original_lead_id = l.id AND c.tenant_id = l.tenant_id AND c.deleted_at IS NULL
WHERE d.contact_id IS NULL
  AND d.metadata->>'leadId' = l.id::text;

-- Outbound webhooks (Extensions module)
CREATE TABLE IF NOT EXISTS public.webhooks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    events      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    secret      TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id      UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
    event           TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
    attempts        INTEGER NOT NULL DEFAULT 0,
    response_status INTEGER,
    response_body   TEXT,
    error_message   TEXT,
    delivered_at    TIMESTAMPTZ,
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON public.webhooks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON public.webhook_deliveries (webhook_id, created_at DESC);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant webhooks" ON public.webhooks;
CREATE POLICY "Tenant webhooks"
    ON public.webhooks FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Tenant webhook deliveries"
    ON public.webhook_deliveries FOR ALL TO authenticated
    USING (
        webhook_id IN (
            SELECT w.id FROM public.webhooks w
            WHERE w.tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
        )
    )
    WITH CHECK (
        webhook_id IN (
            SELECT w.id FROM public.webhooks w
            WHERE w.tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
        )
    );
