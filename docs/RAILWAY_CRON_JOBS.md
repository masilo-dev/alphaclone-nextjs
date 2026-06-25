# Railway Cron Jobs

Configure in Railway dashboard → Service `alphaclone-web` → Cron Jobs.

**Auth header (all jobs):**
```
Authorization: Bearer $CRON_SECRET
```

Or set custom header:
```
x-railway-cron: 1
```

## Active (from vercel.json)

| Schedule | Method | Path | Purpose |
|----------|--------|------|---------|
| `0 0 * * *` | GET | `/api/cron/process-recurring-invoices` | Recurring invoices |
| `0 1 * * *` | GET | `/api/cron/process-invoice-overdue-reminders` | Invoice reminders |
| `0 2 * * *` | GET | `/api/cron/bonnie-dream` | Bonnie dream loop |
| `0 3 * * *` | GET | `/api/cron/daily` | Daily tasks |
| `0 4 * * *` | GET | `/api/cron/intelligence-snapshots` | Intelligence snapshots |
| `*/5 * * * *` | GET | `/api/cron/social-publish` | Social post publishing |
| `*/15 * * * *` | GET | `/api/cron/publish-linkedin` | LinkedIn publishing |
| `*/5 * * * *` | GET | `/api/cron/sync-zoho-inbox` | Zoho inbox poll sync |

## Pro-tier (enable on Railway)

| Schedule | Method | Path | Purpose |
|----------|--------|------|---------|
| `*/5 * * * *` | GET | `/api/cron/process-events` | Automation event bus |
| `*/5 * * * *` | GET | `/api/cron/process-campaigns` | Email campaigns |
| `*/5 * * * *` | GET | `/api/cron/sequence-worker` | Outreach sequences |
| `*/5 * * * *` | GET | `/api/cron/process-scheduled-ai-tasks` | Scheduled AI tasks |
| `*/15 * * * *` | GET | `/api/cron/process-task-reminders` | Task reminders |
| `*/5 * * * *` | GET | `/api/cron/autonomous-runner` | Autonomous agent |
| `*/5 * * * *` | GET | `/api/cron/autonomous-sync` | Autonomous sync |
| `0 * * * *` | GET | `/api/cron/retry-failed` | Retry failed automations |
| `0 * * * *` | GET | `/api/cron/reconcile-social-posts` | Social post reconcile |
| `*/15 * * * *` | GET | `/api/cron/linkedin-inbox-sync` | LinkedIn inbox poll |
| `0 * * * *` | GET | `/api/cron/deal-intelligence` | Deal intelligence |
| `0 * * * *` | GET | `/api/cron/contact-psychology` | Contact psychology |
| `0 * * * *` | GET | `/api/cron/entanglement-model` | Entanglement model |
| `*/30 * * * *` | GET | `/api/cron/calendly-sync` | Calendly sync |

## Scraper service (alphaclone-scraper)

| Schedule | Method | Path | Purpose |
|----------|--------|------|---------|
| `*/10 * * * *` | POST | `/api/scraper/campaign/poll` | Poll active campaigns |

Use `x-internal-api-key: $INTERNAL_API_KEY` for scraper crons.

## Test a cron manually

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-railway-web>.up.railway.app/api/cron/social-publish
```
