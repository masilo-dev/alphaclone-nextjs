# Alphaclone Systems — Master Platform Baseline Audit

**Document type:** Evidence-backed baseline assessment (Phases 1–7)  
**Audit subject:** Repository `masilo-dev/alphaclone-nextjs`  
**Working tree audited:** branch `bonnie/platform-multitenant-isolation-218f` @ commit `92415a4bbb50c4ae8b93862be4263a0e3eb3e19c`  
**Production tip (`origin/master`):** `adecaa4503e137613146ffd9cae28b86e910e28e` (does **not** include PR #65)  
**Audit date (UTC):** 2026-07-24T07:46:43Z  
**Auditor role:** Chief Platform Auditor (read-only; no product code changes in this phase)  
**Evidence quality rule:** Claims marked **Verified** / **Corroborated** / **Partial** / **Unverified** per §0.7

> **Critical framing:** Scores below describe the **audited checkout** (PR #65 branch). Production (`master`) lacks multi-tenant foundation migrations, production-readiness hardenings, and social publishing repair. Where production differs, it is called out explicitly.

---

## 0. Evidence standards (applied)

Citation format used throughout:

`[Source Type] | alphaclone-nextjs | <path> | <commit/date> | verification method`

Acceptable sources used: Source Code, Config, CI/CD, Migrations, Docs, GitHub PR/Checks.  
**Not available this run (Unverified):** live production metrics, Sentry dashboards, Railway cron history, live Supabase schema dump, production secret presence.

---

## Executive Summary

Alphaclone is a **large multi-tenant Business Operating System** built as a Next.js App Router monolith with Supabase (Postgres + Auth + Storage), Railway deploy/crons, optional Vercel workflows, MCP for external AI clients, and Bonnie as the in-product AI agent.

### Platform Health Score (composite)

| Lens                                |        Score | Basis                                                                                                       |
| ----------------------------------- | -----------: | ----------------------------------------------------------------------------------------------------------- |
| **Audited branch (PR #65)**         | **62 / 100** | Strong module breadth + recent hardenings; CI blind; prod migrations not applied; React 18/Next 16 mismatch |
| **Production (`master`) estimated** | **48 / 100** | Same product surface **without** PR #65 tenant/cron/webhook/readiness fixes                                 |

**Verdict:** The product surface is broad and usable by humans without AI for core CRM/finance/docs/campaigns/social drafting. Enterprise readiness is **partial**: security/privacy foundations exist in code, but operational gates (CI, migration apply, Redis, cron Bearer, DR verification) are incomplete. **Do not treat the unmerged branch as production.**

### Top evidence-backed findings

1. **Surface area is very large:** 85 pages, 454 API routes, 37 cron route files, 299 SQL migrations, 19 workflows, 286 service files.  
   Evidence: shell inventory 2026-07-24 @ `92415a4b`.
2. **PR #65 not on master:** multi-tenant + production readiness commits are ahead of `origin/master`.  
   Evidence: `git merge-base --is-ancestor HEAD origin/master` → `NOT_ON_MASTER`; `origin/master` = `adecaa45`.
3. **CI does not protect merges:** PR #65 checks fail/skip in ~2–3s (billing/infra), Vercel preview may pass while quality gates fail.  
   Evidence: `gh pr checks 65` 2026-07-24.
4. **AI is optional for core BOS paths** on this branch (invoice lifecycle via `/api/invoices/lifecycle`).  
   Evidence: `src/app/api/invoices/lifecycle/route.ts`, `EnhancedInvoiceModal.tsx` (no `callMcpTool` for lifecycle).
5. **Governance docs exist ahead of enforcement** (AI/privacy legal pages + prior audits).  
   Evidence: `docs/AI_GOVERNANCE_COMPLIANCE_AUDIT.md`, `src/app/legal/*`.

---

## 1. Phase 1 — Platform inventory

### 1.1 Identity & stack

| Component              | Value                                                   | Evidence                                                 |
| ---------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Package                | `alphaclone-nextjs` 1.0.0                               | Source Code \| `package.json` \| `92415a4b` \| file read |
| Runtime                | Node `22.x`                                             | Source Code \| `package.json` engines \| `92415a4b`      |
| Framework              | Next `16.2.9` + React `^18.3.1`                         | Source Code \| `package.json` \| `92415a4b`              |
| Deploy target (config) | Railway (`railway.toml` health `/api/readiness`)        | Config \| `railway.toml` \| `92415a4b`                   |
| Alternate deploy       | Vercel Actions (`deploy.yml`, `vercel-deploy-hook.yml`) | CI/CD \| `.github/workflows/*` \| `92415a4b`             |
| DB                     | Supabase migrations in-repo (299 SQL)                   | Migrations \| `supabase/migrations/` \| count            |

### 1.2 Modules (dashboard)

Nav groups verified in `src/constants.ts` and hub routes in `src/lib/dashboard/hubRoutes.tsx`:

| Module group       | Example routes                                                                                                                | Evidence                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Workspace / Bonnie | `/dashboard`, `/dashboard/business/bonnie`, `/dashboard/bonnie/approvals`                                                     | Source Code \| `src/constants.ts:132-238` |
| Sales / CRM        | `/dashboard/crm`, `/dashboard/contacts`, `/dashboard/deals`, `/dashboard/leads`, `/dashboard/tasks`                           | Source Code \| `hubRoutes.tsx`            |
| Marketing          | `/dashboard/business/campaigns`, `/dashboard/business/social`, `/dashboard/business/forms`, `/dashboard/business/sms`         | Source Code \| `hubRoutes.tsx`            |
| Money / Finance    | `/dashboard/business/billing`, `/dashboard/accounting`, `/dashboard/finance`, `/dashboard/business/expenses`                  | Source Code \| `hubRoutes.tsx`            |
| Files / Docs       | `/dashboard/business/documents`, `/dashboard/business/contracts`, `/dashboard/business/projects`, `/dashboard/business/vault` | Source Code \| `hubRoutes.tsx`            |
| Comms              | `/dashboard/comms`, `/dashboard/business/whatsapp`, `/dashboard/business/tickets`                                             | Source Code \| `hubRoutes.tsx`            |
| Schedule           | `/dashboard/business/calendar`, `/dashboard/business/booking`, `/dashboard/business/meetings`                                 | Source Code \| `hubRoutes.tsx`            |
| Workspace ops      | `/dashboard/marketplace`, `/dashboard/business/workflows`, `/dashboard/business/settings`                                     | Source Code \| `hubRoutes.tsx`            |

**Pages:** 85 `page.tsx` under `src/app` (Verified — find count).

### 1.3 APIs

| Metric                               |                    Count | Evidence             |
| ------------------------------------ | -----------------------: | -------------------- |
| Total `route.ts` under `src/app/api` |                      454 | Verified — find      |
| Cron API routes                      |                       37 | Verified — find      |
| Auth OAuth APIs                      |     30 under `/api/auth` | Verified — inventory |
| MCP APIs                             |      16 under `/api/mcp` | Verified — inventory |
| Tenant APIs                          |   41 under `/api/tenant` | Verified — inventory |
| Bonnie APIs                          |   13 under `/api/bonnie` | Verified — inventory |
| Invoice APIs                         | 21 under `/api/invoices` | Verified — inventory |

Largest API surface clusters: `tenant`, `cron`, `auth`, `invoices`, `facebook`, `mcp`, `stripe`, `webhooks`, `email`, `bonnie`, `ai`.

### 1.4 Database

| Item                                | Finding                                       | Evidence                                      |
| ----------------------------------- | --------------------------------------------- | --------------------------------------------- |
| Migration files                     | 299                                           | Verified — find                               |
| Unique `CREATE TABLE` names sampled | ≥81 unique table identifiers in migrations    | Partial — grep uniqueness; not a live DB dump |
| RLS enable statements               | 304 across 142 files                          | Verified — grep                               |
| CREATE POLICY                       | 532 across 140 files                          | Verified — grep                               |
| Recent branch migrations            | `20260724120000`, `20001`, `130000`, `140000` | Verified — files on branch; **not on master** |

Representative domains from migrations: CRM (`contacts`, `companies`, `opportunities`), marketing (`marketing_campaigns`, `campaign_*`), finance (`expenses`, `bank_*`), tickets, bookings, integrations/oauth, social (`social_posts`, `media_assets`), security logs.

### 1.5 Workers / queues / schedules

| Kind                | Inventory                                                                                 | Evidence                        |
| ------------------- | ----------------------------------------------------------------------------------------- | ------------------------------- |
| Railway crons       | 32 app paths + 1 scraper cron in `railway.crons.json`                                     | Config \| `railway.crons.json`  |
| Cron route coverage | All 32 `/api/cron/*` paths have matching `route.ts`                                       | Corroborated — path check       |
| Scraper cron        | `/api/scraper/campaign/poll` — **no matching route.ts found**                             | Verified gap — missing file     |
| MCP event queue     | `mcp_event_queue` processed by `/api/cron/process-mcp-event-queue`                        | Source Code \| cron route       |
| Durable workflows   | 19 files under `src/workflows/` (invoice, contract, lead, social, campaign, MCP agent, …) | Source Code \| `src/workflows/` |

### 1.6 AI / MCP

| Component                          | Evidence                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `aiRouter` + DeepSeek-default mode | `src/services/aiRouter.ts`, `src/lib/ai/deepSeekOnly.ts`                 |
| `/api/ai/*`                        | 12 routes                                                                |
| Bonnie                             | 13 API routes + dashboard module                                         |
| MCP JSON-RPC + OAuth               | `src/app/api/mcp/route.ts`, well-known OAuth endpoints                   |
| MCP tool modules                   | 46 files registering tools under `src/lib/mcp/tools`                     |
| Connector RBAC                     | `src/lib/mcp/connector/permissions.ts` (owner/admin/member/viewer/guest) |

### 1.7 Auth / permissions

| Flow                                                              | Evidence                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| Supabase email/password UI                                        | `src/app/auth/login/page.tsx`, `src/services/authService.ts` |
| OAuth connectors (Google, Microsoft, Zoho, LinkedIn, Facebook, …) | `src/app/api/auth/**`                                        |
| MCP OAuth + API keys                                              | `src/services/mcp/authMiddlewareApp.ts`                      |
| Tenant membership assert                                          | `src/lib/tenant/platformTenant.ts` (branch)                  |
| Turnstile                                                         | required in `scripts/production-env.mjs`                     |

### 1.8 Integrations (API folders)

Verified folders: `stripe`, `facebook`, `linkedin`, `slack`, `zoho`, `calendly`, `gmail`, `hubspot`, `resend`, `sendgrid`, `twilio`, `whatsapp`, `zoom`, `daily`, `x`, `brevo`, `webhooks`, `integrations`, `mcp`.

### 1.9 Environment & config

Required production groups (script): Supabase URL/anon/service-role, cron secret, Brevo platform key, Turnstile, public HTTPS app URL (not `vercel.app`), 32-char `ENCRYPTION_SECRET`, Redis required in production unless opted out.  
Evidence: `scripts/production-env.mjs:25-129`.

### 1.10 Deployment / infra

| Component    | Evidence                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Railway      | `railway.toml` (Nixpacks, readiness healthcheck)                                                                      |
| Docker       | `Dockerfile.mcp`, `alphaclone-scraper/Dockerfile`                                                                     |
| Proxy / edge | `proxy.ts` (OWASP headers, rewrites)                                                                                  |
| CI workflows | `ci.yml`, `deploy.yml`, `backup.yml`, `vercel-deploy-hook.yml`, `apply-mcp-auth-migrations.yml`                       |
| Backup job   | `.github/workflows/backup.yml` schedules daily `pg_dump` via `DATABASE_URL` secret — **execution success Unverified** |

### 1.11 Observability

| Component        | Evidence                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Sentry           | `sentry.server.config.ts`, `src/instrumentation.ts`, `withSentryConfig` in `next.config.ts` |
| Health           | `/api/health`, `/api/readiness`, `/api/mcp/health`, `/api/internal/auth-health`             |
| Audit log helper | `src/lib/security/serverAuditLog.ts`                                                        |

### 1.12 Testing / docs

| Item              | Count / note                         | Evidence               |
| ----------------- | ------------------------------------ | ---------------------- |
| Unit tests        | 19 files under `tests/unit`          | find                   |
| Playwright config | present                              | `playwright.config.js` |
| Playwright specs  | 13 `*.spec.*` under `tests`          | find                   |
| Docs              | 28 markdown files incl. prior audits | `docs/`                |

### 1.13 Evidence table (selected components)

| Component           | Source Location           | Evidence Type | Version    | Verification      |
| ------------------- | ------------------------- | ------------- | ---------- | ----------------- |
| Next/React versions | `package.json`            | Source Code   | `92415a4b` | file read         |
| Dashboard nav       | `src/constants.ts`        | Source Code   | `92415a4b` | file read         |
| API surface         | `src/app/api/**/route.ts` | Source Code   | `92415a4b` | find count 454    |
| Crons declared      | `railway.crons.json`      | Config        | `92415a4b` | file read         |
| Cron auth           | `src/lib/cronAuth.ts`     | Source Code   | `92415a4b` | file read         |
| Migrations          | `supabase/migrations/`    | Migrations    | `92415a4b` | find count 299    |
| Master tip          | `origin/master`           | Git           | `adecaa45` | `git rev-parse`   |
| PR #65 CI           | GitHub Checks             | CI/CD         | 2026-07-24 | `gh pr checks 65` |
| Prod metrics        | —                         | —             | —          | **Unverified**    |

---

## 2. Phase 2 — Domain scorecard (0–100)

Scoring method: code/config evidence only; production runtime metrics **Unverified** → capped where noted.

| Domain               |                      Score | Evidence reference                                                                                                            | Notes                           |
| -------------------- | -------------------------: | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Architecture         |                         58 | Monolith App Router + services + workflows; Next 16 / React 18 mismatch (`package.json`); dual Railway/Vercel                 | Broad but framework risk        |
| Security             | 61 (branch) / ~45 (master) | Cron Bearer, Zernio secret, tenant helpers, MCP membership on branch; CI red; service-role heavy                              | Branch better than master       |
| Privacy              |                         55 | Legal pages, data-deletion APIs, Facebook deletion callback, daily deletion processing on branch; purge end-to-end Unverified | Partial enforcement             |
| Performance          |             **Incomplete** | No prod latency/RUM evidence                                                                                                  | Unverified                      |
| Scalability          |                         48 | Redis required in prod script; multi-instance rate-limit depends on Redis; cron global scans                                  | Partial                         |
| Reliability          |                         52 | Readiness 503 on branch; Sentry present; CI blind; scraper cron path missing                                                  | Mixed                           |
| Maintainability      |                         45 | 454 APIs / 286 services / 299 migrations — high cognitive load                                                                | Complexity debt                 |
| Documentation        |                         70 | 28 docs + legal + prior audits + `PRODUCTION_READINESS.md`                                                                    | Strong relative to code         |
| Testing              |                         50 | 19 unit files + Playwright config + 13 specs; coverage % Unverified; CI tests skipping                                        | Partial                         |
| Monitoring           |                         55 | Sentry + health/readiness; alert efficacy Unverified                                                                          | Partial                         |
| Logging              |                         50 | Audit helper + security logs tables; PII minimization improved on branch; soft-fail audits                                    | Partial                         |
| Accessibility        |                         40 | 82 component files with aria/role hits — no WCAG audit evidence                                                               | Partial / Incomplete            |
| AI Governance        |                         58 | `AI_GOVERNANCE_COMPLIANCE_AUDIT.md`, DeepSeek-default, Bonnie approvals routes, risk policy tests                             | Doc > runtime proof             |
| Developer Experience |                         52 | Scripts for validate/test/migrate; typecheck green on branch; CI fails fast                                                   | Mixed                           |
| User Experience      |                         60 | Full BOS UI modules; design tokens/rules present                                                                              | Qualitative from code structure |
| Infrastructure       |                         50 | Railway config + Docker + backup workflow; dual Vercel path; Actions billing issues                                           | Split-brain risk                |
| API Design           |                         55 | Large REST/MCP surface; inconsistent auth patterns historically; improved on branch                                           | Uneven                          |
| Database Design      |                         57 | Heavy RLS usage; tenant helpers on branch; composite FKs incomplete per multitenant audit                                     | Partial                         |
| Disaster Recovery    |                         35 | Backup workflow exists; restore drills / RPO/RTO **Unverified**                                                               | Weak evidence                   |
| Business Continuity  |                         40 | Multi-provider email/social; AI optional; DR Unverified                                                                       | Partial                         |
| Code Quality         |                         55 | `tsc --noEmit` exit 0 on branch; ESLint in CI; npm audit historically high                                                    | Local green / CI red            |
| Technical Debt       |        35 (inverse health) | Dual publishers (legacy opt-in), Next/React skew, service-role ubiquity, open draft PRs                                       | High debt                       |

**Weighted composite (branch): 62.**  
**Missing evidence reducing confidence:** production uptime, error budgets, migration apply status, restore tests, a11y audits, penetration results.

---

## 3. Phase 3 — Framework benchmark mapping

Status legend: **Aligned** / **Partial** / **Gap** / **Unverified**. Not a certification claim.

| Framework                              | Control / theme     | Component                                         | Evidence                   | Status                             |
| -------------------------------------- | ------------------- | ------------------------------------------------- | -------------------------- | ---------------------------------- |
| OWASP Top 10 A01 Broken Access Control | Tenant membership   | `platformTenant.ts`, MCP route membership         | Source Code `92415a4b`     | Partial (branch); Gap on master    |
| OWASP A07 Auth failures                | Cron spoof          | `cronAuth.ts` Bearer-required                     | Source Code                | Aligned (branch)                   |
| OWASP A10 SSRF                         | Media URL fetch     | `mediaUpload.assertPublicMediaUrl`                | Source Code + unit test    | Partial                            |
| OWASP ASVS V14 Config                  | Prod env validation | `production-env.mjs`                              | Source Code                | Partial                            |
| ISO 27001 A.8 Asset mgmt               | Inventory           | this audit + `AUDIT_REPOSITORY_INVENTORY.md`      | Docs                       | Partial                            |
| ISO 27001 A.12 Logging                 | Audit logs          | `serverAuditLog.ts`, `security_logs` migrations   | Source/Migrations          | Partial                            |
| ISO 27001 A.12 Backup                  | DB backup Actions   | `backup.yml`                                      | CI/CD                      | Partial (restore Unverified)       |
| ISO 27701 / GDPR                       | Deletion & consent  | `/api/data-deletion`, legal pages, privacy center | Source Code                | Partial                            |
| GDPR Art. 17                           | Erasure             | `accountDeletionService`, Facebook callback       | Source Code                | Partial                            |
| SOC 2 CC6 Access                       | RBAC                | connector permissions + tenant_users RLS          | Source/Migrations          | Partial                            |
| SOC 2 CC7 Monitoring                   | Sentry/health       | sentry + readiness                                | Source Code                | Partial                            |
| CIS Controls                           | Secure config       | CSP/headers in `next.config.ts` / `proxy.ts`      | Source Code                | Partial                            |
| NIST AI RMF Map/Measure                | AI inventory        | AI gov doc + aiRouter                             | Docs/Source                | Partial                            |
| ISO 42001                              | AI management       | Bonnie approvals + risk policy tests              | Source/Tests               | Partial                            |
| EU AI Act (transparency)               | AI disclaimer       | `src/app/legal` AI disclaimer link                | Source Code                | Partial                            |
| SSDF                                   | Secure build        | CI typecheck/lint/audit jobs                      | `.github/workflows/ci.yml` | Gap (jobs not effectively running) |

---

## 4. Phase 4 — Gap analysis (by module)

| Module                | Strengths                           | Gaps / risks                                              | Evidence                                  | Recommendation                        |
| --------------------- | ----------------------------------- | --------------------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| CRM / Sales           | Full hub routes + APIs              | Tenant isolation depends on app + RLS; pentest Unverified | `hubRoutes.tsx`, `/api/crm`               | Keep; add A/B isolation tests         |
| Finance / Invoices    | Lifecycle API without MCP on branch | Workflow/engine availability Unverified                   | `/api/invoices/lifecycle`                 | Keep; verify workflow runtime in prod |
| Marketing / Campaigns | Manual campaigns + cron             | Cron tenant quarantine only on some jobs                  | `process-campaigns`                       | Extend quarantine to all crons        |
| Social                | Canonical publisher on branch       | Migrations not on master; legacy path opt-in              | social migrations + `social-publish` cron | Merge + apply migrations              |
| Documents / Contracts | Document OS + template fallback     | AI scan path fragility noted in prior review              | DocumentHub / contracts                   | Keep manual paths                     |
| Bonnie / AI           | Approvals, quotas, DeepSeek default | Provider outage UX; governance enforcement Partial        | `/api/bonnie/*`, aiRouter                 | Keep optional; harden fail UX         |
| MCP                   | OAuth multi-client, tool registry   | Large tool blast radius; permission model coarse          | MCP routes + permissions                  | Tighten scopes; continue fail-closed  |
| Auth / Integrations   | Many OAuth providers                | Secret sprawl; webhook variance                           | `/api/auth`, webhooks                     | Standardize webhook verification      |
| Platform / Tenant     | Helpers + foundation SQL on branch  | Not applied in prod; JWT RLS rewrite staged               | `PLATFORM_MULTITENANT_AUDIT.md`           | Apply migrations carefully            |
| Infra / DevOps        | Railway + Sentry + backup workflow  | Dual Vercel; CI billing; scraper cron missing route       | workflows, railway                        | Unify deploy; fix scraper path        |
| Privacy               | Legal UX + deletion requests        | Restore/purge proof Unverified                            | legal + deletion services                 | Run deletion drill                    |
| Testing               | Growing unit suite                  | Low coverage vs 454 APIs; CI skipped                      | tests/unit                                | Expand critical path tests            |

**Remove / redesign candidates (evidence-backed):**

- Dual social publisher (legacy) — keep off by default (`SOCIAL_LEGACY_SCHEDULED_POSTS`).
- Vercel deploy path if Railway is canonical (`docs/RAILWAY_DEPLOY.md` vs `deploy.yml`).
- Spoofable cron trust — already redesigned on branch.

**Stable / keep:** Supabase Auth login, dashboard shell, CRM/finance manual UIs, Sentry instrumentation pattern, production-env validator.

---

## 5. Phase 5 — Prioritized improvements

| Recommendation                                      | Priority | Biz impact | Effort | Risk↓ | Evidence                                 | Linked gap      |
| --------------------------------------------------- | -------- | ---------- | ------ | ----- | ---------------------------------------- | --------------- |
| Apply PR #65 migrations + deploy after review       | Critical | High       | M      | High  | Branch not on master                     | Tenant/security |
| Require Railway cron Bearer everywhere              | Critical | High       | S      | High  | `cronAuth.ts`, `RAILWAY_ENV_TEMPLATE.md` | Auth            |
| Set Redis + ZERNIO_WEBHOOK_SECRET in prod           | Critical | Med        | S      | High  | `production-env.mjs`                     | Config          |
| Restore CI gate (billing / Actions)                 | Critical | High       | S–M    | High  | `gh pr checks 65` fail ~2s               | SSDF            |
| Fix missing scraper cron route or remove cron entry | High     | Med        | S      | Med   | `railway.crons.json` vs missing route    | Reliability     |
| Unify deploy target (Railway XOR Vercel)            | High     | Med        | M      | Med   | dual workflows                           | Infra           |
| React 19 upgrade for Next 16                        | High     | Med        | L      | Med   | `package.json` Next 16 / React 18        | Architecture    |
| Tenant A/B pentest suite                            | High     | High       | L      | High  | Multitenant audit staged C4              | Security        |
| Composite tenant FKs + JWT RLS rewrite              | High     | High       | L      | High  | Multitenant audit B2/B3                  | DB              |
| DR restore drill + documented RPO/RTO               | Medium   | High       | M      | Med   | backup.yml only                          | DR              |
| Expand E2E for login→invoice→campaign               | Medium   | Med        | M      | Med   | Playwright present, CI skip              | Testing         |
| WCAG audit of dashboard                             | Medium   | Med        | M      | Low   | Partial a11y markers                     | A11y            |
| npm audit remediation plan                          | Medium   | Med        | M      | Med   | prior audit findings                     | Code quality    |
| Fine-grained MCP scopes                             | Low      | Med        | L      | Med   | coarse ROLE_PERMISSIONS                  | AI gov          |
| Nice: architecture diagrams automation              | Nice     | Low        | M      | Low   | docs sprawl                              | Maintainability |

---

## 6. Phase 6 — Roadmap

> Calendar buckets are planning labels from the checklist; effort is technical, not a delivery promise.

### Quick wins (small, high certainty)

| Task                              | Component            | Expected outcome     | Evidence             |
| --------------------------------- | -------------------- | -------------------- | -------------------- |
| Configure cron Bearer on Railway  | All crons            | Spoof resistance     | `cronAuth.ts`        |
| Set Redis + Zernio webhook secret | Env                  | Rate limit + WA auth | `production-env.mjs` |
| Close or sync PR #64 vs #65       | GitHub               | Single review path   | PR list              |
| Remove/fix scraper cron entry     | `railway.crons.json` | No 404 cron noise    | missing route        |

### Short term

| Task                                           | Component      | Expected outcome       | Evidence             |
| ---------------------------------------------- | -------------- | ---------------------- | -------------------- |
| Merge #65 after human review + migration apply | DB + app       | Tenant hardenings live | branch vs master     |
| Re-enable CI quality gates                     | Actions        | Block bad merges       | `gh pr checks`       |
| Choose single deploy path                      | Railway/Vercel | Origin/OAuth stability | dual workflows       |
| Add cron tenant quarantine to remaining jobs   | crons          | Fail closed            | multitenant audit C1 |

### Medium term

| Task                         | Component      | Expected outcome           | Evidence     |
| ---------------------------- | -------------- | -------------------------- | ------------ |
| React 19 + Next 16 alignment | Frontend       | Supported App Router stack | package.json |
| Isolation pentest suite      | tests          | Measurable tenant safety   | audit C4     |
| DR restore game day          | backup/restore | Proven RPO/RTO             | backup.yml   |
| Coverage for top 20 APIs     | tests          | Regression signal          | 454 routes   |

### Long term

| Task                                         | Component    | Expected outcome | Evidence      |
| -------------------------------------------- | ------------ | ---------------- | ------------- |
| Composite FKs + RLS modernization            | DB           | Defense in depth | audit B2/B3   |
| Module decomposition / bounded contexts      | Architecture | Maintainability  | size metrics  |
| Formal SOC2/ISO control mapping program      | Compliance   | Audit readiness  | Phase 3 gaps  |
| Continuous evidence store (versioned audits) | Process      | Phase 7 history  | this document |

---

## 7. Phase 7 — Continuous self-audit protocol

| Version             | Change                        | Evidence                     | Impact                         | Status     |
| ------------------- | ----------------------------- | ---------------------------- | ------------------------------ | ---------- |
| Baseline-2026-07-24 | Initial master baseline audit | This document @ `92415a4b`   | Establishes scores             | Superseded |
| Remediation-2026-07-24 | Platform excellence pass on PR #65 branch | Commit on `bonnie/platform-multitenant-isolation-218f` | Scores ↑; CI/test gates green locally | **Active** |
| (next)              | After #65 merge to master     | Re-run inventory + scorecard | Expect Security/Reliability ↑  | Pending    |
| (next)              | After migration apply in prod | Live schema verify           | DB Design ↑; remove Unverified | Pending    |

**Rules for future updates:** re-collect counts (`find`/`rg`), re-run `tsc` + unit tests, re-check `origin/master` tip, re-query CI, update scorecard deltas, append Decision Log.

---

## 8. Final deliverable packs

### 8.1 Security review (summary)

**Aligned (branch):** Bearer cron auth; Zernio webhook secret; MCP membership revalidation; connector fail-closed; SSRF media checks; readiness fail-closed; storage tenant path assert.  
**Gaps:** CI not enforcing; service-role bypass relies on app discipline; webhook signature coverage uneven historically; production migration apply Unverified; Next/React support risk.

### 8.2 Privacy review (summary)

**Present:** Legal center, data request UI, data-deletion APIs, Facebook deletion callback, communication prefs, daily processing of verified deletion requests (branch).  
**Gaps:** End-to-end erasure drill Unverified; marketing consent enforcement across all send paths Unverified; activity log PII historically present (inbound bodies removed on branch).

### 8.3 AI governance review (summary)

**Present:** DeepSeek-default mode, Bonnie approvals APIs, AI disclaimer legal page, governance audit doc, risk policy unit tests.  
**Gaps:** EU AI Act / ISO 42001 operational controls Partial; tool permission granularity coarse; autonomous runners need continuous risk review.

### 8.4 Architecture review (summary)

Monolithic Next app with modular dashboard hubs and large API surface. Strength: one product shell. Risks: size, dual deploy, framework version skew, workflow dependency for durable jobs.

### 8.5 Code quality & technical debt

| Debt item                   | Evidence                 | Severity       |
| --------------------------- | ------------------------ | -------------- |
| Next 16 + React 18          | `package.json`           | High           |
| Dual deploy                 | workflows + Railway docs | High           |
| 454 API routes / thin tests | counts                   | High           |
| Service-role ubiquity       | `supabase-admin` usage   | High           |
| Unmerged security branch    | git ancestry             | Critical (ops) |
| Legacy social path          | env opt-in               | Medium         |
| Open conflicting draft PRs  | `#50`, `#43`             | Medium         |

### 8.6 Risk register

| ID  | Risk                                   | Likelihood | Impact | Mitigation (branch)     | Residual         |
| --- | -------------------------------------- | ---------- | ------ | ----------------------- | ---------------- |
| R1  | Tenant bleed before migrations applied | Med        | Crit   | PR #65 code+SQL         | High until apply |
| R2  | Cron abuse if Bearer not configured    | Med        | High   | `cronAuth` fail-closed  | Med (config dep) |
| R3  | CI blind merges                        | High       | High   | Fix Actions billing     | High             |
| R4  | Framework upgrade break                | Med        | High   | Plan React 19           | Med              |
| R5  | DR unproven                            | Med        | High   | Restore drill           | High             |
| R6  | AI over-automation                     | Med        | Med    | Approvals + optional AI | Med              |
| R7  | Scraper cron 404                       | Med        | Low    | Fix/remove entry        | Low              |

### 8.7 Decision log

| Decision                                              | Rationale                               | Evidence       | Date       |
| ----------------------------------------------------- | --------------------------------------- | -------------- | ---------- |
| Audit performed on PR #65 checkout, not only master   | Includes latest hardenings under review | git HEAD       | 2026-07-24 |
| No product code changes in this audit phase           | User mandate: understand first          | prompt         | 2026-07-24 |
| Score production separately lower                     | Master lacks #65                        | git ancestry   | 2026-07-24 |
| Prefer measurable ops fixes over fashionable features | Phase 6 rule                            | inventory size | 2026-07-24 |

### 8.8 Improvement history (known prior work)

| Item                                  | Evidence                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Prior platform audits                 | `docs/PLATFORM_AZ_AUDIT.md`, `PLATFORM_SCORECARD.md`, `AUDIT_REPOSITORY_INVENTORY.md` |
| AI governance audit                   | `docs/AI_GOVERNANCE_COMPLIANCE_AUDIT.md`                                              |
| Multitenant audit                     | `docs/PLATFORM_MULTITENANT_AUDIT.md`                                                  |
| Social publishing repair              | `docs/SOCIAL_PUBLISHING_REPAIR.md`                                                    |
| Production readiness notes            | `docs/PRODUCTION_READINESS.md`                                                        |
| Merged recent: OAuth multi-client #63 | `origin/master` tip message                                                           |

### 8.9 Evidence traceability (claims → proof)

| Section  | Claim                      | Evidence Source  | Reference                            |
| -------- | -------------------------- | ---------------- | ------------------------------------ |
| Exec     | 454 API routes             | Source Code      | find `src/app/api/**/route.ts`       |
| Exec     | Not on master              | Git              | `NOT_ON_MASTER` vs `adecaa45`        |
| Security | Cron Bearer required       | Source Code      | `src/lib/cronAuth.ts`                |
| Privacy  | Deletion request API       | Source Code      | `src/app/api/data-deletion/route.ts` |
| AI       | DeepSeek-only default      | Source Code      | `src/lib/ai/deepSeekOnly.ts`         |
| Infra    | Railway readiness          | Config           | `railway.toml`                       |
| Testing  | Unit tests exist           | Source Code      | `tests/unit/*.test.mjs`              |
| Ops      | CI failing                 | CI/CD            | `gh pr checks 65`                    |
| DB       | 299 migrations             | Migrations       | `supabase/migrations` count          |
| Gap      | Scraper cron missing route | Config vs Source | `railway.crons.json` vs missing file |

---

## Appendix A — Explicit Unverified list

- Production uptime, p95 latency, error rate, Sentry volume
- Whether migrations `20260724*` are applied in Supabase production
- Railway cron success rate after Bearer change
- Backup restore success
- Live RLS effectiveness under real JWT sessions
- Accessibility WCAG conformance
- Penetration test results against live tenants

## Appendix B — How to re-run baseline (Phase 7)

```bash
git rev-parse HEAD origin/master
find src/app -name page.tsx | wc -l
find src/app/api -name route.ts | wc -l
find supabase/migrations -name '*.sql' | wc -l
npx tsc --noEmit
npm test
gh pr checks <n>
```

Update this document’s Version table and recalculate the scorecard with deltas.

---

**End of baseline audit.**  
Next authorized step (when requested): implement Critical roadmap items only after human acceptance of this baseline — or refresh scores after merging #65 to master.
