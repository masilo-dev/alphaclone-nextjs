# Media Upload & Social Publish — Root Cause Report

## Observed problems

1. **Raw Supabase URLs in MCP responses** — `upload_social_media` returned `https://<project>.supabase.co/storage/v1/object/public/public-assets/media/<tenant-id>/<file>`, exposing project ref, bucket, tenant ID, and storage path.
2. **Facebook photo publish failures** — Generic `"An unknown error has occurred"`, `MISSING_PROVIDER_ID` during in-flight publish, `publish_facebook_photo` internal errors.
3. **Media ID triplication** — `publish_social_post` merged `media_id`, `media_asset_ids`, and `signed_url` without deduplication → one image became three entries.
4. **Durable queue false success** — Jobs marked queued while verification reported `MISSING_PROVIDER_ID`; worker used legacy `cronPublish` without full Graph error capture.

---

## Root causes

| Issue | Cause |
|-------|--------|
| URL leak | `mediaToolResult()` copied `public_url` (Supabase `getPublicUrl`) into MCP fields |
| FB opaque errors | Graph API generic message; insufficient parsing before this session |
| Triple media IDs | `ingestInlineMedia` + `ingestPublishMedia` appended duplicates; URL + ID for same asset |
| Wrong verification | `verifyProviderPost` returned `MISSING_PROVIDER_ID` for `queued`/`publishing` status |
| Weak durable path | `socialPublishDurableTask` called `cronPublish.publishSocialPost` instead of canonical service |

---

## Fixes applied

### Media privacy layer
- `src/lib/media/mediaPublicUrl.ts` — branded `/api/media/:assetId` URLs, sanitizers
- `src/app/api/media/[assetId]/route.ts` — tenant-scoped proxy, streams via short-lived signed URL, security headers
- MCP upload/read tools return only `media_asset_id`, `media_url` (proxy), `status`, safe metadata

### Publish normalization
- `src/lib/media/normalizePublishMedia.ts` — dedupe IDs/URLs, reject raw Supabase URLs
- `ingestPublishMedia()` — dedupe inputs and output assets
- `resolveMediaUrls()` — provider fetch uses proxy URLs

### Facebook & durable pipeline
- Durable worker → `SocialPublishingService.publishExistingPost()`
- `verifyProviderPost()` — `PUBLISH_IN_PROGRESS`, `PUBLISH_FAILED`, clearer `MISSING_PROVIDER_ID`
- Prior session: `parseFacebookGraphError.ts` for actionable Graph diagnostics

### Migration
- `supabase/migrations/20260902130000_media_proxy_url_documentation.sql` — documents internal vs public URL columns (no breaking schema change)

---

## Tests (14/14 pass)

`tests/unit/media-privacy-publish.test.mjs`:
- No `supabase.co` in sanitized payloads
- Dedup: one image → one `media_asset_id`
- Raw storage URL rejection
- Proxy route guards
- Durable publish uses canonical service
- Verification status codes

---

## Security risks discovered

| Risk | Severity | Mitigation |
|------|----------|------------|
| Public bucket + public URL | High | Proxy endpoint; stop exposing URLs in MCP; migrate bucket to private (requires infra approval) |
| Opaque UUID media URLs guessable | Low | UUID v4 entropy; optional tenant query param for authenticated reads |
| Legacy rows with Supabase URL in DB | Medium | Resolver uses `storage_path`; proxy never returns DB `public_url` |
| Facebook fetches branded URL | Info | Expected; our domain streams bytes, not Supabase |

---

## Not verified (requires your approval + staging creds)

Per your instructions, **no production data was modified** and **no live Facebook photo post was executed**.

Still needed for full acceptance:
1. Staging Facebook Page token + test image
2. Confirm Graph returns `facebook_post_id` and verification passes
3. Optional: make `public-assets` bucket private in Supabase (infra change)
4. Deploy code + run one real photo post in safe test environment

---

## Files changed (summary)

- `src/lib/media/mediaPublicUrl.ts` (new)
- `src/lib/media/normalizePublishMedia.ts` (new)
- `src/app/api/media/[assetId]/route.ts` (new)
- `src/lib/media/ingestMedia.ts`
- `src/lib/social/mediaUpload.ts`
- `src/lib/mcp/tools/social-publishing.ts`
- `src/lib/mcp/tools/socialPublishTool.ts`
- `src/lib/social/SocialPublishingService.ts`
- `src/lib/social/socialPublishDurableTask.ts`
- `supabase/migrations/20260902130000_media_proxy_url_documentation.sql` (new)
- `tests/unit/media-privacy-publish.test.mjs` (new)
