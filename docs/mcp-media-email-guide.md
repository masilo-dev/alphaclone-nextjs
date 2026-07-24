# MCP Media + Email Guide

## Upload generated images (ChatGPT / Claude)

```json
{
  "filename": "alphaclone-post.png",
  "mime_type": "image/png",
  "content_base64": "<base64 or data:image/png;base64,...>",
  "purpose": "social_post"
}
```

Or:

```json
{ "data_url": "data:image/png;base64,...", "purpose": "social_post" }
```

Or:

```json
{ "url": "https://cdn.example.com/image.png" }
```

Response includes `asset.id` and `asset.url`.

## Publish with media

```json
{
  "platform": "facebook",
  "caption": "Run your business smarter with Alphaclone.",
  "media": [{ "type": "asset_id", "asset_id": "<uuid>" }],
  "status": "publish_now",
  "idempotency_key": "client-key-1"
}
```

Backward compatible:

```json
{
  "caption": "...",
  "media_urls": ["https://..."],
  "media_asset_ids": ["<uuid>"]
}
```

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
