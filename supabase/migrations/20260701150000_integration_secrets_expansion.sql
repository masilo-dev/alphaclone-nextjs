-- Expand encrypted integration secrets for X, Google Calendar, Calendly

CREATE TABLE IF NOT EXISTS public.x_integration_secrets (
  integration_id UUID PRIMARY KEY REFERENCES public.x_integrations(id) ON DELETE CASCADE,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  oauth1_access_token_encrypted TEXT,
  oauth1_token_secret_encrypted TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.x_integration_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.google_calendar_secrets (
  user_id UUID PRIMARY KEY,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.google_calendar_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.calendly_integration_secrets (
  integration_id UUID PRIMARY KEY,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.calendly_integration_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.hubspot_integration_secrets (
  user_id UUID PRIMARY KEY,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.hubspot_integration_secrets ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
