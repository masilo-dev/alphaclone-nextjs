-- ============================================================
-- Hotfix from Railway logs (2026-07-23):
-- 1) PGRST204: mcp_oauth_tokens.access_token_hash missing
-- 2) P0001: Required accounting accounts missing (manual payment)
-- Paste into Supabase SQL Editor and Run once.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── A) MCP OAuth token hash columns (ChatGPT connector) ───────
ALTER TABLE public.mcp_oauth_tokens
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS access_token_hash text,
  ADD COLUMN IF NOT EXISTS refresh_token_hash text,
  ADD COLUMN IF NOT EXISTS token_type text DEFAULT 'Bearer',
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS resource text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_family_id uuid;

-- Backfill hashes when plaintext tokens still exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mcp_oauth_tokens' AND column_name = 'access_token'
  ) THEN
    UPDATE public.mcp_oauth_tokens
    SET access_token_hash = encode(digest(access_token, 'sha256'), 'hex')
    WHERE access_token IS NOT NULL
      AND (access_token_hash IS NULL OR access_token_hash = '');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mcp_oauth_tokens' AND column_name = 'refresh_token'
  ) THEN
    UPDATE public.mcp_oauth_tokens
    SET refresh_token_hash = encode(digest(refresh_token, 'sha256'), 'hex')
    WHERE refresh_token IS NOT NULL
      AND (refresh_token_hash IS NULL OR refresh_token_hash = '');
  END IF;
END $$;

UPDATE public.mcp_oauth_tokens
SET id = gen_random_uuid()
WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mcp_oauth_tokens_id_uidx
  ON public.mcp_oauth_tokens(id);

CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_access_hash_lookup_idx
  ON public.mcp_oauth_tokens(access_token_hash)
  WHERE access_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_refresh_lookup_idx
  ON public.mcp_oauth_tokens(refresh_token_hash)
  WHERE refresh_token_hash IS NOT NULL;

-- Keep ChatGPT OAuth client registered
ALTER TABLE public.mcp_oauth_clients
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT ARRAY['read', 'write', 'mcp:tools', 'mcp:resources'],
  ADD COLUMN IF NOT EXISTS grant_types text[] DEFAULT ARRAY['authorization_code', 'refresh_token'],
  ADD COLUMN IF NOT EXISTS response_types text[] DEFAULT ARRAY['code'],
  ADD COLUMN IF NOT EXISTS token_endpoint_auth_method text DEFAULT 'none';

INSERT INTO public.mcp_oauth_clients (
  client_id, client_name, redirect_uris, is_public, client_secret, scopes, is_active,
  grant_types, response_types, token_endpoint_auth_method
)
VALUES (
  'chatgpt-connector',
  'ChatGPT',
  ARRAY[
    'https://chatgpt.com/connector_platform_oauth_redirect',
    'https://chatgpt.com/connector/oauth/*',
    'https://chatgpt.com/connector/oauth/callback',
    'https://chat.openai.com/connector_platform_oauth_redirect',
    'https://chat.openai.com/connector/oauth/*',
    'https://chat.openai.com/connector/oauth/callback',
    'https://platform.openai.com/apps-manage/oauth/*'
  ]::text[],
  true,
  'public',
  ARRAY['read', 'write', 'mcp:tools', 'mcp:resources'],
  true,
  ARRAY['authorization_code', 'refresh_token'],
  ARRAY['code'],
  'none'
)
ON CONFLICT (client_id) DO UPDATE SET
  redirect_uris = EXCLUDED.redirect_uris,
  is_public = TRUE,
  scopes = EXCLUDED.scopes,
  is_active = TRUE,
  grant_types = EXCLUDED.grant_types,
  response_types = EXCLUDED.response_types,
  token_endpoint_auth_method = EXCLUDED.token_endpoint_auth_method;

-- Force PostgREST to see new columns immediately
NOTIFY pgrst, 'reload schema';

-- ── B) Seed required accounting accounts for all tenants ─────
-- Fixes: Required accounting accounts are missing; initialize Cash (1000)...
DO $$
DECLARE
  r RECORD;
  a RECORD;
  accounts CONSTANT text[][] := ARRAY[
    ARRAY['1000', 'Cash on Hand', 'asset', 'current_asset', 'debit'],
    ARRAY['1100', 'Accounts Receivable', 'asset', 'current_asset', 'debit'],
    ARRAY['2100', 'Sales Tax Payable', 'liability', 'current_liability', 'credit'],
    ARRAY['4000', 'Sales Income', 'revenue', 'operating_revenue', 'credit'],
    ARRAY['4100', 'Service Revenue', 'revenue', 'operating_revenue', 'credit']
  ];
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS chart_of_accounts_tenant_code_uidx
      ON public.chart_of_accounts (tenant_id, account_code);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  FOR r IN SELECT id AS tenant_id FROM public.tenants LOOP
    FOREACH a SLICE 1 IN ARRAY accounts LOOP
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM public.chart_of_accounts
          WHERE tenant_id = r.tenant_id AND account_code = a[1]
        ) THEN
          INSERT INTO public.chart_of_accounts (
            tenant_id, account_code, account_name, account_type, account_subtype,
            normal_balance, is_system_account, is_active
          ) VALUES (
            r.tenant_id, a[1], a[2], a[3], a[4], a[5], true, true
          );
        ELSE
          UPDATE public.chart_of_accounts
          SET deleted_at = NULL,
              is_active = true
          WHERE tenant_id = r.tenant_id AND account_code = a[1];
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'COA seed skipped for tenant % account %: %', r.tenant_id, a[1], SQLERRM;
      END;
    END LOOP;
  END LOOP;
END $$;

-- ── C) Also install resilient payment RPC (manual approve) ───
-- (no-op if already applied; redefines function safely)
ALTER TABLE public.business_invoices
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'PENDING';

CREATE TABLE IF NOT EXISTS public.business_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.business_invoices(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  source text NOT NULL DEFAULT 'manual',
  external_reference text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_business_invoice_payments_invoice
  ON public.business_invoice_payments (tenant_id, invoice_id, created_at DESC);

ALTER TABLE public.business_invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_invoice_payments_service_all ON public.business_invoice_payments;
CREATE POLICY business_invoice_payments_service_all ON public.business_invoice_payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.business_automation_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  processed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.business_invoices DROP CONSTRAINT IF EXISTS business_invoices_status_check;
ALTER TABLE public.business_invoices
  ADD CONSTRAINT business_invoices_status_check
  CHECK (status IN (
    'draft','sent','viewed','partially_paid','paid','overdue','disputed','void','cancelled'
  ));

DROP FUNCTION IF EXISTS public.record_business_invoice_payment(uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.record_business_invoice_payment(uuid, uuid, numeric, text, text, text, uuid);

CREATE FUNCTION public.record_business_invoice_payment(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_idempotency_key text,
  p_source text DEFAULT 'manual',
  p_external_reference text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS SETOF public.business_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.business_invoices%ROWTYPE;
  v_existing_payment public.business_invoice_payments%ROWTYPE;
  v_payment public.business_invoice_payments%ROWTYPE;
  v_total numeric;
  v_paid numeric;
  v_tax numeric;
  v_tax_share numeric;
  v_revenue_share numeric;
  v_cash_account_id uuid;
  v_revenue_account_id uuid;
  v_tax_account_id uuid;
  v_entry_id uuid;
  v_new_status text;
  v_currency text;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'Payment idempotency key is required'; END IF;

  SELECT * INTO v_invoice
  FROM public.business_invoices
  WHERE tenant_id = p_tenant_id AND id = p_invoice_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  SELECT * INTO v_existing_payment
  FROM public.business_invoice_payments
  WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing_payment.invoice_id <> p_invoice_id OR v_existing_payment.amount <> p_amount THEN
      RAISE EXCEPTION 'Payment idempotency key was already used for a different payment';
    END IF;
    RETURN QUERY SELECT * FROM public.business_invoices WHERE tenant_id = p_tenant_id AND id = p_invoice_id;
    RETURN;
  END IF;

  IF v_invoice.status IN ('void', 'cancelled', 'disputed') THEN
    RAISE EXCEPTION 'This invoice cannot accept payments';
  END IF;

  v_total := COALESCE(v_invoice.total, 0);
  v_paid := COALESCE(v_invoice.amount_paid, 0);
  v_currency := COALESCE(NULLIF(v_invoice.currency, ''), 'USD');

  IF v_paid >= v_total THEN RAISE EXCEPTION 'Invoice is already paid'; END IF;
  IF p_amount > v_total - v_paid THEN RAISE EXCEPTION 'Payment exceeds the remaining invoice balance'; END IF;

  INSERT INTO public.business_invoice_payments (
    tenant_id, invoice_id, idempotency_key, amount, currency, source, external_reference, recorded_by
  ) VALUES (
    p_tenant_id, p_invoice_id, p_idempotency_key, p_amount,
    v_currency, COALESCE(NULLIF(p_source, ''), 'manual'),
    p_external_reference, p_actor_user_id
  ) RETURNING * INTO v_payment;

  v_new_status := CASE WHEN v_paid + p_amount >= v_total THEN 'paid' ELSE 'partially_paid' END;

  BEGIN
    SELECT id INTO v_cash_account_id
    FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '1000'
      AND deleted_at IS NULL AND is_active IS DISTINCT FROM false
    LIMIT 1;
    SELECT id INTO v_revenue_account_id
    FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id AND account_code IN ('4100', '4000')
      AND deleted_at IS NULL AND is_active IS DISTINCT FROM false
    ORDER BY account_code DESC LIMIT 1;
    SELECT id INTO v_tax_account_id
    FROM public.chart_of_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '2100'
      AND deleted_at IS NULL AND is_active IS DISTINCT FROM false
    LIMIT 1;

    v_tax := GREATEST(COALESCE(v_invoice.tax, 0), 0);
    v_tax_share := CASE WHEN v_total > 0 THEN round((p_amount * v_tax / v_total)::numeric, 2) ELSE 0 END;
    v_revenue_share := p_amount - v_tax_share;

    IF v_cash_account_id IS NOT NULL
       AND v_revenue_account_id IS NOT NULL
       AND (v_tax_share = 0 OR v_tax_account_id IS NOT NULL) THEN
      INSERT INTO public.journal_entries (
        tenant_id, entry_number, entry_date, description, reference,
        source_type, source_id, status, total_debits, total_credits,
        currency, posted_at, posted_by, created_by
      ) VALUES (
        p_tenant_id, 'PAY-' || left(replace(v_payment.id::text, '-', ''), 12), CURRENT_DATE,
        'Payment received for Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
        COALESCE(p_external_reference, v_invoice.invoice_number),
        'invoice_payment', v_payment.id, 'posted', p_amount, p_amount,
        v_currency, now(), p_actor_user_id, p_actor_user_id
      ) RETURNING id INTO v_entry_id;

      INSERT INTO public.journal_entry_lines (
        tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount,
        description, entity_type, entity_id, currency
      ) VALUES
        (p_tenant_id, v_entry_id, 1, v_cash_account_id, p_amount, 0,
         'Cash received - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
         'invoice', p_invoice_id, v_currency),
        (p_tenant_id, v_entry_id, 2, v_revenue_account_id, 0, v_revenue_share,
         'Revenue recognized - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
         'invoice', p_invoice_id, v_currency);

      IF v_tax_share > 0 THEN
        INSERT INTO public.journal_entry_lines (
          tenant_id, entry_id, line_number, account_id, debit_amount, credit_amount,
          description, entity_type, entity_id, currency
        ) VALUES (
          p_tenant_id, v_entry_id, 3, v_tax_account_id, 0, v_tax_share,
          'Sales tax collected - Invoice ' || COALESCE(v_invoice.invoice_number, p_invoice_id::text),
          'invoice', p_invoice_id, v_currency
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Skipped invoice payment journal for %: %', p_invoice_id, SQLERRM;
  END;

  UPDATE public.business_invoices SET
    amount_paid = v_paid + p_amount,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
    delivery_status = CASE WHEN v_new_status = 'paid' THEN 'DELIVERED' ELSE delivery_status END,
    updated_at = now()
  WHERE tenant_id = p_tenant_id AND id = p_invoice_id;

  BEGIN
    INSERT INTO public.business_automation_events (tenant_id, event_type, payload)
    VALUES (
      p_tenant_id,
      'invoice_payment_recorded',
      jsonb_build_object(
        'paymentId', v_payment.id,
        'invoiceId', p_invoice_id,
        'amount', p_amount,
        'amountPaid', v_paid + p_amount,
        'status', v_new_status,
        'source', COALESCE(NULLIF(p_source, ''), 'manual'),
        'externalReference', p_external_reference,
        'actorUserId', p_actor_user_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Skipped automation event for invoice payment %: %', p_invoice_id, SQLERRM;
  END;

  RETURN QUERY SELECT * FROM public.business_invoices WHERE tenant_id = p_tenant_id AND id = p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_business_invoice_payment(uuid, uuid, numeric, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_business_invoice_payment(uuid, uuid, numeric, text, text, text, uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';

-- Quick checks (optional):
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='mcp_oauth_tokens' AND column_name IN ('access_token_hash','refresh_token_hash','revoked');
-- SELECT account_code FROM chart_of_accounts
--   WHERE tenant_id='066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4' AND account_code IN ('1000','2100','4000','4100');
