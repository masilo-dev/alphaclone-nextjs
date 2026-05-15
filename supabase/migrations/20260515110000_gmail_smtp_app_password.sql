-- Gmail SMTP (App Password) integration support
-- Records in the 'integrations' table for Gmail use this config shape:
--
--   type: 'gmail'
--   config: {
--     "fromEmail": "user@gmail.com",
--     "appPassword": "xxxx xxxx xxxx xxxx",   -- 16-char Google App Password
--     "fromName": "Your Name"                 -- optional display name
--   }
--
-- App Passwords: https://myaccount.google.com/apppasswords
-- Requires 2-Step Verification to be enabled on the Google Account.
--
-- No OAuth tokens are stored. No global env vars are used.
-- Credentials are scoped per tenant_id in the integrations table.
--
-- This migration is informational only (no schema changes needed —
-- integrations.config is already JSONB and integrations.type is TEXT).

-- Ensure the 'gmail' type is indexed for fast per-tenant provider lookup
CREATE INDEX IF NOT EXISTS idx_integrations_gmail_type
  ON integrations (tenant_id, type)
  WHERE type = 'gmail';

NOTIFY pgrst, 'reload schema';
