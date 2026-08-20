# Bulk Operations and PWA Usability Audit

**Audit date:** 2026-08-20  
**Scope:** Reviewed bulk outreach, project and invoice batch operations, and mobile PWA usability.  
**Branch:** `fix/bulk-pwa-operations`  
**Safety posture:** No email, campaign, notification, reminder, bulk action, tenant mutation, or external communication was dispatched during this audit or its local validation.

## Executive Summary

This pass addressed the unsafe one-click bulk-outreach path and the lack of bounded, auditable bulk controls in core work and finance modules. The repaired outreach interface now follows a clear sequence: configure, inspect the resolved recipient list, acknowledge final confirmation, and queue work for server-side handling. It does **not** issue browser-side delivery calls. Recipient eligibility is checked for a direct address, stored marketing consent, and current suppression status before a queue item can be created.

The batch limit is now **120 unique recipients** across the UI, service, endpoint, MCP tool, and queue worker. Queued events retain a recipient snapshot, review time, reviewer identity, and final-confirmation marker. The queue worker rejects unreviewed or oversized events, and the delivery executor repeats consent and suppression checks immediately before any provider hand-off.

| Area | Previous condition | Repair outcome |
|---|---|---|
| Bulk outreach UI | One click called direct-send browser loops. | A two-step review modal shows eligible addresses and exclusions before a required final queue confirmation. |
| Recipient eligibility | Website-derived inboxes, no durable batch consent gate, and no review-time suppression check. | Direct addresses only; recorded marketing consent and suppression status are checked before queueing. |
| Batch size | No UI cap; MCP capped at 200. | A consistent hard limit of **120** applies at every bulk-outreach boundary. |
| Queue execution | A queued event could still execute inline without a review marker. | The worker rejects events lacking final confirmation/review time and passes the reviewed state into the bounded executor. |
| Delivery recheck | Inline MCP delivery did not require stored consent or independently verify suppression. | The delivery executor rechecks recorded consent and active suppression for each recipient. |
| Project batches | Only single-project update routes existed. | Added a 200-project tenant-scoped bulk status/stage route with full ownership validation and audit events. |
| Invoice batches | Client-side bulk work was a loop of singleton deletes. | Added an audited 200-invoice server batch route for safe, non-delivery maintenance and surfaced a confirmation-gated “Pause follow-ups” control. |
| Android install | The install flow waited for a fresh event despite a captured prompt. | The install service immediately reuses the stored browser install prompt. |
| Installed PWA focus | Six shortcuts duplicated broad dashboard navigation. | The manifest now exposes five focused shortcuts. |

## Implemented Controls

### Reviewed Bulk Outreach

The `BatchOutreachPanel` now begins with a preparation screen and proceeds to a recipient review screen. A preflight request resolves actual records within the active tenant and returns both eligible recipients and exclusions. The review screen presents names and direct email addresses, identifies exclusion reasons, and requires a deliberate acknowledgement before the “Confirm & queue” action becomes available.

The server endpoint at `/api/outreach/batch-review` owns the safety decision. It validates authenticated tenant access, deduplicates IDs, limits a batch to 120, resolves leads and clients tenant-safely, and excludes recipients with missing direct email, missing recorded marketing consent, or active suppression. The endpoint does not send email. A successful final confirmation inserts a server-side `mcp_event_queue` event with the reviewed recipient snapshot and records `bulk_outreach_reviewed_and_queued` in `audit_logs`.

> The browser only requests review or queue creation. It cannot loop over recipients and deliver mail directly.

The MCP `send_batch_outreach` tool now rejects any batch above 120 and requires `final_confirmation: true`. The queue worker independently rejects missing confirmation or review timestamps before it can invoke a bounded delivery chunk. The delivery branch rechecks both stored consent and suppression at send time, protecting against stale review results or later unsubscribe activity.

| Control | Enforcement point | Result when unmet |
|---|---|---|
| Maximum recipients | Panel, browser service, review endpoint, MCP tool, queue worker | Operation is blocked with a split-batch instruction. |
| Direct recipient email | Review endpoint and delivery executor | Recipient is excluded or fails safely. |
| Recorded marketing consent | Review endpoint and delivery executor | Recipient is excluded or fails safely. |
| Suppression/unsubscribe | Review endpoint and delivery executor | Recipient is excluded or fails safely. |
| Explicit final confirmation | Panel, review endpoint, MCP tool, queue worker | Queue/delivery is blocked. |
| Audit record | Review endpoint and delivery logs | Queue creation is recorded; individual delivery remains provider/log governed. |

### Bulk Project and Invoice Operations

A new tenant-scoped project batch route accepts up to 200 project IDs and only supports validated project status and stage changes. It verifies that every project belongs to the current workspace before issuing the update. The route records both a `business_automation_events` event and an `audit_logs` event. It deliberately sends **no** client or owner notifications as a side effect of a bulk state update; communication remains an explicit, separately reviewed operation.

The invoice batch route accepts up to 200 invoices and is intentionally narrower than a generic update endpoint. It cannot create, issue, send, mark as paid, or delete invoices. It supports an explicit status change to `void` or `cancelled` and/or disabling automatic follow-ups, requires a final confirmation, and blocks status changes for paid or partially paid invoices. Each affected invoice receives an invoice audit event and the aggregate change is written to the tenant audit log. The billing UI now offers a confirmation-gated batch action to pause automatic follow-ups; it explicitly states that no email is sent.

## PWA Usability Repairs

The install service now returns a captured `beforeinstallprompt` event immediately, rather than waiting up to five seconds for a new event that may never arrive. This eliminates the apparent Android install stall when the application shell has already captured a prompt. The installed-app shortcut list was reduced from six entries to five, retaining focused paths for Home, CRM, Work, Money, and Bonnie while removing the redundant Communications shortcut.

## Validation Record

| Check | Result | Notes |
|---|---|---|
| `npm run typecheck` | **Passed** | Completed after all code changes. |
| `git diff --check` | **Passed** | No whitespace errors were reported. |
| Local unit suite | **394 passed, 1 pre-existing failure** | The failure is the known master Facebook permalink expectation mismatch in `facebook-publish-verify.test.mjs`; it is unrelated to this branch’s bulk/PWA changes and was previously repaired in unmerged PR #108. |
| Live tenant/data validation | **Blocked** | No Supabase credentials, `DATABASE_URL`, or authenticated tenant test account were available. |
| Outbound delivery validation | **Not performed by design** | No email, campaign, notification, reminder, or tenant action was dispatched. |

## Residual Review Items

The tenant database should be exercised in a controlled staging workspace before release. The reviewer should confirm that the stored consent field convention matches live lead/client records, that review snapshots render correctly with representative exclusions, and that a deliberately confirmed batch produces the expected audit and queue records without exceeding provider limits. These checks must use test recipients or a non-delivery provider configuration.

Project bulk status/stage controls are now available through the typed service and server route; a future UI pass can add multi-select project list controls once product owners decide which status/stage presets deserve a prominent interface. The API remains safe and auditable in the meantime. Likewise, the current invoice UI intentionally exposes only the safest non-delivery maintenance action. Bulk issue, bulk send, bulk payment, and bulk delete should remain separate review workflows rather than being folded into a generic action menu.

## Files Changed

| File | Purpose |
|---|---|
| `src/components/dashboard/business/BatchOutreachPanel.tsx` | Two-step outreach review and final queue confirmation UX. |
| `src/services/leadService.ts` | Replaced browser delivery loop with review and queue calls. |
| `src/app/api/outreach/batch-review/route.ts` | Tenant-scoped recipient preflight, queue creation, and audit record. |
| `src/services/mcp/MCPServer.ts` | 120-recipient cap, final-confirmation requirement, and delivery-time consent/suppression rechecks. |
| `src/app/api/cron/process-mcp-event-queue/route.ts` | Rejects unreviewed/oversized outreach queue events. |
| `src/app/api/tenant/[tenantId]/projects/bulk/route.ts` | Safe, auditable project batch status/stage API. |
| `src/services/projectService.ts` | Typed project bulk-operation client wrapper. |
| `src/app/api/invoices/bulk/route.ts` | Safe, audited invoice maintenance batch API. |
| `src/services/businessInvoiceService.ts` | Typed invoice batch-operation client wrapper. |
| `src/components/dashboard/business/EnhancedBillingPage.tsx` | Confirmation-gated batch pause for automatic follow-ups. |
| `src/services/pwaService.ts` | Reuses captured install prompts. |
| `src/app/manifest.ts` | Reduces installed PWA shortcuts from six to five. |

## Release Recommendation

**Conditionally ready for code review.** The branch is type-safe and contains no direct delivery action in the bulk-outreach UI path. Merge should remain contingent on controlled staging validation with a test tenant and non-production recipient configuration, because live database credentials were unavailable for this audit.
