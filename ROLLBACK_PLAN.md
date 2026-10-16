# AlphaClone Systems — Emergency Rollback & Recovery Plan

**Target Environment**: Production Railway Deployment & Supabase Database  
**Objective**: Immediate restoration of service in the event of an unexpected regression or deployment disruption.

---

## 1. Code & Deployment Rollback

### Railway Instant Deployment Revert
1. Open the Railway dashboard for the `alphaclone-nextjs` service.
2. Navigate to **Deployments**.
3. Locate the previous stable production deployment commit.
4. Click **Redeploy / Rollback** on the preceding build.
5. Verification: Railway switches traffic immediately to the previous container image without downtime.

### Git Revert Protocol
If rolling back via Git commit:
```bash
# Checkout production branch
git checkout main
# Revert the merge commit
git revert -m 1 <MERGE_COMMIT_HASH> -m "revert: rollback A-Z engineering batch"
# Push to remote to trigger clean CI rebuild
git push origin main
```

---

## 2. Database & Schema Rollback Safeguards

Because all database migrations in `MIGRATION_PLAN.md` are **purely additive** (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), rolling back the application code does **not** require rolling back database columns. The previous application version will simply ignore the new columns and continue reading legacy structures normally.

In the event an index causes unforeseen write lock contention:
```sql
-- Safe, non-blocking index drop if necessary:
DROP INDEX CONCURRENTLY IF EXISTS idx_business_invoices_tenant_contract;
```

---

## 3. Storage & Provider Fallback

- **Storage Proxy**: If `invoice-documents` access encounters permission errors, the application automatically falls back to generating PDFs on demand in memory.
- **Email Delivery**: If Zoho Mail API encounters provider outages, transactional notifications automatically route through Brevo via the dual-provider resilience layer.
- **Client Notifications**: If client notification dispatch fails, delivery logs record `status: 'failed'` and retain idempotency keys for automated retry worker reclamation.
