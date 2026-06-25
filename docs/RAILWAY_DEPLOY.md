# Railway Deployment Guide (scraper-only)

**Vercel** hosts the full Next.js app (domain, dashboard, MCP, crons, webhooks).  
**Railway** runs **`alphaclone-scraper` only** — Playwright lead scraping, enrichment, and campaign polling.

This saves cost and avoids running two web hosts.

## Architecture

```
Users → alphaclonesystems.com (Vercel)
              │
              │  SCRAPER_SERVICE_URL
              ▼
        Railway alphaclone-scraper
              │
              │  MCP_SYNC_URL → Vercel /api/internal/leads/mcp-sync
              ▼
        Supabase + CRM (shared)
```

| Component | Host |
|-----------|------|
| Website, dashboard, Lead Finder UI | **Vercel** |
| MCP, Stripe/webhooks, OAuth callbacks | **Vercel** |
| Crons (invoices, social, zoho, automation) | **Vercel** (`vercel.json`) |
| Playwright scraping + lead campaigns | **Railway** (`alphaclone-scraper`) |
| Campaign poll cron | **Railway** scraper service |

## Railway setup (one service)

### 1. Remove or disable `alphaclone-web` on Railway

In Railway dashboard:

1. Open project → **alphaclone-web** service (if it exists)
2. **Settings** → **Danger** → **Remove service** (or pause deployments)
3. Keep only **alphaclone-scraper**

### 2. Configure `alphaclone-scraper`

| Setting | Value |
|---------|--------|
| **Root Directory** | `alphaclone-scraper` |
| **Builder** | Dockerfile |
| **Dockerfile** | `Dockerfile` (inside that folder) |
| **Health check** | `/health` |

Connect repo: `masilo-dev/alphaclone-nextjs`, branch `master`.

### 3. Scraper environment variables

See `docs/RAILWAY_ENV_TEMPLATE.md` → **alphaclone-scraper** section.

Required:

| Variable | Value |
|----------|--------|
| `SUPABASE_URL` | Same as Vercel `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_KEY` | Same as Vercel `SUPABASE_SERVICE_ROLE_KEY` |
| `INTERNAL_API_KEY` | **Must match Vercel** |
| `MCP_SYNC_URL` | `https://alphaclonesystems.com/api/internal/leads/mcp-sync` |

Optional: `APOLLO_API_KEY`, `HUNTER_API_KEY`, `WORKER_CONCURRENCY=2`, `ENABLE_ML_SCORING=false`

### 4. Vercel — add bridge vars

In Vercel → **Environment Variables** → Production:

| Variable | Value |
|----------|--------|
| `SCRAPER_SERVICE_URL` | `https://<scraper>.up.railway.app` |
| `INTERNAL_API_KEY` | Same as Railway scraper |

Redeploy Vercel after saving.

### 5. Scraper cron (Railway only)

Railway → **alphaclone-scraper** → **Cron**:

| Schedule | Method | Path | Auth |
|----------|--------|------|------|
| `*/10 * * * *` | POST | `/api/scraper/campaign/poll` | Header `x-internal-api-key: $INTERNAL_API_KEY` |

Do **not** duplicate Vercel crons on Railway.

## Pre-flight checklist

- [ ] `npm run supabase:push` (scraper tables migration)
- [ ] Railway: only `alphaclone-scraper` service active
- [ ] Vercel: `SCRAPER_SERVICE_URL` + `INTERNAL_API_KEY` set
- [ ] Scraper: `MCP_SYNC_URL` points to **Vercel** domain
- [ ] Health checks pass (below)

## Health checks

```bash
# Vercel (primary web)
curl https://alphaclonesystems.com/api/health
curl https://alphaclonesystems.com/api/mcp/health

# Railway scraper
curl https://<scraper>.up.railway.app/health
```

## Test Lead Finder end-to-end

1. Log in on **Vercel** → **Sales Hub** → **Lead Finder**
2. Run a chat search (e.g. “Find SMB dental clinics in Austin”)
3. Railway scraper logs should show campaign activity
4. Leads appear in UI; outreach + “contacted” still run on Vercel

If Railway is down, Lead Finder falls back to light OSM search on Vercel.

## Optional: full web on Railway later

Root `Dockerfile` + `nixpacks.toml` remain in the repo for a future full migration. They are **not** used in the scraper-only setup. See git history / `railway.json` in older commits if you ever move web off Vercel.

## CLI

```bash
npm i -g @railway/cli
railway login
railway link
railway logs --service alphaclone-scraper
```

## Database migration

```bash
npm run supabase:push
```
