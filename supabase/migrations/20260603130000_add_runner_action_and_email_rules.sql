BEGIN;

-- Add new columns if they do not exist
ALTER TABLE public.autonomous_runner_rules 
ADD COLUMN IF NOT EXISTS lead_action_mode TEXT NOT NULL DEFAULT 'draft_and_task',
ADD COLUMN IF NOT EXISTS email_provider TEXT NOT NULL DEFAULT 'system_default';

-- Add check constraint for lead_action_mode
ALTER TABLE public.autonomous_runner_rules
DROP CONSTRAINT IF EXISTS chk_lead_action_mode;

ALTER TABLE public.autonomous_runner_rules
ADD CONSTRAINT chk_lead_action_mode CHECK (lead_action_mode IN ('draft_and_task', 'task_only', 'draft_only'));

-- Add check constraint for email_provider
ALTER TABLE public.autonomous_runner_rules
DROP CONSTRAINT IF EXISTS chk_email_provider;

ALTER TABLE public.autonomous_runner_rules
ADD CONSTRAINT chk_email_provider CHECK (email_provider IN ('system_default', 'zoho', 'brevo', 'sendgrid', 'resend', 'microsoft365'));

NOTIFY pgrst, 'reload schema';
COMMIT;
