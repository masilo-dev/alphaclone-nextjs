-- ============================================================================
-- Migration: Email Delivery Truthfulness & CRM Communication History Performance
-- Adds performance and covering indexes for CRM contact email queries,
-- legacy integration resolution, and invoice delivery reconciliation.
-- ============================================================================

-- 1. Covering index for CRM contact email lookup on recipients table
CREATE INDEX IF NOT EXISTS email_message_recipients_contact_idx
  ON public.email_message_recipients (tenant_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_message_recipients_email_idx
  ON public.email_message_recipients (tenant_id, lower(email_address));

-- 2. Index on canonical email_messages for tenant purpose and timeline ordering
CREATE INDEX IF NOT EXISTS email_messages_tenant_purpose_idx
  ON public.email_messages (tenant_id, purpose, created_at DESC);

-- 3. Index on email_provider_accounts for fast integration resolution
CREATE INDEX IF NOT EXISTS email_provider_accounts_legacy_integration_idx
  ON public.email_provider_accounts (tenant_id, legacy_integration_id)
  WHERE legacy_integration_id IS NOT NULL;

-- 4. Index on invoice_delivery_log for tenant-scoped delivery reconciliation
CREATE INDEX IF NOT EXISTS invoice_delivery_log_tenant_invoice_idx
  ON public.invoice_delivery_log (tenant_id, invoice_id, sent_at DESC);
