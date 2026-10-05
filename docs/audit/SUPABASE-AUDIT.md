# Supabase Security Audit (read-only)

**Sources:** `RLS_COVERAGE_REPORT.md`, `artifacts/audit/rls-policies.json`, `artifacts/audit/database-objects.json`, `artifacts/audit/functions.json`, application code (`apiAuth.ts`, admin client usage).

## Catalog

| Metric | Value |
|--------|-------|
| Public tables | 367 |
| RLS disabled | 2 (`data_requests`, `tenant_isolation_quarantine`) |
| RLS enabled, no policy | 24 (OAuth codes, encrypted secret tables, queues, rate limits) |
| SECURITY DEFINER functions | 100 |
| SD functions without explicit `search_path` | 38 |
| Advisor flags (report) | 129 mutable search_path, 4 SD views, 8 always-true policies, 172 executable grants on SD funcs to anon/authenticated |

## Tenant isolation model

1. **Direct client access:** Supabase anon/authenticated JWT → PostgREST → **RLS must enforce** `tenant_id`.
2. **Server routes:** Often `createSupabaseAdminClient()` → **no RLS** → application must enforce `requireTenantAccess` + query filters.
3. **MCP / workers:** Service role + token-bound tenant context.

## Tables of concern

### RLS disabled (confirmed configuration)

| Table | App usage | Risk hypothesis |
|-------|-----------|-----------------|
| `data_requests` | `POST /api/legal/data-request` inserts via service role | If `SELECT` granted to anon/authenticated, GDPR queue readable cross-user |
| `tenant_isolation_quarantine` | Internal isolation tooling | Cross-tenant leak if exposed via API |

**Migration note (not deployed in audit):** `20260727160000_close_public_compliance_and_quarantine_tables.sql` referenced in `RLS_COVERAGE_REPORT.md`.

### RLS enabled, zero policies (24 tables)

Typical pattern: service-role-only OAuth/token vault tables. **Needs validation:** confirm no `GRANT ALL` to `anon` on these tables in live project.

### Broad `USING (true)` policies

Report notes reference/public tables and service-oriented tables — must be paired with **role-specific** policies; not automatically unsafe for `service_role` only.

## RPCs

- `check_daily_resource_quota` — MCP quota gate (`src/app/api/mcp/route.ts`).
- `secure_read_only_query` — NL analytics (`naturalLanguageSqlService.ts`); server-side validation before call.
- Many SD functions — review `search_path` hardening to prevent search_path injection (class: NEEDS VALIDATION on live DB).

## Storage

- Bucket list: `artifacts/audit/storage-buckets.json`
- Upload RLS helper: `scripts/apply-uploads-storage-rls.mjs`
- **Audit action:** Verify path conventions include `tenant_id` prefix and signed URL TTL on private docs.

## Service role exposure

| Check | Result |
|-------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` in client bundle | **Not found** in `NEXT_PUBLIC_*` / `VITE_*` client config patterns |
| Server-only usage | `src/lib/supabase-admin.ts`, MCP route, legal forms, workers |
| Client portal signing fallback | `clientPortalAuth.ts` lists service role as **last-resort signing secret candidate** (hygiene issue — see PORTAL-SIGN-001) |

## Client-side keys

`VITE_SUPABASE_URL` + anon key in middleware/browser — **expected**; security depends on RLS.

## Recommendations (report only — no changes)

1. Deploy compliance/quarantine RLS migration after backup parity review.
2. Export live `pg_policies` + `table_privileges` for anon/authenticated and attach to Phase 2.
3. Harden SD functions: fixed `search_path`, minimal grants.
4. Periodic advisor scan (`get_advisors` via Supabase MCP in remediation phase).

## Finding cross-reference

- **SUP-RLS-001** — RLS disabled on compliance tables (CONFIRMED config, exploitability NEEDS VALIDATION on grants).
