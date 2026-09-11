# Phase 6 — Railway-only operations (post-Vercel)

AlphaClone runs entirely on **Railway**. Vercel is not used for hosting, crons, or deploy hooks.

## Done in repo

- `vercel.json` removed (crons live in `railway.crons.json`)
- GitHub `deploy.yml` → production health check only (Railway deploys from Git)
- `vercel-deploy-hook.yml` removed
- Sentry release uses `RAILWAY_GIT_COMMIT_SHA` (not Vercel SHA)
- Cron auth: `Authorization: Bearer $CRON_SECRET` only (`src/lib/cronAuth.ts`)

## You must do in Railway dashboard

1. **Web service** — env vars:
   - `BONNIE_DURABLE_RUNTIME=true`
   - `MCP_NOTIFY_EVERY_ACTION=true`
   - `CRON_SECRET` (strong random; same on every cron job header)
   - `NEXT_PUBLIC_APP_URL=https://alphaclonesystems.com`

2. **bonnie-worker service** — new service, config path `railway.bonnie-worker.toml`, same Supabase/AI env as web.

3. **Cron jobs** — import all paths from `railway.crons.json` with Bearer auth (see `docs/RAILWAY_CRON_JOBS.md`).

4. **DNS** — `alphaclonesystems.com` → Railway web service only. Remove/disable any Vercel DNS or old `*.vercel.app` aliases.

5. **GitHub secrets** — delete unused `VERCEL_*` secrets (optional cleanup).

## Phase 7 (next code phase)

The `workflow` npm package (Vercel Workflow SDK) is still used for durable steps in `src/workflows/*`. On Railway these run **in-process** when crons/API routes call `start()` from `workflow/api`.

Long-term: migrate hot paths to **Bonnie durable runtime** (`agent_tasks`, `bonnie-worker`) so missions survive without depending on the Workflow SDK broker.

Priority migrations:

| Flow | Today | Target |
|------|--------|--------|
| Invoice send / lifecycle | `workflow/api` + crons | Bonnie worker + `verifyBusinessOutcome` |
| Social publish | cron + workflow sleep | Bonnie monitor/chase tasks |
| Onboarding sequences | `user-onboarding.ts` | Bonnie goal runs |
| MCP agent jobs | `mcp-agent.ts` | Already partially on Bonnie |

## Phase 8 — Production hardening

- Railway plan RAM ≥ 8GB for web (MCP tools/list + Next build)
- Separate `bonnie-worker` so long missions don’t block HTTP
- Monitor `/dashboard/admin/mcp-sessions` after ChatGPT/Cursor connect
- `npm run sync:chatgpt-submission` before each ChatGPT app resubmit

## Verify

```bash
curl -sS https://alphaclonesystems.com/api/health
curl -sS -H "Authorization: Bearer $CRON_SECRET" https://alphaclonesystems.com/api/cron/process-events
```

Commit and push all local changes so Railway picks up Phases 1–5 + Phase 6 cleanup.
