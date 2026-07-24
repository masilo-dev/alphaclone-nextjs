-- Apply new social_post_status values after ADD VALUE commits (separate txn).

UPDATE public.social_posts
SET
  status = 'orphaned',
  error_message = COALESCE(
    error_message,
    'Marked orphaned by social publishing repair: ok=true after DB insert without Facebook provider_post_id. Not auto-republished.'
  ),
  last_error = 'fake_success_no_provider_id',
  updated_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'repair',
    jsonb_build_object(
      'repaired_at', now(),
      'reason', 'fake_success_no_provider_id',
      'migration', '20260724120001_social_publishing_orphan_repair'
    )
  )
WHERE id = '1854057c-abea-4333-8a3a-9354be9217d0'
  AND facebook_post_id IS NULL
  AND COALESCE(linkedin_post_urn, '') = '';

UPDATE public.social_posts
SET
  status = 'orphaned',
  last_error = COALESCE(last_error, 'fake_success_no_provider_id'),
  error_message = COALESCE(
    error_message,
    'Marked orphaned: published without provider post id'
  ),
  updated_at = now()
WHERE status = 'published'
  AND facebook_post_id IS NULL
  AND COALESCE(linkedin_post_urn, '') = ''
  AND COALESCE(live_url, '') = '';

UPDATE public.social_posts
SET
  status = 'failed',
  last_error = COALESCE(last_error, 'stuck_publishing_timeout'),
  error_message = COALESCE(error_message, 'Publishing timed out; marked failed for retry'),
  updated_at = now()
WHERE status = 'publishing'
  AND updated_at < now() - interval '30 minutes';
