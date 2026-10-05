# ALPHACLONE SYSTEMS
# SECURITY / RELIABILITY AUDIT

**Date:** 2026-10-05  
**Mode:** Read-only (DISCOVER → MAP → TEST → VERIFY → CLASSIFY → REPORT)  
**Methodology:** [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill)  
**Scope:** `masilo-dev/alphaclone-nextjs` codebase + existing audit artifacts; no production mutation  

---

## Executive Summary

AlphaClone is a **Next.js monolith on Railway** with **Supabase** data/auth and a **large MCP execution surface** (523 tools) backed by a **P0 domain external-write layer** (idempotency, receipts, policy gate). Staff authorization is generally **session + tenant membership** (`requireTenantAccess`). The **LLM boundary is real and partially hardened** (OAuth, quotas, `ToolPolicyGate`, converged writes for email/invoice/social/contract/project).

**Confirmed issues** in this pass are primarily **database RLS gaps on two public tables**, **rate-limit scaling weakness without Redis**, and **portal signing-secret hygiene**. **Cross-tenant IDOR and portal document isolation** were not live-proven — marked **NEEDS VALIDATION**. No authentication bypass or cross-tenant exploit was demonstrated in production.

**Market-readiness verdict:** **CONDITIONAL GO** (see § Market-Readiness Gate).

---

## Architecture Overview

See `ARCHITECTURE.md`. Summary: Browser/PWA or MCP → Cloudflare → Next middleware (rate limit + session) → API/MCP → authorization → Supabase admin or RLS-scoped client → external providers → `external_actions` / receipts → user.

---

## Attack Surface

629 App Router endpoints; MCP; OAuth callbacks; cron/internal secrets; client portal; public legal endpoints. Details: `ATTACK-SURFACE.md`, `API-INVENTORY.md`.

---

## Trust Boundaries

Documented in `TRUST-BOUNDARIES.md`. Highest priority: **tenant isolation with service-role admin**, **MCP OAuth tenant binding**, **internal API key → arbitrary tenantId in body**, **client portal vs staff session**.

---

## Confirmed Vulnerabilities / Misconfigurations

### SUP-RLS-001 — Public tables without RLS

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Status** | CONFIRMED (configuration); exploitability depends on DB grants |
| **Component** | Supabase |
| **Files** | `RLS_COVERAGE_REPORT.md`, `src/app/api/legal/data-request/route.ts` |
| **Evidence** | Catalog: `data_requests`, `tenant_isolation_quarantine` RLS disabled; legal route inserts into `data_requests` with service role |
| **Attack precondition** | Anon or authenticated role has SELECT on `data_requests` via PostgREST |
| **Attack path** | Direct Supabase API read of compliance queue |
| **Impact** | PII in data subject requests exposed across users |
| **Existing protection** | Inserts only through server route; not client-side insert |
| **Why protection may fail** | Missing RLS + overly broad GRANT |
| **Confidence** | High (config); Medium (exploit) |
| **Remediation** | Deploy documented migration; audit grants; no RLS change in this audit |
| **Regression test** | Anon key cannot SELECT `data_requests` |

### PORTAL-SIGN-001 — Portal JWT signing secret fallback chain

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Status** | CONFIRMED |
| **Component** | Client portal |
| **Files** | `src/lib/auth/clientPortalAuth.ts` (lines 38–43) |
| **Evidence** | `SUPABASE_SERVICE_ROLE_KEY` in `SHARED_SECRET_CANDIDATE_ENVS` |
| **Impact** | Secret role confusion; forged portal sessions if signing material equals/leaks service role |
| **Remediation** | Dedicated `CLIENT_PORTAL_SESSION_SIGNING_SECRET` only |
| **Regression test** | Prod boot fails without dedicated portal secret |

### RATE-001 — Distributed rate limit bypass without Redis

| Field | Value |
|-------|-------|
| **Severity** | P2 |
| **Status** | CONFIRMED |
| **Component** | Middleware / `rateLimit.ts` |
| **Evidence** | In-memory fallback documented when Redis unavailable |
| **Impact** | Brute force / abuse scales with replica count |
| **Remediation** | Mandate Upstash in prod + monitoring |
| **Regression test** | Readiness exposes Redis backend |

### MCP-SURFACE-001 — High MCP write blast radius (architecture)

| Field | Value |
|-------|-------|
| **Severity** | P2 (risk posture, not single CVE) |
| **Status** | CONFIRMED (metrics) |
| **Evidence** | `artifacts/audit/mcp-exposure-report.json`: 349 writes, 6 verification hooks |
| **Impact** | Any MCP authz bug has large impact |
| **Remediation** | Tool tiering, idempotency defaults, approval for external writes |

---

## Needs Validation

| ID | Title | Unresolved fact |
|----|-------|-----------------|
| PORTAL-IDOR-001 | Client document IDOR | documentId substitution across clients |
| SOC-IDENT-001 | Social account substitution | page/account ID ownership checks on all routes |
| DEP-NEXT-001 | Critical Next npm advisory | applicability on Linux @ 16.2.12 |
| MCP-IDEM-001 | MCP idempotency coverage | per-tool keys for external actions |
| DOC-STORAGE-001 | Storage path isolation | all upload handlers |
| PWA-CACHE-001 | SW caching of API JSON | production `sw.js` rules |
| TENANT-API-001 | 78 `manual_review` routes | canonical auth label per route |

---

## Rejected Findings

| ID | Claim | Reason |
|----|-------|--------|
| CRON-001 | `x-railway-cron` bypass in prod | `cronAuth.ts` requires Bearer secret in production |
| AUTH-001 | 78 routes unauthenticated | Classifier false positives; portal/OAuth/custom guards |
| SECRET-001 | Live service role in git | Only QUICK_START placeholders / test tokens found |

---

## Performance Problems

| ID | Issue | Severity |
|----|-------|----------|
| PERF-001 | Dashboard stats long `maxDuration`, heavy DB fan-out | P3 |
| PERF-PAGINATION-001 | Possible unbounded CRM/list queries | P2 (NEEDS VALIDATION) |

See `PERFORMANCE-AUDIT.md`.

---

## Reliability Problems

- **Strength:** P0 `executeDomainExternalWrite`, unknown-state reconciliation cron, execution state taxonomy.
- **NEEDS VALIDATION:** Stuck queues, partial provider failures on non-converged legacy routes.
- Compare states: REQUESTED → … → SUCCEEDED/FAILED documented in execution modules; not all legacy paths migrated.

---

## Cloudflare Opportunities

WAF per-route limits, API Shield subset, Logpush, RUM — `CLOUDFLARE-RECOMMENDATIONS.md`.

---

## Supabase Findings

367 tables; 2 without RLS; 24 RLS-no-policy; SD function search_path concerns — `SUPABASE-AUDIT.md`.

---

## LLM Execution Risks

OAuth + quota + policy gate + partial domain convergence — `LLM-EXECUTION-AUDIT.md`. Primary residual risk: **surface area × uneven idempotency/verification**.

---

## Tenant Isolation

Application layer **strong pattern** (`requireTenantAccess`). Database layer **requires grant + RLS verification** especially for tables without RLS. Service-role handlers remain **manual review** for IDOR (resource UUID + tenant filter).

---

## External Provider Risks

Encrypted token storage required in prod; OAuth callback diversity — validate state/PKCE per provider in Phase 2. No confirmed hard-coded production tenant/page IDs in application code (tests/docs only).

---

## Recommended Remediation (by priority)

### P0
- None **confirmed exploitable** in this read-only pass. Treat **SUP-RLS-001** as P0 if live grants confirm anon/authenticated SELECT on `data_requests`.

### P1
- SUP-RLS-001: RLS + grant audit + deploy pending migration (after backup review).
- PORTAL-IDOR-001: Playwright isolation tests on staging.
- SOC-IDENT-001: Assert provider account IDs belong to tenant on every publish path.

### P2
- PORTAL-SIGN-001, RATE-001, MCP tool tiering/idempotency, DEP-NEXT-001 triage, storage upload audit.

### P3
- PERF-001 dashboard optimization, PWA cache review, documentation secret examples in QUICK_START.

---

## Final Security Scorecard (/100)

| Domain | Current | Target | Notes |
|--------|---------|--------|-------|
| Tenant Isolation | 72 | 90 | RLS gaps + admin-client pattern |
| Authentication | 78 | 88 | Supabase + MCP OAuth solid base |
| Authorization | 70 | 90 | 78 routes need labels; IDOR not fully tested |
| API Security | 68 | 85 | Large surface; rate limit fallback |
| LLM Execution Security | 65 | 85 | Policy + P0 writes; huge tool count |
| Supabase Security | 70 | 92 | RLS report findings |
| OAuth Security | 75 | 88 | Provider-specific validation pending |
| External Integrations | 74 | 88 | Encryption enforced in prod |
| Document Security | 68 | 85 | Portal tests pending |
| Client Portal | 72 | 90 | Double guard; signing fallback |
| Social Execution | 73 | 88 | Converged path good; legacy routes TBD |
| Secrets Management | 76 | 90 | No live keys in repo; doc placeholders |
| Rate Limiting | 62 | 85 | Redis dependency |
| Idempotency | 75 | 90 | Domain layer; MCP uneven |
| Logging/Observability | 74 | 85 | Security logs + external_actions |
| PWA Security | 65 | 80 | SW rules not verified |
| Dependency Security | 58 | 85 | 66 npm advisories |
| Performance | 68 | 85 | Heavy dashboard paths |
| Reliability | 72 | 88 | Execution substrate improving |

**Blocking issues for broad market validation:** SUP-RLS-001 (if grants bad), unvalidated portal IDOR, Redis-less rate limits at scale.

---

## Market-Readiness Gate

**Verdict: CONDITIONAL GO**

AlphaClone is **architecturally serious** about LLM execution (policy gate, domain writes, audit rows) and tenant membership checks for staff APIs. It is **not yet fully proven** for broad market validation until:

1. Live Supabase **grant + RLS verification** for `data_requests` / quarantine tables.  
2. **Client portal IDOR** tests pass on staging.  
3. **Production Redis** (or Cloudflare rate limits) confirmed for abuse-sensitive endpoints.  
4. **Dependency triage** for critical/high npm advisories affecting runtime.

Theoretical perfection is not required; **demonstrated tenant and client boundaries** are.

---

## Playwright / QA

`playwright.config.js` exists; **`test:e2e` not run** against production (non-destructive policy). Recommend staging suite for auth, portal IDOR, tenant switching.

---

## Secret Scanning

Repository scan: **no production key material** in tracked code; `QUICK_START.md` contains **example** JWT-shaped placeholders — rotate if ever real. Masking policy applied in this report.

---

## Phase 2

**Do not remediate in bulk.** Await human approval, then open **PHASE 2 — REMEDIATION PLAN** with one finding per PR + regression tests.

---

## Document Index

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | System map |
| `ATTACK-SURFACE.md` | Entrypoints |
| `TRUST-BOUNDARIES.md` | Isolation |
| `API-INVENTORY.md` | HTTP surface |
| `SUPABASE-AUDIT.md` | Database |
| `AUTH-AUDIT.md` | Authentication |
| `LLM-EXECUTION-AUDIT.md` | MCP/agents |
| `SOCIAL-AUDIT.md` | Social publish |
| `DOCUMENT-AUDIT.md` | Docs/contracts |
| `CLIENT-PORTAL-AUDIT.md` | Portal |
| `PWA-AUDIT.md` | Service worker |
| `PERFORMANCE-AUDIT.md` | Latency/CWV |
| `CLOUDFLARE-RECOMMENDATIONS.md` | Edge |
| `DEPENDENCY-AUDIT.md` | npm audit |
| `COVERAGE-LEDGER.md` | Inspection log |
| `findings.json` | Structured findings |
| `_generated/api-inventory.json` | 629 routes |
