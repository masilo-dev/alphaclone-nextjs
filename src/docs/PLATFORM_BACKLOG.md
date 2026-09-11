# Platform backlog and acceptance criteria

This document tracks prioritized product and engineering work: notifications and email strategy, MCP and data integrity, reporting, and social integrations. Update status inline when work ships.

---

## 1. Notifications and email (architecture)

**Goal:** Each tenant may connect multiple outbound providers (Resend, Brevo, SendGrid, Zoho Mail, Gmail). Do not remove multi-provider support; routing policy decides which message type uses which provider and failover order.

**In-app:** The `notifications` table, real-time subscriptions, and web push cover dashboard presence. Keep this as the primary surface for timely, personalized updates per user and tenant.

**Email:** Event-driven and digest email is not fully productized yet. When implemented:

- Respect per-user preferences (frequency, categories, opt-out for marketing vs transactional).
- Use the tenant’s connected provider(s) for tenant-branded mail; reserve a separate product sender only for pure AlphaClone platform notices if legally and UX-wise required.
- Brevo may be used for API-triggered transactional sends and/or for marketing automation if contacts are synced and journeys live in Brevo; align with compliance and tenant expectations.

**Reference:** `src/services/notificationService.ts`, `src/hooks/useRealTimeMessages.ts`, `src/components/dashboard/business/CampaignBuilder.tsx`, `src/lib/server/sendScheduledCampaignServer.ts`, `src/app/api/outreach/send/route.ts`.

---

## 2. Critical

### 2.1 Social post DB integrity (LinkedIn and similar)

**Problem:** External API succeeds (post is live) but the platform fails to persist the record, causing orphaned state and broken trust.

**Acceptance criteria:**

- If the publish API returns success, a durable platform record MUST exist: either the insert succeeds in the same logical operation, or a queued job retries until success or explicit terminal failure with admin visibility.
- No silent drop: failures to write MUST be logged with correlation IDs and surfaced where operators can act.
- Document the happy path: API response ID stored, timestamps, tenant and user linkage.

**Suggested approach:** Outbox or transactional pattern: write pending row first, call API, update row to published with external ID; or queue write-after-success with idempotent retries using the external post ID.

---

### 2.2 Tenant ID auto-resolution for MCP and API usage

**Problem:** Users are asked to manually find and paste `tenant_id`, which is friction and error-prone. MCP and integrations are already authenticated (e.g. OAuth).

**Acceptance criteria:**

- After successful auth, the server resolves `tenant_id` from the session, OAuth token, or API key mapping. Users never type `tenant_id` for normal flows.
- MCP tools and internal APIs accept optional explicit tenant only for super-admin or cross-tenant scenarios, with strict authorization.
- Document the resolution order (session user → membership → tenant) for engineers.

---

## 3. Important

### 3.1 Revenue breakdown in summaries

**Problem:** Summary only exposes aggregates (e.g. total paid, outstanding, invoice count) without dimensional breakdown.

**Acceptance criteria:**

- API or UI exposes at least: totals by month (or rolling period), and optionally by client or by invoice period, consistent with existing permissions.
- Responses remain performant for typical tenant sizes (pagination or limits where needed).

---

### 3.2 Task listing date filters

**Problem:** `get_tasks` (or equivalent) returns unbounded lists without due-date filters.

**Acceptance criteria:**

- Query supports `due_before`, `due_after`, or equivalent ISO date range parameters.
- Document parameters in MCP/tooling and REST if exposed.
- Default behavior unchanged for callers that omit filters.

---

### 3.3 Client records: extra metadata from outreach

**Problem:** Clients created from external sources (e.g. Google Maps) cannot store extra fields such as rating, review count, or source URL.

**Acceptance criteria:**

- Client model supports extensible fields (JSON `metadata` or structured columns) validated at API boundary.
- Outreach/import flows map known fields into storage; UI can display source and scores where present.

---

## 4. Nice to have

### 4.1 Duplicate LinkedIn post detection

**Acceptance criteria:** Before calling the LinkedIn publish API, detect duplicate or near-duplicate content against recent posts for the same account and block with a clear in-product message instead of a raw API error.

---

### 4.2 Social post reconciliation job

**Acceptance criteria:** Scheduled job compares published state on LinkedIn/Facebook (or stored external IDs) against the database and backfills missing rows or fixes status mismatches, with rate limits and audit logging.

---

## 5. Performance (Lighthouse / PSI) follow-ups

Cross-reference: `src/docs/PERFORMANCE_GUIDE.md` and PageSpeed reports for alphaclone.tech.

**Themes:** Image delivery (~1.5 MiB savings in lab), cache lifetimes for static assets, render-blocking resources (especially mobile), main-thread JavaScript and long tasks.

**Acceptance criteria (incremental):**

- LCP image(s): correct format and sizing, priority on true LCP asset, no lazy-load on LCP image.
- Long-lived `Cache-Control` on hashed static assets via hosting/CDN.
- Reduce render-blocking CSS/JS on critical path; code-split heavy routes.

---

## 6. Tracking

| ID   | Area              | Priority   | Status   |
|------|-------------------|------------|----------|
| 2.1  | Social DB integrity | Critical | In progress (LinkedIn publish + queue) |
| 2.2  | Tenant ID auto-resolve | Critical | In progress (MCP optional tenant_id) |
| 3.1  | Revenue breakdown | Important  | Done (MCP get_revenue_summary) |
| 3.2  | Task due filters  | Important  | Done (MCP get_tasks + taskService) |
| 3.3  | Client metadata   | Important  | Done (create_client metadata) |
| 4.1  | Duplicate LinkedIn | Nice      | Done (caption dedupe) |
| 4.2  | Social reconciliation | Nice   | Done (cron reconcile-social-posts) |
| 5    | Performance PSI   | Ongoing    | Open     |
| 6    | Lead finder / Google Places | Important | Done (geocode + Text Search, scraper fallback) |

Replace **Open** with **Done** and add PR or release notes when closing items.
