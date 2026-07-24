# MCP Universal Client Compatibility — Audit & Remediation

**Date:** 2026-07-24  
**Branch:** `bonnie/mcp-universal-compat-218f`  
**Deploy:** Railway (`https://alphaclonesystems.com/api/mcp`)

## Goal

Any standards-compliant MCP client (ChatGPT Apps, Claude, Claude Code, Cursor, VS Code, Continue, Codex, future clients) can discover, OAuth, initialize, list tools, and call tools — without provider-specific capability gates.

## Working (pre-existing)

- Streamable HTTP at `/api/mcp` with JSON-RPC `initialize`, `tools/list`, `tools/call`, `resources/list`, `ping`
- OAuth AS metadata + protected resource metadata (well-known)
- Auth-code + PKCE + refresh rotation
- Token validation (expiry, revoked, resource/audience, tenant membership)
- Dynamic Client Registration (`POST /api/mcp/register`)
- Canonical `PUBLIC_APP_ORIGIN` / `PUBLIC_MCP_RESOURCE`

## Issues found and fixed

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| P0-1 | P0 | Revoke endpoint treated anonymous as authenticated `public-client` without binding | Require client auth or possession; confidential tokens need client auth |
| P0-2 | P0 | Tool scope map unused on `tools/call` | Enforce `requiredScopesForTool` / `hasRequiredScopes` before tool execution |
| P0-3 | P0 | `alphaclone-mcp-client` aliased → `chatgpt-connector` | Alias removed; ids are identity-preserving |
| P1-1 | P1 | CORS allowlist of 6 vendor origins | Reflect any safe HTTPS Origin (universal browser clients) |
| P1-2 | P1 | ChatGPT redirect URIs injected at authorize for multiple ids | Redirect allowlist = registered client `redirect_uris` only |
| P1-3 | P1 | Approve upserted unknown clients + Claude name heuristic | Reject unknown clients; require DCR |
| P1-4 | P1 | `/api/mcp/messages` returned empty resources/prompts | Parity with `/api/mcp` + `prompts/get` |
| P1-5 | P1 | Missing `prompts/get` | Implemented on HTTP route + SDK server |
| P1-6 | P1 | Health advertised SSE as streamable endpoint | Canonical endpoint `/api/mcp` |
| P1-7 | P1 | Auth failures flattened to HTTP 401 | Preserve 403 for `insufficient_scope` |
| P1-8 | P1 | Auth health required `chatgpt-connector` | Any active OAuth client counts |
| P1-9 | P1 | UA/name sniffing for curated tool catalog | Catalog mode from registered client seed only |
| P2-1 | P2 | Social publish hard-coded `aiClient: chatgpt-connector` | Use MCP context client label/id |

## Remaining limitations

- Live ChatGPT/Claude/Cursor connection tests need production OAuth credentials (not run in this agent).
- Plaintext token columns still supported for migration compatibility (hash preferred).
- Introspection is still relatively broad (resource-server style); tighten further if needed.
- Curated tool catalog for size-limited connectors (`chatgpt-connector`, Claude `1778309945386-41bab8272f61`, Manus, Grok, and unknown/DCR clients). Full catalog is opt-in (`alphaclone-mcp-client` / SDK `forChatGPT: false`). Claude clients that receive the full registry often connect successfully but show **zero tools** (silent schema-size drop).
- `alphaclone-mcp-client` seed has empty `redirect_uris` until DCR/admin sets them (intentional — no longer inherits OpenAI redirects).

## Spec compliance summary

| Capability | Status |
|------------|--------|
| initialize / initialized | OK |
| tools/list / tools/call | OK (+ scope gate) |
| resources/list / resources/read | OK (read via SDK) |
| prompts/list / prompts/get | OK |
| OAuth discovery | OK |
| PKCE auth code + refresh | OK |
| Multi-client (no single-provider hardcode) | Improved |
| Streamable HTTP | `/api/mcp` |

## How to connect (any client)

1. Resource URL: `https://alphaclonesystems.com/api/mcp`
2. Complete OAuth (PKCE) using registered or DCR client
3. Call `initialize` → `tools/list` → `tools/call` with Bearer token

See also: `docs/CHATGPT_MCP_CONNECTOR.md` (OpenAI Apps specifics) and `docs/auth/DELIVERABLES.md`.
