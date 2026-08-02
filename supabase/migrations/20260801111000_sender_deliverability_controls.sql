BEGIN;

ALTER TABLE public.email_sender_addresses
  ADD COLUMN IF NOT EXISTS warmup_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (warmup_status IN ('not_started','warming','ready','paused','blocked')),
  ADD COLUMN IF NOT EXISTS warmup_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_send_limit INTEGER NOT NULL DEFAULT 25 CHECK (daily_send_limit > 0),
  ADD COLUMN IF NOT EXISTS reputation_score NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (reputation_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS bounce_rate NUMERIC(8,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaint_rate NUMERIC(8,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS domain_authentication JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS idx_sender_addresses_deliverability
  ON public.email_sender_addresses (tenant_id, warmup_status, reputation_score);

COMMIT;
