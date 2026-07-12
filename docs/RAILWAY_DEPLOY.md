# Railway Deployment Guide

This guide covers deploying the Alphaclone platform on **Railway**. The repository is configured to support two deployment architectures:

1. **Full Deployment (Recommended for Single-Cloud)**: Both the Next.js web application (`alphaclone-web`) and the Python Playwright scraper (`alphaclone-scraper`) run on Railway.
2. **Split Deployment (Recommended for Cost Savings)**: The web application is hosted on Vercel, while the scraper is hosted on Railway.

---

## 1. Full Deployment on Railway (All Services)

In this architecture, Railway hosts the entire stack.

### Architecture
```
Users → alphaclone-web (Railway)
              │
              │  SCRAPER_SERVICE_URL
              ▼
        alphaclone-scraper (Railway)
              │
              ▼
        Supabase + CRM (shared)
```

### Services Configured in `railway.json`
- **`alphaclone-web`**: Next.js web application.
  - **Root Directory**: `/`
  - **Builder**: `Dockerfile` (using root `Dockerfile`)
  - **Health Check**: `/api/health`
- **`alphaclone-scraper`**: Python FastAPI scraper service.
  - **Root Directory**: `alphaclone-scraper`
  - **Builder**: `Dockerfile` (using `alphaclone-scraper/Dockerfile`)
  - **Health Check**: `/health`

### Setup Instructions
1. **Create/Connect Project**: Create a new project in Railway and link it to your GitHub repository: `masilo-dev/alphaclone-nextjs`.
2. **Auto-Discovery**: Railway will automatically detect the two services defined in `railway.json`: `alphaclone-web` and `alphaclone-scraper`.
3. **Environment Variables**:
   - Provide all frontend & database variables to `alphaclone-web`.
   - Provide database and scraper API variables to `alphaclone-scraper`.
   - Refer to `docs/RAILWAY_ENV_TEMPLATE.md` for the template.
4. **Cron Setup**:
   - For `alphaclone-web`, crons are defined in `railway.crons.json`.
   - For `alphaclone-scraper`, a cron endpoint should poll campaign tasks.

---

## 2. Split Deployment (Vercel + Railway Scraper)

In this cost-efficient setup, Vercel hosts the Next.js web application while Railway runs the resource-heavy Playwright scraper.

### Architecture
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

### Setup Instructions
1. **Remove `alphaclone-web` on Railway**: If present, delete or pause the `alphaclone-web` service on Railway.
2. **Configure `alphaclone-scraper`**:
   - Set **Root Directory** to `alphaclone-scraper`.
   - Set **Builder** to `Dockerfile` (`alphaclone-scraper/Dockerfile`).
   - Set **Health check** to `/health`.
3. **Scraper Environment Variables**: Set `SUPABASE_URL`, `SUPABASE_KEY`, `INTERNAL_API_KEY`, and `MCP_SYNC_URL` (pointing to Vercel).
4. **Vercel Bridge Variables**: Set `SCRAPER_SERVICE_URL` and `INTERNAL_API_KEY` in Vercel to point to the scraper.

---

## CLI Deployment & Verification

### Railway CLI Setup
```bash
npm i -g @railway/cli
railway login
railway link
```

### Health Check Endpoints
```bash
# Web application (Next.js)
curl https://<your-web-service>.up.railway.app/api/health

# Scraper service
curl https://<your-scraper-service>.up.railway.app/health
```

### Database Migrations
Always ensure the database matches the latest schema:
```bash
npm run supabase:push
```
