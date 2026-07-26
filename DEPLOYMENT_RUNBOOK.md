# Deployment runbook

1. Confirm the target project is exactly `ehekzoioqvtweugemktn`.
2. Confirm a current restorable production backup.
3. Start Docker and run:
   `npx supabase start`
4. Rebuild locally:
   `npx supabase db reset`
5. Run:
   `npx supabase db lint`
   `npx supabase test db`
6. Run all repository tests, typecheck, route audit, environment validation, and production build.
7. Inspect the 15 pending migrations and their rollback files.
8. Run:
   `npx supabase db push --dry-run`
9. Review every statement; never include seed data.
10. Deploy to staging when available and execute tenant/auth/email/MCP smoke tests.
11. Apply migrations using the normal migration command only after approval.
12. Deploy reviewed Edge Functions with their existing JWT posture.
13. Deploy the application.
14. Re-run Supabase security/performance advisors and monitor Auth, API, storage, and worker logs.

Do not run `supabase db reset --linked`.
