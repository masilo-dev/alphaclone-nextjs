# AlphaClone Systems — A–Z reliability audit and repair

Local repairs are implemented. This is not a claim that the production incident is resolved. Changes have not been committed, pushed or deployed.

## Scope and release evidence

- Repository: `masilo-dev/alphaclone-nextjs`, branch `master`.
- Deployed/source baseline: `8f9f596a7a8b8273a50c44e37bd78661debe2c2a`.
- Railway deployment: `e16561d1-8b03-43ac-a92f-00cb607a0e13`, SUCCESS, created 2026-10-12 09:34:30 UTC.
- No production business-data writes, schema migrations, configuration changes or provider sends were performed by this audit's controlled verification.
- Original console/HAR was not attached to this request. The supplied failure categories are reports, not independently reproduced browser observations.

## Confirmed findings

1. Dashboard membership-query errors were conflated with forbidden access. The route now uses shared authenticated membership validation and reports lookup outages separately.
2. Outreach could fall back after an uncertain provider outcome, and tracking IDs changed per request. Durable operation identity, atomic receipts and recipient-level unknown-outcome holds now prevent blind retransmission.
3. The document list bridges Doc OS document IDs while its detail route originally searched only catalog IDs. The repaired detail route resolves both within the authorized tenant and preserves soft-delete hiding.
4. Presence initialization accumulated activity, focus and unload listeners; transient schema-cache failures could disable presence permanently. Cleanup/ownership/cooldown behavior is repaired.
5. Profile preference reads returned an empty object on error, allowing an update to erase saved values. Failed reads now block writes; unrelated keys and concurrent changes are protected.
6. Early PWA capture and React handlers competed for the same event. The early handler could cause the React handler to exit before updating controls. Event ownership is centralized.
7. Service-worker network-error fallback could retry mutations. API mutation retry is removed and mutation requests bypass interception.
8. Dashboard fallback paths swallowed errors and manufactured zero values. The route and client return unavailable data explicitly rather than running fallback request storms.

## Infrastructure observations and hypotheses

- Supabase reported ACTIVE_HEALTHY at inspection; this does not prove Data API availability.
- Railway runtime logs at 09:51:24 UTC recorded a schema-cache database query failure.
- Supabase PostgREST logs from 09:00–10:30 UTC contain repeated “Thread killed by timeout manager” events. This proves timeout symptoms, not the underlying cause.
- A database snapshot showed 14 idle client connections plus the active diagnostic connection; max_connections was 60. Current connection exhaustion was not established.
- Railway 2-hour metrics: maximum memory 0.7569 GB against an 8 GB limit; maximum CPU usage 0.2011 against a limit of 8. Historical database resource pressure/incident causes remain unproved.
- Filtered Railway HTTP reads for the reported endpoint categories and 502/503/403/404 in 09:00–10:30 UTC returned no matching rows. This does not invalidate the supplied reports or prove recovery.
- A bounded lead-search SELECT plan scanned 27 rows, executed in 4.629 ms and planned in 28.225 ms. This plan does not explain the incident or establish representative busy-tenant latency.
- Query statistics included a dashboard-related statement with cumulative mean 705.51 ms and max 14,433.90 ms; these are historical aggregates, not timings for the missing console trace.

## Verification

- Controlled behavior tests: **40 passed, 0 failed**; see `controlled-tests.txt`.
- Command: `node --require ./tests/server-only-register.cjs --import tsx --test tests/unit/reliability-a-z.test.mjs tests/unit/bulk-email-execution-behavior.test.mjs`.
- Tests replace database/provider/network boundaries with mocks; they do not send production outreach.
- Checked authorization denial, expired sessions, membership outage, read coalescing, Retry-After/cooldown, provider rejection and 5xx uncertainty, concurrent send replay, lost response/reconciliation, edited-draft holds, document ID resolution, failed preference reads and install/presence lifecycle cleanup.
- Isolated comparison against the deployed source: 20 concurrent identical healthy read consumers produced 20 fetches before and 1 after. After 20 presence mount/cleanup cycles, leftover mousemove/focus/unload listeners changed from 20 each to 0. These are controlled measurements, not production counts.
- Final `npm run build`: **PASS (exit 0)**, including compilation, 422 static pages and build typecheck. Final bundle contains the repaired native-message-reference handling. `git diff --check` and reverse patch applicability check also passed.
- Local runtime is Node 24.19.0; production declares Node 22. This is a verification limitation.
- Broad full-suite validation was blocked by automatic approval review because tests may transmit an unverified payload to an external geocoding service. It is not marked passed. Isolated tests were used instead.
- Production browser was able to navigate from the public site to `/auth/login`; authenticated end-to-end verification is blocked by the missing signed-in test session.

## Remaining limitations and release requirements

- The top-priority 503 root cause remains unresolved. Original sanitized browser request traces, incident timestamps, response bodies and matching database/provider evidence are needed.
- Actual provider acceptance/delivery for the reported 502 was not established. No historical message was automatically resent or relabeled during this audit.
- Identical completed/failed payloads conservatively replay their original receipt. A dedicated, explicit new-attempt flow after a verified provider rejection is not implemented here; reconnecting a provider alone does not release an old receipt.
- Approval is bound to the payload and configuration revision. Native sender/account verification, connection permissions and actual message delivery still require a controlled signed-in production/staging flow.
- Microsoft sendMail acceptance can lack a native message ID. The repair retains acceptance separately and no longer fabricates a native ID for canonical persistence; native reference/canonical mailbox visibility waits for provider sync/reconciliation.
- The outreach composer previously accepted attachment selections but did not include them in its outgoing payload. It now blocks that omission explicitly. Complete attachment delivery through this composer remains unsupported.
- Some document supplemental/history queries still have their existing optional behavior. Actual contract generation state, storage object and full viewer behavior require the specific failing document and authenticated verification.
- Unused-preload warnings were not reproduced. Public HTML showed two font resources, visible logo/hero image preloads and a webpack runtime preload. No resources were removed without performance evidence.
- Native installation on Chrome/Android and iOS/Safari, old-worker upgrade handling, rapid navigation and multiple signed-in tabs remain unverified live.
- No commit/push/deployment was performed. The patch must be reviewed before release; a new server with stale client bundles can reject sends until the updated client prepares signed approval.

## Rollback

Before deployment, discard/revert this patch in the isolated checkout; there are no schema or configuration changes to reverse. After deployment, revert the repair commit or restore the recorded prior Railway deployment through the usual release process. Preserve all action receipts, send history and canonical evidence. Keep outreach held while any outcomes are unresolved; rolling back to a route with blind retries would reintroduce duplicate risk. Do not delete receipts or clear all browser data as a repair.

## Exact source/test files changed

- `src/app/api/dashboard/stats/route.ts`
- `src/app/api/leads/searches/route.ts`
- `src/app/api/outreach/send/route.ts`
- `src/app/api/tenant/[tenantId]/documents/[documentId]/route.ts`
- `src/app/layout.tsx`
- `src/app/sw.ts`
- `src/components/MarketingProviders.tsx`
- `src/components/Providers.tsx`
- `src/components/dashboard/AIStudioTab.tsx`
- `src/components/dashboard/CommandPalette.tsx`
- `src/components/dashboard/business/AIOutreachModal.tsx`
- `src/components/dashboard/business/ComposeEmailModal.tsx`
- `src/components/dashboard/business/UnifiedInboxTab.tsx`
- `src/components/dashboard/crm/CommunicationModal.tsx`
- `src/components/dashboard/email/AlphaCloneEmailWorkspace.tsx`
- `src/components/dashboard/outreach/OutreachInbox.tsx`
- `src/components/documents/SharedDocumentsWorkspace.tsx`
- `src/components/leads/OutreachPanel.tsx`
- `src/contexts/PWAContext.tsx`
- `src/lib/api/clientErrorResponse.ts`
- `src/lib/apiAuth.ts`
- `src/lib/email/approvedOutreachClient.ts`
- `src/lib/email/emailOperation.ts`
- `src/lib/email/outreachApproval.ts`
- `src/lib/email/providerSdk.ts`
- `src/lib/email/sendEmail.ts`
- `src/lib/onboarding/resolveOnboardingGate.ts`
- `src/lib/platformReset.ts`
- `src/lib/profileRead.ts`
- `src/lib/pwa/authNetworkBypass.ts`
- `src/lib/pwa/installLifecycle.ts`
- `src/lib/readRequestPolicy.ts`
- `src/lib/supabase.ts`
- `src/lib/transientDbError.ts`
- `src/services/presenceService.ts`
- `src/services/pwaService.ts`
- `src/services/server/microsoftServerService.ts`
- `src/services/tenancy/TenantService.ts`
- `src/services/userDashboardPreferencesService.ts`
- `tests/unit/bulk-email-execution-behavior.test.mjs`
- `tests/unit/reliability-a-z.test.mjs`

## A–Z checklist

FIXED means repaired locally and supported by controlled/source evidence, not deployed or fully verified in production. PASS applies only to the specific check described. BLOCKED marks unmet evidence/verification requirements.

| Letter | Status | Evidence / limitation |
|---|---|---|
| A | BLOCKED | Deployed commit and logs captured; original console/HAR, response bodies and request IDs were not supplied. |
| B | BLOCKED | PostgREST timeouts confirmed. Current health/resource evidence does not prove the underlying cause. No configuration changed. |
| C | FIXED | Coalesced reads and auth lookups; removed layered query retries. Mock baseline: 20 identical reads became 1. |
| D | FIXED | Shared bearer/cookie authorization; lookup outages return 503, genuine denial remains 403. Controlled tests pass. |
| E | BLOCKED | Provider HTTP diagnostics, timeout and safe failure messages repaired. Actual reported 502/provider records unavailable. |
| F | FIXED | Unknown delivery is explicit. Durable reconciliation and recipient holds prevent bypass through draft edits. Native-provider reconciliation remains unverified. |
| G | FIXED | Atomic database receipt claim/replay covers concurrency and unknown outcomes. Production unique index verified read-only. |
| H | FIXED | Signed approval binds authenticated user, payload and sender configuration. Existing Send handlers prepare approval; no scheduling added. |
| I | FIXED | Tenant membership remains mandatory; fresh mutation authorization and tenant filters retained. Cross-tenant/expired-token mocks pass. |
| J | FIXED | Request/operation IDs and safe provider diagnostics added; no complete original browser-to-provider trace available. |
| K | FIXED | Bounded read retries, jitter, Retry-After and origin cooldown; mutations and SW email requests never blindly retry. |
| L | FIXED | Removed failed-statistics zero fabrication and outage fallback fan-out; stale data is identified. All-widget live review remains blocked. |
| M | FIXED | Detail route resolves the Doc OS IDs returned by the list, within the tenant. Deleted/missing records stay hidden. Actual failing document/storage object unidentified. |
| N | FIXED | Document error view offers retry and return while preserving URL parameters and scroll behavior. |
| O | FIXED | Shared profile reads; failed reads cannot overwrite preferences. Compare-and-swap merge retains unrelated preference keys. |
| P | FIXED | Shared heartbeat ownership, listener cleanup, overlap prevention, hidden-tab pause and transient cooldown recovery. |
| Q | PASS | Read-only index/timing inspection and actual bounded SELECT plan completed. 27-row scan took 4.629 ms; no speculative index/config changes. |
| R | BLOCKED | Actual public preloads identified; no unused-preload warning reproduced. Visible hero/fonts retained. No measured preload change claimed. |
| S | FIXED | Authenticated APIs remain network-only; service worker no longer retries mutations. Existing waiting-worker update policy retained. |
| T | FIXED | One early install-event owner; click-driven prompt consumption, dismissal, appinstalled and cleanup tested. |
| U | FIXED | Existing iOS manual guidance retained; unavailable/consumed prompts cannot leave an active native install action. Real-device installation unverified. |
| V | FIXED | Ownership centralized; repeated bootstrap evaluation registers one listener pair. The compiled production bootstrap also passed isolated execution; native device behavior needs live confirmation. |
| W | BLOCKED | Controlled flow tests pass; production browser reaches login and lacks a signed-in test session. No real outreach sent by controlled tests. |
| X | FIXED | Controlled concurrency, lost response, edited-draft hold, session rejection and recovery tests pass. Multiple-tab/device live tests remain blocked. |
| Y | PASS | Before/after mock measurements, infrastructure evidence, changed files and test commands recorded; no production improvement percentages claimed. |
| Z | PASS | Report distinguishes local repairs from production verification and records limitations/rollback. No console suppression or authorization removal. |

