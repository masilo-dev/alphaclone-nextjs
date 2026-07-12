# Railway Deployment Guide

This guide covers deploying AlphaClone entirely on **Railway**.

## Architecture

```text
Users -> alphaclone-web (Railway)
            |
            | SCRAPER_SERVICE_URL
            v
      alphaclone-scraper (Railway)
            |
            v
      Supabase + shared services
```

## Services

- `alphaclone-web`
  - Root directory: `/`
  - Build: `railway.toml`
  - Health check: `/api/health`
- `alphaclone-scraper`
  - Root directory: `alphaclone-scraper`
  - Build: `alphaclone-scraper/railway.toml`
  - Health check: `/health`

## Setup

1. Connect the GitHub repo to Railway.
2. Create both services in the same Railway project.
3. Point the web service to the repo root.
4. Point the scraper service to `alphaclone-scraper/`.
5. Set the environment variables from `docs/RAILWAY_ENV_TEMPLATE.md`.
6. Add the Railway cron jobs from `railway.crons.json` to the web service.
7. Add the scraper poll cron to the scraper service.

## Notes

- Railway should be the only runtime origin for the app.
- If a browser or edge proxy is still pointing to an old origin, update that DNS or origin target to Railway.
- Use `/api/health?deep=1` only for diagnostics; Railway should use `/api/health` for liveness.

## Verification

```bash
curl https://<your-web-service>.up.railway.app/api/health
curl https://<your-web-service>.up.railway.app/api/health?deep=1
curl https://<your-scraper-service>.up.railway.app/health
```
