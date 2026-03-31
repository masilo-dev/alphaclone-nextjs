-- ============================================================
-- Migration: Social Media Storage Bucket
-- Ensures public-assets bucket exists with correct limits and policies.
-- File size enforcement is also done at the upload route level:
--   - Images: 10 MB max (enforced in /api/social/media/upload/route.ts)
--   - Videos: 200 MB max (enforced in /api/social/media/upload/route.ts)
-- The bucket-level limit is 200 MB (covers both, image limit is stricter in code).
-- ============================================================

-- 1. Upsert the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'public-assets',
    'public-assets',
    true,
    209715200, -- 200 MB in bytes
    ARRAY[
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/avif',
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime',
        'video/x-msvideo'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public            = EXCLUDED.public,
    file_size_limit   = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS Policies
--    Drop then re-create so this migration is idempotent.

-- Public read (anyone can view images/videos in social posts)
DROP POLICY IF EXISTS "public_assets_public_read" ON storage.objects;
CREATE POLICY "public_assets_public_read"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'public-assets');

-- Authenticated users can upload
DROP POLICY IF EXISTS "public_assets_auth_insert" ON storage.objects;
CREATE POLICY "public_assets_auth_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'public-assets');

-- Authenticated users can update their own objects
DROP POLICY IF EXISTS "public_assets_auth_update" ON storage.objects;
CREATE POLICY "public_assets_auth_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'public-assets' AND owner = auth.uid());

-- Authenticated users can delete their own objects
DROP POLICY IF EXISTS "public_assets_auth_delete" ON storage.objects;
CREATE POLICY "public_assets_auth_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'public-assets' AND owner = auth.uid());
