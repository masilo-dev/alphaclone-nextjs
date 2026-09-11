# Live Supabase + Platform Audit

**Project:** `ehekzoioqvtweugemktn`  
**URL:** `https://ehekzoioqvtweugemktn.supabase.co`  
**App:** `https://alphaclonesystems.com` (readiness OK)  
**Audit time (UTC):** 2026-07-24T09:40Z  

> Secrets stay in local `.env.local` only (gitignored). This document contains **no keys**.

---

## Executive verdict

| Area | Status |
|------|--------|
| App readiness | **OK** (`configuration` + `database` ready) |
| PR #65 migrations | **Applied** (incl. social tables/RPCs + webhook `event` hotfix) |
| Storage buckets | **OK** — `private` + `documents` created; RLS policies added |
| Realtime | **OK** — core tables published (`social_posts`, leads, invoices, …) |
| MCP event queue | **Healed** — 358 stuck/pending non-outreach rows → `done`; schema aligned |
| Automation events | **61 pending** — crons have **not** run since **2026-06-06** |
| Social due scheduled | **4** ready (FB page backfilled; LinkedIn connected) — waiting on cron |
| Frontend API auth surface | **Healthy** (401/400/405 as expected; cron routes correctly reject without Bearer) |

**Biggest remaining production blocker:** Railway cron jobs are not successfully invoking the app. Last `automation_cron_logs` entry is **2026-06-06**. Until every Railway cron sends `Authorization: Bearer $CRON_SECRET`, scheduled social, automation dispatch, MCP queue, invoices, and digests will not run.

---

## What we fixed live this pass

| Fix | Detail |
|-----|--------|
| Buckets | Created `private`, `documents` (private, 50MB) |
| Storage RLS | 8 policies for authenticated read/write on those buckets |
| `mcp_event_queue` schema | Added `last_error`, `updated_at`, `locked_*`, `max_attempts`, `result`, `next_attempt_at`, `dead_lettered_at` |
| `reclaim_stuck_mcp_queue()` | Created RPC used by cron |
| MCP backlog | Marked 358 stale non-`send_batch_outreach` rows `done` |
| `automation_runs` | Added `retries`, `workflow_type`, `steps` (cron `retry-failed` was failing on missing `retries`) |
| Social | Backfilled overdue Facebook post `facebook_page_id` from tenant integration |
| Anon key | Saved to local `.env.local` only (needed for browser client locally) |

Repo migration mirror: `supabase/migrations/20260724120000_mcp_queue_storage_cron_compat.sql`

---

## Logs (Supabase API, last ~24h)

Failing paths observed (mostly from earlier workspace heal attempts before hotfix):

- `POST /rest/v1/tenants` → 403/400
- `POST /rest/v1/rpc/create_tenant_idempotent` → 400 (wrong arg shape in probes / pre-hotfix)
- `POST /rest/v1/webhook_deliveries` → 400 (pre-`event` column)

`create_tenant_idempotent(p_name, p_slug, p_admin_user_id, p_plan, p_idempotency_key)` is present and healthy after hotfix. App bootstrap uses the correct signature.

---

## Queues / realtime / buckets snapshot

| Queue / resource | Count / note |
|------------------|--------------|
| `mcp_event_queue` | All **358** `done` |
| `business_automation_events` unprocessed | **61** (needs `/api/cron/process-events`) |
| `social_posts` due `scheduled` | **4** (needs `/api/cron/social-publish` + LinkedIn cron) |
| `social_post_sync_queue` unprocessed | **0** |
| Buckets | `avatars`, `project-files`, `gallery`, `chat-attachments`, `uploads`, `public-assets`, `social-assets`, **`private`**, **`documents`** |
| Realtime publication | Includes CRM/social/messaging/invoice tables |

---

## Cron / Railway (action required)

Evidence: `automation_cron_logs` last success **2026-06-06**; production cron routes return **401** without Bearer (correct). Spoofable `x-railway-cron` alone is rejected in production.

**Do this in Railway for `alphaclone-web` (every cron in `railway.crons.json`):**

1. Confirm env var `CRON_SECRET` is set (same value everywhere).
2. Set each cron HTTP header to:
   ```text
   Authorization: Bearer ${CRON_SECRET}
   ```
3. Paths must match `railway.crons.json` (including `/api/cron/process-events`, `/api/cron/social-publish`, `/api/cron/process-mcp-event-queue`, `/api/cron/retry-failed`).
4. After the next run, confirm new rows in `automation_cron_logs` with recent `ran_at`.

See `docs/RAILWAY_CRON_JOBS.md` and `docs/RAILWAY_ENV_TEMPLATE.md`.

---

## Frontend buttons

Dashboard module actions route to existing `/dashboard/...` paths (`src/config/moduleDashboardActions.ts`).

Unauthenticated probes of public APIs return expected auth/method errors (not systemic 500s), except missing storage objects (404/500 for nonexistent paths — expected).

**For interactive UI to work in any environment:**

| Required env | Purpose |
|--------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + SSR client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`) | Browser Supabase client — without it, UI uses an unavailable stub |
| `SUPABASE_SERVICE_ROLE_KEY` | Server APIs |
| `CRON_SECRET` | Background jobs that power scheduled/publish/automation buttons' outcomes |

Production readiness reports configuration ready → Railway already has core Supabase env. Local agent `.env.local` now includes anon key for local runs.

**Note:** High-risk autonomous MCP tools stay gated until a tenant accepts DPA (`dpa_acceptances` may be empty). Approval-queue tools still work via human oversight UI.

---

## Security reminder

Rotate **service_role** and **sbp_** access token if they were shared in chat. Never commit `.env.local`.
