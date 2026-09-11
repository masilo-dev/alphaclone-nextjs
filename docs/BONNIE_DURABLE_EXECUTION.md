# Bonnie Durable Execution Foundation

**Date:** 2026-07-24  
**Branch:** `bonnie/durable-execution-foundation-218f`  
**Flag:** `BONNIE_DURABLE_RUNTIME=true`

## Rule

Postgres is the sole source of truth. Queue/outbox payloads only carry IDs (`task_id`, `run_id`, `tenant_id`, `correlation_id`). No critical workflow state may live only in an LLM prompt, browser tab, or process memory.

## Hierarchy

`bonnie_goals` → `agent_runs` → `agent_graphs` / versions → `agent_tasks` → attempts → tool executions / checkpoints  
Plus: outbox, inbox, subscriptions, timers, approvals, interventions, state transitions, reconciliation logs.

## Crons

| Path | Role |
|------|------|
| `/api/cron/bonnie-runtime-worker` | Reclaim leases + claim/execute tasks |
| `/api/cron/bonnie-runtime-outbox` | Deliver outbox (`task.ready` → QUEUED) |
| `/api/cron/bonnie-runtime-reconcile` | Full recovery suite |
| `/api/cron/bonnie-runtime-timers` | Fire durable timers |

Auth: `Authorization: Bearer ${CRON_SECRET}`

## Key mechanics

- **Transactional graph create:** `create_agent_graph_transaction` RPC
- **Atomic claim:** `claim_agent_task` with fencing token + OCC `version`
- **Lease expiry:** abandon attempt → check idempotency → READY or `EXECUTION_UNCERTAIN`
- **Inbox:** persist-first with unique `(tenant_id, provider_event_id)`; wake subscriptions once
- **Approvals:** `agent_approvals` with `data_version`; invalidate if data changed

## Cutover

When `BONNIE_DURABLE_RUNTIME=true`, complex Bonnie missions call `createRunForObjective` instead of only the request-scoped cognitive loop. Workers continue after browser close / redeploy.

When unset/false, legacy cognitive + goal chase paths remain.

## APIs

- `GET/POST /api/bonnie/runtime/runs`
- `GET/PATCH /api/bonnie/runtime/runs/[id]`
- `GET /api/bonnie/runtime/tasks`

## UI

Operations panel → **Durable runs** (`BonnieRuntimePanel`) shows run progress and task graph statuses.

## Rollback

1. Set `BONNIE_DURABLE_RUNTIME=false` (or unset)
2. Disable new crons in Railway
3. Tables can remain (no destructive drop required); optional: drop `agent_*` tables from migration

## Acceptance scenario

Chase overdue invoices → durable run/graph → close browser → worker crash → redeploy → provider timeout after accept → payment/reply events → approval pending → resume without duplicate side effects → user returns to timeline.
