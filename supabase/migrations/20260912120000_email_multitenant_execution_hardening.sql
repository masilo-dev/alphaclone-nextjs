-- AlphaClone multi-tenant email execution hardening.
-- Additive/idempotent migration. Does not special-case any tenant/provider/contact.
BEGIN;

-- Canonical outbound linkage/evidence fields.
ALTER TABLE IF EXISTS public.email_messages
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_id uuid,
  ADD COLUMN IF NOT EXISTS contact_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS sequence_id uuid,
  ADD COLUMN IF NOT EXISTS sequence_step_id uuid,
  ADD COLUMN IF NOT EXISTS outreach_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS source_module text,
  ADD COLUMN IF NOT EXISTS source_action text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS provider_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS email_messages_tenant_idempotency_uidx
  ON public.email_messages (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND direction = 'outbound';

CREATE INDEX IF NOT EXISTS email_messages_tenant_provider_message_idx
  ON public.email_messages (tenant_id, provider_account_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_messages_tenant_campaign_idx
  ON public.email_messages (tenant_id, campaign_id, created_at DESC)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_messages_tenant_sequence_idx
  ON public.email_messages (tenant_id, sequence_id, sequence_step_id, created_at DESC)
  WHERE sequence_id IS NOT NULL;

-- Delivery events need provider identity as explicit evidence, not only payload JSON.
ALTER TABLE IF EXISTS public.email_delivery_events
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS email_delivery_events_tenant_provider_message_idx
  ON public.email_delivery_events (tenant_id, provider_account_id, provider, provider_message_id, occurred_at DESC)
  WHERE provider_message_id IS NOT NULL;

-- Operational outreach ledger catches up to the canonical status/evidence contract.
ALTER TABLE IF EXISTS public.lead_outreach_log
  ADD COLUMN IF NOT EXISTS provider_account_id uuid REFERENCES public.email_provider_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outbound_email_id uuid REFERENCES public.email_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_tenant_tracking
  ON public.lead_outreach_log (tenant_id, tracking_id)
  WHERE tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_tenant_provider_account_message
  ON public.lead_outreach_log (tenant_id, provider_account_id, provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_tenant_outbound_email
  ON public.lead_outreach_log (tenant_id, outbound_email_id)
  WHERE outbound_email_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_outreach_log_tenant_idempotency
  ON public.lead_outreach_log (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Database-level cross-tenant protection for service-role writes.
-- RLS does not protect service-role code from accidentally pairing foreign rows,
-- so composite tenant foreign keys are added NOT VALID for safe rollout.
CREATE UNIQUE INDEX IF NOT EXISTS email_provider_accounts_tenant_id_uidx
  ON public.email_provider_accounts (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS email_messages_tenant_id_uidx
  ON public.email_messages (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS email_threads_tenant_id_uidx
  ON public.email_threads (tenant_id, id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_provider_account_tenant_fk') THEN
    ALTER TABLE public.email_messages
      ADD CONSTRAINT email_messages_provider_account_tenant_fk
      FOREIGN KEY (tenant_id, provider_account_id)
      REFERENCES public.email_provider_accounts(tenant_id, id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_thread_tenant_fk') THEN
    ALTER TABLE public.email_messages
      ADD CONSTRAINT email_messages_thread_tenant_fk
      FOREIGN KEY (tenant_id, thread_id)
      REFERENCES public.email_threads(tenant_id, id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_recipients_message_tenant_fk') THEN
    ALTER TABLE public.email_message_recipients
      ADD CONSTRAINT email_recipients_message_tenant_fk
      FOREIGN KEY (tenant_id, message_id)
      REFERENCES public.email_messages(tenant_id, id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_jobs_message_tenant_fk') THEN
    ALTER TABLE public.email_outbound_jobs
      ADD CONSTRAINT email_jobs_message_tenant_fk
      FOREIGN KEY (tenant_id, message_id)
      REFERENCES public.email_messages(tenant_id, id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_jobs_provider_account_tenant_fk') THEN
    ALTER TABLE public.email_outbound_jobs
      ADD CONSTRAINT email_jobs_provider_account_tenant_fk
      FOREIGN KEY (tenant_id, provider_account_id)
      REFERENCES public.email_provider_accounts(tenant_id, id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_delivery_message_tenant_fk') THEN
    ALTER TABLE public.email_delivery_events
      ADD CONSTRAINT email_delivery_message_tenant_fk
      FOREIGN KEY (tenant_id, message_id)
      REFERENCES public.email_messages(tenant_id, id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_delivery_provider_account_tenant_fk') THEN
    ALTER TABLE public.email_delivery_events
      ADD CONSTRAINT email_delivery_provider_account_tenant_fk
      FOREIGN KEY (tenant_id, provider_account_id)
      REFERENCES public.email_provider_accounts(tenant_id, id)
      NOT VALID;
  END IF;
END $$;

-- One canonical outbound projection without introducing a second source of truth.
CREATE OR REPLACE VIEW public.outbound_emails AS
SELECT
  m.id,
  m.tenant_id,
  COALESCE(m.actor_id, m.created_by) AS actor_id,
  m.lead_id,
  m.contact_id,
  m.client_id,
  m.campaign_id,
  m.sequence_id,
  m.sequence_step_id,
  m.outreach_attempt_id,
  m.source_module,
  m.source_action,
  a.provider,
  m.provider_account_id,
  m.provider_message_id,
  m.provider_thread_id,
  a.email_address AS from_email,
  r.email_address AS to_email,
  m.subject,
  m.purpose AS category,
  CASE
    WHEN m.unsubscribed_at IS NOT NULL THEN 'unsubscribed'
    WHEN m.complained_at IS NOT NULL OR m.delivery_status = 'complained' THEN 'complained'
    WHEN m.bounced_at IS NOT NULL OR m.delivery_status = 'bounced' THEN 'bounced'
    WHEN m.replied_at IS NOT NULL THEN 'replied'
    WHEN m.clicked_at IS NOT NULL OR m.delivery_status = 'clicked' THEN 'clicked'
    WHEN m.opened_at IS NOT NULL OR m.delivery_status = 'opened' THEN 'opened'
    WHEN m.delivered_at IS NOT NULL OR m.delivery_status = 'delivered' THEN 'delivered'
    WHEN m.application_status = 'failed' THEN 'failed'
    WHEN m.application_status = 'sent' THEN 'sent'
    WHEN m.application_status = 'provider_accepted' OR m.delivery_status = 'accepted' THEN 'provider_accepted'
    WHEN m.application_status = 'sending' THEN 'sending'
    WHEN m.application_status = 'queued' THEN 'queued'
    ELSE 'draft'
  END AS status,
  m.created_at AS queued_at,
  m.provider_accepted_at,
  m.sent_at,
  m.delivered_at,
  m.opened_at,
  m.clicked_at,
  m.replied_at,
  m.bounced_at,
  m.complained_at,
  m.unsubscribed_at,
  m.failed_at,
  m.idempotency_key,
  m.created_at,
  m.updated_at
FROM public.email_messages m
LEFT JOIN public.email_provider_accounts a
  ON a.tenant_id = m.tenant_id AND a.id = m.provider_account_id
LEFT JOIN LATERAL (
  SELECT emr.email_address
  FROM public.email_message_recipients emr
  WHERE emr.tenant_id = m.tenant_id
    AND emr.message_id = m.id
    AND emr.recipient_type = 'to'
  ORDER BY emr.created_at ASC
  LIMIT 1
) r ON true
WHERE m.direction = 'outbound';

-- Schema contract: fail CI/pre-deploy if runtime-required outreach columns drift.
CREATE OR REPLACE FUNCTION public.assert_email_execution_schema_contract()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(required.column_name ORDER BY required.column_name)
  INTO missing
  FROM (
    VALUES
      ('lead_outreach_log','tenant_id'),
      ('lead_outreach_log','opened_at'),
      ('lead_outreach_log','clicked_at'),
      ('lead_outreach_log','delivered_at'),
      ('lead_outreach_log','bounced_at'),
      ('lead_outreach_log','replied_at'),
      ('lead_outreach_log','complained_at'),
      ('lead_outreach_log','unsubscribed_at'),
      ('lead_outreach_log','provider'),
      ('lead_outreach_log','provider_account_id'),
      ('lead_outreach_log','provider_message_id'),
      ('lead_outreach_log','tracking_id'),
      ('lead_outreach_log','outbound_email_id'),
      ('email_messages','tenant_id'),
      ('email_messages','provider_account_id'),
      ('email_messages','provider_message_id'),
      ('email_messages','idempotency_key'),
      ('email_delivery_events','tenant_id'),
      ('email_delivery_events','provider_account_id'),
      ('email_delivery_events','provider_message_id')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = required.table_name
      AND c.column_name = required.column_name
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'EMAIL_SCHEMA_CONTRACT_FAILED missing columns: %', array_to_string(missing, ', ');
  END IF;
END;
$$;

SELECT public.assert_email_execution_schema_contract();
NOTIFY pgrst, 'reload schema';
COMMIT;
