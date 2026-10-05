# Client Portal Audit

## Trust model

Separate from staff Supabase session:

1. **Finance portal token** in URL (`finance_portal_token` on `business_clients`).
2. **Password** (`client_portal_password_hash`) with lockout.
3. **Session cookie** `ac_client_portal_session` — HMAC JWT with `sub` (client_id), `tid` (tenant_id), `jti`, `salt`.

## Login

`POST /api/client-portal-auth/login`

- Rate limit: `rateLimitClientPortalLogin` (Upstash or fallback).
- Audit rows on failure/success (`writeClientPortalAuditRow`).
- Legacy first-time password set flow when hash null.

## Session validation

`requireClientPortalSession` / `requireClientPortalAccessDoubleGuarded`:

- Verifies signature, expiry, audience, issuer.
- Checks session row not revoked; salt matches client row (rotation invalidates old JWTs).

## API families

- `/api/client-finance/*` — documents, invoices, messages, approvals, activity.
- `/api/client-portal-auth/me`

## Cross-client isolation tests (recommended)

| Test | Method |
|------|--------|
| Client A token + Client B `documentId` | Expect 403/404 |
| Client A session cookie + Client B portal token | Expect TOKEN_MISMATCH |
| Expired JWT | 401 |
| Salt rotation after login | 401 SALT_ROTATED |

**Playwright:** Not run against production in this audit (read-only policy). Mark **NEEDS VALIDATION**.

## Signing secret hygiene

`getSessionSigningSecret()` candidate envs include `SUPABASE_SERVICE_ROLE_KEY` as last resort (`clientPortalAuth.ts` lines 38–43).

**Impact:** If service role used as HMAC secret, compromise of JWT forgery secret equals DB admin key material overlap — **poor separation** (finding PORTAL-SIGN-001, P2 CONFIRMED configuration smell; exploit requires env leak).

## PWA / cache

Portal pages must not cache authenticated JSON in service worker — see PWA-AUDIT.

## Findings

- **PORTAL-SIGN-001** (P2, CONFIRMED): Service role listed as portal JWT signing fallback.  
- **PORTAL-IDOR-001** (P1, NEEDS VALIDATION): Document/invoice ID substitution across clients.  
