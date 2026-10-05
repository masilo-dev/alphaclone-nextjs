# Deploy / CI failure investigation (2026-10-05)

## Symptom

GitHub Actions for master push and Phase 2 PR failed in ~3–10s with **empty job steps**.  
Railway Production Health Check workflow also failed instantly.  
Production `GET /api/dashboard/next-actions` still returns **404** (P0 route not live yet).

## Root cause (CI)

From the Actions run page for PR #156 / run `37318641821`:

> **The job was not started because your account is locked due to a billing issue.**

This is **not** an application build failure. Jobs never checkout or run.

Also observed: **Vercel account is blocked** (`Account is blocked` on PR checks).

## Railway

- Production origin responds (`/api/health` 200, `/api/readiness` 200, `x-railway-request-id` present).
- Readiness body does **not** yet include `rate_limit` (Phase 2 not on master).
- `/api/dashboard/next-actions` **404** → live image predates the P0 merge at `45aa36b9`, **or** Railway has not finished / succeeded deploying that commit.
- Railway MCP auth was unavailable in this environment (no `RAILWAY_TOKEN` / `.env.local`); build logs could not be pulled from Railway API.

## What to do

1. **Unlock GitHub billing** so Actions runners start (CI + Railway health-check workflow).
2. In Railway dashboard: confirm latest deployment for service serving `alphaclonesystems.com` is commit `45aa36b9` (or later). If stuck/failed, redeploy / inspect build logs there.
3. After deploy: verify `GET /api/dashboard/next-actions?tenantId=…` returns 401/403 (auth), not 404.
4. Vercel block is separate (marketing/preview); core app is on Railway.

## Not caused by Phase 2 code

Empty-step failures precede any lint/test/build. Fix billing first.
