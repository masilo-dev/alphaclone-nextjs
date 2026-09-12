-- Additive email control-plane fields. Existing campaign and provider records remain valid.
BEGIN;

ALTER TABLE public.email_outbound_jobs
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS recipient_id uuid,
  ADD COLUMN IF NOT EXISTS requested_provider text,
  ADD COLUMN IF NOT EXISTS resolved_provider text,
  ADD COLUMN IF NOT EXISTS fallback_from text,
  ADD COLUMN IF NOT EXISTS fallback_reason text,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS provider_thread_id text;

ALTER TABLE public.email_delivery_events
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS recipient_id uuid,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS event_time timestamptz,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

-- The original foundation backfill predates AlphaClone-owned campaign fan-out.
-- Preserve existing records while allowing connected, active delivery accounts
-- and usable sender identities to participate in marketing after preflight.
UPDATE public.email_provider_accounts
SET allowed_purposes = ARRAY(SELECT DISTINCT unnest(allowed_purposes || ARRAY['marketing']::text[]))
WHERE connection_status = 'connected'
  AND deleted_at IS NULL
  AND NOT ('marketing' = ANY(allowed_purposes));

UPDATE public.email_sender_identities
SET allowed_purposes = ARRAY(SELECT DISTINCT unnest(allowed_purposes || ARRAY['marketing']::text[]))
WHERE is_active = true
  AND can_send_as = true
  AND verification_status = 'verified'
  AND NOT ('marketing' = ANY(allowed_purposes));

CREATE UNIQUE INDEX IF NOT EXISTS email_outbound_jobs_campaign_recipient_idempotency_uidx
  ON public.email_outbound_jobs (tenant_id, campaign_id, recipient_id, idempotency_key)
  WHERE campaign_id IS NOT NULL AND recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_outbound_jobs_control_plane_due_idx
  ON public.email_outbound_jobs (tenant_id, status, next_attempt_at, scheduled_for, priority DESC)
  WHERE status IN ('queued','scheduled','retryable','running');
CREATE INDEX IF NOT EXISTS email_outbound_jobs_campaign_recipient_idx
  ON public.email_outbound_jobs (tenant_id, campaign_id, recipient_id);
CREATE INDEX IF NOT EXISTS email_delivery_events_provider_message_idx
  ON public.email_delivery_events (tenant_id, provider, provider_message_id, event_time DESC);
CREATE UNIQUE INDEX IF NOT EXISTS email_delivery_events_webhook_dedupe_uidx
  ON public.email_delivery_events (tenant_id, provider, provider_message_id, event_type, occurred_at)
  WHERE provider_message_id IS NOT NULL;

COMMIT;
