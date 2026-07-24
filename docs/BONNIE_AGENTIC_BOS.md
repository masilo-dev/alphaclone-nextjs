# Bonnie Agentic Business Operating System

**Date:** 2026-07-24  
**Branch:** `bonnie/agentic-bos-goals-engine-218f`

Bonnie is no longer framed as a chatbot. It is the Agentic Business Operating System for Alphaclone Systems: goal-driven, multi-agent, event-woken, approval-gated, and multi-tenant.

---

## Architecture

```text
User objective / platform event
        │
        ▼
┌───────────────────┐
│  Executive / COO  │  plan + coordinate
│  + Supervisor     │
└─────────┬─────────┘
          │ selects specialists
          ▼
┌─────────────────────────────────────────────┐
│ CRM · Finance · Accounting · Documents ·    │
│ Contracts · Email · Calendar · Marketing ·  │
│ Social · Support · Reporting · Compliance · │
│ Security · Workflow · Knowledge · Memory ·  │
│ Research · Integration · Notification ·     │
│ Monitoring · Audit · Evaluation             │
└─────────┬───────────────────────────────────┘
          │
          ▼
 Persistent Goal (bonnie_goals + subtasks)
          │
          ├── Cognitive loop (Observe→Learn)
          ├── Approval gates (high-risk tools)
          ├── Event wake (invoice_paid, …)
          └── Goal chase cron (resume / complete)
```

---

## Persistent goals

Tables:

- `bonnie_goals` — title, owner, tenant, priority, progress, blockers, waiting_for, execution_mode, linked conversation/workflow/run
- `bonnie_goal_subtasks` — agent-assigned steps with tools, approval links, results

Goals survive refresh, logout, and deploy. Cognitive runs attach via `goal_id`.

### APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/bonnie/goals?tenantId=` | List open goals |
| POST | `/api/bonnie/goals` | Create (cognitive) or `action: chase` |
| GET | `/api/bonnie/goals/[id]?tenantId=` | Goal + subtasks |
| PATCH | `/api/bonnie/goals/[id]` | cancel / resume / chase / status |
| GET | `/api/bonnie/os?tenantId=` | Agents + open goals + twin |

### Crons

- `/api/cron/bonnie-goals-chase` every 10m — resume open goals
- `/api/cron/bonnie-continuous` — twin + KG + light chase
- Existing `process-events` — wakes goals via `wakeGoalsForEvent`

Auth: `Authorization: Bearer ${CRON_SECRET}`

---

## Agent contract

Each specialist exposes:

- capabilities
- permissions (`writeAllowed` + `supportedModes`)
- required tools / supported actions
- confidence prior
- health status

Execution modes: `ask_only` · `plan_only` · `approval_required` · `semi_autonomous` · `fully_autonomous`

High-risk actions (payments, deletions, external email, social publish, contract changes, permission updates, financial exports, compliance) always require a human approval card.

---

## Reasoning loop

Before important actions Bonnie runs:

1. Understand objective  
2. Gather context  
3. Search related records  
4. Check permissions  
5. Evaluate risks  
6. Create execution plan  
7. Predict outcome  
8. Execute  
9. Verify result  
10. Learn / update memory  

Implemented as the cognitive stages in `src/lib/bonnie/os/cognitiveLoop.ts`.

---

## What this PR delivers vs full COO vision

**Shipped now**

- Persistent goals + subtasks schema and engine
- Enriched multi-agent registry (28 specialists including Contracts, Integration, Notification, Monitoring)
- Event wake map expansion
- Goal chase API + cron
- Goals panel in Bonnie workspace Operations sidebar
- Complex missions create/chase persistent goals

**Still phased**

- Full rollback / checkpoint recovery UX
- Per-module “Ask Bonnie” goal surfaces everywhere
- Rich learning memory across all preference dimensions
- Fully autonomous mode only after explicit low-risk allowlists per tenant

---

## Example

User: “Recover overdue payments.”

Bonnie:

1. Creates a persistent goal  
2. Routes Finance + Accounting + Email + CRM  
3. Plans AR recovery steps  
4. Queues reminder drafts for approval  
5. After approval / payment events, wakes and continues  
6. Reports progress in the Operations goals panel  
