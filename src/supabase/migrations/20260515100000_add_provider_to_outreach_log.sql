-- Migration: Add provider column to lead_outreach_log
-- Required by MCP send_batch_outreach and automation runtime to store which
-- email provider was used for each outreach attempt.

ALTER TABLE lead_outreach_log ADD COLUMN IF NOT EXISTS provider TEXT;

-- Reload PostgREST schema cache so the column is immediately visible to the API
NOTIFY pgrst, 'reload schema';
