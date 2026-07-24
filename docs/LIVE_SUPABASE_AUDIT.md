# Live Supabase Database Audit

**Project:** `ehekzoioqvtweugemktn`  
**URL:** `https://ehekzoioqvtweugemktn.supabase.co`  
**Audit time (UTC):** 2026-07-24T09:14Z  
**Method:** Service-role Data API probes (no DB password → DDL could not be applied from agent)

> Secrets are in local `.env.local` only (gitignored). This document contains **no keys**.

---

## Executive verdict

| Area | Status |
|------|--------|
| Connectivity / service role | Working |
| PR #65 migrations applied? | **NO — critical schema missing** |
| Data hygiene (social orphans / stuck posts) | **Fixed in this pass** |
| `lead_activities.tenant_id` nulls | **Backfilled (111 → 0)** |
| Workspace bootstrap for orphan tenant_admins | **Blocked** by `webhook_deliveries.event` bug |
| Auth admin listUsers | Intermittent `Database error finding users` |

**Production cannot get full PR #65 security/social benefits until SQL migrations are pasted into the SQL Editor.**

---

## Inventory (live)

| Object | Live count / note |
|--------|-------------------|
| Auth users (earlier probe) | ~49 |
| `profiles` | 49 |
| `tenants` | 47 |
| `tenant_users` | 47 |
| `social_posts` | 218 |
| `media_assets` | 23 |
| `facebook_integrations` | 5 |
| `linkedin_integrations` | 2 |
| `contacts` | 342 (all `email_opt_in=true`) |
| `tasks` | 2159 (`tenant_id` present, 0 nulls) |
| `contracts` | 54 |
| `business_invoices` | 57 |
| `autonomous_runner_approvals` | 35 (0 pending) |
| `mcp_oauth_clients` | 64 |
| Exposed PostgREST paths | ~470 |

### Profile roles
- `client`: 26  
- `tenant_admin`: 20  
- `admin`: 3  

---

## Critical schema gaps (PR #65 not applied)

### Missing tables
- `social_connections`
- `social_identities`
- `tenant_social_defaults`
- `tenant_isolation_quarantine`
- `login_history`
- `tenant_members` (optional legacy)

### Missing columns
- `social_posts.live_url`, `idempotency_key`, `correlation_id`, `last_error`, `attempt_count`, `deleted_at`, `provider_response`, `connection_id`, `identity_id`, …
- `media_assets.checksum_sha256`, `width`, `height`
- `project_milestones.tenant_id`
- `ticket_comments.tenant_id`
- `tenant_users.status`
- `campaign_recipients.email_opt_in` (consent uses `contacts.email_opt_in` instead — OK)

### Missing RPCs
| RPC | Live |
|-----|------|
| `get_user_tenant_ids` | Present |
| `user_belongs_to_tenant` | Present |
| `create_tenant_idempotent` | Present (but broken by trigger — see below) |
| `is_tenant_member` | **MISSING** |
| `is_tenant_owner` | **MISSING** |
| `current_tenant_id` | **MISSING** |
| `set_tenant_context` | **MISSING** |

---

## Data issues found & fixed this pass

| Issue | Before | Action | After |
|-------|--------|--------|-------|
| Stuck `publishing` posts (>30m) | 25 | Set `status='failed'` | **0** |
| Fake `published` (no FB/LI provider id) | 18–23 | Set `status='failed'` (no republish) | **0** |
| `lead_activities.tenant_id` null | 111 | Backfill from `leads.tenant_id` | **0** |
| `tenant_admin` profiles with no workspace | 2 (`desiremboko@gmail.com`, test-manus) | `create_tenant_idempotent` | **FAILED** (see blocker) |

### Profiles still without any `tenant_users` row
Mostly `client` portal users (expected). Business-relevant failures:
- `desiremboko@gmail.com` (`tenant_admin`) — **cannot create workspace** until webhook bug fixed
- `test-manus-2026-v2@example.com` (test)

---

## Blocker: `create_tenant_idempotent` broken

Error when creating a workspace:

```text
column "event" of relation "webhook_deliveries" does not exist
```

A trigger/function on tenant creation writes to `webhook_deliveries.event`, but that column is missing in production. **New Google / tenant_admin signups can fail to get a workspace** until this is fixed in SQL.

### Fix SQL (run in SQL Editor before/with PR #65 pack)

Paste **`docs/HOTFIX_webhook_deliveries_event.sql`** first (adds compatible `event` column + sync trigger).

Then apply `docs/APPLY_PR65_MIGRATIONS.sql` (FILE 1, then FILE 2–4).

---

## Auth / logs notes

- `auth.admin.listUsers` sometimes returns **`Database error finding users`** — Auth schema/health issue; re-check in Supabase Dashboard → Authentication → Users and Logs.
- No server log stream was available from this agent (no Management API / MCP auth). Check:
  - https://supabase.com/dashboard/project/ehekzoioqvtweugemktn/logs/explorer
  - Auth logs + Postgres logs for `webhook_deliveries` / `create_tenant_idempotent`

---

## Apply status (updated)

**Applied via Management API on 2026-07-24** using project access token (stored only in local `.env.local`).

| Step | Result |
|------|--------|
| HOTFIX `webhook_deliveries.event` | Applied |
| FILE 1 social columns + enum | Applied |
| FILE 2 orphan/stuck status SQL | Applied |
| FILE 3 social_connections/identities (patched: no `linkedin_identities.role`) | Applied — 7 connections, 8 identities backfilled |
| FILE 4 helpers + stage B (status-safe; prod has no `tenant_users.status`) | Applied |
| Heal `desiremboko@gmail.com` workspace | Created tenant `ad641a1f-…` |
| Heal test-manus workspace | Created tenant `25692567-…` |

**Verified present:** `social_connections`, `social_identities`, `tenant_isolation_quarantine`, `social_posts.live_url`, RPCs `set_tenant_context` / `is_tenant_member` / `is_tenant_owner` / `current_tenant_id`.

### Security reminder
Rotate both the **service_role** key and the **sbp_** personal access token after this session — they were shared in chat.

---

## What the agent fixed without DDL

- 25 stuck social posts → `failed`  
- 23 fake published posts → `failed`  
- 111 `lead_activities` tenant backfills  

## What still needs your SQL paste

- All PR #65 DDL (social connections, enum columns, tenant helpers, quarantine, RLS)  
- `webhook_deliveries.event` column (blocks new workspace creation)
