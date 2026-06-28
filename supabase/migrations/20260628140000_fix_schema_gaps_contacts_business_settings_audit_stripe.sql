-- Fix schema gaps: tables/columns referenced in app code but missing from migrations.
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

BEGIN;

-- ── 1. business_settings (Settings, invoices, email provider) ───────────────
CREATE TABLE IF NOT EXISTS public.business_settings (
  tenant_id              UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  business_name          TEXT,
  logo_url               TEXT,
  brand_color            TEXT DEFAULT '#2dd4bf',
  address                TEXT,
  phone                  TEXT,
  email                  TEXT,
  tax_rate               NUMERIC(5,2) DEFAULT 0,
  currency               TEXT DEFAULT 'USD',
  invoice_prefix         TEXT DEFAULT 'INV',
  bank_details           TEXT,
  mobile_payment_details TEXT,
  settings               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members manage business settings" ON public.business_settings;
CREATE POLICY "Tenant members manage business settings"
  ON public.business_settings
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- ── 2. contacts soft-delete + lead conversion columns ───────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS converted_from_lead_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at
  ON public.contacts (tenant_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_original_lead
  ON public.contacts (original_lead_id)
  WHERE original_lead_id IS NOT NULL;

-- ── 3. audit_logs writers (activityService, Stripe webhook) ─────────────────
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'error', 'critical'));

-- ── 4. stripe_webhook_events (idempotent Stripe webhook processing) ─────────
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id     VARCHAR(255) UNIQUE NOT NULL,
  event_type          VARCHAR(100) NOT NULL,
  api_version         VARCHAR(20),
  created_at_stripe   TIMESTAMPTZ NOT NULL,
  processed_at        TIMESTAMPTZ DEFAULT NOW(),
  status              VARCHAR(20) DEFAULT 'processed'
    CHECK (status IN ('processed', 'failed', 'skipped', 'retrying')),
  event_data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_attempts INTEGER DEFAULT 1,
  last_error          TEXT,
  tenant_id           UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  customer_id         VARCHAR(255),
  subscription_id     VARCHAR(255),
  amount_cents        INTEGER,
  currency            VARCHAR(3),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_id
  ON public.stripe_webhook_events (stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_tenant
  ON public.stripe_webhook_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON public.stripe_webhook_events (status);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages stripe webhooks" ON public.stripe_webhook_events;
CREATE POLICY "Service role manages stripe webhooks"
  ON public.stripe_webhook_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
