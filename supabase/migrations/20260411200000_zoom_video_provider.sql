-- Multi-provider video: Daily (default) + Zoom Meeting API / Video SDK metadata
-- Secrets (OAuth client secret, SDK secrets) must stay server-side or in Supabase Vault — never in this table.

ALTER TABLE public.video_calls
  ADD COLUMN IF NOT EXISTS video_provider text NOT NULL DEFAULT 'daily';

ALTER TABLE public.video_calls
  ADD COLUMN IF NOT EXISTS zoom_meeting_id text,
  ADD COLUMN IF NOT EXISTS zoom_join_url text,
  ADD COLUMN IF NOT EXISTS zoom_start_url text,
  ADD COLUMN IF NOT EXISTS zoom_session_name text,
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'video_calls_video_provider_check'
  ) THEN
    ALTER TABLE public.video_calls
      ADD CONSTRAINT video_calls_video_provider_check
      CHECK (video_provider IN ('daily', 'zoom_meeting', 'zoom_video_sdk', 'external'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tenant_zoom_settings (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE PRIMARY KEY,
  integration_mode text NOT NULL DEFAULT 'none'
    CHECK (integration_mode IN ('none', 'meeting_api', 'video_sdk')),
  zoom_account_id text,
  default_meeting_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_zoom_settings IS 'Tenant Zoom product mode and non-secret metadata. Tokens and SDK secrets belong in environment or Supabase Vault only.';
COMMENT ON COLUMN public.video_calls.video_provider IS 'Infrastructure backing this call: daily | zoom_meeting (join URL) | zoom_video_sdk (session) | external.';

ALTER TABLE public.tenant_zoom_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_zoom_settings_tenant_admin_all" ON public.tenant_zoom_settings;
CREATE POLICY "tenant_zoom_settings_tenant_admin_all"
  ON public.tenant_zoom_settings
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.role IN ('tenant_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "tenant_zoom_settings_super_admin_read" ON public.tenant_zoom_settings;
CREATE POLICY "tenant_zoom_settings_super_admin_read"
  ON public.tenant_zoom_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND u.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.set_tenant_zoom_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_zoom_settings_updated_at ON public.tenant_zoom_settings;
CREATE TRIGGER trg_tenant_zoom_settings_updated_at
  BEFORE UPDATE ON public.tenant_zoom_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_zoom_settings_updated_at();
