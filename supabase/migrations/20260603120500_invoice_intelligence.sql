-- ============================================================
-- Invoice Intelligence Upgrade Migration
-- Created: 2026-06-03
-- ============================================================

-- 1. Extend business_invoices with intelligence columns
ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN ('PENDING','DELIVERED','BOUNCED','OPENED')),
  ADD COLUMN IF NOT EXISTS auto_followup_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disputed_reason TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Extend status values (drop old constraint, add new one)
ALTER TABLE public.business_invoices
  DROP CONSTRAINT IF EXISTS business_invoices_status_check;

ALTER TABLE public.business_invoices
  ADD CONSTRAINT business_invoices_status_check
  CHECK (status IN (
    'draft','sent','viewed','partially_paid','paid','overdue','disputed','void','cancelled'
  ));

-- ============================================================
-- 2. invoice_views — read receipt log (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.business_invoices(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    TEXT,
  user_agent    TEXT,
  source        TEXT DEFAULT 'page_load' -- 'page_load' | 'email_pixel'
);

CREATE INDEX IF NOT EXISTS idx_invoice_views_invoice_id ON public.invoice_views(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_views_tenant_id ON public.invoice_views(tenant_id);

ALTER TABLE public.invoice_views ENABLE ROW LEVEL SECURITY;

-- Service role can insert; tenant members can read their own
DROP POLICY IF EXISTS "invoice_views_service_insert" ON public.invoice_views;
CREATE POLICY "invoice_views_service_insert"
  ON public.invoice_views FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "invoice_views_tenant_select" ON public.invoice_views;
CREATE POLICY "invoice_views_tenant_select"
  ON public.invoice_views FOR SELECT
  USING (tenant_id = (SELECT id FROM public.tenants WHERE id = tenant_id LIMIT 1));

-- ============================================================
-- 3. invoice_audit_log — immutable event log (INSERT only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.business_invoices(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  event_type    TEXT NOT NULL,  -- 'created','sent','viewed','payment_received','status_changed', etc.
  event_data    JSONB,
  performed_by  TEXT,           -- user UUID or 'system'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_audit_invoice_id ON public.invoice_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_tenant_id ON public.invoice_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_event_type ON public.invoice_audit_log(event_type);

ALTER TABLE public.invoice_audit_log ENABLE ROW LEVEL SECURITY;

-- INSERT-only for service_role (no UPDATE, no DELETE)
DROP POLICY IF EXISTS "invoice_audit_log_service_insert" ON public.invoice_audit_log;
CREATE POLICY "invoice_audit_log_service_insert"
  ON public.invoice_audit_log FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "invoice_audit_log_tenant_select" ON public.invoice_audit_log;
CREATE POLICY "invoice_audit_log_tenant_select"
  ON public.invoice_audit_log FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid()
  ));

-- Explicitly revoke UPDATE and DELETE
REVOKE UPDATE, DELETE ON public.invoice_audit_log FROM service_role;

-- ============================================================
-- 4. tax_rules — country-based tax rate lookup
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL,
  tax_name     TEXT NOT NULL,   -- 'VAT', 'GST', 'HST', 'Sales Tax'
  rate         DECIMAL(5,2) NOT NULL,
  applies_to   TEXT NOT NULL DEFAULT 'all' -- 'services', 'products', 'all'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rules_country_type
  ON public.tax_rules(country_code, applies_to);

ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_rules_public_read" ON public.tax_rules;
CREATE POLICY "tax_rules_public_read"
  ON public.tax_rules FOR SELECT USING (true);

-- Seed with major country tax rates
INSERT INTO public.tax_rules (country_code, tax_name, rate, applies_to) VALUES
  ('GB', 'VAT',        20.00, 'all'),
  ('DE', 'VAT',        19.00, 'all'),
  ('FR', 'VAT',        20.00, 'all'),
  ('NL', 'VAT',        21.00, 'all'),
  ('BE', 'VAT',        21.00, 'all'),
  ('ES', 'VAT',        21.00, 'all'),
  ('IT', 'VAT',        22.00, 'all'),
  ('PL', 'VAT',        23.00, 'all'),
  ('SE', 'VAT',        25.00, 'all'),
  ('DK', 'VAT',        25.00, 'all'),
  ('NO', 'VAT',        25.00, 'all'),
  ('AU', 'GST',        10.00, 'all'),
  ('NZ', 'GST',        15.00, 'all'),
  ('CA', 'GST',         5.00, 'all'),
  ('IN', 'GST',        18.00, 'services'),
  ('IN', 'GST',        12.00, 'products'),
  ('ZA', 'VAT',        15.00, 'all'),
  ('SG', 'GST',         9.00, 'all'),
  ('JP', 'Consumption', 10.00, 'all'),
  ('MX', 'IVA',        16.00, 'all'),
  ('BR', 'ICMS',       17.00, 'products'),
  ('AE', 'VAT',         5.00, 'all'),
  ('SA', 'VAT',        15.00, 'all'),
  ('US', 'Sales Tax',   0.00, 'all'),  -- US has no federal; state-level (manual)
  ('KE', 'VAT',        16.00, 'all')
ON CONFLICT (country_code, applies_to) DO NOTHING;

-- ============================================================
-- 5. invoice_delivery_log — e-delivery proof
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_delivery_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.business_invoices(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_to_email   TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN ('PENDING','DELIVERED','BOUNCED','OPENED')),
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  bounced_at      TIMESTAMPTZ,
  bounce_reason   TEXT,
  email_provider  TEXT,
  provider_msg_id TEXT,
  raw_webhook     JSONB
);

CREATE INDEX IF NOT EXISTS idx_invoice_delivery_invoice_id
  ON public.invoice_delivery_log(invoice_id);

ALTER TABLE public.invoice_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_delivery_service_insert" ON public.invoice_delivery_log;
CREATE POLICY "invoice_delivery_service_insert"
  ON public.invoice_delivery_log FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "invoice_delivery_service_update" ON public.invoice_delivery_log;
CREATE POLICY "invoice_delivery_service_update"
  ON public.invoice_delivery_log FOR UPDATE TO service_role USING (true);

DROP POLICY IF EXISTS "invoice_delivery_tenant_select" ON public.invoice_delivery_log;
CREATE POLICY "invoice_delivery_tenant_select"
  ON public.invoice_delivery_log FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid()
  ));
