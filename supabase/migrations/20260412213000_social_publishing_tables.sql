-- Social publishing core for Facebook Pages.
-- Includes scheduled posts queue and reusable media library metadata.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_post_status') THEN
    CREATE TYPE public.social_post_status AS ENUM (
      'draft',
      'scheduled',
      'queued',
      'publishing',
      'published',
      'failed',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  caption TEXT NOT NULL,
  platforms TEXT[] NOT NULL DEFAULT ARRAY['facebook']::TEXT[],
  media_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  media_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  link_url TEXT,
  hashtags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status public.social_post_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  facebook_page_id TEXT,
  facebook_post_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'video', 'gif')),
  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  alt_text TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_created
  ON public.social_posts (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_status_scheduled
  ON public.social_posts (tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_page
  ON public.social_posts (facebook_page_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_user_created
  ON public.social_posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_created
  ON public.media_assets (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_type
  ON public.media_assets (tenant_id, asset_type);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_posts_select_tenant_members" ON public.social_posts;
CREATE POLICY "social_posts_select_tenant_members"
ON public.social_posts
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "social_posts_insert_tenant_members" ON public.social_posts;
CREATE POLICY "social_posts_insert_tenant_members"
ON public.social_posts
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "social_posts_update_tenant_members" ON public.social_posts;
CREATE POLICY "social_posts_update_tenant_members"
ON public.social_posts
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "media_assets_select_tenant_members" ON public.media_assets;
CREATE POLICY "media_assets_select_tenant_members"
ON public.media_assets
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "media_assets_insert_tenant_members" ON public.media_assets;
CREATE POLICY "media_assets_insert_tenant_members"
ON public.media_assets
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "media_assets_update_tenant_members" ON public.media_assets;
CREATE POLICY "media_assets_update_tenant_members"
ON public.media_assets
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
  )
);
