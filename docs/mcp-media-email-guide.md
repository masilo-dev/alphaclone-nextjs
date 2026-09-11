# MCP Media + Email Guide

## Publish AI-generated images (ChatGPT / Claude / any MCP client)

Local sandbox paths like `/mnt/data/…png` **cannot** be sent to Facebook. Upload bytes first, then publish.

### 1. Upload with `upload_media`

```json
{
  "filename": "alphaclone-post.png",
  "mime_type": "image/png",
  "content_base64": "<base64 or data:image/png;base64,...>",
  "purpose": "social_post"
}
```

Aliases accepted: `file`, `file_base64` → `content_base64`; `content_type` → `mime_type`.

Or:

```json
{ "data_url": "data:image/png;base64,...", "filename": "post.png" }
```

Or ingest an already-public HTTPS URL:

```json
{ "url": "https://cdn.example.com/image.png" }
```

### 2. Response

```json
{
  "success": true,
  "media_id": "abc123-uuid",
  "media_asset_id": "abc123-uuid",
  "media_url": "https://….supabase.co/storage/v1/object/public/public-assets/media/{tenantId}/….png",
  "public_url": "https://…",
  "asset": { "id": "…", "filename": "…", "mime_type": "image/png", "url": "…" }
}
```

`media_url` is a permanent public HTTPS URL (correct `Content-Type`, no cookies). Facebook/LinkedIn can fetch it directly.

### 3. Publish with `publish_post` (or `publish_social_post`)

```json
{
  "platform": "facebook",
  "content": "Your Facebook caption",
  "media_urls": ["https://….supabase.co/storage/v1/object/public/public-assets/media/{tenantId}/….png"],
  "status": "queued"
}
```

Or with the asset id:

```json
{
  "platform": "facebook",
  "content": "Your Facebook caption",
  "media_asset_ids": ["<media_id from upload_media>"]
}
```

Unified media bag on `publish_social_post`:

```json
{
  "platform": "facebook",
  "caption": "Run your business smarter with Alphaclone.",
  "media": [{ "type": "asset_id", "asset_id": "<uuid>" }],
  "status": "publish_now",
  "idempotency_key": "client-key-1"
}
```

### Related media tools

| Tool | Purpose |
|------|---------|
| `upload_media` | Upload base64 / data URL / HTTPS URL → public `media_url` |
| `get_media` | Fetch asset by `media_id` (tenant-scoped) |
| `delete_media` | Remove asset + storage object (tenant-scoped) |
| `get_media_asset` / `list_media_assets` | Library helpers |
| `publish_post` / `publish_social_post` | Publish using `media_urls` or `media_asset_ids` |
| `get_post_status` | Check publish status |

Storage: Supabase bucket `public-assets` at `media/{tenantId}/…`. Tenant isolation is enforced on upload/get/delete/publish.

## Send email

```json
{
  "to": "recipient@example.com",
  "subject": "Alphaclone Systems update",
  "text": "The AI implementation is complete.",
  "idempotency_key": "email-key-1"
}
```

CRM name resolution:

```json
{
  "recipient_name": "Bonnie Masilo",
  "subject": "Done",
  "text": "The AI implementation is complete.",
  "idempotency_key": "email-key-2"
}
```

If multiple contacts match, the tool returns `RECIPIENT_AMBIGUOUS` with matches — it never guesses.

## Idempotency

Pass the same `idempotency_key` to `send_email` / `publish_social_post` to return the original receipt instead of duplicating the provider action.
