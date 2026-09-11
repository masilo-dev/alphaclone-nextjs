-- Unified Email foundation. Additive: existing OAuth records, provider logs,
-- messages, suppressions and sender addresses remain authoritative until cutover.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.email_provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN (
    'zoho','microsoft_graph','brevo','sendgrid','smtp','gmail','resend','other'
  )),
  account_type text NOT NULL DEFAULT 'user' CHECK (account_type IN (
    'user','shared_mailbox','transactional','marketing','smtp','platform'
  )),
  email_address text,
  display_name text,
  provider_account_id text,
  provider_tenant_id text,
  region text,
  connection_status text NOT NULL DEFAULT 'pending' CHECK (connection_status IN (
    'pending','connected','degraded','expired','revoked','failed'
  )),
  sync_status text NOT NULL DEFAULT 'not_started' CHECK (sync_status IN (
    'not_started','queued','syncing','healthy','degraded','failed','paused'
  )),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_purposes text[] NOT NULL DEFAULT ARRAY['personal','crm','transactional']::text[],
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  legacy_integration_id uuid REFERENCES public.integrations(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_successful_sync_at timestamptz,
  last_successful_send_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS email_provider_accounts_legacy_uidx
  ON public.email_provider_accounts (tenant_id, legacy_integration_id)
  WHERE legacy_integration_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS email_provider_accounts_external_uidx
  ON public.email_provider_accounts (tenant_id, provider, provider_account_id)
  WHERE provider_account_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.email_sender_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  provider_account_id uuid NOT NULL REFERENCES public.email_provider_accounts(id) ON DELETE RESTRICT,
  email_address text NOT NULL,
  display_name text,
  reply_to_address text,
  provider_identity_id text,
  verification_status text NOT NULL DEFAULT 'unknown' CHECK (verification_status IN (
    'unknown','pending','verified','failed','revoked'
  )),
  can_send_as boolean NOT NULL DEFAULT false,
  can_send_on_behalf boolean NOT NULL DEFAULT false,
  allowed_purposes text[] NOT NULL DEFAULT '{}'::text[],
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  legacy_sender_address_id uuid REFERENCES public.email_sender_addresses(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider_account_id, email_address)
);

CREATE TABLE IF NOT EXISTS public.email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  subject_normalized text,
  latest_message_at timestamptz,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','archived','spam','trash')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  thread_id uuid REFERENCES public.email_threads(id) ON DELETE RESTRICT,
  provider_account_id uuid REFERENCES public.email_provider_accounts(id) ON DELETE RESTRICT,
  sender_identity_id uuid REFERENCES public.email_sender_identities(id) ON DELETE RESTRICT,
  provider_message_id text,
  internet_message_id text,
  provider_thread_id text,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  purpose text NOT NULL CHECK (purpose IN (
    'personal','crm','transactional','marketing','invoice','contract','project','calendar','automation'
  )),
  subject text,
  body_preview text,
  body_storage_key text,
  sent_at timestamptz,
  received_at timestamptz,
  read_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  application_status text NOT NULL DEFAULT 'draft' CHECK (application_status IN (
    'draft','scheduled','queued','sending','provider_accepted','sent','failed','cancelled'
  )),
  delivery_status text CHECK (delivery_status IN (
    'unknown','accepted','delivered','deferred','bounced','complained','opened','clicked'
  )),
  has_attachments boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  headers_safe jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_messages_provider_uidx
  ON public.email_messages (tenant_id, provider_account_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS email_messages_internet_uidx
  ON public.email_messages (tenant_id, internet_message_id)
  WHERE internet_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_message_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL REFERENCES public.email_messages(id) ON DELETE RESTRICT,
  recipient_type text NOT NULL CHECK (recipient_type IN ('to','cc','bcc','reply_to')),
  email_address text NOT NULL,
  display_name text,
  contact_id uuid,
  company_id uuid,
  delivery_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_outbound_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL REFERENCES public.email_messages(id) ON DELETE RESTRICT,
  provider_account_id uuid NOT NULL REFERENCES public.email_provider_accounts(id) ON DELETE RESTRICT,
  sender_identity_id uuid NOT NULL REFERENCES public.email_sender_identities(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued','scheduled','running','provider_accepted','completed','retryable','failed','cancelled','dead_letter'
  )),
  scheduled_for timestamptz,
  idempotency_key text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, message_id)
);

CREATE TABLE IF NOT EXISTS public.email_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  message_id uuid REFERENCES public.email_messages(id) ON DELETE RESTRICT,
  provider_account_id uuid REFERENCES public.email_provider_accounts(id) ON DELETE RESTRICT,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  recipient_email text,
  occurred_at timestamptz NOT NULL,
  payload_storage_key text,
  payload_safe jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_verified boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider_account_id, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.email_default_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  module text,
  purpose text NOT NULL,
  provider_account_id uuid NOT NULL REFERENCES public.email_provider_accounts(id) ON DELETE RESTRICT,
  sender_identity_id uuid NOT NULL REFERENCES public.email_sender_identities(id) ON DELETE RESTRICT,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_default_rules_scope_uidx
  ON public.email_default_rules (
    tenant_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(module, ''), purpose
  );

-- Preserve connection ownership and provider identity without copying any
-- credential material out of the existing encrypted/legacy connection record.
INSERT INTO public.email_provider_accounts (
  tenant_id, owner_user_id, provider, account_type, display_name,
  connection_status, sync_status, legacy_integration_id, created_by
)
SELECT
  i.tenant_id,
  i.user_id,
  CASE i.type
    WHEN 'microsoft365' THEN 'microsoft_graph'
    WHEN 'microsoft' THEN 'microsoft_graph'
    WHEN 'custom_smtp' THEN 'smtp'
    ELSE i.type
  END,
  CASE WHEN i.type IN ('brevo','sendgrid','resend') THEN 'transactional' ELSE 'user' END,
  i.name,
  CASE WHEN i.enabled THEN 'connected' ELSE 'revoked' END,
  'not_started',
  i.id,
  i.user_id
FROM public.integrations i
WHERE i.tenant_id IS NOT NULL
  AND i.type IN ('zoho','microsoft365','microsoft','brevo','sendgrid','custom_smtp','gmail','resend')
ON CONFLICT (tenant_id, legacy_integration_id) WHERE legacy_integration_id IS NOT NULL DO NOTHING;

-- Reuse previously discovered sender identities and retain lineage.
INSERT INTO public.email_sender_identities (
  tenant_id, provider_account_id, email_address, display_name,
  verification_status, can_send_as, allowed_purposes, is_default,
  legacy_sender_address_id, metadata
)
SELECT
  s.tenant_id, a.id, lower(s.email_address), s.display_name,
  CASE WHEN s.is_verified THEN 'verified' ELSE 'pending' END,
  s.is_verified,
  ARRAY['personal','crm','transactional','invoice','contract','project','calendar','automation']::text[],
  s.is_default, s.id, jsonb_build_object('legacyProvider', s.provider)
FROM public.email_sender_addresses s
JOIN public.email_provider_accounts a
  ON a.tenant_id = s.tenant_id
 AND a.provider = CASE s.provider WHEN 'microsoft' THEN 'microsoft_graph' ELSE s.provider END
 AND (a.owner_user_id = s.user_id OR s.user_id IS NULL)
ON CONFLICT (tenant_id, provider_account_id, email_address) DO NOTHING;

CREATE INDEX IF NOT EXISTS email_threads_tenant_latest_idx
  ON public.email_threads (tenant_id, latest_message_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_tenant_thread_idx
  ON public.email_messages (tenant_id, thread_id, COALESCE(received_at, sent_at, created_at));
CREATE INDEX IF NOT EXISTS email_outbound_jobs_due_idx
  ON public.email_outbound_jobs (status, scheduled_for, created_at)
  WHERE status IN ('queued','scheduled','retryable');
CREATE INDEX IF NOT EXISTS email_delivery_events_message_idx
  ON public.email_delivery_events (tenant_id, message_id, occurred_at);

DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'email_provider_accounts','email_sender_identities','email_threads',
    'email_messages','email_message_recipients','email_outbound_jobs',
    'email_delivery_events','email_default_rules'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('DROP POLICY IF EXISTS tenant_member_access ON public.%I', target);
    EXECUTE format(
      'CREATE POLICY tenant_member_access ON public.%I FOR ALL TO authenticated ' ||
      'USING (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid())) ' ||
      'WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = %I.tenant_id AND tu.user_id = auth.uid()))',
      target, target, target
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
