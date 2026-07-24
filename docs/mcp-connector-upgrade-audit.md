# MCP Connector Audit — 2026-07-24

## Summary

Alphaclone already had strong social publishing (`SocialPublishingService`, `upload_media`, identity resolution, verification) and transactional email plumbing (`sendEmailServer`, Zoho/Gmail adapters). Gaps blocked ChatGPT/Claude from completing real business flows: fake transactional email, no first-class `send_email`, media limited to base64/`media_urls`, and receipts not always persisted.

## Existing (kept)

| Area | Status |
|------|--------|
| Social publish + verify | Production (`SocialPublishingService`) |
| `upload_media` / `media_assets` | Production (`mediaUpload.ts`) |
| Identity selection | Production (`socialIdentityStore`) |
| `mcp_action_receipts` | Exists |
| Connector envelope `okResult`/`errorResult` | Exists |
| Zoho send/draft/reply services | Production |
| Gmail send via App Password SMTP | Production |

## Gaps found → fixed in this upgrade

1. **Social media inputs** — publish only practical via `media_urls` / asset IDs; ChatGPT-generated images needed base64/data_url/media[]. → Unified `MediaInput` + `ingestMedia` + `publish_social_post.media[]`.
2. **`send_transactional_email`** — registry tool fabricated message IDs (dry-run by default), shadowing real MCPServer sender. → Calls `sendEmailServer` for live sends.
3. **No `send_email` / draft / reply registry tools** → Added `email-ops` module.
4. **Media library list/get** → `list_media_assets` / `get_media_asset`.
5. **Receipts** — social receipts often in-memory only → persist when idempotency_key present.
6. **ChatGPT discovery** — curated list missing email tools → added.
7. **Schema** — `email_sender_addresses` + `external_actions` migration.

## Remaining limitations

- Forward email / Gmail OAuth drafts not fully exposed as MCP tools yet (Zoho draft/reply are).
- Instagram publish still depends on connected FB/IG capability flags.
- Durable queue for every email/social action is partial (`external_actions` table added; workers can adopt next).
- Cross-client live OAuth retest should be done after Railway deploy.

## Tools added

- `send_email`, `create_email_draft`, `reply_to_email`, `list_email_accounts`, `get_action_status`, `get_media_asset`, `list_media_assets`

## Tools modified

- `upload_media` (url/data_url/base64)
- `publish_social_post` (media[] + receipt persist)
- `send_transactional_email` (real provider send)
