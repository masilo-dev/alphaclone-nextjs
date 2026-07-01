-- Meta integrations security hardening: encrypted token secrets for Facebook, Instagram, WhatsApp

CREATE TABLE IF NOT EXISTS public.facebook_integration_secrets (
  integration_id UUID PRIMARY KEY REFERENCES public.facebook_integrations(id) ON DELETE CASCADE,
  page_access_token_encrypted TEXT,
  user_access_token_encrypted TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.facebook_integration_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.instagram_integration_secrets (
  integration_id UUID PRIMARY KEY REFERENCES public.instagram_integrations(id) ON DELETE CASCADE,
  page_access_token_encrypted TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.instagram_integration_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.whatsapp_integration_secrets (
  integration_id UUID PRIMARY KEY REFERENCES public.whatsapp_integrations(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_integration_secrets ENABLE ROW LEVEL SECURITY;

-- Intentionally no RLS policies on *_secrets tables: only service_role bypasses RLS

ALTER TABLE public.facebook_integrations
  ALTER COLUMN page_access_token DROP NOT NULL,
  ALTER COLUMN user_access_token DROP NOT NULL;

COMMENT ON COLUMN public.facebook_integrations.page_access_token IS
  'Deprecated — tokens live in facebook_integration_secrets. Column cleared after migration.';
COMMENT ON COLUMN public.facebook_integrations.user_access_token IS
  'Deprecated — tokens live in facebook_integration_secrets. Column cleared after migration.';

ALTER TABLE public.instagram_integrations
  ALTER COLUMN page_access_token DROP NOT NULL;

COMMENT ON COLUMN public.instagram_integrations.page_access_token IS
  'Deprecated — tokens live in instagram_integration_secrets. Column cleared after migration.';

ALTER TABLE public.whatsapp_integrations
  ALTER COLUMN access_token DROP NOT NULL;

COMMENT ON COLUMN public.whatsapp_integrations.access_token IS
  'Deprecated — tokens live in whatsapp_integration_secrets. Column cleared after migration.';

NOTIFY pgrst, 'reload schema';
