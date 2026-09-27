# AlphaClone six-month reliability freeze

**Period:** 27 September 2026–27 March 2027
**Product rule:** No new modules during this period. Stabilize, complete, simplify, and support the modules already in AlphaClone.

## What this means

For six months, engineering work should make an existing AlphaClone workflow safer, more dependable, easier to finish, faster to recover, or easier to understand. Do not start a new module, product area, or parallel system. Existing modules may receive the missing behavior, integration, or UI work required to make their current promises work end to end.

If a request appears to add a module, pause and explain the trade-off. Continue only when it is clearly a repair or completion of an existing module, or Bonnie explicitly changes this freeze.

“Fully reliable” is the direction, not a claim that software can have zero failures. Measure reliability against observable behavior: a user can complete a workflow, see its real result, recover safely from failure, and never cross tenant boundaries.

## In scope

- Existing CRM, leads, contacts, deals, companies, and follow-ups.
- Existing social publishing and scheduling, including Instagram, LinkedIn, and Facebook.
- Existing email, unified inbox, campaigns, and provider integrations.
- Existing invoices, accounting, quotes, contracts, bookings, projects, tasks, and client portal.
- Existing Bonnie/AI/MCP execution, approvals, audit records, and durable jobs.
- Authentication, tenant isolation, permissions, database migrations, realtime updates, PWA/mobile behavior, performance, observability, deployment, and recovery.
- UX changes that remove friction, duplicate navigation, misleading success states, or unnecessary copy in those workflows.

## Out of scope

- New modules, product areas, or parallel implementations of existing workflows.
- Broad rewrites without a verified failure, a migration plan, and a measurable reliability gain.
- “100%” or uptime claims unsupported by production telemetry.
- Shipping a UI success state before the provider or database confirms the outcome.

## Reliability principles

1. **Protect customer data first.** Every read, write, job, storage object, and provider identity is scoped to the active tenant and authorized user.
2. **Make side effects safe to retry.** Sending, publishing, billing, signing, conversion, and automation use durable idempotency and explicit operation states.
3. **Tell the truth about status.** Distinguish draft, scheduled, queued, processing, published/sent, verified, failed, and needs-attention states.
4. **Recover without duplicates.** Retries, timeouts, worker restarts, and browser returns must resume or reconcile safely.
5. **Keep one source of truth.** Prefer repair and reconciliation across current systems over adding another queue, table, service, or user-facing module.
6. **Make the common action the shortest path.** Put records and primary actions first; move guidance and secondary controls out of the default path.
7. **Prove production behavior.** A passing local build is not proof that a Railway deployment, Supabase migration, cron, OAuth provider, or Meta publish is healthy.

## Priority order

### P0 — Safety and data correctness

- Tenant isolation, RLS, authorization, and account/identity routing.
- Duplicate-safe side effects and durable execution receipts.
- Data loss, corruption, cross-tenant exposure, incorrect financial state, and false-success reports.
- Failed production deployments, migrations, cron jobs, webhooks, and authentication/session recovery.

### P1 — Workflow completion and recoverability

- CRM list/detail/deep-link/navigation correctness and access to all records.
- Social and email delivery state, provider reconciliation, safe retries, and clear failure reasons.
- Finance, contracts, client portal, project, task, and booking end-to-end completion.
- Durable jobs, stalled-work recovery, observability, and useful operator controls.

### P2 — Usability and performance

- Remove duplicate headers, tabs, navigation, and explanatory blocks from working screens.
- Improve list loading, pagination, mobile/PWA layouts, and return-to-tab behavior.
- Reduce unnecessary requests and bundle cost without weakening correctness.

Lower-priority polish must not delay P0 or P1 work.

## Six-month sequence

### Month 1: Establish the baseline and stop unsafe failures

- Inventory existing modules and their user-critical workflows; mark each workflow pass, fail, blocked, or unverified.
- Reproduce the known P0 defects and fix tenant, permission, identity-routing, data-integrity, false-success, and duplicate-side-effect risks first.
- Establish production checks for build/deploy, database migrations, scheduled jobs, webhooks, provider connections, error rate, and queue age.
- For each high-risk write action, document its durable operation record, idempotency key, state transitions, retry policy, and reconciliation path.

**Exit gate:** no known, reproducible P0 remains open without a named owner, mitigation, and target date. Every critical scheduled worker has an observable heartbeat and stale-work alert.

### Month 2: Make core customer and sales work dependable

- Verify CRM and lead workflows from create/import through search, list, detail, edit, conversion, activity, follow-up, and archive.
- Verify deep links and back navigation preserve the selected record and return to the previous working context.
- Exercise large datasets, pagination, filters, selection, and tenant switching.
- Reconcile CRM records and provider/contact links without destructive cleanup.

**Exit gate:** core CRM scenarios pass with seeded small and large datasets; every supported record link opens the correct record; tenant-boundary tests pass.

### Month 3: Make communication and social delivery trustworthy

- Verify photo, carousel, and video/reel publish flows supported by each current provider; verify scheduled and immediate paths separately.
- Verify provider container processing, rate limits, token expiry, webhook/cron delay, timeout, retry, and reconciliation.
- Verify outbound email, campaign sends, inbox sync, thread/contact association, and failure reporting.
- Prove idempotent retries do not create duplicate posts or messages.

**Exit gate:** each supported channel has production evidence for accepted, published/sent, verified, delayed, and failed states. Every pending operation has an observable next retry or terminal reason.

### Month 4: Make money and commitments correct

- Verify quote-to-invoice, payment, accounting entries, contract generation/signature, booking, and client-portal workflows end to end.
- Reconcile webhook retries, partial failures, cancellation, refunds/voids where supported, and duplicate provider events.
- Check permissions and audit trails for financial and signed records.

**Exit gate:** financial totals reconcile against source transactions in representative cases; repeated webhook/action delivery does not duplicate money movement, invoices, contracts, or appointments.

### Month 5: Stabilize execution, mobile use, and performance

- Exercise Bonnie/AI/MCP actions through plan, approval, execution, durable receipt, timeout, retry, and audit review.
- Test realtime and browser-return behavior without blank screens, duplicate actions, or session loss.
- Test key user journeys at 320, 360, 375, 390, 412, and 430 px, tablet, desktop, and installed PWA.
- Profile the slowest high-frequency lists and routes; optimize only measured bottlenecks.

**Exit gate:** authorized execution is auditable and tenant-scoped; high-frequency workflows pass on supported screen sizes; performance baselines are recorded and regressions are visible.

### Month 6: Production rehearsal and reliability review

- Run a release candidate through the full regression suite and production-like staging checks.
- Rehearse database restore, deployment rollback, worker restart, queue recovery, token reconnection, and incident communication.
- Review open issues, production incidents, user-reported failures, and monitoring coverage.
- Set the next roadmap from verified remaining risks, not new-module ideas.

**Exit gate:** restore and rollback rehearsals succeed; critical workflows have current test evidence; no unresolved P0/P1 is hidden by a green build or unverified status.

## Definition of done for every change

Every reliability change must include:

1. The user-visible failure or risk it addresses, with a reproduction or evidence.
2. The smallest safe change to the existing workflow.
3. A meaningful regression test for the failure mode; security and money-moving changes also need negative and retry/idempotency coverage.
4. Tenant, permission, retry, duplicate, timeout, and partial-failure behavior considered where relevant.
5. Clear persisted status and recovery path for asynchronous work.
6. Targeted lint/typecheck/tests, plus relevant build or end-to-end checks.
7. A deployment/migration note and post-deploy verification for production-dependent changes.
8. A concise report of what changed, evidence, remaining risks, and whether it was committed/deployed.

Do not add tests that simply mirror implementation details. Tests should prove user-visible or data-safety behavior.

## Operating cadence

- Work one existing workflow or closely related failure cluster at a time.
- Keep a visible ledger with severity, affected module/workflow, reproduction, owner, fix, test evidence, production verification, and status.
- Review P0/P1 incidents weekly; prioritize by customer impact and recurrence.
- Do not close an issue on code completion alone when production behavior is part of the failure.
- Keep deployment and database changes independently reviewable and reversible where possible.
- Do not silently discard customer data or unrelated workspace changes.

## Measures to report

Report observed values and date ranges; do not invent targets where there is no baseline.

- Successful completion rate for critical workflows.
- Duplicate side effects prevented or observed.
- Queue depth, oldest pending age, retry count, and terminal failures by provider/job type.
- API and page latency at representative percentiles, split by route where available.
- Production availability and incident count/severity.
- Failed deploys/migrations and time to recover.
- Support/user-reported failures, time to acknowledge, and time to resolution.
- Coverage of tenant-isolation, authorization, idempotency, restore, and rollback checks.

## Decision rule when scope is unclear

Ask only when the choice could change customer-data safety, money movement, permissions, external publication, or irreversible production state. For reversible UI and test choices, use the simplest consistent implementation and document the assumption. If the work proposes a new module, treat the freeze as controlling and bring the trade-off to Bonnie before expanding scope.
