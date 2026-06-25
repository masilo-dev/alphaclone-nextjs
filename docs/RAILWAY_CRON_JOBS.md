# Railway Cron Jobs (scraper-only setup)

**Vercel** runs all app crons — see `vercel.json` and `vercel.pro.crons.json`.  
**Railway** runs **one cron** on `alphaclone-scraper` in the recommended split.

Do not duplicate Vercel crons on Railway (double invoices, emails, social posts).

---

## Railway — alphaclone-scraper

Configure in Railway dashboard → **alphaclone-scraper** → Cron Jobs.

| Schedule | Method | Path | Purpose |
|----------|--------|------|---------|
| `*/10 * * * *` | POST | `/api/scraper/campaign/poll` | Poll active lead campaigns |

**Auth header:**
```
x-internal-api-key: $INTERNAL_API_KEY
```

### Test manually

```bash
curl -X POST \
  -H "x-internal-api-key: $INTERNAL_API_KEY" \
  https://<scraper>.up.railway.app/api/scraper/campaign/poll
```

---

## Vercel — all other crons (reference)

These stay on **Vercel**, not Railway.

### Active (`vercel.json`)

| Schedule | Path |
|----------|------|
| `0 0 * * *` | `/api/cron/process-recurring-invoices` |
| `0 1 * * *` | `/api/cron/process-invoice-overdue-reminders` |
| `0 2 * * *` | `/api/cron/bonnie-dream` |
| `0 3 * * *` | `/api/cron/daily` |
| `0 4 * * *` | `/api/cron/intelligence-snapshots` |
| `*/5 * * * *` | `/api/cron/social-publish` |
| `*/15 * * * *` | `/api/cron/publish-linkedin` |
| `*/5 * * * *` | `/api/cron/sync-zoho-inbox` |

### Pro-tier (`vercel.pro.crons.json`)

Includes `process-events`, `sequence-worker`, `process-campaigns`, and other automation crons — enable on Vercel when on Pro plan.

**Auth:** `Authorization: Bearer $CRON_SECRET` or `x-railway-cron: 1` (if using external cron caller).
