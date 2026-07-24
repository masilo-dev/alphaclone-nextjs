# Railway Environment Variables Template

This template covers the full Railway deployment for AlphaClone.

## Web service (`alphaclone-web`)

### Core

| Variable                         | Description                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                       | `production`                                                                                                         |
| `NEXT_PUBLIC_APP_URL`            | `https://alphaclonesystems.com`                                                                                      |
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL                                                                                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anon key                                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`      | Supabase service role key                                                                                            |
| `CRON_SECRET`                    | **Required.** Railway cron must send `Authorization: Bearer ${CRON_SECRET}` (header alone is rejected in production) |
| `INTERNAL_API_KEY`               | Service-to-service auth (fallback for cron Bearer)                                                                   |
| `ENCRYPTION_SECRET`              | Exactly 32 characters                                                                                                |
| `UPSTASH_REDIS_REST_URL`         | **Required in production** for global rate limits                                                                    |
| `UPSTASH_REDIS_REST_TOKEN`       | **Required in production**                                                                                           |
| `REDIS_REQUIRED`                 | Default on in production; set `false` only for emergency single-instance                                             |
| `ZERNIO_WEBHOOK_SECRET`          | WhatsApp webhook auth (`Authorization: Bearer` or `x-zernio-webhook-secret`)                                         |
| `READINESS_ALWAYS_200`           | Emergency only — keep readiness HTTP 200 even when DB/config degraded                                                |
| `SOCIAL_LEGACY_SCHEDULED_POSTS`  | Opt-in dual legacy `scheduled_posts` publisher (off by default)                                                      |
| `AUDIT_REQUIRED`                 | When `true`, critical audit writes fail the request if insert fails                                                  |
| `BREVO_PLATFORM_API_KEY`         | Platform transactional and privacy email delivery                                                                    |
| `BREVO_PLATFORM_FROM_EMAIL`      | Verified platform sender address                                                                                     |
| `TURNSTILE_SECRET_KEY`           | Server-side Cloudflare Turnstile verification key                                                                    |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile widget key                                                                               |

### Common integrations

| Variable                             | Description                           |
| ------------------------------------ | ------------------------------------- |
| `ANTHROPIC_API_KEY`                  | Claude API                            |
| `DEEPSEEK_API_KEY`                   | DeepSeek API                          |
| `OPENAI_API_KEY`                     | OpenAI                                |
| `OPENROUTER_API_KEY`                 | OpenRouter                            |
| `STRIPE_SECRET_KEY`                  | Stripe secret key                     |
| `STRIPE_WEBHOOK_SECRET`              | Stripe webhook signing secret         |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key                |
| `GOOGLE_CLIENT_ID`                   | Google OAuth                          |
| `GOOGLE_CLIENT_SECRET`               | Google OAuth                          |
| `AZURE_CLIENT_ID`                    | Microsoft OAuth                       |
| `AZURE_CLIENT_SECRET`                | Microsoft OAuth                       |
| `LINKEDIN_CLIENT_ID`                 | LinkedIn OAuth                        |
| `LINKEDIN_CLIENT_SECRET`             | LinkedIn OAuth                        |
| `ZOHO_CLIENT_ID`                     | Zoho OAuth                            |
| `ZOHO_CLIENT_SECRET`                 | Zoho OAuth                            |
| `ZOHO_REDIRECT_URI`                  | Zoho callback URL                     |
| `ZOHO_REGION`                        | `US`, `EU`, `IN`, `AU`, `JP`, or `CA` |
| `ZOHO_ENCRYPTION_SECRET`             | Exactly 32 characters                 |

### Messaging and infra

| Variable                       | Description                                                              |
| ------------------------------ | ------------------------------------------------------------------------ |
| `RESEND_API_KEY`               | Email delivery                                                           |
| `BREVO_API_KEY`                | Email delivery                                                           |
| `QSTASH_TOKEN`                 | Queue auth                                                               |
| `QSTASH_URL`                   | Queue URL                                                                |
| `UPSTASH_REDIS_REST_URL`       | Redis URL                                                                |
| `UPSTASH_REDIS_REST_TOKEN`     | Redis token                                                              |
| `SENTRY_DSN`                   | Error tracking                                                           |
| `NEXT_PUBLIC_SENTRY_DSN`       | Client error tracking                                                    |
| `SCRAPER_SERVICE_URL`          | Railway scraper public URL                                               |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public key (also set `VITE_VAPID_PUBLIC_KEY` to the same value) |
| `VITE_VAPID_PUBLIC_KEY`        | Alias of the Web Push public key for server-side ENV readers             |
| `VAPID_PRIVATE_KEY`            | Web Push private key (server only — never expose to client)              |
| `VAPID_EMAIL`                  | Contact for VAPID, e.g. `mailto:sales@alphaclonesystems.com`             |

## Scraper service (`alphaclone-scraper`)

| Variable                   | Description                |
| -------------------------- | -------------------------- |
| `SUPABASE_URL`             | Same Supabase URL          |
| `SUPABASE_KEY`             | Same service role key      |
| `INTERNAL_API_KEY`         | Must match the web service |
| `MCP_SYNC_URL`             | Web service sync endpoint  |
| `APOLLO_API_KEY`           | Apollo enrichment          |
| `HUNTER_API_KEY`           | Optional enrichment        |
| `WORKER_CONCURRENCY`       | Typically `2` to `5`       |
| `ENABLE_ML_SCORING`        | Usually `false`            |
| `UPSTASH_REDIS_REST_URL`   | Optional cache             |
| `UPSTASH_REDIS_REST_TOKEN` | Optional cache             |

## Suggested Railway values

| Variable              | Where   | Suggested value                                             |
| --------------------- | ------- | ----------------------------------------------------------- |
| `SCRAPER_SERVICE_URL` | Web     | `https://<scraper>.up.railway.app`                          |
| `MCP_SYNC_URL`        | Scraper | `https://alphaclonesystems.com/api/internal/leads/mcp-sync` |
| `PORT`                | Both    | Set by Railway                                              |
