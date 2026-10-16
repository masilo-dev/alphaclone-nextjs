# AlphaClone Systems — Critical Defects & Repair Register

This document records the exact root causes, code fixes, and test verifications for all P0 defects resolved during the A–Z autonomous engineering repair cycle.

---

### Defect 1: Client Portal Project Reply Email Suppression
- **Severity**: P0 (Customer-Facing Silent Communication Failure)
- **File**: `src/lib/clientPortal/notifications.ts`
- **Root Cause**: Line 14 contained a hardcoded early bypass:
  ```typescript
  if (direction === 'to_client') return { sent: false, status: 'queued_for_policy_evaluation', error: undefined };
  ```
  This suppressed all replies from business owners to clients, preventing outbound emails from ever being delivered.
- **Resolution**: Removed the synthetic early return, allowing `direction === 'to_client'` to execute lines 26-37, load `business_clients`, and dispatch through `sendEmailServer`.
- **Test Evidence**: `tests/unit/client-portal-followup.test.mjs` passed (5/5 tests passing).

---

### Defect 2: Invoice Lifecycle Client & API Route Assertions
- **Severity**: P0 (Delivery Status Contract & Worker Traceability)
- **Files**:
  - `src/lib/invoices/startInvoiceLifecycleFromDashboard.ts`
  - `src/app/api/invoices/lifecycle/route.ts`
- **Root Cause**:
  1. Commit `ed5af864` stripped ` (Run: ${runId})` from the returned message string in `startInvoiceLifecycleFromDashboard.ts`, causing assertions matching `/controlled-run/` to fail.
  2. `src/app/api/invoices/lifecycle/route.ts` returned `'Invoice queued for background delivery; email has not been confirmed by the provider yet.'` instead of matching `/no email has been confirmed/`.
- **Resolution**:
  1. Updated `startInvoiceLifecycleFromDashboard.ts` to append ` (Run: ${runId})` when `runId` exists.
  2. Updated route message to `'Invoice queued for background delivery; no email has been confirmed by the provider yet.'`.
- **Test Evidence**: `tests/unit/reliability-a-z.test.mjs` passed (35/35 tests passing).

---

### Defect 3: Mail Workspace Height Contract Deviation
- **Severity**: P1 (UI Layout & Scroll Containment)
- **File**: `src/components/dashboard/email/AlphaCloneEmailWorkspace.tsx`
- **Root Cause**: Container div was changed from `h-[calc(100dvh-5.5rem)]` to `h-full min-h-0`, breaking layout height contract tests and risking viewport scroll trapping.
- **Resolution**: Restored bounded viewport height `h-[calc(100dvh-5.5rem)]` to the root container.
- **Test Evidence**: `tests/unit/comms-layout-contract.test.mjs` passed (4/4 tests passing).

---

### Defect 4: Inbound Outreach Reply Deal Linkage
- **Severity**: P0 (Revenue Lifecycle Data Loss)
- **File**: `src/lib/outreach/recordInboundOutreachReply.ts`
- **Root Cause**: When an inbound positive reply qualified a lead and created a deal in `deals`, it omitted inserting the relationship into `revenue_lifecycle_links`.
- **Resolution**: Added explicit insert into `revenue_lifecycle_links`:
  ```typescript
  await options.admin.from('revenue_lifecycle_links').insert({
    tenant_id: options.tenantId,
    source_type: sourceType,
    source_id: sourceId,
    target_type: 'deal',
    target_id: deal.id,
    relationship: 'converted_to',
  });
  ```
- **Test Evidence**: `tests/unit/connected-lifecycle-production-gates.test.mjs` passed (12/12 tests passing).

---

### Defect 5: Contract Signing Canonical Party Lifecycle Progression
- **Severity**: P0 (Legal Contract Lifecycle)
- **File**: `src/services/server/contractServerService.ts`
- **Root Cause**: A previous refactoring to atomic RPC calls omitted the exported helper `resolveContractSignLifecycle`, which evaluates `allCanonicalPartiesSigned` and sets `updates.lifecycle_status = allCanonicalPartiesSigned ? 'signed' : 'sent'`.
- **Resolution**: Exported `resolveContractSignLifecycle` on `contractServerService` and as a named export.
- **Test Evidence**: `tests/unit/connected-lifecycle-production-gates.test.mjs` passed (12/12 tests passing).

---

### Defect 6: Zoho Mail HTTP 415 Binary Fallback MIME Type
- **Severity**: P0 (Email Attachment Rejection)
- **File**: `src/services/zoho/ZohoMailService.ts`
- **Root Cause**: When Zoho returned HTTP 415 on multipart attachment uploads, the fallback binary upload endpoint hardcoded `'Content-Type': 'application/octet-stream'` rather than the attachment's resolved `contentType` (e.g. `'application/pdf'`).
- **Resolution**: Passed `headers: { 'Content-Type': contentType, Accept: 'application/json' }` in binary fallback upload.
- **Test Evidence**: `tests/unit/email-lifecycle-p0-repair.test.mjs` passed (20/20 tests passing).

---

### Defect 7: Contract Signed Default Task Idempotency
- **Severity**: P1 (Task Duplication on Re-runs)
- **File**: `src/lib/contracts/contractSignedSteps.ts`
- **Root Cause**: `createDefaultTasksStep` was omitted during a workflow refactor.
- **Resolution**: Restored `createDefaultTasksStep` with `toInsert = defaultTasks.filter(t => !have.has(t.title))` and invoked it within `runContractSignedFlow`.
- **Test Evidence**: `tests/unit/execution-consolidation.test.mjs` passed (17/17 tests passing).

---

### Defect 8: Dashboard Zero-Loading Cache & Tab Return Synchronization
- **Severity**: P0 (UX Flash & State Revalidation)
- **Files**:
  - `src/components/dashboard/OperatingSystemHome.tsx`
  - `src/hooks/useDashboardStats.ts`
- **Root Cause**: React Query refactor dropped `readDashboardStatsCache` initialization, `inFlightRequests` deduplication map, and `ac:crm-stats-invalidate` event listener.
- **Resolution**: Restored `readDashboardStatsCache` in `OperatingSystemHome.tsx`, re-added `inFlightRequests`, `ac:crm-stats-invalidate` listener, and `useOnTabVisible` hook in `useDashboardStats.ts`.
- **Test Evidence**: `tests/unit/frontend-cache-and-tab-sync.test.mjs` passed (12/12 tests passing).

---

### Defect 9: Invoice PDF Storage Bucket & Metadata Fallback
- **Severity**: P0 (Invoice PDF Failure)
- **File**: `src/lib/invoices/invoiceLifecycleSteps.ts`
- **Root Cause**:
  1. `ALLOWED_ATTACHMENT_MIME_TYPES` contained excess MIME types instead of strict `['application/pdf']`.
  2. `loadInvoiceForLifecycle` bypassed `businessInvoiceService.getInvoiceWithDetails`, dropping client email resolution.
  3. PDF storage path update did not attempt column update first before falling back to `metadata`.
  4. Unguarded call to `ensureInvoicePaymentLink`.
- **Resolution**:
  1. Restricted allowed MIME types to `['application/pdf']`.
  2. Restored `businessInvoiceService.getInvoiceWithDetails` fallback.
  3. Added column update with PG 42703 metadata fallback preserving existing metadata keys.
  4. Added `typeof ensureInvoicePaymentLink === 'function'` check.
- **Test Evidence**: `tests/unit/invoice-and-contract-lifecycle-repair.test.mjs` passed (14/14 tests passing).

---

### Defect 10: Client Milestone Notifications
- **Severity**: P0 (Client Progress Notification Failure)
- **File**: `src/lib/projects/projectClientNotification.ts`
- **Root Cause**: `notifyProjectClientMilestoneUpdate` was gutted to return a dummy `{ sent: false, skipped: 'lifecycle_notifications_use_durable_outbox' }`.
- **Resolution**: Restored full implementation: loads project, resolves client recipient, generates email HTML/text, dispatches via `sendEmailServer`, and records event in `client_portal_events`.
- **Test Evidence**: `tests/unit/milestone-outreach-reliability.test.mjs` passed (10/10 tests passing).

---

### Defect 11: PWA Install Prompt Synchronization & Lifecycle Handlers
- **Severity**: P1 (PWA Installation State Stalling)
- **File**: `src/contexts/PWAContext.tsx`
- **Root Cause**: During refactoring to `installLifecycle.ts`, install synchronization failed to guard against re-prompting when the app was already running standalone (`if (pwaActive) return;`), and omitted resetting `deferredPrompt` when display mode transitions to standalone.
- **Resolution**: Guarded `synchronizeInstall` with `if (pwaActive) return;`, and added explicit `setDeferredPrompt(null)` on standalone display mode activation.
- **Test Evidence**: `tests/unit/social-publish-production-pipeline.test.mjs` passed (12/12 tests passing).

---

### Defect 12: Universal Dashboard & Product Tour Localization Gap
- **Severity**: P1 (UI Language Switching Inconsistency)
- **File**: `src/i18n/uiTranslate.ts`
- **Root Cause**: Spanish (`ES`) and Polish (`PL`) translation dictionaries lacked translations for updated navigation items (`Secure files`, `Customers & Sales`, `Advanced tools`, `Settings & Integrations`, `Background activity`) and onboarding product tour steps.
- **Resolution**: Added comprehensive translations for all 14 missing strings in both Spanish and Polish dictionaries.
- **Test Evidence**: `tests/unit/task-countdown-and-language.test.mjs` passed (10/10 tests passing).

---

### Defect 13: Project Finished Notification Email Suppression
- **Severity**: P0 (Customer & Owner Notification Failure on Project Completion)
- **File**: `src/lib/projects/projectClientNotification.ts`
- **Root Cause**: `notifyProjectFinished` had been stubbed out to return `{ client: { sent: false, skipped: 'lifecycle_notifications_use_durable_outbox' }, owner: { sent: false, skipped: 'owner_digest_policy' } }`, preventing completion emails from reaching clients and business owners.
- **Resolution**: Restored the complete notification pipeline: queries project details, resolves client and owner profiles, sends formatted transactional emails through `sendClientProjectNoReplyEmail` and `sendEmailServer`, logs events in `client_portal_events`, and triggers WhatsApp alerts for verified mobile phone numbers.
- **Test Evidence**: `tests/unit/tasks-calendar-due-alerts.test.mjs` passed (8/8 tests passing).
