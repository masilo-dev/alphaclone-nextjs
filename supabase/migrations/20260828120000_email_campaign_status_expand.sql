-- Align email_campaigns.status with runtime values (cron, builder, fan-out).
-- Production uses campaign_status enum; local/dev may use TEXT + CHECK — handle both.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
    ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'queued';
    ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'processing';
    ALTER TYPE public.campaign_status ADD VALUE IF NOT EXISTS 'failed';
  END IF;
END $$;

ALTER TABLE public.email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_status_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
    ALTER TABLE public.email_campaigns
      ADD CONSTRAINT email_campaigns_status_check
      CHECK (status IN (
        'draft',
        'scheduled',
        'queued',
        'sending',
        'processing',
        'sent',
        'active',
        'paused',
        'completed',
        'cancelled',
        'failed'
      ));
  END IF;
END $$;
