-- Idempotent lookup indexes for high-throughput mailbox message ingestion and thread resolution.
-- Matches production database indexes applied to resolve statement timeouts during historical sync.

CREATE INDEX IF NOT EXISTS email_mailbox_rfc_parent_idx
ON public.email_messages(tenant_id,provider_account_id,(headers_safe->>'message-id'));

CREATE INDEX IF NOT EXISTS email_mailbox_provider_thread_idx
ON public.email_messages(tenant_id,provider_account_id,provider_thread_id,created_at);

CREATE INDEX IF NOT EXISTS email_mailbox_canonical_thread_idx
ON public.email_messages(tenant_id,provider_account_id,thread_id,created_at);

CREATE INDEX IF NOT EXISTS email_mailbox_recipient_lookup_idx
ON public.email_message_recipients(tenant_id,message_id,recipient_type,email_address);
