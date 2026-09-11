# AlphaClone Systems — Execution Expansion Scope

Status: APPROVED IMPLEMENTATION SCOPE
Branch: master
Voice: EXCLUDED for this phase

## Core rule

Do not create a second AlphaClone, second CRM, second Projects app, second Calendar, second invoice system, second email UI, or a collection of disconnected SaaS products.

Extend the existing AlphaClone architecture and preserve existing IDs, tenant ownership, auth, CRM relations, Contracts, Invoices, Calendar, Documents, Bonnie, Nexus, Marketing Hub, Redis workers, MCP tools, notifications, Business Logs and existing project/task data.

The end state must feel like one operating system:

LEAD -> SALE -> CONTRACT -> PAYMENT -> PROJECT -> DELIVERY -> INVOICE -> RETENTION

## Required implementation

### 1. Projects V2
Upgrade the existing Projects module with:
- Overview
- Kanban
- List
- Timeline
- Milestones
- Tasks and subtasks
- Task dependencies
- Project templates
- Project health and explainable health reasons
- Progress calculation
- Deadlines
- Project files
- Comments
- Activity timeline
- Linked client and CRM contact
- Linked opportunity/deal
- Linked quote
- Linked contract
- Linked invoices/payments
- Linked documents
- Linked calendar events/meetings
- Linked emails where supported
- Client approvals
- Project financials

Do not replace existing project/task IDs. Follow the existing additive migration strategy in PROJECTS_TASKS_REBUILD_AUDIT.md.

### 2. Project templates
Ship reusable templates for:
- Website Development
- Consulting
- Software Development
- Marketing Campaign
- Social Media Management
- Client Onboarding
- Custom Project

Templates may define milestones, tasks, dependencies, durations, approval checkpoints, invoice checkpoints and required documents.

### 3. Automatic project creation
Support configurable workflows such as:
Lead -> Opportunity -> Quote -> Contract -> Signed -> Deposit/Payment -> Project

When conditions are met, AlphaClone may create the project, select a template, create tasks/milestones/dependencies, create deadlines/calendar events, create approval checkpoints and schedule invoice checkpoints.

All side effects must be idempotent and auditable.

### 4. Bonnie project intelligence
Bonnie must treat projects as a first-class business object and use database truth.

Bonnie must be able to:
- create/update projects
- create/update/complete/move tasks
- create milestones
- apply project templates
- identify overdue and blocked work
- identify missing approvals
- identify unpaid project invoices
- summarize project state
- calculate/explain project progress and health
- recommend next actions
- create the next permitted invoice/action through existing approval rules
- answer what needs attention today

Never hallucinate project state.

### 5. Project health engine
Supported health states:
- HEALTHY
- AT_RISK
- BLOCKED
- OVERDUE
- WAITING_ON_CLIENT
- WAITING_ON_PAYMENT
- COMPLETED

Inputs include overdue tasks, blocked dependencies, missed milestones, project deadline, approvals, client replies, invoice/payment state, contract state and inactivity.

Persist or expose both health status and human-readable reasons.

### 6. Chaser integration
Connect Projects to the existing chaser system instead of creating another reminder framework.

Required chaser capabilities:
- project_chaser
- task_chaser
- milestone_chaser
- approval_chaser
- payment_chaser
- client_response_chaser

Prevent duplicate messages. Respect digest/rate-limit rules. Do not return to per-event email spam.

### 7. Client approval system
Approval types should support designs, documents, proposals, deliverables, milestones and custom approval items.

Statuses:
- pending
- viewed
- approved
- changes_requested
- expired

Client actions:
- APPROVE
- REQUEST CHANGES
- COMMENT

Maintain version, actor, timestamp and audit history. Store only legally appropriate request/session metadata.

### 8. Unified client timeline
Create a single business timeline that can include leads, CRM updates, emails, meetings, quotes, contracts, projects/tasks, approvals, files/documents, invoices, payments, Bonnie actions and automation events.

### 9. Project financial intelligence
Connect Projects with existing Invoice/Money data.

Expose:
- contract value
- total invoiced
- total paid
- outstanding
- estimated cost
- actual cost
- projected profit
- actual profit
- margin

Do not create a second accounting source of truth.

## Listmonk integration

Listmonk is approved as isolated self-hosted campaign infrastructure.

Rules:
- Do not rebuild Listmonk inside Next.js.
- Do not expose Listmonk admin as the normal AlphaClone customer experience.
- AlphaClone Marketing Hub remains the user-facing control layer.
- Listmonk failures must not break CRM or normal transactional email.
- Use a dedicated integration adapter/service boundary.

Required capabilities:
- subscriber/list sync
- CRM-driven segmentation
- campaign creation
- preview/approval
- scheduling
- campaign execution
- unsubscribe/suppression
- bounce handling
- status and statistics
- delivery/result writeback
- tenant-aware mapping
- idempotent send protection

Desired flow:
Bonnie/Marketing Hub -> CRM segment -> consent/suppression checks -> campaign preview -> approval/rule check -> Listmonk execution -> results -> CRM/client timeline -> summary.

## Penpot integration

Penpot is approved for a later phase as isolated design/prototyping infrastructure.

Rules:
- Do not rebuild Figma functionality in AlphaClone.
- Do not tightly couple core project availability to Penpot.
- AlphaClone remains system of record.
- Penpot outage must not break Projects.

Use cases:
- website mockups
- UI designs
- prototypes
- visual deliverables
- project-linked design references

Desired flow:
Project -> Design task -> Penpot design -> client preview -> AlphaClone approval -> approval recorded -> dependent task unlocked.

## Railway deployment model

Use the existing Railway project.

Keep services isolated. Current main services include alphaclone-nextjs and Redis. Add external systems as separate services, not inside the Next.js process.

Target model:
- alphaclone-nextjs
- Redis
- Listmonk service
- dedicated Listmonk PostgreSQL database
- Penpot services later
- dedicated Penpot persistence/database as required

No auxiliary service may become a single point of failure for login, CRM, Projects, Contracts, Invoices, Dashboard, Bonnie or MCP.

## Feature flags

Introduce/reuse the existing feature flag mechanism for:
- PROJECTS_V2
- PROJECT_AUTOMATION_ENABLED
- CLIENT_APPROVALS_ENABLED
- LISTMONK_ENABLED
- PENPOT_ENABLED

New external integrations default OFF until health checks and acceptance tests pass.

## Explicit exclusion

Do NOT implement in this phase:
- Voicebox
- voice AI
- speech-to-text
- text-to-speech
- voice commands
- audio agents

Voice is postponed.

## Event architecture

Prefer events/queues over direct cross-module coupling.

Normalize or support events such as:
- lead.created
- opportunity.created
- quote.created
- contract.sent
- contract.signed
- payment.received
- project.created
- project.updated
- task.created
- task.started
- task.completed
- task.overdue
- milestone.completed
- approval.requested
- approval.approved
- approval.changes_requested
- invoice.created
- invoice.paid
- invoice.overdue
- campaign.created
- campaign.started
- campaign.completed
- client.response.received

Reuse Redis queues/workers/locks where appropriate.

## Idempotency

Any operation that can create/send a real side effect must be idempotent, including:
- emails
- campaigns
- invoices
- projects
- tasks
- notifications
- documents
- approvals

Retries must not duplicate real-world actions.

## Tenant isolation

All new reads/writes must enforce existing tenant/user ownership. No project, task, campaign, contact, approval, invoice, document or activity record may leak across unrelated accounts.

Audit server routes, Supabase policies/queries, workers and MCP tools for tenant scope.

## Observability

Every important automated action must be traceable with at least:
- correlation_id
- action
- source
- trigger
- tenant/user
- timestamp
- status
- result
- error
- retry_count

Integrate with the existing Business Logs / Control System instead of inventing another log product.

## ALAMOS

For consequential automated flows, preserve the AlphaClone ALAMOS pattern:
Context -> Decision -> Owner -> Action -> Evidence -> Result -> Learning

## UI requirements

Use the existing AlphaClone design system and shared components. Do not introduce a separate visual language.

Projects primary navigation:
- Overview
- Tasks
- Timeline
- Files
- Approvals
- Financials
- Activity

The project header should make visible, where applicable:
- client
- health
- progress
- deadline
- next milestone
- next action
- revenue/value
- paid
- outstanding

The first screen must quickly answer:
- What is happening?
- What is late?
- What is blocked?
- What needs attention?
- What happens next?

## Repository-first implementation procedure

Before broad code changes, audit and reuse the current implementations for:
1. Projects
2. Tasks
3. project/task migrations
4. CRM relations
5. contract lifecycle
6. invoice/payment lifecycle
7. Calendar
8. Redis queues/workers
9. notifications/digests
10. Chasers
11. Marketing Hub
12. email infrastructure
13. Bonnie runtime/tools
14. MCP tools
15. Nexus
16. Business Logs/Control System
17. tenant/user scoping
18. feature flags
19. client portal/approval surfaces
20. migrations and rollback practices

Do not duplicate working infrastructure.

## Implementation order

Phase 0 — Stabilize current build/deployment/runtime failures.
Phase 1 — Projects V2 core and normalized server-side APIs.
Phase 2 — Tasks, subtasks, dependencies, milestones and templates.
Phase 3 — Automatic project creation and event flows.
Phase 4 — Bonnie/MCP project execution tools.
Phase 5 — Health engine and Chasers.
Phase 6 — Client approvals and portal integration.
Phase 7 — Unified client timeline.
Phase 8 — Project financial intelligence.
Phase 9 — Listmonk isolated deployment and Marketing Hub integration.
Phase 10 — Penpot isolated deployment and project approval integration.
Phase 11 — End-to-end, security, idempotency, load and failure-isolation testing.

Do not advance a phase when the previous phase is unstable.

## Acceptance flow

The implementation is complete only when this flow works safely:

Lead created
-> opportunity
-> quote
-> contract
-> contract signed
-> deposit/payment received
-> project created
-> template applied
-> milestones/tasks/dependencies created
-> calendar updated
-> project work progresses
-> design/deliverable linked
-> approval requested
-> client approves or requests changes
-> dependent task unlocks when appropriate
-> overdue/blocked work detected
-> chaser/action triggered without duplication
-> milestone completes
-> invoice generated when permitted
-> payment recorded
-> final deliverable approved
-> project completed
-> financial result calculated
-> client/CRM timeline updated
-> appropriate retention/marketing eligibility available

Every step must remain tenant-safe, idempotent, observable and auditable.

## Definition of success

Do not optimize for feature count. Optimize for reliable execution.

A small-business owner should eventually be able to ask Bonnie:
"What needs my attention today?"

AlphaClone should identify real priorities from CRM, projects, approvals, contracts, payments, invoices, campaigns and meetings, then safely execute the actions it is authorized to perform and surface only the decisions that require the owner.
