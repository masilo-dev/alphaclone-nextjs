# Alphaclone Systems production audit

Baseline date: 2026-07-26
Production project: `ehekzoioqvtweugemktn` (`eu-central-1`, healthy)
Current verdict: **Blocked from deployment pending migration dry-run, backup confirmation, and local Docker rebuild**

## Executive summary

Repository mapping scanned 2,824 files, 93 pages, 483 API routes, more than 320 canonical migrations, 42 cron routes, 367 production public tables, and 5 local Supabase Edge Functions. The connected production project has 2 active Edge Functions and its recorded migrations stop at `20260724200000`; the later canonical migration chain remains pending.

Critical production evidence:

| ID | Severity | Component | Evidence | Fix | Status |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | Critical | `data_requests` | RLS disabled; `anon` and `authenticated` had all table privileges | `20260727160000_close_public_compliance_and_quarantine_tables.sql` | Ready, not deployed |
| SEC-002 | Critical | `tenant_isolation_quarantine` | RLS disabled; public roles had all privileges | Same migration | Ready, not deployed |
| AUTH-001 | High | `tenant_users` membership reads | Production API logs repeatedly returned 400 for nonexistent `status` | Removed schema-probe reads | Fixed locally, tested |
| MCP-001 | High | MCP OAuth | 2 active rows still contain plaintext token material | Grant/encryption expand migration | Ready, not deployed |
| DB-001 | High | Migration parity | Production is 15 canonical migrations behind | Dry-run and staged deployment required | Blocked |
| DB-002 | High | Database functions | 38 of 100 `SECURITY DEFINER` functions lack fixed `search_path` | Function-by-function remediation required | Open |
| RLS-001 | Medium | RLS policy coverage | 24 RLS-enabled server tables have no client policies | Verify grants and document server-only access | Open |
| AUTH-002 | Medium | OAuth codes | 29 expired unused MCP authorization codes | Existing cleanup needs scheduling verification | Open |
| EDGE-001 | Medium | Edge Functions | Local 5; production 2 active | Diff/deploy after review | Blocked |
| ROUTE-001 | Medium | Static routing | 451 potential broken links require runtime classification | Playwright authenticated crawl | Open |
| AUTH-003 | High | Confirmation links | No dedicated server token-hash confirmation endpoint | Added `/auth/confirm` with safe OTP verification and recovery routing | Fixed locally, tested |
| DB-003 | High | Public views | Four views execute with owner rights | Added `security_invoker=true` migration | Ready, not deployed |
| DB-004 | High | Security-definer functions | 38 functions have mutable search paths | Added signature-preserving hardening migration | Ready, not deployed |

## Verified data integrity

Connected read-only SQL found zero orphan tenant memberships, duplicate memberships, users without profiles, profiles without users, or missing tenant IDs in contacts, tasks, and deals. No production rows were changed.

## Automated evidence

- `npm run audit:production -- --json`: 5 passed, 0 failed, 1 credential-bound check blocked.
- Targeted tenant/OAuth/security suite: 23 passed, 0 failed.
- `git diff --check`: passed.
- Local Supabase rebuild: blocked because Docker is unavailable.
- Full typecheck: inconclusive; repository TypeScript compilation exceeded the available execution window even with a 7 GB heap.

Machine-readable evidence is under `artifacts/audit/`.

Supabase advisors reported 345 security findings (6 error, 316 warning, 23 informational) and 2,304 performance findings (1,586 warning, 718 informational). High-volume classes include 129 mutable function search paths, 172 executable security-definer-function grants, 283 unindexed foreign keys, 580 RLS init-plan findings, 988 multiple-permissive-policy findings, and 18 duplicate-index findings. These require workload-aware remediation rather than a blanket migration.
