# Rollback runbook

1. Stop the deployment if migrations, Auth, tenant isolation, or email delivery regress.
2. Preserve logs and correlation IDs without secrets.
3. Roll back the application to the previous Railway release.
4. Use the matching files under `supabase/rollbacks/` only after reviewing data written since deployment.
5. Prefer compatibility rollback: keep additive columns/tables and switch application reads back.
6. Never drop backfilled grants, tokens, email records, or customer data to perform a rollback.
7. Restore from backup only for confirmed irreversible corruption and with operator approval.
