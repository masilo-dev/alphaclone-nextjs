# Authentication Audit

## Mechanisms

| Mechanism | Implementation | Notes |
|-----------|----------------|-------|
| Staff session | Supabase SSR cookies + `createServerClient` | `src/lib/middleware.ts` refreshes session |
| Bearer API | `Authorization: Bearer <jwt>` | `requireAuthenticatedUser` validates via admin `getUser` |
| MCP OAuth | RFC 9728 resource metadata, token hash lookup | `src/services/mcp/authMiddlewareApp.ts` |
| Client portal | HMAC-SHA256 cookie JWT | `src/lib/auth/clientPortalAuth.ts` |
| Cron / internal | Shared secret bearer | `src/lib/cronAuth.ts`, `productionGuard.ts` |

## Registration / login / logout

- Auth routes under `/api/auth/*` and Supabase-hosted flows.
- Rate limits: login 5/15m, signup 3/h, password reset 3/h (`rateLimit.ts`).
- Account states: `profiles.account_status` — deleted/suspended/pending_deletion blocked in `requireActiveProfile`.

## Session lifecycle

- 15s in-memory cache for profile + tenant membership (`apiAuth.ts`) — performance tradeoff; not a security bypass (still hits DB on cache miss).
- Logout: Supabase signOut + PWA cache considerations (PWA-AUDIT).

## OAuth

- Multiple providers: Google, Facebook, Instagram, LinkedIn, Microsoft, Zoho, HubSpot, X, Calendly, etc.
- MCP-specific: resource URL validation against `PUBLIC_MCP_RESOURCE` (prevents wrong-audience tokens on wrong host).
- **Tests needed:** state parameter consistency per provider callback (spot-check during remediation).

## CSRF

- Cookie-based API calls rely on SameSite cookies + JSON APIs; no global CSRF token observed for API routes (typical for Bearer/cookie SPA with CORS policy — validate `next.config` CORS for sensitive POSTs).

## PKCE

- MCP OAuth path includes modern client discovery; provider-specific PKCE varies — **NEEDS VALIDATION** per provider module.

## Client portal auth

- Lockout after 10 failures / 30 minutes.
- Session salt rotation invalidates JWTs.
- Double guard: cookie session + portal token binding (`requireClientPortalAccessDoubleGuarded`).

## Threat tests (static / unit)

| Threat | Assessment |
|--------|--------------|
| Session fixation | Supabase-managed tokens — **REJECTED** as app-level gap |
| Cross-tenant session | Requires wrong `tenant_users` row — blocked by `requireTenantAccess` |
| Privilege escalation to platform admin | Guarded by `requirePlatformSuperAdmin`; unit tests exist |
| Open redirect | **NEEDS VALIDATION** on OAuth `redirect_uri` allowlists |
| Cron header spoof | `x-railway-cron` ignored in production without bearer (`cronAuth.ts`) — **REJECTED** in prod |

## Finding cross-reference

- **PORTAL-SIGN-001** — Signing secret candidate includes service role key  
- **RATE-001** — Auth endpoint rate limit weak when Redis down  
