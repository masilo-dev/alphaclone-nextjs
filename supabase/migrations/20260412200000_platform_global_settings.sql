-- Single-row platform configuration for super-admin Global Settings UI (API uses service role).
CREATE TABLE IF NOT EXISTS public.platform_global_settings (
  singleton_key text PRIMARY KEY DEFAULT 'default' CHECK (singleton_key = 'default'),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_global_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.platform_global_settings IS 'Platform-wide admin settings. Read/write only via server routes using service role.';

INSERT INTO public.platform_global_settings (singleton_key, settings)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (singleton_key) DO NOTHING;
