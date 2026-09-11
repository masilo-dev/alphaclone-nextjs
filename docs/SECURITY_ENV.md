# Production security environment variables

Required for a secure production deployment:

| Variable | Purpose |
|----------|---------|
| `ENCRYPTION_SECRET` | 32-character key for integration token encryption at rest |
| `INTERNAL_API_KEY` or `CRON_SECRET` | Protects `/api/email/welcome`, cron routes, internal jobs |
| `ZOHO_WEBHOOK_SECRET` | HMAC verification for Zoho inbound webhooks |
| `DAILY_WEBHOOK_SECRET` | Daily.co webhook signature verification |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | Calendly webhook verification |
| `QSTASH_CURRENT_SIGNING_KEY` | QStash job signature verification |
| `TWILIO_AUTH_TOKEN` | Twilio webhook HMAC |
| `FACEBOOK_APP_SECRET` | Meta webhook + OAuth state HMAC |

## Optional but recommended

| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limiting |
| `DEV_MIGRATE_SECRET` | Only if `/api/dev-migrate` must exist in production (otherwise route returns 404) |

## After deploy

1. Run pending Supabase migrations (`npm run migrate`).
2. Set `ENCRYPTION_SECRET` before users reconnect OAuth integrations.
3. Rotate MCP API keys (now stored as SHA-256 hashes).
4. Point Meta WhatsApp webhook to `/api/webhooks/facebook/whatsapp`.

## Integration token health crons

| Cron path | Schedule |
|-----------|----------|
| `/api/cron/linkedin-token-health` | Daily 06:00 UTC |
| `/api/cron/meta-token-health` | Daily 06:00 UTC |
| `/api/cron/zoho-token-health` | Daily 06:00 UTC |
| `/api/cron/integration-token-health` | Slack, Microsoft, Google Calendar |
