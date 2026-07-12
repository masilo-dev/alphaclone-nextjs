# Railway Environment Variables Template

This template covers the full Railway deployment for AlphaClone.

## Web service (`alphaclone-web`)

### Core

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | `https://alphaclonesystems.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `CRON_SECRET` | Secret for cron auth |
| `INTERNAL_API_KEY` | Service-to-service auth |
| `ENCRYPTION_SECRET` | Exactly 32 characters |

### Common integrations

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API |
| `DEEPSEEK_API_KEY` | DeepSeek API |
| `OPENAI_API_KEY` | OpenAI |
| `OPENROUTER_API_KEY` | OpenRouter |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `AZURE_CLIENT_ID` | Microsoft OAuth |
| `AZURE_CLIENT_SECRET` | Microsoft OAuth |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth |
| `ZOHO_CLIENT_ID` | Zoho OAuth |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth |
| `ZOHO_REDIRECT_URI` | Zoho callback URL |
| `ZOHO_REGION` | `US`, `EU`, `IN`, `AU`, `JP`, or `CA` |
| `ZOHO_ENCRYPTION_SECRET` | Exactly 32 characters |

### Messaging and infra

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Email delivery |
| `BREVO_API_KEY` | Email delivery |
| `QSTASH_TOKEN` | Queue auth |
| `QSTASH_URL` | Queue URL |
| `UPSTASH_REDIS_REST_URL` | Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token |
| `SENTRY_DSN` | Error tracking |
| `NEXT_PUBLIC_SENTRY_DSN` | Client error tracking |
| `SCRAPER_SERVICE_URL` | Railway scraper public URL |

## Scraper service (`alphaclone-scraper`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Same Supabase URL |
| `SUPABASE_KEY` | Same service role key |
| `INTERNAL_API_KEY` | Must match the web service |
| `MCP_SYNC_URL` | Web service sync endpoint |
| `APOLLO_API_KEY` | Apollo enrichment |
| `HUNTER_API_KEY` | Optional enrichment |
| `WORKER_CONCURRENCY` | Typically `2` to `5` |
| `ENABLE_ML_SCORING` | Usually `false` |
| `UPSTASH_REDIS_REST_URL` | Optional cache |
| `UPSTASH_REDIS_REST_TOKEN` | Optional cache |

## Suggested Railway values

| Variable | Where | Suggested value |
|----------|-------|-----------------|
| `SCRAPER_SERVICE_URL` | Web | `https://<scraper>.up.railway.app` |
| `MCP_SYNC_URL` | Scraper | `https://alphaclonesystems.com/api/internal/leads/mcp-sync` |
| `PORT` | Both | Set by Railway |

