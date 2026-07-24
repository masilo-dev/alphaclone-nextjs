# Platform Auth OAuth Repair — Deliverables

## 1. Auth / OAuth routes found

See `docs/auth/PLATFORM_AUTH_AUDIT.md`.

**MCP:** `/api/mcp`, `/api/mcp/sse`, `/api/mcp/authorize`, `/api/mcp/token`, introspect, revoke, register, well-known  
**Integrations:** Google Gmail/Calendar, Microsoft, Facebook, Instagram, LinkedIn, X, HubSpot, Zoho, Calendly, Slack, Zoom, Stripe Connect  
**Supabase:** `/auth/callback`

## 2. External provider callback URLs (configure in provider consoles)

| Provider        | Callback URL                                                      |
| --------------- | ----------------------------------------------------------------- |
| Supabase Auth   | `https://alphaclonesystems.com/auth/callback`                     |
| Microsoft       | `https://alphaclonesystems.com/auth/microsoft/callback`           |
| Google Gmail    | `https://alphaclonesystems.com/api/auth/google/gmail/callback`    |
| Google Calendar | `https://alphaclonesystems.com/api/auth/google/calendar/callback` |
| Facebook        | `https://alphaclonesystems.com/api/auth/facebook/callback`        |
| Instagram       | `https://alphaclonesystems.com/api/auth/instagram/callback`       |
| LinkedIn        | `https://alphaclonesystems.com/api/auth/linkedin/callback`        |
| X               | `https://alphaclonesystems.com/api/auth/callback/x`               |
| HubSpot         | `https://alphaclonesystems.com/api/auth/hubspot/callback`         |
| Zoho            | `https://alphaclonesystems.com/api/auth/zoho/callback`            |
| Calendly        | `https://alphaclonesystems.com/api/auth/calendly/callback`        |
| Slack           | `https://alphaclonesystems.com/api/slack/oauth/callback`          |
| Zoom            | `https://alphaclonesystems.com/api/zoom/oauth/callback`           |
| Stripe Connect  | `https://alphaclonesystems.com/api/stripe/connect/callback`       |
| MCP consent     | `https://alphaclonesystems.com/authorize`                         |

ChatGPT MCP redirects (client `chatgpt-connector`): OpenAI connector redirect URIs (chatgpt.com / chat.openai.com), not Alphaclone callbacks.

## 3. Root causes

1. MCP resource validation compared token audience to `req.url` → `https://0.0.0.0:8080/api/mcp` on Railway.
2. Token/discovery/introspect/SSE sometimes derived issuer/resource from request Host.
3. No single `PUBLIC_APP_ORIGIN` / `PUBLIC_MCP_RESOURCE` contract.
4. Redis constructed at import with empty credentials.
5. Schema drift risk on `mcp_oauth_tokens` / `tenants.status` / WhatsApp columns.
6. Audit inserts via browser client subject to RLS failures.

## 4. Files changed (high level)

- `src/lib/config/public-origin.ts`, `oauth-callbacks.ts`
- `src/lib/mcp/scopes.ts`, `oauthRedirect.ts`, `mcpWellKnown.ts`
- `src/lib/errors/auth-errors.ts`, `src/lib/redis.ts`, `src/lib/server/appUrl.ts`
- `src/lib/security/serverAuditLog.ts`
- `src/services/mcp/authMiddlewareApp.ts`, `MCPServer.ts` (WhatsApp select)
- `src/app/api/mcp/token/route.ts`, introspect, sse
- Integration connect/callback routes (LinkedIn, X, Facebook, Instagram, Zoho, Google)
- `src/app/api/internal/auth-health/route.ts`
- `scripts/production-env.mjs`
- Migration + tests + docs

## 5. Database migrations

`supabase/migrations/20260722140000_platform_auth_oauth_hardening.sql`

- mcp_oauth_tokens: id, hashes, revoked, resource, refresh_expires_at, last_used_at, indexes
- mcp_oauth_codes: consumed_at, code_hash, resource
- chatgpt-connector client seed
- tenants.status column + backfill from subscription_status

## 6. Environment variables

See `docs/auth/production.env.example`. Critical:

```
PUBLIC_APP_ORIGIN=https://alphaclonesystems.com
NEXT_PUBLIC_APP_URL=https://alphaclonesystems.com
PUBLIC_MCP_RESOURCE=https://alphaclonesystems.com/api/mcp
SUPABASE_SERVICE_ROLE_KEY=...
ENCRYPTION_SECRET=... (32 chars)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## 7. Security improvements

- Canonical resource validation (no container host)
- Hardened redirect URI matching (no userinfo / suffix domains)
- Atomic auth-code consume; timing-safe PKCE compare
- Refresh-token rotation with revoke of prior token
- Token hash columns + dual lookup compatibility
- Scope registry (fail closed)
- Lazy Redis; production env validation for origin/MCP/Redis
- Service-role audit writer with redaction
- Auth health endpoint (internal auth only)

## 8. Tests added

`tests/unit/platform-auth-origin.test.mjs` — origin, 0.0.0.0 mismatch, redirects, scopes, well-known

## 9. Remaining risks

- Plaintext token columns still present until all clients rotate (by design)
- Some integration callbacks still accept provider-specific env override URIs (intentional)
- Redis not fail-closed unless `REDIS_REQUIRED=true`
- Full E2E ChatGPT reconnect requires production env + migration apply
- `get_social_posts` unknown-tool issue not fully remediated beyond scope registry (verify tools/list separately)

## 10. Deployment steps

1. Backup `mcp_oauth_*` tables
2. Apply migration `20260722140000_platform_auth_oauth_hardening.sql`
3. Set `PUBLIC_APP_ORIGIN`, `PUBLIC_MCP_RESOURCE`, Redis vars on Railway
4. Deploy this branch
5. `GET /api/internal/auth-health` with `Authorization: Bearer $CRON_SECRET`
6. Disconnect ChatGPT connector → reconnect fresh OAuth
7. Confirm token issue + `/api/mcp` initialize + tools/list

## 11. Rollback

1. Redeploy previous Railway image/commit
2. Do **not** drop new columns (additive migration is backward compatible)
3. If needed, unset `PUBLIC_MCP_RESOURCE` only after confirming old code path (not recommended)

## 12. Production verification checklist

- [ ] Auth health all `true`
- [ ] Well-known resource = `https://alphaclonesystems.com/api/mcp` (no 0.0.0.0)
- [ ] ChatGPT OAuth authorize → consent → token
- [ ] MCP bearer auth succeeds (no resource mismatch)
- [ ] initialize / tools/list OK
- [ ] Read tool OK; write tool only with write scope
- [ ] Replayed auth code → `invalid_grant`
- [ ] Evil redirect still rejected
- [ ] No secrets in logs
- [ ] Audit insert via service role succeeds
- [ ] WhatsApp status tool no longer errors on `phone_number`
