# Railway Cron Jobs

Railway runs application crons for the web service and the polling cron for the scraper service.

## Critical auth (production)

Production **rejects** cron calls that only send `x-railway-cron`. Every cron must send:

```http
Authorization: Bearer ${CRON_SECRET}
```

Set `CRON_SECRET` (or `INTERNAL_API_KEY`) on the web service, then configure that exact Bearer header on **each** Railway cron job.

If crons are misconfigured, queues back up (`business_automation_events`, scheduled `social_posts`, MCP queue) and `automation_cron_logs.ran_at` stops advancing.

## Web service crons

Use the path list in `railway.crons.json` for the `alphaclone-web` service.

Typical jobs include:

- Daily cleanup and sync jobs
- Invoice processing
- Social publishing (`/api/cron/social-publish`, `/api/cron/publish-linkedin`)
- Token health checks
- MCP event queue processing (`/api/cron/process-mcp-event-queue` every 2 minutes)
- Automation dispatcher (`/api/cron/process-events` every 5 minutes)
- Activity digest (`/api/cron/activity-digest`, every 3 hours)
- Platform hardening (`chief-of-staff`, `automation-heartbeat`, `resolve-stuck-social-posts`, `retry-failed`)

## Scraper service cron

Configure one cron on `alphaclone-scraper`:

| Schedule       | Method | Path                         |
| -------------- | ------ | ---------------------------- |
| `*/10 * * * *` | POST   | `/api/scraper/campaign/poll` |

Scraper auth may use the same Bearer secret or `x-internal-api-key` depending on that service’s guard — prefer Bearer for consistency.

## Verification

```bash
# Expect 401 without secret
curl -sS -i https://alphaclonesystems.com/api/cron/process-events | head

# Expect 200 with secret
curl -sS -i \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://alphaclonesystems.com/api/cron/process-events | head
```

Then confirm a fresh row in `automation_cron_logs` for `process-events`.
