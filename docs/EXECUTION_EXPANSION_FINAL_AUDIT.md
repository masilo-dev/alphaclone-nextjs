# AlphaClone Execution Expansion — Final Audit Matrix

This document audits the implementation against the Project Execution Expansion brief. It does not mark external infrastructure as healthy until it is actually provisioned and tested.

## Architecture invariants

- Existing Projects, CRM, invoices, calendar, email, Bonnie/MCP, chaser and tenant architecture remain canonical.
- No voice infrastructure was added.
- Listmonk and Penpot are optional infrastructure behind disabled-by-default feature flags.
- External service credentials remain server-side.
- New persistence is additive and tenant-scoped.
- Automated side effects use idempotency keys / execution ledgers where retries can duplicate work.

## Implemented

### Projects V2
- Project health with explainable states.
- Project summary endpoint.
- Milestones, template phases/tasks/dependencies.
- Dependency cycle/self/cross-tenant enforcement.
- Atomic template application.
- Standard templates and task chains.
- Configurable automatic project creation for contract/payment triggers.
- Project automation execution ledger.
- Client approvals and immutable approval history.
- Project/task/approval/milestone/payment/client-response chaser policies.
- Bonnie/MCP project intelligence for blockers, overdue work, approvals and unpaid invoices.

### Financial intelligence
- Project financial fields for estimated value/cost and actual cost/revenue.
- Canonical invoice + payment ledger aggregation.
- Invoiced, paid, outstanding and uninvoiced value.
- Gross/projected profit and realized/projected margins.
- Overdue invoice detection.
- Completed-but-potentially-unbilled detection.

### Unified client timeline
- One tenant-authorized API merges client creation, project creation/activity, approvals/history, invoices, payments and relevant business automation events.
- Timeline is reverse chronological and bounded.
- No separate history store was introduced.

### Listmonk
- Disabled-by-default tenant gate.
- Tenant list/subscriber/campaign mappings.
- Server-only API client.
- Idempotent operation ledger.
- Marketing Hub send adapter.
- Suppression/blocklist synchronization.
- Health endpoint and Railway deployment contract.
- Existing direct email providers remain fallback when Listmonk is disabled.

### Penpot
- Disabled-by-default tenant gate.
- Server-only access-token RPC client.
- AlphaClone project -> Penpot project mapping.
- AlphaClone project/task/approval -> Penpot file mapping.
- Idempotent create/retry operation ledger.
- Graceful service-unavailable behavior.
- Railway deployment contract with dedicated database/storage.
- AlphaClone approval state remains canonical.

## Executable audit scripts

### End-to-end acceptance
`node scripts/execution-expansion-acceptance.mjs`

Required environment:
- `ALPHACLONE_BASE_URL`
- `ALPHACLONE_TEST_BEARER`
- `ALPHACLONE_TEST_TENANT_ID`
- `ALPHACLONE_TEST_PROJECT_ID`
- `ALPHACLONE_TEST_CLIENT_ID`

Validates project summary, financials, client timeline, approvals and optional integration surfaces.

### Load audit
`LOAD_CONCURRENCY=10 LOAD_REQUESTS=100 node scripts/execution-expansion-load.mjs`

Reports request count, failures and p50/p95/p99/max latency across summary, financial and timeline reads.

### Failure isolation
Stop or misconfigure Penpot/Listmonk in a test environment, then run:
`node scripts/execution-expansion-failure-isolation.mjs`

Core health, Projects and financial endpoints must remain HTTP 200. Optional integration endpoints may return 404/503 without breaking core execution.

## Not truthfully complete until external verification

The following require a deployed test environment and cannot be certified merely from repository code:

1. Railway Listmonk service + dedicated PostgreSQL is running and healthy.
2. Railway Penpot services + dedicated database/storage are running and healthy.
3. Valid server-only Listmonk/Penpot credentials are configured.
4. Real contract signed -> deposit -> project -> template -> approval -> dependency unlock -> invoice -> payment lifecycle succeeds end-to-end.
5. Load audit meets the production SLO chosen by AlphaClone.
6. Penpot/Listmonk forced outages pass the failure-isolation script.
7. GitHub CI completes on an allocated runner and all migration/typecheck/test/security jobs pass.

Do not enable either external integration broadly before these checks pass.

## Definition-of-done scenario to execute

Lead -> opportunity -> quote -> accepted -> contract signed -> deposit received -> project auto-created -> correct template applied -> milestones/tasks/dependencies created -> deadlines/calendar -> design linked -> approval requested -> approval recorded -> dependent work unlocks -> Bonnie/chaser detects delay -> milestone complete -> invoice -> payment -> final approval -> project complete -> financial result -> unified client timeline -> later marketing follow-up.

Every step must preserve tenant isolation, auditability and retry safety.
