# Dashboard loading audit — 2026-09-29

## Confirmed root causes

- `TenantProvider` independently called `getCurrentUser()` after `AuthProvider` had already validated the session. The providers could start overlapping auth work during initial mount.
- The auth bootstrap awaited a noncritical MFA level lookup, with its own three second timeout.
- The CRM Kanban view called `leadService.getLeads()`, which reads every lead page into browser memory. Its initial view now requests 100 rows and loads additional pages on demand.
- The Clients directory used offset pagination, reset to the first page on remount, and filtered sales stage only in the browser. It now uses a stable server cursor for the directory, server search and stage filtering, and a tenant/user scoped warm snapshot.
- Dashboard local storage entries for projects, invoices, messages, and stats did not all include both tenant and user identity. They now do. Runtime lead/client caches clear on the platform reset event.
- The full Bonnie view and contract editor were imported with the dashboard shell despite only being needed for their route/action.
- Bulk outreach loaded the entire CRM and repeated its load effect due to an unstable default array. This is fixed in the same commit, along with recipient paging and prior-send suppression.

## Database evidence

Read-only checks on the active Supabase project showed existing tenant indexes on Leads and Clients. `pg_stat_user_tables` estimated 1,747 Leads and 649 business clients across the project at inspection time. The largest tenant had 1,215 Leads. The stored row footprint for those Leads was approximately 1,127,684 bytes; the first 100 rows used approximately 165,784 bytes. This compares row data, not serialized response size or browser timings.

`EXPLAIN (ANALYZE, BUFFERS)` for a representative first 101 Lead IDs ordered by `created_at DESC, id DESC` used `idx_leads_tenant_created` and completed in 24.486 ms at the database. No index migration was justified by this query. These numbers do not establish end-to-end application latency or the requested sub-three-second target.

## Architecture changed

- Auth session validation has one in-flight path, and workspace resolution reuses the authenticated user from context.
- A user-scoped last-known workspace snapshot can render the shell while membership is checked in the background. The server continues enforcing tenant access for protected requests. A confirmed lack of access clears the snapshot.
- Client and Kanban pages restore a tenant/user scoped first view immediately, then fetch fresh data. The Clients view preserves loaded pages during its first-page refresh; refresh failures keep the visible cache.
- Client requests for the same filter/page deduplicate in flight. Client and Lead runtime caches clear on sign-out, session expiry, or tenant switch.
- Development-only duration warnings identify slow session validation, workspace resolution, CRM clients pages, and CRM pipeline pages at the 1,000 ms threshold.

## Verification and limitations

- TypeScript and targeted ESLint checks passed.
- Focused frontend cache, outreach intelligence, and Lead Finder UI tests passed. The stale Lead Finder assertion now checks the shared tab source. The final full unit run passed 1,107 of 1,108 tests; the sole failure is an unrelated CRM identity test that reads the absent `supabase/migrations/20260904120000_crm_identity_dashboard_sync.sql` file. This checkout cannot pass the full suite without restoring that migration or correcting the test fixture.
- The production build did not complete in this 8 GiB execution workspace. Next.js workers were killed with SIGKILL under 12 GiB and 6 GiB configured Node heaps; the 4 GiB retry exited with a JavaScript heap out-of-memory error during optimized compilation. Production build validity remains unverified and needs a runner with sufficient memory or a separate build-memory investigation.
- Authenticated Playwright flows, cold/warm browser timing, provider synchronization, and a 10,000-record tenant could not be measured from this checkout without an authenticated test environment and representative fixtures. No sub-second or sub-three-second result is claimed.
- Other modules still contain full-list reads, including Growth Agent and reporting paths. The dashboard's older admin shell also retains manual state and some whole-screen loading paths. Select-all-matching across 10,000+ records remains separate work requiring server-side selection tokens and bulk operation APIs. Back scroll restoration beyond the cached Clients list needs authenticated browser verification.
