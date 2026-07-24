# Social Publishing Repair — Root Cause Report

## Multi-tenant follow-up

Additional hardening so Alphaclone Systems is **never** a global social default:

- Removed hard-coded Facebook Page `106807848991283` from `publishScheduledPosts`
- Removed MCPServer Facebook `user_id`-only cross-tenant fallback
- Added `social_connections` / `social_identities` / `tenant_social_defaults` (+ RLS)
- Identity resolution via `get_social_identities` + internal `identity_id`
- Cron media assets filtered by `tenant_id`
- LinkedIn org posts refuse personal fallback
- `getFacebookIntegration` requires `tenantId`

## Summary

`publish_post` (ChatGPT connector) returned `ok: true` after inserting a `social_posts` row and **never called Facebook or LinkedIn**. Saving a database record was treated as success. Record `1854057c-abea-4333-8a3a-9354be9217d0` is a concrete instance of this failure mode.

## Failure analysis for `1854057c-abea-4333-8a3a-9354be9217d0`

| Question | Finding |
|----------|---------|
| Was Facebook Graph API called? | **No** — legacy `publish_post` only ran `INSERT INTO social_posts` |
| Which Facebook page was selected? | **None** — `facebook_page_id` was not set by the connector path |
| Did media upload occur? | **No** (or data URI was stored raw in `media_urls`) |
| Did provider return an error? | **N/A** — provider was never contacted |
| Why `ok=true`? | `defineConnectorTool` wraps any non-throwing handler return as `{ ok: true }` |
| Why no Facebook post ID / live URL? | Never published to Graph; columns left null |

**Repair action:** Migration marks the row `status=orphaned` without republishing (avoids duplicates). Use `retry_social_post` only after an operator confirms the content should go live.

## Systemic root causes

1. **Dual publishers** — Real pipeline (`create_social_post` / `cronPublish` / LinkedIn UGC) vs ChatGPT stubs (`publish_post`, `publish_now`) that insert rows and invent IDs.
2. **Tool discovery mismatch** — ChatGPT curated `tools/list` omitted identity/publish tools that `inspect_tools` advertised.
3. **Wrong account tables** — `connected_accounts` / `get_social_accounts` read generic `integrations`, while OAuth writes `facebook_integrations` / `linkedin_integrations`.
4. **LinkedIn identity gaps** — Organization scopes treated as identity; drafts lacked `linkedin_organization_id` / author URN.
5. **Data URIs in `media_urls`** — Connector paths stored `data:image/...` instead of uploading to storage.
6. **Scheduler drift** — Due LinkedIn rows stayed `scheduled` without identity fields; `inspect_scheduler` selected singular `platform` and could miss rows.

## Fix delivered

- Canonical `SocialPublishingService` (resolve → upload → publish → verify → receipt)
- Canonical MCP tools exposed in `tools/list` **and** ChatGPT curated catalog
- Hardened `upload_media` (MIME, size, signature, tenant storage, checksum)
- Identity tools with required Facebook/LinkedIn shapes
- Scheduler uses the same `social_posts` source of truth; overdue alerting
- Migration for orphaned fake-success + overdue LinkedIn recovery flags
- `SOCIAL_PUBLISH_TEST_MODE` support
- Catalog consistency validator (`scripts/validate-social-tool-catalog.ts`)

## Deployment

1. Deploy app code (Railway / Next.js).
2. Apply migration `20260724120000_social_publishing_repair.sql`.
3. Run `npx tsx scripts/validate-social-tool-catalog.ts` (must exit 0).
4. Run unit tests: `npm test -- --test-name-pattern='social'`.
5. Smoke: `get_facebook_identities`, `get_linkedin_identities`, `upload_media`, `publish_social_post` with `SOCIAL_PUBLISH_TEST_MODE=true`.

## Rollback

1. Revert the deploy to previous commit.
2. Migration columns are additive; status constraint expansion is compatible.
3. Orphaned rows can be left as-is or moved back to `draft` manually — do **not** bulk flip to `published`.

## Env flags

| Variable | Purpose |
|----------|---------|
| `SOCIAL_PUBLISH_ENABLED` | Kill switch (`false` disables publish) |
| `SOCIAL_PUBLISH_TEST_MODE` | `[TEST]` prefix, test page/org, no personal LinkedIn |
| `SOCIAL_PUBLISH_TEST_FACEBOOK_PAGE_ID` | Designated test Page |
| `SOCIAL_PUBLISH_TEST_LINKEDIN_ORG_ID` | Designated test organization |
