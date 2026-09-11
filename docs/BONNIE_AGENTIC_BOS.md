# Bonnie Agentic Business Operating System

**Deploy target: Railway only** (no Vercel).  
**Authoritative runtime:** PostgreSQL `agent_*` tables + Railway crons + optional `bonnie-worker` service.  
**Flag:** `BONNIE_DURABLE_RUNTIME=true`

## What shipped in this pass

- Audit: `docs/BONNIE_AGENTIC_BOS_AUDIT.md`
- Railway env example: `docs/bonnie.railway.env.example`
- Long-running worker: `src/bonnie/worker.ts` (`npm run bonnie:worker`)
- Zod runtime schemas, verification service, chasing policies
- Invoice collection workflow template (`workflowTemplate: "invoice_collection"`)
- Migration: `supabase/migrations/20260724180000_bonnie_agentic_bos_extensions.sql`
- Workspace views: Chat / Plan / Task Graph / Activity / Approvals / Interventions / Audit / Results

## Railway services

| Service | Command / path | Role |
|---------|----------------|------|
| `alphaclone-web` | `npm run start` | Next.js UI + APIs |
| Cron jobs | `railway.crons.json` | Worker / outbox / reconcile / timers |
| `bonnie-worker` (optional) | `npm run bonnie:worker` | Continuous poller for durable tasks |

Do **not** embed the worker inside a serverless request lifecycle as the only runner. Prefer Railway cron + dedicated worker service.

### Create `bonnie-worker` on Railway

1. Duplicate/add a service from the same repo
2. Start command: `npm run bonnie:worker`
3. Copy env from web service (especially Supabase + `BONNIE_DURABLE_RUNTIME=true`)
4. Health: process logs `[bonnie-worker] starting on Railway`

## Apply migrations

```bash
npm run migrate
# or: npx supabase db push
```

Additive tables: `agent_verifications`, `agent_chasing_policies`, `agent_runtime_limits`.

## API

```http
POST /api/bonnie/runtime/runs
{
  "tenantId": "...",
  "objective": "Chase unpaid invoices…",
  "workflowTemplate": "invoice_collection"
}
```

Generic objectives omit `workflowTemplate` (or use `"generic"`).

## Rollback

1. Set `BONNIE_DURABLE_RUNTIME=false` on Railway web + worker
2. Stop `bonnie-worker` service / disable new crons if needed
3. Keep tables (non-destructive); UI views still render empty runs

## Known limitations

- Specialist tool stages in the durable worker still use **simulated** side effects (`bonnie_runtime` provider refs) until wired through `ToolPolicyGate` + real providers per task type
- Supabase MCP auth was unavailable in this agent environment; apply migration via `supabase db push` / Railway deploy pipeline
- Temporal / BullMQ / LangGraph / OPA / full OTEL intentionally **not** installed (see audit)
- Full chaos/e2e against live Temporal is N/A; use Railway redeploy + duplicate webhook tests against inbox uniqueness

## Acceptance (durable PG runtime)

With flag on: create invoice collection run → close browser → worker/cron continues → approvals pause side effects → timers advance chase → payment event wakes subscription → verification marks outcome → no duplicate idempotent sends.
