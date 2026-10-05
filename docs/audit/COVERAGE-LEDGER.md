# Coverage Ledger

Methodology: Cloudflare security-audit-skill — reconnaissance + coverage-led hunting + adversarial validation.

**Audit run ID:** alphaclone-2026-10-05-readonly  
**Agent:** Cloud Agent (Principal AppSec / Reliability auditor mode)  
**Mutable actions:** None (no RLS changes, no prod config, no fixes)

## Coverage summary

| Unit | Boundary | Status | Evidence |
|------|----------|--------|----------|
| ARCH-01 | Full repo layout | covered | `ARCHITECTURE.md`, 629 API routes enumerated |
| API-01 | App Router inventory | covered | `_generated/api-inventory.json` |
| AUTH-01 | Staff session + Bearer | covered | `apiAuth.ts`, `middleware.ts` |
| AUTH-02 | MCP OAuth | covered | `authMiddlewareApp.ts`, `mcp/route.ts` |
| AUTH-03 | Client portal | covered | `clientPortalAuth.ts`, login + finance routes |
| AUTH-04 | Cron / internal | covered | `cronAuth.ts`, `internal/leads/mcp-sync` |
| TENANT-01 | requireTenantAccess pattern | covered | Grep + P0 route sample |
| TENANT-02 | RLS catalog | covered | `RLS_COVERAGE_REPORT.md`, `rls-policies.json` |
| TENANT-03 | Live cross-tenant exploit | blocked | No destructive prod tests in audit |
| LLM-01 | MCP tool registry | covered | `mcp-exposure-report.json` |
| LLM-02 | Tool policy + guard | covered | `ToolPolicyGate.ts`, `toolExecutionGuard.ts` |
| LLM-03 | Domain external write | covered | `domainExternalWrite.ts`, commands |
| LLM-04 | NL SQL | covered | `naturalLanguageSqlService.ts` |
| SOC-01 | Social converge path | covered | `socialPublishCommand.ts`, schedule route |
| SOC-02 | Legacy social routes | partial | 78 manual_review routes not each traced |
| DOC-01 | Client finance document | covered | `client-finance/document/route.ts` |
| DOC-02 | All upload paths | deferred | Remediation-phase file upload pass |
| PORTAL-01 | Portal IDOR | blocked | Needs Playwright/staging credentials |
| PWA-01 | SW registration | covered | `registerServiceWorker.ts` |
| PWA-02 | Built sw.js rules | blocked | Requires production build artifact |
| SECRET-01 | Repo secret scan | covered | ripgrep patterns; QUICK_START placeholders only |
| DEP-01 | npm audit | covered | `DEPENDENCY-AUDIT.md` |
| PERF-01 | Dashboard stats | covered | `dashboard/stats/route.ts` |
| PERF-02 | Lighthouse/CWV | out_of_scope | No browser metrics in audit VM |
| CF-01 | Zone WAF config | out_of_scope | Not in repository |
| PLAY-01 | Playwright security | partial | Config exists; tests not executed vs prod |

## Manual review queue (78 API routes)

**Status:** `candidate` — classifier could not match auth helper strings; spot checks show many use portal/OAuth/custom guards.

**Next wave:** Assign owner per route in `_generated/api-inventory.json` where `auth === "manual_review"`.

## Prior artifacts incorporated

- `artifacts/audit/*` (MCP, RLS, routes, storage, email)
- P0 unit tests (41 tests) — execution substrate behavior
- `tests/security/super_admin_security.test.ts` — referenced, not re-run (TS test runner path)

## Validation passes

| Candidate | Validator action | Verdict |
|-----------|------------------|---------|
| x-railway-cron auth bypass in prod | Read `cronAuth.ts` | **REJECTED** |
| All 78 manual_review = unauthenticated | Spot check client-finance | **REJECTED** |
| data_requests no RLS | RLS report + legal route | **CONFIRMED** config gap |
| MCP 523 tools all unguarded | Policy gate + quotas | **REJECTED** as total bypass; **CONFIRMED** large surface |
| Service role in browser bundle | Grep VITE/NEXT_PUBLIC | **REJECTED** |

## Machine ledger

See `coverage-ledger.json` for structured units (simplified schema for this run).
