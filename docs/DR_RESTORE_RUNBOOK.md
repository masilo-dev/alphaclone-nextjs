# Disaster Recovery — Restore Runbook

**Scope:** Alphaclone Next.js + Supabase Postgres  
**Owner:** Platform / DevOps  
**Last updated:** 2026-07-24

## Objectives

| Metric                         | Target     | Evidence                                |
| ------------------------------ | ---------- | --------------------------------------- |
| RPO (Recovery Point Objective) | ≤ 24 hours | Daily GitHub Actions backup @ 03:00 UTC |
| RTO (Recovery Time Objective)  | ≤ 4 hours  | Manual restore + migration verify       |

## Backup sources

1. **GitHub Actions** — `.github/workflows/backup.yml` runs `scripts/backup/daily-backup.sh` using `DATABASE_URL`.
2. **Supabase** — project-level backups (enable in Supabase dashboard; not verified from repo).
3. **Artifacts** — `database-backup-<run_number>` retained 30 days in GitHub Actions.

## Preconditions

- `DATABASE_URL` or Supabase service role with restore permissions
- `pg_restore` / `psql` client installed
- Maintenance window announced to tenants

## Restore procedure

### 1. Identify backup

```bash
# Download latest artifact from GitHub Actions run, or:
ls -lt backups/*.sql.gz | head -1
```

### 2. Verify backup integrity

```bash
chmod +x scripts/backup/verify-backup.sh
./scripts/backup/verify-backup.sh backups/your-backup.sql.gz
```

### 3. Restore to staging first

```bash
export TARGET_DATABASE_URL="postgresql://..."
gunzip -c backups/your-backup.sql.gz | psql "$TARGET_DATABASE_URL"
```

### 4. Apply pending migrations

```bash
npx supabase db push --db-url "$TARGET_DATABASE_URL"
npm run migrate:check
```

### 5. Smoke test

- `GET /api/health` → 200
- `GET /api/readiness` → 200 (or 503 with documented degraded state)
- Login → dashboard → invoice list (tenant-scoped)
- Cron auth: `Authorization: Bearer $CRON_SECRET` required in production

### 6. Cutover production

- Point Railway `DATABASE_URL` / Supabase connection to restored instance
- Redeploy app from tagged release
- Monitor Sentry for 30 minutes

## Rollback

If restore fails validation, revert Railway env to previous database URL and redeploy last known-good release.

## Game-day checklist

- [ ] Download backup artifact
- [ ] Run `verify-backup.sh`
- [ ] Restore to isolated staging DB
- [ ] Run migrations + unit tests
- [ ] Document actual RPO/RTO observed
- [ ] Update this runbook with findings

## Related

- `docs/PRODUCTION_READINESS.md`
- `docs/RAILWAY_ENV_TEMPLATE.md`
- `.github/workflows/backup.yml`
