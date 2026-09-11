-- Allow scheduled/sending/sent campaign statuses used by cron + CampaignBuilder
ALTER TABLE public.email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_status_check;
ALTER TABLE public.email_campaigns
  ADD CONSTRAINT email_campaigns_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'active', 'paused', 'completed', 'cancelled'));
