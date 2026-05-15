-- Add OAuth 1.0a support to X Integrations
-- Path: supabase/migrations/20260515140000_add_oauth1_to_x_integrations.sql

ALTER TABLE public.x_integrations 
ADD COLUMN IF NOT EXISTS oauth1_access_token TEXT,
ADD COLUMN IF NOT EXISTS oauth1_token_secret TEXT;
