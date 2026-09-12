BEGIN;

-- Provider acceptance must be traceable tenant-safely even before a provider webhook arrives.
CREATE INDEX IF NOT EXISTS email_messages_provider_message_lookup_idx
  ON public.email_messages (tenant_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_messages_tenant_created_idx
  ON public.email_messages (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_message_recipients_contact_idx
  ON public.email_message_recipients (tenant_id, contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_delivery_events_provider_message_idx
  ON public.email_delivery_events (tenant_id, provider_account_id, provider_event_id, occurred_at DESC);

-- Existing deployments may already have these additive control-plane columns.
ALTER TABLE public.email_delivery_events
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS email_delivery_events_provider_reference_idx
  ON public.email_delivery_events (tenant_id, provider, provider_message_id, occurred_at DESC)
  WHERE provider_message_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;
