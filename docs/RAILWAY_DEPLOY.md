# Railway Deployment Guide

Zero-downtime migration from Vercel to Railway for Alphaclone Systems.

## Services

| Service | Root | Start |
|---------|------|-------|
| `alphaclone-web` | `/` | `npm run start` |
| `alphaclone-scraper` | `/alphaclone-scraper` | Docker / uvicorn |

## Pre-deployment checklist

- [ ] `npm run build` passes locally
- [ ] Supabase migration applied: `npm run supabase:push`
- [ ] All env vars copied from Vercel → Railway (see `RAILWAY_ENV_TEMPLATE.md`)
- [ ] `SCRAPER_SERVICE_URL` set on web service
- [ ] `MCP_SYNC_URL` set on scraper service pointing to web `/api/internal/leads/mcp-sync`

## Vercel + Railway parallel run (automation)

Both platforms can run the **same app** during migration. Automation works on either:

| Component | Vercel | Railway |
|-----------|--------|---------|
| Web app + MCP | ✅ | ✅ |
| Python scraper | ❌ (use Railway service) | ✅ `alphaclone-scraper` |
| Cron jobs (`process-events`, `sequence-worker`) | `vercel.json` | `docs/RAILWAY_CRON_JOBS.md` |
| Lead Finder fallback search | OSM/Nominatim (no Playwright) | Full Playwright scraper |

**Lead Finder Chat** auto-falls back to free OSM local search when the Railway scraper is unreachable — so it works on Vercel-only until you cut over DNS.

**Nexus + n8n-level automation:** Lead Finder emits `scraper_outreach_requested` → `process-events` cron → `leadNurtureWorkflow` (email drip). Enable `/api/cron/process-events` on whichever host is primary (every 5 min).


1. Deploy both Railway services without DNS change
2. Note Railway URLs: `https://<web>.up.railway.app`, `https://<scraper>.up.railway.app`
3. Health checks:
   ```bash
   curl https://<web>.up.railway.app/api/health
   curl https://<web>.up.railway.app/api/mcp/health
   curl https://<scraper>.up.railway.app/health
   ```
4. Test cron:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://<web>.up.railway.app/api/cron/daily
   ```
5. Test campaign run on Railway staging URL via `/dashboard/leads/campaigns`
6. Register **second** webhook endpoints at Stripe/Meta (keep Vercel active)

## DNS cutover (Cloudflare)

1. Lower TTL to 60s (24 hours before cutover)
2. Add custom domain in Railway → `alphaclonesystems.com`
3. Update Cloudflare CNAME to Railway target
4. Update `NEXT_PUBLIC_APP_URL` on Railway
5. Update OAuth redirect URIs (Google, LinkedIn, Zoho, Calendly, Zoom, HubSpot, Microsoft, X)
6. Update Supabase Auth → Site URL and redirect URLs
7. Update webhook URLs at all providers (see list below)
8. Configure Railway cron jobs (`RAILWAY_CRON_JOBS.md`)

## Webhook URL updates

Replace `https://alphaclonesystems.com` with your production domain (unchanged after cutover if same domain):

| Provider | Path |
|----------|------|
| Stripe | `/api/stripe/webhook` |
| Meta Lead Ads | `/api/webhooks/facebook/leads` |
| Messenger | `/api/webhooks/facebook/messenger` |
| WhatsApp | `/api/webhooks/whatsapp` |
| Calendly | `/api/webhooks/calendly` |
| Zoom | `/api/webhooks/zoom` |
| Zoho Mail | `/api/webhooks/zoho/incoming` |
| Twilio | `/api/webhooks/twilio/sms` |
| Daily.co | `/api/daily/webhook` |
| Slack | `/api/slack/interactive` |

## Rollback

1. Revert Cloudflare DNS to Vercel
2. Vercel crons in `vercel.json` resume automatically
3. Keep Railway running for debugging

## Post-migration cleanup

- [ ] Disable Vercel auto-deploy (after 1 week stable)
- [ ] Archive Vercel environment variable export
- [ ] Remove duplicate Stripe/Meta webhook endpoints pointing to Vercel
- [ ] Monitor Sentry + Railway logs for 48 hours

## CLI commands

```bash
npm i -g @railway/cli
railway login
railway link
railway up --service alphaclone-web
railway up --service alphaclone-scraper
railway logs --service alphaclone-web
railway logs --service alphaclone-scraper
```

## Apply database migration

```bash
npm run supabase:push
# or
npx supabase db push
```
