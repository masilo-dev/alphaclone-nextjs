# Projects V2 — Repository Audit & Implementation Map

Status: implementation gate for `feat/projects-v2-execution-expansion`
Base: `master` @ `1cdefbab57327a4aad36bc5bf18694f182bcb205`
Scope source: `ALPHACLONE_EXECUTION_EXPANSION.md`
Voice: explicitly excluded

## Phase 0 gate

The current `master` Railway build is failing before runtime. The blocking TypeScript error is in `src/lib/facebook/validateFacebookImage.ts`, where Sharp's broad `metadata.format` union is used to index a four-key MIME map. This branch fixes that first. No Projects V2 production rollout is allowed until the branch build is green.

Non-blocking build warnings observed:
- Playwright `require.resolve` externalization warnings in workflow bundle.
- Dynamic dependency warning in `src/lib/scraper/enrichmentPipeline.ts`.
- custom `Cache-Control` warning for `/_next/static/:path*`.
- Serwist registration/configuration notice.

These are tracked as stability risks but are not the failing TypeScript error.

## Existing repository audit

| Area | Existing component / evidence | Current role | Decision |
|---|---|---|---|
| Projects | `src/components/dashboard/projects/*`, `src/services/projectService.ts`, tenant project APIs | Existing project workspace, stages, progress, comments, portal, task/kanban/gantt surfaces | Extend; do not create a second module |
| Project workspace UI | `ProjectWorkspaceDrawer.tsx` | Overview, tasks, milestones, timeline/Gantt, team, blockers, comments, portal | Evolve into requested Overview / Tasks / Timeline / Files / Approvals / Financials / Activity navigation |
| Tasks | `src/services/taskService.ts`, existing `tasks` table, project task components | Canonical task records with project relationship | Extend existing task IDs with parent/dependency/milestone capabilities |
| Milestones | `src/services/milestoneService.ts`, `project_milestones` | Existing project milestones and progress contribution | Extend; no replacement table |
| Project operating schema | `supabase/migrations/20260726200000_projects_tasks_operating_system.sql` | Additive project/task foundation | Reuse as canonical foundation |
| Subtasks | `tasks.parent_task_id` | Already represented in additive schema | Build service/API/UI behavior around existing column |
| Dependencies | `task_dependencies` | Already normalized with tenant scope and unique constraint | Reuse and add dependency-aware state/unlocking |
| Relationships | `project_relationships`, `task_relationships` | Generic links to business entities | Use for quotes, contracts, invoices, docs, meetings, emails where canonical FK does not already exist |
| Activity | `project_activity`, existing activity services | Correlated project activity feed | Extend and feed unified client timeline |
| Risks/issues/decisions | `project_risks`, `project_issues`, `project_decisions` | Existing project execution data | Reuse; expose where useful, do not create duplicates |
| CRM relationships | Projects already carry `client_id`, `deal_id`, `contract_id`; generic relationship tables exist | Existing project-client/deal/contract linkage | Normalize reads and extend links without breaking legacy IDs |
| Contract lifecycle | Existing contract statuses/lifecycle; `entityTimelineService` already recommends project/invoice creation for signed contracts | Canonical contract truth | Emit/consume `contract.signed`; do not infer signature from UI state |
| Invoice/payment lifecycle | Existing invoice/payment modules and Money Hub | Canonical finance truth | Project financials are computed/read-through; no second accounting ledger |
| Calendar | `calendarService.ts`, native calendar sync, project due-date sync | Existing business/calendar events | Emit/update project deadlines and milestone/task checkpoints through existing calendar path |
| Redis | `src/lib/redis/client.ts` | Central Railway TCP Redis with fallback | Reuse for delivery, locks and queue primitives |
| Worker runtime | `src/worker/index.ts`, Bonnie durable runtime | Separate Railway worker service | Add project/event consumers here or through existing durable runtime; do not add a second workflow engine |
| Notifications | Existing notification services and `mcpToolNotificationHook.ts` | In-app/email event notification layer | Route project events into existing notification/digest policy |
| Chaser | `src/lib/chaser/chaseConfig.ts`, `chaseExecutorService.ts` | Existing universal chaser | Add project/task/milestone/approval/payment/client-response policies, not a new chaser system |
| Marketing Hub | Existing marketing/email pages, APIs and campaign tools | AlphaClone customer-facing campaign UI | Keep UI; put Listmonk behind adapter |
| Email infrastructure | Existing transactional/outreach/campaign services + digest work | Existing delivery/notification stack | Listmonk handles campaign execution only; transactional mail stays independent |
| Bonnie | `src/lib/bonnie/bonnieToolCatalog.ts`, `bonnieProjectExecutionEngine.ts` | Existing agent orchestration and project-aware execution | Extend existing tools and database-grounded read models |
| MCP | `src/lib/mcp/tools/projects.ts`, manifest/discovery/outcome definitions | Existing project actions incl. `create_project` | Extend canonical tools; no duplicate V2 namespace unless aliases are required for compatibility |
| Nexus | Existing Bonnie/Nexus/MCP layer | Cross-module intelligence/orchestration | Consume project event/read model rather than direct bespoke coupling |
| Business Logs | `src/lib/audit/businessAuditEngine.ts`, entity timeline/audit services | Existing business action evidence | Extend with standardized project event metadata and ALAMOS evidence |
| Tenant/user scoping | `tenant_id`, tenant-scoped APIs, RLS, `is_active_tenant_member()` | Existing security boundary | Every new read/write/worker/MCP action must preserve it; remove direct client reads where practical |
| Feature flags | `feature_flags` table and platform ops lookup | Existing global/tenant flag mechanism | Add requested flags to this mechanism; external integrations default OFF |
| Migrations | 400+ migrations; additive project OS migration already exists | Canonical schema evolution mechanism | New changes must be additive and idempotent; never rewrite production history |

## Major reuse findings

1. **Projects V2 is partly present already.** Existing UI includes Kanban, Gantt/timeline, blockers, milestones, comments and project workspace behavior.
2. **The data model already has many V2 primitives.** `parent_task_id`, `task_dependencies`, normalized milestones, project relationships, activity, risks, issues, decisions, recurrence, custom fields and saved views already exist.
3. **Bonnie/MCP already has project tools.** `create_project` and related project/task tools are already catalogued. Extend them instead of creating a parallel project agent.
4. **Signed-contract project creation is already a known workflow concept.** Existing trigger templates and audit/timeline logic already point from signed contract to project/invoice.
5. **Redis and a separate Railway worker already exist.** Reuse them. Do not introduce Temporal/BullMQ as a second orchestration source of truth unless the existing runtime explicitly adopts a queue primitive internally.
6. **The chaser already exists.** Add policies/entity kinds; preserve dedupe and digest behavior.
7. **Client timeline foundations already exist.** `clientActivityService` and `entityTimelineService` should be consolidated/extended instead of adding another timeline product.

## Canonical implementation rules

- Server-side tenant-scoped API/service calls are canonical for mutations and sensitive reads.
- Database state is truth; UI state and LLM text are never truth for health, payment, approval, signature or completion.
- Existing record IDs remain stable.
- Additive migrations only.
- Every real side effect gets an idempotency key and durable result record.
- Every automated action carries `correlation_id`, `action`, `trigger`, `source`, `tenant_id`, `user_id`, timestamp, status, result/error and retry count.
- ALAMOS stays the decision/evidence pattern; project automation writes into existing audit/business-log paths.
- External integrations are adapters behind flags and failure boundaries.
- Listmonk and Penpot are never required for AlphaClone login, CRM, projects, contracts, invoices, dashboard, Bonnie or MCP to remain usable.

# Implementation map

## A. Projects core / workspace

**EXISTING COMPONENT**
`ProjectWorkspaceDrawer`, `projectService`, tenant-scoped project routes, `projects` table.

**WHAT IT CURRENTLY DOES**
Existing project details, stages, progress, task/milestone views, Gantt/timeline, comments, blockers, portal sharing, due-date calendar sync.

**WHAT NEEDS TO CHANGE**
Promote existing workspace into Projects V2. Add the requested top summary model (client, explainable health, progress, deadline, next milestone, next action, revenue/paid/outstanding). Add Files, Approvals, Financials and Activity tabs. Preserve existing Kanban/Gantt components. Add a list view rather than replacing Kanban.

**FILES INVOLVED**
- `src/components/dashboard/projects/ProjectWorkspaceDrawer.tsx`
- `src/components/dashboard/projects/ProjectTasksKanban.tsx`
- `src/components/dashboard/projects/GanttChart.tsx`
- `src/components/dashboard/projects/MilestoneManager.tsx`
- `src/components/dashboard/projects/ProjectBlockersPanel.tsx`
- `src/services/projectService.ts`
- existing tenant project API routes

**DATABASE CHANGES**
No replacement of `projects`; add only missing columns/indexes after production-schema verification. Normalize health reason compatibility (`health_reasons` currently exists; expose a primary human-readable reason without duplicating truth).

**API CHANGES**
Add one tenant-scoped project summary/read-model endpoint and focused dependency/relationship/financial/activity endpoints as required. Move sensitive direct browser queries behind tenant APIs.

**UI CHANGES**
Navigation becomes Overview / Tasks / Timeline / Files / Approvals / Financials / Activity. Milestones remain visible in Overview/Timeline and may retain a contextual management panel rather than a top-level duplicate tab.

**WORKER CHANGES**
None for basic reads; events for material project changes.

**MCP/BONNIE CHANGES**
Read the same summary endpoint/read model Bonnie uses; no separate AI-only truth.

**RISKS**
Schema drift between legacy `health`/`progress` fields and newer `health_status`/weighted progress. Must preserve existing client portal behavior.

## B. Tasks, subtasks, dependencies, milestones

**EXISTING COMPONENT**
`tasks`, `project_milestones`, `task_dependencies`, `ProjectTasksKanban`, task/milestone services.

**WHAT IT CURRENTLY DOES**
Project tasks and milestone tracking already exist; additive schema already has parent task and dependency primitives.

**WHAT NEEDS TO CHANGE**
Expose subtasks/dependencies consistently in API/UI. Block task start/completion where hard prerequisites are incomplete according to policy. Calculate unlock state server-side. Add overdue event generation.

**DATABASE CHANGES**
Prefer none beyond missing indexes/constraints verified against production. Keep unique dependency constraint.

**API/UI/WORKER**
Tenant-scoped dependency CRUD; nested task/list visualization; dependency markers in Kanban/list/timeline; overdue scanner uses existing worker/runtime.

**MCP/BONNIE**
Extend update/move/complete task tools with dependency checks and explainable blocker results.

**RISKS**
Cycles. Add cycle detection before dependency creation and deterministic handling of deleted/completed parent tasks.

## C. Project templates

**EXISTING COMPONENT**
`TemplateSelector.tsx`; `projectService.createProject(..., templateId)` already carries a template identifier.

**WHAT NEEDS TO CHANGE**
Confirm existing project template persistence/API. Extend rather than replace. Seed Website Development, Consulting, Software Development, Marketing Campaign, Social Media Management, Client Onboarding and Custom templates.

**DATABASE CHANGES**
Only if canonical template tables lack normalized template milestones/tasks/dependencies/approval/invoice/document checkpoint definitions.

**API/UI**
Template preview + apply endpoint; idempotent instantiation; configurable offsets/durations.

**WORKER/MCP/BONNIE**
Bonnie can list, preview and apply templates; template application emits project/task/milestone events with one correlation id.

**RISKS**
Duplicate task generation on retry. Protect with template-application idempotency key/version.

## D. Automatic project creation

**EXISTING COMPONENT**
Workflow trigger templates, contract lifecycle, payment/invoice lifecycle, Redis/worker runtime.

**WHAT IT CURRENTLY DOES**
Repo already models signed contract -> project as a known action.

**WHAT NEEDS TO CHANGE**
Create a configurable project-kickoff policy that listens to canonical lifecycle events and checks required conditions (signed contract, payment/deposit when configured) before applying the selected template.

**DATABASE**
Store automation policy/config and execution/idempotency references using existing automation tables where possible.

**API/UI**
Settings surface for trigger condition/template/deposit requirement/checkpoints.

**WORKER**
Consume `contract.signed` and `payment.received`; use distributed lock + idempotency key such as `project-kickoff:{tenant}:{contract}:{policy-version}`.

**MCP/BONNIE**
Bonnie can explain whether kickoff is eligible and why; manual `create project from this contract` uses same service.

**RISKS**
Double project creation from contract and payment races. Solve with unique idempotency record/relationship plus lock.

## E. Health engine + chasers

**EXISTING COMPONENT**
Project health fields, blockers panel, universal chaser.

**WHAT NEEDS TO CHANGE**
One deterministic server-side health evaluator returning HEALTHY, AT_RISK, BLOCKED, OVERDUE, WAITING_ON_CLIENT, WAITING_ON_PAYMENT or COMPLETED plus ordered reasons. Persist current status/reasons and recompute on relevant events plus periodic reconciliation.

**DATABASE**
Reuse `health_status` and `health_reasons`; add only compatibility field/view if a single `health_reason` is required by consumers.

**WORKER**
Recompute on task/milestone/approval/invoice/payment/client-response/project events. Extend universal chaser entity/policy support for project/task/milestone/approval/payment/client response.

**RISKS**
Email fanout. Chasers enqueue digestable notification facts; they do not directly fan out one email per event.

## F. Client approvals

**EXISTING COMPONENT**
Bonnie approval concepts and project deliverable acceptance fields exist, but a general client approval history must be verified/extended.

**WHAT NEEDS TO CHANGE**
Canonical tenant-owned approval record with type, target, version, status and immutable history. Public/client action uses opaque token/session boundary, never tenant IDs supplied by the client as authorization.

**DATABASE**
Add/extend approval + approval_event/history tables only if existing tables cannot represent this safely.

**API/UI**
Project Approvals tab; client portal APPROVE / REQUEST CHANGES / COMMENT actions; complete history.

**WORKER**
`approval.requested`, `approval.approved`, `approval.changes_requested`; unlock dependency through task dependency policy.

**RISKS**
Authorization and replay. Signed/opaque token, expiry, version check, idempotent action semantics.

## G. Unified client timeline

**EXISTING COMPONENT**
`clientActivityService`, `entityTimelineService`, project activity, business audit engine.

**WHAT NEEDS TO CHANGE**
Build one tenant-scoped client relationship timeline read model that merges canonical events without copying source records into a competing system of record.

**API/UI**
Cursor-paginated timeline endpoint and one CRM/client timeline surface with filters.

**WORKER**
Event projection only if required for performance; otherwise server-side union/read model.

**RISKS**
N+1 queries and inconsistent timestamps. Normalize event envelope and paginate.

## H. Project financial intelligence

**EXISTING COMPONENT**
Contracts, invoices/payments, Money Hub, project budget fields.

**WHAT NEEDS TO CHANGE**
Read-through aggregate: contract value, invoiced, paid, outstanding, expected/actual cost, projected/actual profit, margin. Do not duplicate invoice/payment truth.

**API/UI**
Tenant-scoped financial summary endpoint + Project Financials tab and header metrics.

**MCP/BONNIE**
Read same aggregate; invoice creation calls existing invoice tool/service under existing approval/idempotency rules.

**RISKS**
Currency mismatch and partial/refunded payments. Define currency policy and only aggregate compatible canonical amounts.

## I. Listmonk adapter

**EXISTING COMPONENT**
Marketing Hub/campaign UI and campaign/email infrastructure.

**WHAT NEEDS TO CHANGE**
Add an `email-marketing` provider abstraction with a Listmonk implementation. AlphaClone owns segmentation intent, consent/suppression checks, preview/approval and writeback; Listmonk owns bulk campaign execution.

**DATABASE**
Tenant-aware external subscriber/list/campaign mappings + sync/delivery metadata only; do not duplicate CRM contacts as a new source of truth.

**API/UI**
Marketing Hub remains unchanged conceptually; provider health/status is surfaced through AlphaClone. `LISTMONK_ENABLED` defaults false.

**WORKER**
Async sync, campaign execution, webhook/result reconciliation. Circuit-breaker/failure isolation.

**RISKS**
Unsubscribe divergence, bounce loops, duplicated sends. Canonical suppression gate before send plus idempotent campaign key and reconciliation.

## J. Penpot adapter (later)

**EXISTING COMPONENT**
Project files/documents, deliverables, approval concepts.

**WHAT NEEDS TO CHANGE**
Define a design-provider interface and external reference model only. Implement Penpot behind `PENPOT_ENABLED=false` after core phases pass acceptance tests.

**RISKS**
Tight coupling and auth token leakage. Store references/metadata; core project remains usable during outage.

# Event contract

Adopt one envelope for new/normalized events:

```ts
type BusinessEvent<T = unknown> = {
  id: string;
  name: string;
  correlation_id: string;
  causation_id?: string;
  idempotency_key?: string;
  tenant_id: string;
  user_id?: string;
  source: string;
  trigger: string;
  occurred_at: string;
  retry_count: number;
  payload: T;
};
```

Required event names follow the approved scope. Existing equivalent event names should be adapted/aliased at the boundary rather than forcing a risky repo-wide rename in one release.

# Feature flags

Use the existing `feature_flags` mechanism:
- `PROJECTS_V2`
- `PROJECT_AUTOMATION_ENABLED`
- `CLIENT_APPROVALS_ENABLED`
- `LISTMONK_ENABLED` (default false)
- `PENPOT_ENABLED` (default false)

Rollout should be tenant-aware where the existing flag mechanism supports tenant overrides.

# Incremental delivery sequence

0. Restore green build and validate current migrations/runtime.
1. Projects V2 read model + workspace shell using existing project/task/milestone data.
2. Complete task/subtask/dependency/milestone behavior and tests.
3. Consolidate/extend project templates and seed approved templates.
4. Add idempotent event-driven project kickoff.
5. Extend canonical Bonnie/MCP project tools.
6. Add deterministic health engine and chaser policies.
7. Add client approval records/portal actions/history.
8. Unify client timeline.
9. Add financial read model.
10. Add Listmonk adapter/service behind disabled flag.
11. Add Penpot adapter behind disabled flag only after prior phases are stable.
12. Execute E2E, tenant-isolation, idempotency, retry, load and dependency-failure tests.

# Acceptance invariant

The full lead -> opportunity -> quote -> signed contract -> payment -> project -> template -> tasks/milestones/dependencies -> calendar -> approval -> unlock -> overdue/chaser -> invoice/payment -> final approval -> completion -> financial result -> client timeline -> marketing eligibility flow must be explainable from database state and Business Logs using one correlation chain, with retries producing no duplicate real-world side effects.
