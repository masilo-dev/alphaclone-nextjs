# Railway Environment Variables Template

**Vercel** = full web app (see your Vercel dashboard for all existing vars).  
**Railway** = **`alphaclone-scraper` only** (this file’s scraper section).

Do not copy the whole web env to Railway unless you deploy `alphaclone-web` (not recommended — use Vercel for web).

---

## Vercel — add these for Railway bridge

Add to **existing** Vercel Production env (everything else stays):

| Variable | Description |
|----------|-------------|
| `SCRAPER_SERVICE_URL` | `https://<scraper>.up.railway.app` |
| `INTERNAL_API_KEY` | Random secret — **same value** on Vercel + Railway scraper |

All other vars (Supabase, Stripe, OAuth, AI keys, crons) remain on **Vercel only**.

---

## alphaclone-web (Vercel only — reference)

These live on **Vercel**, not Railway, in the scraper-only setup:

### Required — Core
| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | `https://alphaclonesystems.com` (update after custom domain) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server only) |
| `CRON_SECRET` | Random secret for cron HTTP auth |
| `INTERNAL_API_KEY` | Service-to-service auth (scraper, engine) |
| `ENCRYPTION_SECRET` | Exactly 32 characters |

### AI
| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API |
| `DEEPSEEK_API_KEY` | DeepSeek API |
| `OPENAI_API_KEY` | OpenAI |
| `OPENROUTER_API_KEY` | OpenRouter |
| `APOLLO_API_KEY` | Apollo.io enrichment |

### Payments
| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable |

### OAuth — Google
| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | |
| `GOOGLE_CLIENT_SECRET` | |

### OAuth — Microsoft
| Variable | Description |
|----------|-------------|
| `AZURE_CLIENT_ID` | |
| `AZURE_CLIENT_SECRET` | |

### OAuth — LinkedIn
| Variable | Description |
|----------|-------------|
| `LINKEDIN_CLIENT_ID` | |
| `LINKEDIN_CLIENT_SECRET` | |
| `LINKEDIN_REDIRECT_URI` | `{APP_URL}/api/auth/linkedin/callback` |

### OAuth — Zoho (set region-specific keys as needed)
| Variable | Description |
|----------|-------------|
| `ZOHO_CLIENT_ID` | |
| `ZOHO_CLIENT_SECRET` | |
| `ZOHO_REDIRECT_URI` | |
| `ZOHO_REGION` | `US` / `EU` / `IN` / `AU` / `JP` / `CA` |
| `ZOHO_ENCRYPTION_SECRET` | 32 chars |

### OAuth — Calendly, Zoom, HubSpot, X
| Variable | Description |
|----------|-------------|
| `CALENDLY_CLIENT_SECRET` | |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | |
| `ZOOM_CLIENT_ID` | |
| `ZOOM_CLIENT_SECRET` | |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | |
| `HUBSPOT_CLIENT_ID` | |
| `HUBSPOT_CLIENT_SECRET` | |
| `X_CLIENT_ID` | |
| `X_CLIENT_SECRET` | |

### Meta / WhatsApp
| Variable | Description |
|----------|-------------|
| `FACEBOOK_APP_SECRET` | |
| `FACEBOOK_VERIFY_TOKEN` | |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | |
| `WHATSAPP_PHONE_NUMBER_ID` | |
| `WHATSAPP_ACCESS_TOKEN` | |

### Email & Messaging
| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | |
| `BREVO_API_KEY` | |
| `QSTASH_TOKEN` | |
| `QSTASH_URL` | `https://qstash.upstash.io` |

### Infrastructure
| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | |
| `SENTRY_DSN` | Server Sentry |
| `NEXT_PUBLIC_SENTRY_DSN` | Client Sentry |
| `SCRAPER_SERVICE_URL` | On **Vercel** — Railway scraper URL (not on Railway web) |

### Cost control

| Variable | Where | Description |
|----------|--------|-------------|
| `SCRAPER_SERVICE_URL` | **Vercel** | Points to Railway `alphaclone-scraper` |
| `WORKER_CONCURRENCY` | **Railway scraper** | `2`–`3` |
| `ENABLE_ML_SCORING` | **Railway scraper** | `false` unless needed |

**Railway runs:** Playwright scraper + campaign poll cron only.  
**Vercel runs:** web, MCP, webhooks, Lead Finder UI, all other crons.

### Optional enrichment (legacy in-app routes)

| Variable | Description |
|----------|-------------|
| `FIRECRAWL_API_KEY` | |
| `HERE_API_KEY` | |
| `HUNTER_API_KEY` | |
| `BUILTWITH_API_KEY` | |

---

## alphaclone-scraper (Python FastAPI)

| Variable | Description |
|----------|-------------|
| `PORT` | Set by Railway automatically |
| `SUPABASE_URL` | Same as `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |
| `INTERNAL_API_KEY` | Must match web service |
| `MCP_SYNC_URL` | `https://<web-host>/api/internal/leads/mcp-sync` |
| `APOLLO_API_KEY` | Apollo.io |
| `HUNTER_API_KEY` | Optional |
| `PROXY_LIST` | Comma-separated proxy URLs (optional) |
| `WORKER_CONCURRENCY` | `2`–`5` (Chromium instances) |
| `SCRAPE_DELAY_MIN` | `2` |
| `SCRAPE_DELAY_MAX` | `10` |
| `ENABLE_ML_SCORING` | `false` (set `true` for BERT classifier) |
| `UPSTASH_REDIS_REST_URL` | Optional campaign status cache |
| `UPSTASH_REDIS_REST_TOKEN` | |

---

## CLI setup (scraper only)

```bash
npm i -g @railway.cli
railway login
railway link

# Scraper service only
railway variables set SUPABASE_URL=... --service alphaclone-scraper
railway variables set SUPABASE_KEY=... --service alphaclone-scraper
railway variables set INTERNAL_API_KEY=... --service alphaclone-scraper
railway variables set MCP_SYNC_URL=https://alphaclonesystems.com/api/internal/leads/mcp-sync --service alphaclone-scraper

# Then on Vercel (dashboard or CLI):
# SCRAPER_SERVICE_URL=https://<scraper>.up.railway.app
# INTERNAL_API_KEY=<same secret>
```

## Cron jobs

**Vercel:** all app crons — see `vercel.json`  
**Railway:** scraper poll only — see `docs/RAILWAY_CRON_JOBS.md`
