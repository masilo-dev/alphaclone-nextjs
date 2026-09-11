# MCP Audit Root-Cause Report (2026-09-02)

Grouped by tool and shared subsystem. Repairs applied in this session unless noted as external blocker.

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Known production failures | 8 | 0 (code paths repaired; live provider verification needs staging creds) |
| Catalog tools | ~530 | 530 |
| Contract test failures | unknown | 0 |
| Static audit failures | unknown | 0 |
| Staging-blocked (external-send/delete) | — | 56 |

Machine-readable results: `artifacts/audit/mcp-tool-contract-results.json`, `artifacts/audit/mcp-full-execution-audit.json`.

---

## 1. `upload_social_media`

**Root cause:** Handler passed `base64:` field name but `MediaInput` expects `data:`; empty values reached `.includes()` in decode path (partially fixed in PR #120).

**Repair:** Schema accepts `base64`, `data_url`, `source_url`, and aliases; handler maps to typed ingest input with validation guards before decode.

**Subsystem:** `social-publishing.ts`, `ingestMedia.ts`, `mediaUpload.ts`

---

## 2. `publish_social_post`

**Root cause:** `executionMode: 'autonomous'` violated `agent_runs_execution_mode_check` (DB allows `fully_autonomous`, not `autonomous`).

**Repair:** `normalizeAgentRunExecutionMode()` in `goalRunService.ts`; durable enqueue fallback to direct publish in `socialPublishTool.ts`.

**Subsystem:** Bonnie durable runtime / goal runs

---

## 3. `publish_facebook_photo`, `create_social_post`, `retry_social_post`

**Root cause:** Facebook Graph API errors surfaced only generic message `"An unknown error has occurred."`; tokens could appear in logs/responses; page ID vs identity ID confusion unchanged but errors now actionable.

**Repair:** New `parseFacebookGraphError.ts` captures HTTP status, code, subcode, fbtrace_id; sanitizes tokens; used in `SocialPublishingService.ts` and `providerAssetPublishers.ts`.

**Remaining blocker:** Live publish verification requires valid Page token + publicly accessible media URL in staging.

---

## 4. `search_clients`

**Root cause:** PostgREST `.or()` filter built unquoted ilike patterns; queries containing commas or `%` broke filter parsing → unhandled DB error → MCP `-32603`.

**Repair:** `postgrestFilters.ts` + `searchBusinessClients.ts`; tool registered in `crm.ts` registry; MCPServer delegates to shared search.

**Subsystem:** CRM / PostgREST query construction

---

## 5. `get_zoho_mail_messages`

**Root cause:** Unhandled provider exceptions re-thrown as generic internal MCP errors.

**Repair:** Catch-all returns standard envelope `{ ok, tool, data, error }` with stable codes (`ZOHO_AUTH_EXPIRED`, `CIRCUIT_OPEN`, `PROVIDER_ERROR`).

**Remaining blocker:** OAuth refresh and folder resolution need live Zoho credentials in staging.

---

## 6. `send_email`

**Root cause:** Durable runtime enqueued tasks when `BONNIE_DURABLE_RUNTIME=true` but worker not processing → stuck `QUEUED` 0%; approvals in `agent_approvals` not visible via `list_pending_approvals`.

**Repair:** Durable enqueue wrapped in try/catch with direct-send fallback; `list_pending_approvals` merges `autonomous_runner_approvals` + `agent_approvals`; `MCP_SEND_EMAIL_DIRECT=true` env override documented.

**Remaining blocker:** Production requires Railway `bonnie-worker` service for durable queue path.

---

## 7. CRM note verification (`add_note` / `get_contact_activity`)

**Root cause:** `add_note` wrote only to entity `notes` column; `get_contact_activity` reads `activities` table.

**Repair:** `add_note` now calls `logCrmActivityAdmin()` with `type: 'note'` so notes appear in contact activity feed.

---

## 8. Integration status inconsistency (Calendly)

**Root cause:** `get_calendly_status` read tenant settings only; `integrations_status` used `integrationStatusService` snapshot.

**Repair:** `get_calendly_status` now uses `getTenantIntegrationSnapshot()` for `booking_ready` and `calendly_connected`.

**Subsystem:** `integrationStatusService.ts` (authoritative)

---

## Shared subsystems

| Subsystem | Issue | Fix |
|-----------|-------|-----|
| PostgREST filters | Comma/wildcard breakage | `postgrestFilters.ts` |
| Facebook Graph | Opaque errors | `parseFacebookGraphError.ts` |
| Bonnie approvals | Split tables | Unified `list_pending_approvals` |
| Durable runtime | Stuck queue without worker | Direct-send fallback + docs |
| Response envelope | `-32603` leaks | Standard `{ ok, tool, data, error }` on Zoho/search paths |

---

## External blockers (require credentials / infra)

1. **Facebook/LinkedIn live publish** — Page/org tokens, media URL accessibility, Graph API app review
2. **Zoho Mail live reads** — OAuth reconnect, mailbox folder IDs
3. **Bonnie worker** — Separate Railway service with `BONNIE_DURABLE_RUNTIME=true`
4. **Staging tenant** — Set `MCP_AUDIT_TENANT_ID` for external-send/destructive tests
5. **Supabase local/remote** — `.env.local` credentials missing in CI dev shell (registry loads 530 tools regardless)
