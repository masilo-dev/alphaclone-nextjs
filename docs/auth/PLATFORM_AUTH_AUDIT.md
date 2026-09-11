# Alphaclone Systems — Platform Auth Audit (Phase 1)

**Date:** 2026-07-22  
**Public origin:** `https://alphaclonesystems.com`  
**Canonical MCP resource:** `https://alphaclonesystems.com/api/mcp`

## Confirmed root causes

1. **MCP resource mismatch (primary production failure):** `validateMCPAuthApp` compared token `resource` to `req.url` / request-derived `baseUrl` (`https://0.0.0.0:8080/...` on Railway). Tokens issued for the public MCP URL failed validation.
2. **Token endpoint / discovery also request-derived:** `/api/mcp/token` and some WWW-Authenticate metadata builders used forwarded host/request URL instead of a single configured public origin.
3. **No `PUBLIC_APP_ORIGIN` / `PUBLIC_MCP_RESOURCE`:** Multiple overlapping env vars (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL`, `RAILWAY_PUBLIC_DOMAIN`) with inconsistent precedence.
4. **Redis instantiated at module load** with empty URL/token → noisy Upstash warnings; not fail-closed when required.
5. **Schema drift risk:** `mcp_oauth_tokens` historically missing `resource` / `revoked`; admin tenants code references `tenants.status` while billing uses `subscription_status`.
6. **WhatsApp MCP tool** selects nonexistent `phone_number` / `provider` / `status` columns on `whatsapp_integrations` (actual: `phone_number_id`, `is_active`, `waba_id`).
7. **Audit logging** via browser Supabase client can hit RLS when actor context does not match insert policies.
8. **Redirect URI wildcards** used `startsWith` path matching without rejecting userinfo / suffix-domain attacks (partially mitigated by URL parsing, still needs hardening).

## Route inventory (summary)

### MCP OAuth

- `GET/POST /api/mcp/authorize` · `POST /api/mcp/oauth/approve` · `GET /authorize`
- `POST /api/mcp/token` · introspect · revoke · register
- `GET /api/mcp` · `/api/mcp/sse` · tools · resources · prompts · health
- `/.well-known/oauth-authorization-server` · `oauth-protected-resource` (+ `/api/mcp/well-known/*`)

### Integration callbacks (must use public origin)

- `/auth/callback` (Supabase)
- `/auth/microsoft/callback`
- `/api/auth/google/gmail/callback` · `/api/auth/google/calendar/callback`
- `/api/auth/facebook/callback` · `/api/auth/instagram/callback`
- `/api/auth/linkedin/callback` · `/api/auth/callback/x`
- `/api/auth/hubspot/callback` · `/api/auth/zoho/callback` · `/api/auth/calendly/callback`
- `/api/slack/oauth/callback` · `/api/zoom/oauth/callback` · `/api/stripe/connect/callback`

### Providers

ChatGPT MCP, Claude MCP, Supabase Auth, Google (Gmail/Calendar), Microsoft, Meta/Facebook, Instagram, LinkedIn, X, HubSpot, Zoho, Calendly, Slack, Zoom, Stripe Connect.

## Repair strategy

Centralize `PUBLIC_APP_ORIGIN` + `PUBLIC_MCP_RESOURCE`, validate tokens against configured resource (not container host), harden clients/PKCE/refresh, migrations for schema contract, lazy Redis, service-role audit writes, callback registry, tests, and auth health endpoint.
