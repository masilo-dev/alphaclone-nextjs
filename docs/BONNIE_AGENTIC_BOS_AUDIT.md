# Bonnie Agentic BOS — Implementation Audit

**Date:** 2026-07-24  
**Branch:** `bonnie/agentic-bos-master-impl-218f`

## Existing architecture

- **App:** Next.js 16 / React 19 / TypeScript on **Railway** (`alphaclone-nextjs`)
- **DB:** Supabase Postgres (multi-tenant RLS)
- **AI:** AI SDK package `ai` ^6 + Zod ^4 (model streaming only — not the workflow engine)
- **Package manager:** npm
- **Tests:** `node --import tsx --test` unit tests; Playwright e2e present
- **Crons:** Railway `railway.crons.json` + Bearer `CRON_SECRET`

## Existing Bonnie (reuse)

| Layer | Location |
|-------|----------|
| Chat workspace shell | `src/components/dashboard/bonnie/*` |
| Conversations | `bonnie_conversations` / messages APIs |
| Goals | `bonnie_goals` + `goalEngine.ts` |
| Durable runtime | `src/lib/bonnie/runtime/*` (`agent_runs`, tasks, outbox/inbox, leases, checkpoints) |
| Agents | `agentRegistry.ts` / supervisor |
| Tool policy + approvals | `ToolPolicyGate`, `autonomous_runner_approvals` |
| Events | `business_automation_events` → `process-events` |
| Short domain workflows | `src/workflows/*` via `workflow` package (legacy short flows) |

## Selected durable runtime

**Authoritative engine: PostgreSQL-backed Bonnie Durable Runtime + Railway worker/cron processes.**

Rejected as competing orchestration systems:

| Candidate | Decision | Why |
|-----------|----------|-----|
| Temporal | **Rejected for this environment** | No Temporal cluster/ops in Railway today; would be a second source of truth next to the shipped `agent_*` runtime |
| BullMQ / Redis jobs | **Rejected as workflow truth** | Redis is optional (`REDIS_REQUIRED`); Upstash used for cache/rate-limit only |
| LangGraph | **Rejected as business runtime** | Would duplicate planner/executor; planning stays in `plannerService` |
| OPA | **Deferred** | Existing ToolPolicyGate + RLS + `requireTenantAccess` cover sensitive actions; fail-closed path already exists |
| OpenTelemetry full SDK | **Deferred** | Add correlation IDs + metrics tables first; avoid large OTEL install without collector |
| `workflow` (WDK) as Bonnie goal engine | **Not expanded** | Deploy is Railway; Bonnie goals use PG durable runtime + Railway crons/worker |

## Dependencies to add

**None required for this implementation pass.** Reuse: `zod`, `ai`, `tsx`, existing Supabase admin client, `date-fns`.

## Dependencies rejected

Temporal SDK, BullMQ, ioredis (as broker), LangGraph, OPA, full OTEL stack, vitest (repo uses node:test), decimal.js (no new money math in this pass).

## Database changes (this branch)

- Migration: chasing policies + verifications + runtime limits (additive)
- pgvector: only enable if extension available; memory embeddings table optional stub

## Security risks addressed

- Model never authorizes; ToolPolicyGate + durable approvals remain
- Tenant from trusted server records only
- Idempotency + `EXECUTION_UNCERTAIN` for ambiguous side effects
- Feature flag `BONNIE_DURABLE_RUNTIME`

## Deployment changes

- Railway cron paths already registered for durable runtime
- New long-running optional service script: `bonnie:worker` (polls durable queue on Railway)
- Docs use **Railway only** (no alternate cloud PaaS deploy instructions)

## Implementation sequence (this PR)

1. Audit doc (this file)
2. Env validation + Railway worker entrypoint
3. Verification + chasing + invoice collection workflow template + Zod schemas
4. Full Bonnie view switcher (Chat/Plan/Graph/Activity/Approvals/Interventions/Audit)
5. Tests + docs + PR
