-- Zoom OAuth access and refresh tokens are credentials. Keep them outside the
-- tenant-visible integration catalog; only server-side service-role code may
-- access this table.
CREATE TABLE IF NOT EXISTS public.zoom_integration_secrets (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  configured_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  expires_at timestamptz NOT NULL,
  scope text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zoom_integration_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.zoom_integration_secrets FROM anon, authenticated;

COMMENT ON TABLE public.zoom_integration_secrets IS
  'Server-only encrypted Zoom OAuth credentials. Never return these rows to a browser.';

NOTIFY pgrst, 'reload schema';
