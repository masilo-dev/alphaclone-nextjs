# Phase 2 Gate Journal

## GATE 1 — SUP-RLS-001 live validation

| Field | Value |
|-------|-------|
| Status | **FIXED / NOT EXPLOITABLE** (already remidiated in production) |
| Live RLS | `data_requests` = enabled; `tenant_isolation_quarantine` = enabled |
| Live grants | **service_role only** — no anon/authenticated privileges |
| Policies | None (deny-by-default) |
| Migration applied | `20260727160000_close_public_compliance_and_quarantine_tables` |
| Anon REST probe | SELECT/INSERT → HTTP 401 `permission denied` |
| Reclassification | Remains **P1 config debt historically**; **not P0** live |

## GATE 2 — RLS remediation

| Field | Value |
|-------|-------|
| Status | **FIXED** (migration already live; regression tests added) |
| DB changes this PR | None required (idempotent migration already in repo) |

## GATE 3 — PORTAL-SIGN-001

| Field | Value |
|-------|-------|
| Status | **FIXED** |
| Change | Dedicated `CLIENT_PORTAL_SESSION_SIGNING_SECRET` only; production fail-closed |
| Files | `src/lib/auth/clientPortalAuth.ts`, `scripts/production-env.mjs` |

## GATE 4 — PORTAL-IDOR-001

| Field | Value |
|-------|-------|
| Status | **FIXED** (code already scoped; strengthened + tests) |
| Evidence | Document/contract routes filter `tenant_id` + `client_id`; `portalOwnsResource` helper |
| Live Playwright | Not run against production clients (use staging gate) |

## GATE 5 — SOC-IDENT-001

| Field | Value |
|-------|-------|
| Status | **PARTIALLY FIXED → FIXED for Instagram gap** |
| Change | Instagram lookups require `tenantId` (Facebook/LinkedIn already required) |
| Domain publish | `resolveSocialIdentity` / `SocialPublishingService.resolveIdentity` tenant-scoped |

## GATE 6 — RATE-001

| Field | Value |
|-------|-------|
| Status | **FIXED** |
| Change | Production sensitive paths fail closed without Redis; readiness exposes `rate_limit`; prod env requires Redis |

## GATE 7 — MCP authz + idempotency

| Field | Value |
|-------|-------|
| Status | **FIXED** |
| Change | Tool risk tiers drive `classifyToolRisk` + HIGH_RISK approval; `ensureMcpIdempotencyKey` derives stable keys for EXTERNAL/HIGH_RISK writes in `guardToolExecution` |
| Invariant | Same tenant+tool+canonical args → same idempotency key (retries safe) |

## GATE 8–10 — Storage / PWA / deps

| Gate | Status |
|------|--------|
| Storage | **PARTIALLY FIXED** — portal signed URLs after ownership; broader upload inventory deferred |
| PWA | **FIXED** — NetworkOnly for `/api/*`; logout `CLEAR_AUTH_CACHES` message |
| DEP-NEXT | **MITIGATED** — critical Next advisory is Windows RCE; prod is Linux Railway on 16.2.12; upgrade tracked, not force-applied |

## GATE 11–15

OAuth/webhook deep pass, perf indexes, full independent re-audit, and Cloudflare paid enables remain follow-ups. Edge recommendations documented without enabling paid features.
