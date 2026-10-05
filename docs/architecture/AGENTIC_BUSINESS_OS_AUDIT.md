# AlphaClone Agentic Business Operating System — Architecture Audit

**Date:** 2026-10-05  
**Branch:** `cursor/agentic-os-architecture-audit-b56b`  
**Scope:** Production codebase + live Supabase project `ehekzoioqvtweugemktn` (Alphaclone systems)  
**Method:** Repository inventory + live schema/FK/row-count inspection + prior artifacts under `artifacts/audit/`  
**Operating principle:** Human-led. AI-assisted. System-executed.  
**Constraint honored:** Audit only. No rebuild. No production data mutation.

Related prior docs (not replaced):
- `docs/architecture/ALPHACLONE_CURRENT_STATE.md` (2026-10-04)
- `docs/architecture/ALPHACLONE_TARGET_ARCHITECTURE.md`
- `artifacts/audit/mcp-full-execution-audit.md`
- `artifacts/audit/mcp-root-cause-report.md`

---

## Executive verdict

AlphaClone already has most of the **piece parts** of an LLM execution layer:

| Layer | Status |
| --- | --- |
| Canonical business objects | **Strong** for CRM/client/deal/quote/contract/project/invoice/social |
| MCP tool catalog | **Large** (~524–569 tools) — discovery exists |
| Shared domain services (email/social/invoice) | **Partially shared** UI ↔ MCP |
| Durable agent runtime | **Present** (`agent_runs`/`agent_tasks`, Bonnie worker) |
| Event taxonomy | **Defined** (`businessEventTaxonomy.ts`) |
| Capability / approval / receipt spine | **Present but unevenly applied** |
| One invariant pipeline for every action | **Not yet enforced** |

The structural gap is **not** “missing AI agents.”  
The structural gap is **multiple execution paths for the same business operation**, incomplete write-path idempotency/verification coverage, dual identity tables mid-migration, and policy/HITL divergence between Bonnie and MCP.

**Final product test answer today:**  
An authorized LLM can *request* many lifecycle actions via MCP. It cannot yet be trusted that *every* path uses one canonical execution service with verified outcome, universal approval policy, and next-best-action — especially across lead promotion, deal→project, quotes vs proposals, and invoice create/pay.

---

## 1. CURRENT ARCHITECTURE MAP

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Instruction surfaces                                                      │
│  Web/PWA Dashboard   Bonnie chat   ChatGPT/Claude MCP   Cron/workers     │
└──────────────┬───────────────┬──────────────┬──────────────┬─────────────┘
               │               │              │              │
               ▼               ▼              ▼              ▼
     Next.js API routes   ToolPolicyGate   /api/mcp      Railway crons
               │               │              │              │
               └───────┬───────┴──────┬───────┘              │
                       ▼              ▼                      │
              Domain services   tool-registry                │
              (email/social/    + executionGateway           │
               invoice/crm/…)   + outcomeOrchestrator        │
                       │              │                      │
                       ▼              ▼                      ▼
                 Supabase Postgres (canonical graph + agent tables)
                       │
                       ▼
              Providers: Zoho/Gmail/MS · Meta/LinkedIn · Stripe · Booking
```

**Topology notes**
- Product UI is mostly `/dashboard/[[...slug]]` → `BusinessDashboard` / `Dashboard` (dual shells still exist).
- MCP entry: `src/app/api/mcp/route.ts` → `tool-registry` → domain tools → often `executionGateway` for high-risk writes.
- Bonnie interactive: mega-agent planner over the same registry; durable work uses department `agentRegistry`.
- Hermes is a dispatcher shim (`src/lib/hermes/`), not a second OS.
- `src/lib/engine/*` (eventBus/workflowEngine/policyEngine) is an adjacent/legacy stack — do not treat as primary spine unless proven sole caller.

---

## 2. MODULE INVENTORY

| Module | UI (canonical) | Primary APIs | Primary services | MCP tools (examples) | Maturity |
| --- | --- | --- | --- | --- | --- |
| CRM contacts/companies | `/dashboard/crm/*`, unified-contacts | `/api/crm/*`, `/api/tenant/.../contacts` | `unifiedContacts`, `contactService`, `resolveOrCreateCRMIdentity` | `crm.ts`, `crm-ops.ts` | Production |
| Leads / Lead Finder | `/dashboard/leads`, `/dashboard/leads/finder` | `/api/leads/*`, `/api/scraper/*` | `leadLifecycle`, scraper/enrichment, qualification brain | `lead-scraping-ops`, `crm-ops` | Production, multi-path |
| Deals / pipeline | `/dashboard/deals` | `/api/deals/*`, tenant deals | `dealService`, `dealStageActions` | `deals.ts` | Production |
| Clients / lifecycle | unified contacts + Client 360 | `/api/tenant/.../clients`, lifecycle MCP | `businessClientService`, `clientLifecycleCoordinator` | `execute_client_lifecycle`, portal-ops | Production, glue uneven |
| Email | `/dashboard/comms` | `/api/email/send`, provider routes | `emailExecutionService` → gateway | `email-ops`, gmail/ms tools | Rebuild in flight |
| Social | `/dashboard/business/social*` | `/api/social/*`, platform APIs | `SocialPublishingService` | social-publishing / facebook / linkedin | Strong verification model |
| Documents | `/dashboard/business/documents` | tenant documents APIs | `document-os`, documents libs | `document-os`, `documents-ops` | Dual Doc OS vs `documents` |
| Contracts / e-sign | `/dashboard/business/contracts`, `/sign/*` | `/api/contracts/*` | contract* services, native e-sign | `contracts`, `contracts-ops` | Production native e-sign |
| Quotes / proposals | `/dashboard/business/quotes` | `/api/quotes/*`, `/api/proposals/*` | `quoteService`, proposal lifecycle | finance gap-tools | Dual `quotes`/`proposals` |
| Invoices / finance | `/dashboard/business/billing*` | `/api/invoices/*`, `/api/stripe/*`, accounting | `businessInvoiceService`, payment recorders | `invoicing`, accounting | Canonical `business_invoices` |
| Projects / tasks | `/dashboard/business/projects`, `/dashboard/tasks` | `/api/tenant/.../projects|tasks` | `projectService`, `taskService` | projects / gap-tools | Dual status enums |
| Calendar / booking | `/dashboard/business/calendar|booking` | `/api/booking/*`, calendly, meetings | booking + calendar services | calendar-ops, video | Dual UI + Calendly |
| Client portal | `/portal/[token]`, `/p/[id]` | client-portal-auth, client-finance, project portal | portal auth + finance portal | portal-ops | Two portals |
| Notifications / PWA | `/dashboard/notifications`, PWA | `/api/notifications`, push | notification engines | MCP notification hook | Type enum drift |
| Agents / automation | Bonnie workspace, chase surfaces | `/api/bonnie/*`, `/api/chase/*`, cron | Bonnie runtime, chaser | chase-ops, bonnie-* | Present |
| Auth / tenancy | onboarding, settings | `/api/auth/*`, tenant routes | tenant membership, RLS | — | Strong pattern, enforce everywhere |

---

## 3. DATABASE / SOURCE-OF-TRUTH MAP

Live project: **Alphaclone systems** · region `eu-central-1` · status `ACTIVE_HEALTHY` · Postgres 17.

### Canonical objects (use these)

| Business concept | Canonical table | Approx rows | Key FKs observed |
| --- | --- | ---: | --- |
| Tenant | `tenants` | 64 | — |
| Lead (CRM pipeline) | `leads` | 1,774 | `tenant_id`, `client_id` → `business_clients` |
| Contact (person) | `contacts` | 365 | `company_id`, `original_lead_id` → `leads` |
| Client (commercial) | `business_clients` | 668 | `crm_contact_id` → `contacts` |
| Company | `companies` | (present) | linked from contacts/deals |
| Deal | `deals` | 55 | `contact_id`, `company_id`, `project_id` |
| Quote | `quotes` | 258 | `deal_id` |
| Contract | `contracts` | 92 | `client_id`, `deal_id`, `project_id`, `document_id` |
| Project | `projects` | 32 | `client_id`, `deal_id`, `contract_id` |
| Task | `tasks` | 3,333 | `related_to_project/lead/contact` |
| Invoice | `business_invoices` | 61 | `client_id`, `project_id` |
| Social post | `social_posts` | 459 | `publish_operation_id` |
| Email message | `email_messages` / threads | ~14.9k | unified foundation |
| External action ledger | `external_actions` | 495 | `tenant_id` |
| MCP receipts | `mcp_action_receipts` | 194 | — |
| Agent run/task | `agent_runs` / `agent_tasks` | 143 / 1,038 | durable runtime |
| Chase | `chase_instances` | 886 | follow-up engine |
| Notifications | `notifications` | 972 | — |

### Deprecated / parallel / empty (do not expand)

| Table | Approx rows | Guidance |
| --- | ---: | --- |
| `invoices` | 6 | Deprecated; use `business_invoices` |
| `clients` | 0 | Empty; use `business_clients` |
| `opportunities` | 0 | Empty; use `deals` |
| `proposals` | 0 | Parallel to `quotes` — collapse toward quotes |
| `business_projects` | 7 | Legacy dual; prefer `projects` |
| `crm_contacts` | 5 | MCP-era parallel; prefer `contacts` |
| `scheduled_posts` | 8 | Legacy social queue; prefer `social_posts` |
| `doc_os_documents` | 1 | Doc OS side-store; prefer `documents` for product files |
| Lead finder parallel: `lead_candidates`, `scraper_leads`, `leads_raw` | live | Promote into `leads` via one handoff |

### Graph (intended)

```text
Tenant
  └─ User (tenant_users / tenant_members)
  └─ Lead ──convert──▶ Contact ──link──▶ Business Client
       │                  │                    │
       │                  └─ Company           │
       └─ Deal ◀───────────────────────────────┤
            │                                  │
            ├─ Quote / Proposal                │
            ├─ Contract ───────────────────────┤
            └─ Project ── Tasks                │
                  │                            │
                  └─ Invoice / Payment ◀───────┘
```

FK evidence confirms this chain exists for `contacts`, `business_clients`, `deals`, `quotes`, `contracts`, `projects`, `tasks`, `business_invoices`. Gaps are behavioral (optional auto-create) more than missing columns.

---

## 4. EXISTING AI / AUTOMATION INVENTORY

### MCP / LLM execution
- **Gateway:** `src/app/api/mcp/route.ts`
- **Registry:** `src/lib/mcp/tool-registry.ts` (~75 tool modules under `src/lib/mcp/tools/`)
- **Aliases / governance:** `canonicalToolRegistry.ts`
- **Capability negotiation:** `capabilityManifest.ts`, `capabilityFilter.ts`, progressive discovery
- **Write spine:** `executionGateway.ts` → `external_actions` + `mcp_action_receipts`
- **Outcomes:** `intentAdapter.ts`, `outcomeDefinitions.ts`, `outcomeOrchestrator.ts`
- **Prior audit:** 569 runtime tools; 219 pass / 350 safety-blocked writes (expected under audit policy)

### Bonnie
- Interactive mega-agent: `bonnieAgent.ts` + tool catalog
- Specialized department agents: `src/lib/bonnie/os/agentRegistry.ts` (ceo, coo, sales, crm, finance, …)
- HITL: `ToolPolicyGate` → `autonomous_runner_approvals` / Bonnie approvals APIs
- Durable runtime: leases, outbox, idempotency (`agent_idempotency_keys`), verification, chasing
- Worker: `src/bonnie/worker.ts` (Railway)

### Automation / cron
- `railway.crons.json` — email sync, social publish/reconcile, invoice reminders, contract reminders, lead discovery, chase, Bonnie runtime, digests, etc.
- Domain automations: booking automation, project automation, task reminders, proposal follow-ups

### Events
- Canonical taxonomy: `src/lib/events/businessEventTaxonomy.ts` (lead.*, deal.*, quote.*, contract.*, invoice.*, project.*, social.*, booking.*, …)
- Envelope + logger: `operatingEventEnvelope.ts`, `tenantEventLogger.ts`
- Also present: older `events` / `event_subscriptions` / `business_automation_events` / agent event inbox-outbox

---

## 5. DUPLICATE / LEGACY SYSTEM INVENTORY

| Class | Duplicates | Priority |
| --- | --- | --- |
| **Client identity** | `contacts` + `business_clients` (+ empty `clients`, sparse `crm_contacts`) | P0 structural |
| **Lead pipelines** | `leads` vs `lead_candidates` vs `scraper_leads` | P0 lifecycle |
| **Projects** | `projects` vs `business_projects`; dual status vocabularies | P1 |
| **Quotes** | `quotes` (live) vs `proposals` (empty but APIs still exist) | P1 |
| **Invoices** | `business_invoices` vs deprecated `invoices` | P1 (mostly done) |
| **Documents** | `documents` vs in-memory Doc OS + `doc_os_*` | P1 |
| **Social queue** | `social_posts` vs `scheduled_posts` | P2 |
| **Email send paths** | unified execution + direct Brevo/SendGrid/Resend/Gmail/MS + campaign engine | P0 reliability |
| **Dashboard shells** | `Dashboard.tsx` vs `BusinessDashboard.tsx` | P2 UX |
| **Portals** | finance `/portal` vs project `/p` vs Stripe billing portal | P2 |
| **Policy engines** | ToolPolicyGate, bonnieRiskPolicy, engine/policyEngine, Hermes policy, capabilityFilter tiers | P0 |
| **Ticket MCP** | Inline handlers in MCP route bypassing registry | P0 |
| **Engine stack** | `src/lib/engine/*` adjacent to Bonnie durable runtime | P2 clarify |

---

## 6. BUSINESS LIFECYCLE MAP

```text
Discover (finder/scraper)
  → Candidate (lead_candidates / scraper_leads)
  → Promote → CRM Lead (leads)
  → Research / score / enrich
  → Outreach (email/social)
  → Conversation / reply (chase stop)
  → Meeting / booking
  → Opportunity (deals)
  → Quote / Proposal (quotes)
  → Contract (contracts) → sign
  → Client (business_clients)   [also creatable earlier via convert RPC]
  → Project + Tasks
  → Invoice + Payment
  → Portal visibility
  → Customer success / follow-up / chase
```

**What works today**
- Lead convert RPC creates contact + business_client (+ optional company).
- Quotes → convert to contract/invoice paths exist (UI + MCP).
- Contract signed can spawn delivery tasks (`contractSignedDurableTask` / project automation).
- Social publish has real verification + reconcile crons.
- Email has idempotency keys + delivery events on the unified path.
- Chase engine exists for follow-up situations (~886 instances).

---

## 7. BROKEN / WEAK HANDOFFS

| Handoff | Issue | Class |
| --- | --- | --- |
| Finder/scraper → `leads` | Multiple promotion paths; not one durable handoff | P0 |
| Deal `closed_won` → project | Often toast/next-steps only; auto project mainly via lifecycle MCP | P1 |
| Quote vs proposal accept | Dual APIs/tables risk divergent state | P1 |
| Contract → project → portal | Multiple enable paths (finance vs project portal) | P1 |
| UI vs MCP invoice create/pay | Shared recorder often, but multiple entry services remain | P0 |
| Event → notification → digest | Taxonomy exists; digest cron wiring incomplete vs railway list | P2 |
| `/dashboard/sales-agent` | Canonical alias → Lead Finder; Dashboard switch → AI agents | P2 |
| MCP vs Bonnie approval | MCP source often auto-allows; Bonnie queues HITL | P0 |
| Agent claim vs verified outcome | LLM can narrate success without verification gate on many tools | P0 |

---

## 8. SECURITY / TENANT RISKS

| Risk | Evidence | Priority |
| --- | --- | --- |
| Tenant isolation pattern is strong but not universal | Widespread `.eq('tenant_id')` + membership checks; RLS migrations exist | — keep enforcing |
| MCP must never trust model-supplied tenant/user | Session/token resolution exists; force overrides in handlers — verify all tools | P0 continuous |
| Ticket tools bypass registry | Inline SQL in `/api/mcp/route.ts` | P0 |
| Policy fragmentation | Multiple evaluators; MCP auto-approve as source rule must stay explicit | P0 |
| High-risk financial actions | Invoicing/payment tools exist; require approval_required enforcement everywhere | P0 |
| Portal auth split | Password session vs project token vs Stripe portal — scope carefully | P1 |
| Secrets / env | Cloud agent lacked `.env.local` (expected); never commit keys | — |
| Generated DB types stub | `database.types.ts` nearly empty → drift risk for typed clients | P2 |

---

## 9. PERFORMANCE BOTTLENECKS

| Area | Observation | Priority |
| --- | --- | --- |
| Calendar aggregation | Parallel `select('*')` across ~8 entity types (limit ~200) | P1 |
| Client 360 / finance portal | Fan-out of projects/invoices/contracts/docs/messages per open | P1 |
| Project lists | `select('*')`, default limits; dual shells load overlapping state | P2 |
| MCP catalog size | 500+ tools — progressive discovery exists; keep it mandatory for LLM clients | P1 |
| Agent context | Risk of dumping large tenant state into prompts — use targeted retrieval | P0 design rule |
| Lead enrichment loops | Array/email enrichment can amplify | P2 |
| Notification digests | Engine present; scheduling gaps | P2 |

---

## 10. PROPOSED CANONICAL EXECUTION ARCHITECTURE

**Do not rebuild.** Enforce one invariant on top of existing pieces.

```text
INTENT (UI | MCP | Bonnie | Cron)
  → CONTEXT (minimal object + relationship slice)
  → IDENTITY (authenticated actor; never LLM-claimed tenant)
  → AUTHZ (scopes + connector permissions + membership)
  → CANONICAL OBJECT (resolve IDs in SoT tables)
  → POLICY (single ordered chain: risk → approval → quota)
  → EXECUTION (domain service only; no tool-local provider calls)
  → PROVIDER
  → VERIFICATION (provider evidence / reconcile)
  → STATE UPDATE (object + external_actions/receipts)
  → AUDIT (receipt + optional audit_logs)
  → NOTIFICATION (canonical event)
  → NEXT ACTION (universalModuleEngine / chase / attention)
```

**Reuse as spine**
1. `tool-registry` + `canonicalToolRegistry`
2. `executionGateway` + `mcp_action_receipts` + `external_actions`
3. Domain services: `sendEmailServer`, `SocialPublishingService`, `businessInvoiceService`, CRM identity resolvers
4. `ToolPolicyGate` + approval center (extend; don’t fork)
5. Bonnie durable runtime + worker
6. `businessEventTaxonomy` + operating event envelope
7. `capabilityManifest` / progressive discovery
8. Department `agentRegistry` + supervisor

**Collapse / stop expanding**
- Direct provider send routes as primary paths
- Doc OS in-memory as product SoT
- `proposals` table / APIs as parallel commercial SoT
- Inline MCP ticket handlers
- New mega-agent frameworks (Eve, etc.) — out of scope for this OS

---

## 11. CAPABILITY REGISTRY DESIGN

**Current state:** Tool catalog ≈ capability registry, with tiers in `capabilityFilter` / `capabilityManifest`, but not a stable dotted capability ID layer (`crm.contact.create`) separate from MCP tool names.

**Target (incremental):** Map existing tools → stable capability IDs without renaming overnight.

| Capability ID | Maps from (examples) | Permission | Risk | Approval | Idempotency | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| `crm.contact.search` | `get_contacts`, `list_contacts` | read | low | none | n/a | n/a |
| `crm.contact.create` | `create_contact` | write | medium | policy | required | row exists |
| `lead.discover` | `find_and_qualify_leads`, research tools | write | medium | assisted default | job key | candidate count |
| `lead.qualify` | qualify tools | write | medium | none/assisted | snapshot key | score persisted |
| `email.compose` | `create_email_draft` | draft | low | none | draft key | draft row |
| `email.send` | `send_email` | external_write | high | assisted/auto by policy | tenant email key | delivery event |
| `social.publish` | `publish_social_post` | external_write | high | assisted | publish key | `verify_social_post_published` |
| `quote.create` / `quote.send` | quote tools | write / external | med/high | policy | quote id + action | status + send receipt |
| `contract.generate` / `send` / `sign` | contract tools + public sign | high for send/sign | strong for money/legal | token/claim | signature events |
| `invoice.create` / `send` / `status` | invoicing tools | high | strong | payment keys | allocation/status |
| `project.create` / `task.create` | project/task tools | write | medium | object id | row state |
| `calendar.book` | booking/calendar tools | write | medium | booking id | booking status |
| `followup.prepare` / `chase.run` | chase-ops | assisted | high bulk | chase instance | attempt log |

Each capability record should eventually carry: input/output schema, required permission, tenant scope, human approval requirement, risk level, idempotency behavior, provider deps, verification method, retry strategy, audit requirements — **backed by** existing `ToolGovernance` / connector meta rather than a new parallel registry file that drifts.

---

## 12. EVENT MODEL

**Keep** `CANONICAL_EVENTS` in `businessEventTaxonomy.ts` as the single vocabulary.

Coverage already includes: lead.*, client.*, deal.*, quote.*, contract.*, invoice.*, project.*, task.*, campaign.*, social.*, booking.*, ticket.*, document.*, integration.*, workflow.*, security.event.

**Gaps to close (wiring, not renaming)**
1. Ensure every domain write emits the matching canonical event (not only UI toasts).
2. Chase/stop hooks already exist on reply/convert/won/signed/paid — extend consistently.
3. Notifications must map only through taxonomy (`mapEventTypeToNotificationType`); retire divergent type enums.
4. Agent/automation triggers should subscribe to canonical events, not scrape UI routes.

---

## 13. AGENT RESPONSIBILITY MATRIX

Map requested agent roles onto **existing** Bonnie department agents + MCP capability sets. Do **not** create parallel agent products.

| Requested agent | Existing home | Primary capabilities | Must not |
| --- | --- | --- | --- |
| Research | research tools + sales/crm agents | research_businesses, account summarize | invent contacts |
| Lead | lead-scraping-ops + CRM | discover→score→dedupe→qualify→create_lead | write unverified emails as truth |
| Sales | sales/crm agents + deals tools | pipeline, next steps, neglected deals | bypass stage policy |
| Outreach | email-ops + outreach + ToolPolicyGate | contextual drafts/sends | blind mass-send |
| Follow-up | chase-ops + Follow-Up surfaces | state watch → prepare → approve → send | generic templates without history |
| Marketing | social-publishing | plan/create/schedule/publish/verify | new social stack |
| Document | document-os + documents-ops | generate from templates + brand | raw HTML as final customer doc |
| Contract | contracts* | generate/send/track/sign | third parallel e-sign SoT |
| Project | projects tools + automation | create from won/signed, tasks, status | ignore `deal_id`/`client_id` |
| Finance | invoicing + accounting | quotes/invoices/status; never move money alone | autonomous payouts |
| Customer success | COO/ops + portal + chase | onboarding, updates, retention signals | separate fake portal objects |

Interactive Bonnie remains the **owner-facing coordinator**; specialists run under supervisor for durable goals.

---

## 14. HUMAN-APPROVAL MATRIX

| Mode | Meaning | Current support |
| --- | --- | --- |
| MANUAL | AI prepares; human executes | Draft tools, Bonnie plan_only |
| ASSISTED | AI prepares; human approves; system executes | ToolPolicyGate + approval APIs + chase approve |
| AUTOMATIC | Explicit tenant policy | capabilityFilter tiers + autonomy modes |
| HIGH-RISK | Always explicit approval | payments, bulk outreach, credential changes, destructive deletes |

**Priority fix:** MCP source auto-allow must remain a *conscious source rule* in the **same** policy chain as Bonnie — not a second silent authority escalator.

High-risk examples already classified in audits: `create_invoice`, bulk lead/email/social, approve_* tools, destructive deletes.

---

## 15. MIGRATION / IMPLEMENTATION PLAN

Work highest leverage first. No greenfield modules.

### P0 — Foundation (do first)
1. **Single policy chain** for MCP + Bonnie + cron actors (ordered evaluators; MCP auto-approve as source attribute).
2. **Route all MCP writes** through `executeMcpWrite` / domain services; remove ticket inline bypass.
3. **Raise idempotency + receipt coverage** on external_write / high_risk tools (inventory showed sparse coverage).
4. **Verification default** for email send + social publish + contract send + invoice send.
5. **One lead promotion path** into `leads` from finder/scraper.
6. **Identity merge enforcement** — contacts ↔ business_clients as required link for commercial actions.

### P1 — Core revenue loop
7. Next-best-action: extend `universalModuleEngine` + chase + attention for lead/deal/client/invoice/contract.
8. Deal won → project create as optional policy (reuse lifecycle coordinator; don’t add a second).
9. Collapse proposal APIs onto `quotes`.
10. Follow-up agent behavior = chase + contextual email drafts (no new follow-up product).

### P2 — Customer lifecycle
11. Document SoT = `documents`; Doc OS becomes engine behind it or deprecated for product writes.
12. Portal consistency: same client/project IDs with permission views.
13. Finance agent surfaces on `business_invoices` only.
14. Notification type enum unification + digest cron registration.

### P3 — Growth
15. Marketing agent content workflows on existing social stack.
16. Analytics warehouse / single metrics service (later).

### Explicit non-goals this cycle
- Do not adopt a new agent framework.
- Do not build ERP modules.
- Do not create “AI versions” of CRM/email/social/invoicing.
- Do not reset/truncate production tables.

---

## 16. REGRESSION TEST PLAN

### Per-capability matrix (required)
For each major capability (email.send, social.publish, invoice.create/send, contract.send/sign, lead.create/promote, quote.send, project.create):

| Axis | Test |
| --- | --- |
| UI | Happy path from dashboard |
| MCP/LLM tool | Same domain service, receipt present |
| Cron/worker | Durable/retry path |
| PWA | Where applicable (notifications, portal) |
| Retry | Timeout ≠ duplicate send |
| Provider timeout | UNKNOWN_EXECUTION_STATE until verified |
| Expired auth | PROVIDER_AUTH_EXPIRED structured |
| Wrong identity/destination | DESTINATION_MISMATCH / IDENTITY_NOT_CONNECTED |
| Wrong tenant | empty/403 — never cross-tenant write |
| Duplicate request | same idempotency key → same receipt |
| Partial provider success | reconcile/verify |
| Verification delay | provider_processing state |
| Permission denied | AUTHZ / POLICY_BLOCKED |

### End-to-end safe tenant scenario
Use a dedicated test tenant (never production customer data):

Find prospect → qualify → CRM → research → prepare outreach → approve → send → record → simulate reply → stage update → book meeting → proposal → follow-up → accept → contract → sign → client/project → portal expose → invoice → payment state → success follow-up.

At each step assert: canonical IDs, tenant scope, audit/receipt, state transition, notification/event, next-best-action, idempotency, verification.

Existing harnesses to extend (not replace): `artifacts/audit/mcp-full-execution-audit*`, unit tests under `tests/unit/mcp-*`, finance integrity scripts.

---

## 17. WHAT SHOULD NOT BE CHANGED

| Keep | Why |
| --- | --- |
| `business_clients` / `contacts` / `leads` / `deals` / `quotes` / `contracts` / `projects` / `tasks` / `business_invoices` / `social_posts` | Live production SoT |
| MCP tool-registry + progressive discovery | External LLM interface |
| `executionGateway` + receipts + `external_actions` | Write audit spine |
| Email gateway + SocialPublishingService | Proven providers |
| Native contract e-sign | Working legal path |
| Bonnie durable runtime + chase | Follow-up / HITL foundations |
| Canonical event taxonomy | Notification/automation vocabulary |
| Tenant membership + RLS direction | Security model |
| Stripe webhook → `recordInvoicePaymentServer` | Payment integrity |
| Railway cron security (`CRON_SECRET`) | Ops boundary |

---

## Priority classification summary

### P0 — launch blockers / security / data integrity / execution reliability
- Multiple execution paths for send email / publish / invoice create-pay
- MCP write idempotency/receipt coverage incomplete
- Policy/HITL divergence (MCP auto vs Bonnie approve)
- Ticket MCP registry bypass
- Lead promotion multi-path
- Verification not default on external writes
- Tenant identity must remain derived from auth context

### P1 — core lifecycle reliability
- Deal won → project optional automation via existing coordinator
- Quotes vs proposals collapse
- Contacts ↔ clients identity consistency
- Next-best-action / chase completeness
- Calendar/portal query fan-out
- Document dual SoT

### P2 — important improvements
- Dashboard shell unification
- Notification enum + digest cron
- Social `scheduled_posts` retirement
- Engine stack clarification vs Bonnie runtime
- Generated DB types

### P3 — future optimization
- Marketing intelligence layer
- Unified analytics warehouse
- Specialist OSS adapters (Documenso/Paperless/etc.) per target architecture — only behind AlphaClone ownership boundary

---

## Immediate next implementation slice (recommended)

After this audit is accepted, implement **one structural change set** only:

1. Policy chain unification (MCP + Bonnie + cron)  
2. Mandatory `executeMcpWrite` for remaining external_write tools + ticket bypass removal  
3. Lead promotion single service into `leads`  

That removes an entire bug class (duplicate sends, silent authority, orphan candidates) without adding features.

---

## Evidence index

- Live DB: Supabase MCP `list_projects` / `execute_sql` / `list_tables` on 2026-10-05  
- Code: `src/lib/mcp/*`, `src/lib/bonnie/*`, `src/lib/events/*`, `src/lib/email/*`, `src/lib/social/*`, `src/services/*`, `src/app/api/**`  
- Prior audits: `artifacts/audit/*`, `docs/architecture/ALPHACLONE_CURRENT_STATE.md`  
- Row counts: `pg_stat_user_tables` approximate live stats (not exact locks)

---

*End of audit. No production schema or data was modified.*
