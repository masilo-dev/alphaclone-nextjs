# AlphaClone project lifecycle repair — local review

**Release readiness: BLOCKED. Full acceptance is not yet proven.**

No commits, pushes, merges, deployments, production schema changes, signatures, or financial obligations were performed. The follow-up verification sent one separately authorized delivery-test email through Zoho; see live verification below. Changes are an uncommitted local working tree based on the repository's master branch.

## Production reproduction

Read-only MCP checks on project `e6524e8a-d6e5-4091-95b7-b45936b764cf` reproduced:

| Check | Observed production evidence |
|---|---|
| Client association | Bornface Masilo, expected email, linked successfully |
| Task | `ff700b4d-a21a-4761-9c7b-859e645b4220` is completed; completed_at is null; progress_percent is 0 |
| Task relationship | related_to_project is set; canonical project_id is null |
| Project | Progress 0; stage Discovery; status Active; progress_method weighted_tasks |
| Template | No project type or template selection recorded; no milestones |
| Timeline | Empty |
| Summary | INTERNAL_ERROR, trace `0e672235-a4e8-4cb2-8dff-29d46063e0e9`, misleading ok:true / VERIFIED wrapper |
| Contracts | No project link. Multiple sent Bornface agreements exist; do not guess which to associate |
| Portal | portal_enabled false, is_public false. Authenticated rendering not verified |
| Email | Client email history lookup returns an empty list; this does not prove that no message ever existed outside that lookup |

The QA description explicitly prohibits emails, invoices, payments and signatures. The follow-up live dashboard check triggered the existing drawer's write-on-open recalculation, changing only this QA project's derived progress to 100%. Its stage remains Discovery and its status Active. This is not evidence that the local repair was deployed. After a separately authorized release, reconcile derived progress using the new RPC rather than inventing historical completion timestamps or creation events.

## Root causes and exact repair paths

1. **Split task relationships and browser-only progress callbacks.** A database BEFORE trigger synchronizes project_id/related_to_project, checks tenant/milestone ownership, stamps actual completion transitions, enforces required client approval, and keeps task percentages aligned. AFTER triggers recalculate configured progress and record real events. Cancelled, archived and deleted tasks are excluded. Progress never automatically marks the project Completed.
2. **Separate creation implementations.** Dashboard template/portal creates, the registered MCP tool, legacy MCP switch and contract kickoff now call the same domain command. A service-only SQL RPC locks the retry key, validates relationships, inserts the canonical project and applies an explicitly selected/template-type-resolved template in one transaction. Failed template initialization rolls back creation. Contract/deal/key retries reuse an existing project; contract-to-existing-project association checks the client.
3. **Summary queried business_projects only; timeline queried only task.project_id and discarded errors.** Canonical MCP summary now returns the canonical project, linked client/contracts/invoices, task counts, deadlines, milestones and activity, with errors propagated. Timeline reads actual persisted activity. The dashboard summary includes both task links, uses persisted progress, and checks dependency query failures. Summary task rows are bounded to 1,000 and expose a truncation flag; large-project aggregate work remains a release concern.
4. **Notification paths bypassed tenant authorization and used short-window, after-send dedupe.** New project events atomically enqueue a unique outbox row per activity event. The worker reuses the existing tenant email gateway/adapters. Authorizations, event preferences and template wording come from tenant settings. QA/import records are suppressed by default. Provider acceptance is distinct from delivery. Ambiguous sends and expired worker claims stop for reconciliation. Pre-provider failures receive bounded retries. Existing inline project confirmation/progress/stage/milestone/finished send paths defer to the outbox to avoid duplicate sends.
5. **Partially signed contracts and waiting retries.** Execution is guarded by canonical contract state and required party statuses. Client-only signatures are insufficient. Waiting/failed automation records may be claimed again when conditions become eligible; a running record is never reported as completed. Configured automation templates flow through the canonical create transaction. No generic kickoff tasks or console-only fake welcome queue are created.
6. **Portal visibility was implicit.** Authenticated client project listing now requires explicit metadata.client_visible=true, as well as matching tenant/client and an undeleted row. The project update API supports explicit client visibility and owner/admin execution authorization. Secure public portal links are included only when enabled/public/visible and unexpired. Existing public portal password/session guards remain in force.
7. **Wrong tenant email logo.** Tenant branding reads the tenant's configured logo rather than forcing the platform logo.
8. **Deployment/MCP execution truth.** Bridge operational errors are propagated rather than returned as successful not_configured data. MCP create responses separate persisted project/template work from a confirmation email queued for policy evaluation. Kickoff rejects unauthorized execution and checks persistence errors.

## Database migration

`supabase/migrations/20261014120548_project_lifecycle_consistency.sql` is pending, not applied to production.

- Adds service-only atomic creation RPC; invoker-scoped progress RPC; task relationship/progress/event triggers; milestone/stage rules; project creation/status/delay events.
- Adds durable project_notification_outbox with unique event identity, attempt/claim/status/provider/evidence fields, RLS, tenant-member read access and service-role mutation access.
- Uses a private, revoked schema for the narrowly scoped definer enqueue trigger. Activity inserts must match the canonical project tenant.
- Wires meaningful approval, shared document relationship and staff-to-client message events to the outbox.
- Adds an active legacy task-link index and a pending-notification index.
- Adds default next-stage rules only to system website template phases that lack their own rule. Existing project milestones and tenant-custom rules are preserved.
- No historical mail backfill or fabricated timestamps. Existing signed documents and invoices are not rewritten by this migration.

Worker integration is in the existing Bonnie outbox worker/cron path. Its availability and cadence must be verified in staging before release. Automatic emails default off. Owner/admin authorization is exposed in notification settings. Marketing/outreach approval behavior is unchanged.

## Validation

| Verification | Result | Scope |
|---|---|---|
| Selected unit/security/email/portal suites | 70 passed, 0 failed | See unit-tests.log |
| Isolated PostgreSQL via PGlite | Passed | Real new SQL plus existing template schema/RPC; controlled schema fixture |
| TypeScript | Passed | npm run typecheck |
| Selected lint | Passed | New lifecycle services, command, create route, settings UI |
| Diff whitespace check | Passed | git diff --check |
| Production email account discovery | Zoho and Brevo found | Zoho discovery reports verified read/send capability; this is not project email delivery |
| Production provider delivery test | Zoho accepted; delivery unconfirmed | One separately authorized test, not a project confirmation |
| Authenticated dashboard/MCP 20-step E2E | Not performed | Local changes are not deployed and no authenticated staging runtime was available |
| Mobile/tablet/desktop portal rendering | 30 fixture browser checks passed | 320/375/768/1440 px; live QA portal remains disabled |
| Production migration/advisors/performance | Not performed | Requires a staging schema and release workflow |

PostgreSQL assertions cover canonical creation/retry, atomic template failure rollback, legacy task link synchronization, 25%/100% progress, weighted/manual methods, actual completion timestamps, event/outbox deduplication, milestone completion, execution-authorized stage advance, and rejection of a foreign-tenant task link. These are isolated integration tests, not proof of the complete production schema or every RLS policy.

Notification tests cover QA/import suppression, authorization gates, activation wording, partial-signature rejection, accepted-versus-delivered evidence, duplicate replay, and ambiguous provider outcomes without resend.

## Follow-up live and browser verification

- Secure user-assisted sign-in succeeded on the real dashboard. The QA client association and completed task are visible. Milestones are empty. The Timeline tab is a due-date schedule, not lifecycle activity. The generic Business Context panel separately shows two project-created activity entries; this is not the canonical MCP lifecycle timeline.
- Opening the project drawer caused the deployed code to call recalculate_progress and persist progress=100 at 2026-10-14T14:40:31.658403Z. This exposed an extra root cause: a view performs a write. Local ProjectWorkspaceDrawer now reads persisted progress instead and displays the canonical stage label in its overview. There was no explicit progress-save click and no local repair deployment.
- The live database has neither public.project_notification_outbox nor create_project_lifecycle(uuid,jsonb,text,uuid,uuid). The repaired workflow cannot be proven on this deployed version. Discovery located the existing Railway production deployment, not a running environment with the local patch.
- Exactly one separate Zoho email was accepted: subject “AlphaClone delivery test — 14 October 2026”; recipient bornfacemasilo22@gmail.com; provider message 1791988564297002100; canonical message 75ca0299-dc91-47cb-8045-2baac65eb5de. Zoho mailbox search independently returned the sent message from bonnie@alphaclonesystems.com. The canonical message and delivery-event table show provider acceptance only, with no delivery, bounce or failure timestamp at the checks. Receiving Gmail inbox placement is unverified. The email explicitly says it does not start work or create obligations.
- Browser-based portal fixture: 30 checks passed, seven sections at 320/375/768/1440 pixels, no horizontal overflow, a preserved draft and one saved message after two retries, project-detail dialog and Escape close, no page errors. The actual portal page and root layout CSS were bundled; all data/auth/network boundaries were synthetic. These results do not prove live client authentication or production synchronization. Screenshots are in docs/qa/client-portal.
- Repaired the fixture's missing esbuild resolve directory, missing root theme styles, hidden sidebar wait selector and stale project-open/error selectors. The normal Chromium download failed; an isolated official npm Chromium runtime was used with archive ownership preservation disabled for the sandbox filesystem. It was not added to production dependencies.
- Live QA portal settings remain portal_enabled=false, is_public=false and client_visible unset. No sharing settings were changed.
- The static MCP manifest now exposes template, project-type, progress-method and idempotency/test/import inputs consistent with the registered tool.

## Remaining release blockers

- Run the complete authorized 20-step workflow against authenticated staging through both dashboard and MCP, including approval tasks and notification retries.
- Verify real project notification provider evidence through Zoho/Brevo and controlled Outlook credentials. No Outlook account was returned in production discovery; Outlook behavior uses the existing adapter and is not live-verified here.
- Verify authorized portal project/documents/contracts/invoices/messages on phone, tablet and desktop. Existing QA visibility must not be enabled silently.
- Choose the exact Bornface contract ID before association; several sent records exist. None is treated as executed.
- Replay the complete Supabase migration chain and run advisors and concurrency/load checks against staging. The isolated fixture does not prove production schema compatibility or cross-tenant isolation everywhere.
- Confirm every quote/proposal/onboarding entry point routes through the command, and every document sharing producer writes the canonical shared relationship. No blanket parity claim is made for unaudited producers.
- Test contract financial substeps: invoice/project/contract linkage still spans existing separate steps; partial persistence and recovery require staging evidence before claiming complete end-to-end atomicity.
- Verify historical project progress reconciliation without generating historical emails. Large summaries and the dashboard feature flag path need final performance/parity review.
- Full production build and full repository suite were not run. The selected tests and typecheck are not substitutes.

Do not approve this as a finished production repair yet. The local patch remains undeployed. The only observed production changes during follow-up verification are the authorized delivery-test email and the existing dashboard's automatic QA progress recalculation.

## Modified source/test files

- `docs/qa/client-portal/1440-invoices.png`
- `docs/qa/client-portal/1440-messages.png`
- `docs/qa/client-portal/1440-overview.png`
- `docs/qa/client-portal/1440-project-details.png`
- `docs/qa/client-portal/375-invoices.png`
- `docs/qa/client-portal/375-messages.png`
- `docs/qa/client-portal/375-overview.png`
- `package-lock.json`
- `package.json`
- `scripts/client-portal-fixture-qa.mjs`
- `src/app/api/tenant/[tenantId]/notification-preferences/route.ts`
- `src/app/api/tenant/[tenantId]/projects/[projectId]/route.ts`
- `src/app/api/tenant/[tenantId]/projects/[projectId]/summary/route.ts`
- `src/app/api/tenant/[tenantId]/projects/route.ts`
- `src/components/dashboard/projects/ProjectWorkspaceDrawer.tsx`
- `src/components/dashboard/settings/NotificationCategoryPolicyPanel.tsx`
- `src/lib/bonnie/runtime/outboxService.ts`
- `src/lib/clientPortal/notifications.ts`
- `src/lib/clientPortal/projects.ts`
- `src/lib/contracts/contractSignedSteps.ts`
- `src/lib/contracts/projectExecutionAuthorization.ts`
- `src/lib/email/tenantEmailBranding.ts`
- `src/lib/execution/commands/projectCreateCommand.ts`
- `src/lib/mcp/tools/gap-tools-crm.ts`
- `src/lib/mcp/tools/manifest-bridge.ts`
- `src/lib/mcp/tools/projects.ts`
- `src/lib/projects/projectAutomationService.ts`
- `src/lib/projects/projectClientNotification.ts`
- `src/lib/projects/projectEnums.ts`
- `src/lib/projects/projectLifecycleSummary.ts`
- `src/lib/projects/projectNotificationOutbox.ts`
- `src/services/mcp/MCPServer.ts`
- `src/services/mcp/toolManifest.ts`
- `supabase/migrations/20261014120548_project_lifecycle_consistency.sql`
- `tests/integration/project-lifecycle-postgres.test.mjs`
- `tests/unit/client-portal-complete.test.mjs`
- `tests/unit/project-lifecycle-notifications.test.mjs`

## Invoice-send follow-up

Live verification found a paid invoice (`98dd9b94-6083-4814-bc61-83129325f739`) falsely reported VERIFIED even though canonical_delivery_status=not_sent. A draft invoice was labeled pending/EXECUTING without send evidence. No invoice was sent during this check.

Local verification now queries tenant-scoped invoice_delivery_log evidence. Paid/issued/sent accounting status alone cannot prove email sending. The returned states distinguish not_sent, queued, provider_accepted, receiving-server delivery, bounce/failure, and unknown. not_sent maps to REQUESTED rather than EXECUTING. Provider acceptance and unknown outcomes forbid blind retries. These fixes remain undeployed.

The existing invoice lifecycle sends a stored PDF attachment through the tenant email gateway. The earlier Zoho plain-email test does not prove attachment sending or invoice delivery. The recorded Zoho action took approximately 8.8 seconds from start to completion; no faster failure guarantee has been established.


## Invoice queue follow-up — 14 October 2026

User explicitly authorized sending existing INV-62943534 to its confirmed recipient. One send queued run e60206cf-5754-4354-b5dd-df463f4c7cc8, task 391ac3d9-9b0c-4977-87e4-951e9f134a2c at 15:07 UTC. Subsequent reads show READY, zero attempts, no provider evidence. Last recorded bonnie-runtime-worker cron success is 24 September 2026 10:10 UTC; this does not prove absence of every standalone worker, but confirms no recent recorded cron processing. No duplicate send submitted.

Local patch: durableInvoiceRouter schedules a Next after-response kick for both durable enqueue paths. invoiceWorkerKick processes only the persisted tenant/task through processClaimableTasks. Worker supports scoped selection, checks lookup errors and logs rejected claims rather than silently swallowing them. Existing atomic lease, approval and execution stages remain authoritative. Outside a Next request or on an unavailable worker, task remains durable and error is logged; a functioning poller is still required for retries. This does not restore deployed worker infrastructure and does not prove live delivery.

Validation: six worker-kick/send-evidence tests pass; TypeScript and targeted lint pass. No database changes, commit, push or deployment performed for this follow-up. Live existing request is not confirmed sent. Remaining verification: patched real request execution, lease contention, worker infrastructure/retry health, provider acceptance and final delivery evidence.


## Shared module queue repair

The invoice-specific kick has been replaced by workerKick.ts in the canonical durable graph service. All current createGraphTransactional producers inherit it: email, social publication/scheduling, contract lifecycle/signature automation, invoices/collections, MCP outcomes, and general agent plans. READY tasks in graph expansion also use it. A single callback processes persisted task scopes sequentially; one failed task does not skip later tasks. Normal task claim and stage policies remain in force. Future scheduled tasks are still guarded by the existing due-time query and require a continuously operating worker.

Run summaries now expose queueHealth with a stalled warning for READY/QUEUED due tasks older than two minutes. Status polling no longer advances last_progress_at solely because of a read. Task query failures propagate. Nine focused tests pass, TypeScript and targeted lint pass. No live deployment. Existing invoice remains READY with no send evidence on final read.

This covers the shared Bonnie graph queue, not proof that every independent queue is repaired. Workflow SDK fallback, event queues, recurring timers, project notification outbox, and durable retry infrastructure still require staging/live end-to-end verification. After-response kicks are a latency improvement, not a substitute for provisioned workers. No old queued external actions were replayed.


## MCP resume and approval execution

Workflow coordination resume now checks persistence failures, only resets FAILED tasks (never completed, running, or uncertain tasks), reads tenant/run-scoped runnable tasks, and wakes them through the shared worker kick. Responses distinguish queued from waiting without claiming execution completed. Durable approval checks its READY transition result and wakes the approved task rather than leaving it dormant. These are local changes; production has not been altered or deployed.


## Cross-module audit checkpoint

49 selected contract, document, CRM, communication, and execution unit/source-contract checks passed. These tests include mocks and static assertions; they are not full dashboard/MCP end-to-end evidence. The saved signer profile and record_contract_signature_atomic service exist. No saved-business-signature action was found in the inspected contracts MCP tool file; document-os exposes send_for_signature/get_signature_status, not equivalent owner adoption through the saved profile. Further authorization, tenant identity, canonical contract hashing and atomic evidence integration is required before offering that operation. No real contract was signed or resent.


## Combined release authorization and signing bridge

User approved the combined release scope, including project lifecycle, migrations and unfinished integration work. New MCP tools prepare_business_contract_signature and sign_contract_with_saved_business_signature use authenticated context, administrator membership, saved actor profile, explicit owner approval/consent and an exact content hash. Signature data stays server-side. New forward migration 20261014162000_saved_contract_signature_hash_guard.sql replaces only the signing function, checks expectedContentHash inside its existing locked transaction, and alters no stored signatures/contracts. Three service tests and nine signing PostgreSQL tests pass.

Production build exposed Workflow SDK server-module dependency bundling; contract/invoice workflow server imports were moved inside explicit step boundaries. Build is rerunning. No release commit or deployment has occurred as of this checkpoint.


## Latest combined-release checkpoint

The shared email gateway has an explicit Workflow SDK step boundary; prior workflow dependency errors cleared and Next.js reached optimized webpack compilation. Full build completion remains pending. StartWorkflow now initializes the canonical durable graph, carries the requested customer/scope context, and reports persisted-run/task-initialization partial failure accurately. User approval covers one combined release; it does not authorize claiming untested modules complete or replaying historical external actions. No commit, push, migration application or deployment has been performed yet.


## GitHub publication checkpoint

User explicitly requested committing and pushing all combined repairs. The latest full production build cleared Workflow SDK dependency errors and reached webpack compilation, but did not finish; its last recorded blocker was fetching the Inter font from fonts.googleapis.com in this restricted environment. No full-build success or live end-to-end success is claimed. Production migrations and dedicated worker deployment remain outstanding.
