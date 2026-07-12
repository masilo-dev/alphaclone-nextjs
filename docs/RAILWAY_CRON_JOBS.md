# Railway Cron Jobs

Railway runs the application crons for the web service and the polling cron for the scraper service.

## Web service crons

Use the path list in `railway.crons.json` for the `alphaclone-web` service.

Typical jobs include:

- Daily cleanup and sync jobs
- Invoice processing
- Social publishing
- Token health checks
- MCP event queue processing

## Scraper service cron

Configure one cron on `alphaclone-scraper`:

| Schedule | Method | Path |
|----------|--------|------|
| `*/10 * * * *` | POST | `/api/scraper/campaign/poll` |

## Auth header

```text
x-internal-api-key: $INTERNAL_API_KEY
```

## Verification

```bash
curl -X POST \
  -H "x-internal-api-key: $INTERNAL_API_KEY" \
  https://<scraper>.up.railway.app/api/scraper/campaign/poll
```
