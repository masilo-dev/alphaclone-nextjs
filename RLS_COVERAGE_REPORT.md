# RLS coverage report

Connected catalog result: 367 public tables.

- RLS disabled: `data_requests`, `tenant_isolation_quarantine`.
- RLS enabled with no policy: 24 tables, primarily OAuth codes/clients, encrypted integration-secret tables, rate limits, and internal queues.
- Broad `true` policies exist on public reference tables and several service-oriented tables. Each must be checked for role targeting; a `true` expression is not automatically unsafe when restricted to `service_role`.
- `SECURITY DEFINER` functions: 100.
- Security-definer functions without explicit `search_path`: 38.

Supabase's broader advisor also flags 129 mutable-search-path functions, 4 security-definer views, 2 public tables without RLS, 8 always-true RLS policies, and 172 executable grants on security-definer functions across `anon` and `authenticated`.

The critical RLS-disabled tables are fixed by migration `20260727160000_close_public_compliance_and_quarantine_tables.sql`. It is intentionally not deployed before backup and migration-parity review.
