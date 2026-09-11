# Production Stabilization Report

Generated: 2026-09-02

## 1. Root Cause Report

### MCP sessions NULL user_id
- **Symptom:** `null value in column "user_id" of relation "mcp_sessions" violates not-null constraint`
- **Root cause:** Telemetry/outcome paths inserted rows without resolving ownership (`mcpToolTelemetry`, `bonnie-outcomes`, `bonnie/outcomes` API, `mcpStore.updateBusinessAIState`).
- **Affected files:** `src/lib/mcp/mcpToolTelemetry.ts`, `src/lib/mcp/tools/bonnie-outcomes.ts`, `src/app/api/bonnie/outcomes/route.ts`, `src/services/mcp/mcpStore.ts`
- **Affected table:** `mcp_sessions`
- **Fix:** `resolveMcpSessionUserId()` resolves authenticated user → tenant owner/admin → `MCP_SYSTEM_USER_ID`; skips insert if none found.

### mcp_action_receipts.tool missing
- **Symptom:** `column mcp_action_receipts.tool does not exist`
- **Root cause:** `20260808203000_workspace_app_reference_table_compatibility.sql` created a generic stub table via `CREATE TABLE IF NOT EXISTS` before the proper MCP schema migration could apply.
- **Affected files:** `src/lib/mcp/actionReceipts.ts`
- **Affected table:** `mcp_action_receipts`
- **Fix:** Migration `20260902140000_production_stabilization_schema.sql` adds MCP columns; legacy payload fallback retained for pre-migration window.

### agent_event_inbox.run_id missing
- **Symptom:** `column agent_event_inbox.run_id does not exist`
- **Root cause:** `triggerGateway.ts` inserts `run_id` but migration table only had `correlation_id`.
- **Affected files:** `src/lib/bonnie/runtime/triggerGateway.ts`
- **Affected table:** `agent_event_inbox`
- **Fix:** Migration adds nullable `run_id` + `deduplication_key` columns.

### media_assets.deleted_at missing
- **Symptom:** Media proxy 404 / Facebook publish failures
- **Root cause:** Proxy queried nonexistent `deleted_at` on `media_assets` (prior PR removed this).
- **Affected files:** `src/lib/media/fetchMediaAssetBytes.ts`, `src/app/api/media/[assetId]/route.ts`
- **Fix:** Query uses only existing columns; no soft-delete filter on `media_assets`.

### tenants.legal_name missing
- **Symptom:** Supabase 400 on tenant branding load
- **Root cause:** `tenantEmailBranding.ts` selected `legal_name` column that does not exist in production (`name` + `settings.branding` are canonical).
- **Affected files:** `src/lib/email/tenantEmailBranding.ts`
- **Fix:** Removed column from select; use `settings.branding.legalBusinessName`.

### audit_logs severity check violation
- **Symptom:** `audit_logs_severity_check` constraint failures
- **Root cause:** Writers used `low`/`medium`/`high`; DB allows `info`/`warning`/`error`/`critical`.
- **Affected files:** `src/lib/audit/businessAuditEngine.ts`, `src/services/auditLogService.ts`
- **Fix:** Central `normalizeAuditSeverity()` / `auditSeverityFromStatus()`.

### tenant_usage_events duplicate operation_id
- **Symptom:** `tenant_usage_events_operation_id_unique` violations on retry
- **Root cause:** Race between SELECT-then-INSERT in `record_metered_usage_idempotent`; direct inserts in `recordUsageEvent` not idempotent.
- **Affected files:** `src/lib/email/usageMeteringService.ts`, `supabase/migrations/20260826210000_usage_metering_architecture.sql`
- **Fix:** RPC uses `ON CONFLICT DO NOTHING`; app layer swallows duplicate key on usage events.

### Overlapping cron / memory pressure
- **Symptom:** 80–125s cron requests, heap OOM at ~1.5GB (pre-6GB bump)
- **Root cause:** Many heavy crons fire on same minute; no distributed singleton locks; unbounded batch sizes.
- **Fix:** Redis/in-process cron locks, 25s job budget, staggered schedules, reduced batch sizes, memory guard integration.

---

## 2. Changes Made

### Code
- `src/lib/mcp/resolveMcpSessionUserId.ts` (new)
- `src/lib/audit/auditSeverity.ts` (new)
- `src/lib/cron/distributedLock.ts` (new)
- `src/lib/cron/withCronJob.ts` (new)
- MCP session inserts, audit severity, usage idempotency, tenant branding, auth refresh handling
- Cron routes: worker, outbox, timers, reconcile, process-events, mcp-queue, scheduled-ai, social-publish
- Readiness lightweight DB mode (`READINESS_LIGHT_DB`, default in production)
- Memory telemetry RSS thresholds
- `railway.crons.json` staggered schedules
- `package.json`: `@react-email/render`, `npm run worker`

### Migration
- `supabase/migrations/20260902140000_production_stabilization_schema.sql`

### Tests
- `tests/unit/production-stabilization.test.mjs` (13 tests, all passing)

---

## 3. Memory Findings

| Component | Risk | Mitigation |
|-----------|------|------------|
| Overlapping crons | High | Distributed locks + staggered schedules |
| MCP queue batch | Medium | MAX 10 events/run + 25s budget |
| Outbox/timers batches | Medium | Reduced from 80 → 40 |
| Bonnie worker in web process | High | `npm run worker` entry exists; deploy separately when ready |
| Heap telemetry | Low | RSS + heap % warnings at 60/75/85% |
| 6GB heap setting | Emergency only | Target steady-state well below limit |

Existing safeguards retained: `cronMemoryGuard`, `processGuards` SIGTERM drain, `mapWithConcurrency`.

---

## 4. Database Schema Drift

| Table | Code expected | Production had | Resolution |
|-------|---------------|----------------|------------|
| mcp_action_receipts | tool, idempotency_key, … | Generic stub columns | Additive migration |
| agent_event_inbox | run_id | correlation_id only | Add run_id column |
| mcp_sessions | user_id NOT NULL | NOT NULL | Resolve before insert |
| tenants | legal_name | name + settings | Code uses settings |
| audit_logs.severity | low/medium/high | info/warning/error/critical | Normalize centrally |
| media_assets | no deleted_at | no deleted_at | Code fixed (no migration) |

---

## 5. Cron Map

| Job | Cadence (new) | Budget | Lock | Batch | Move to worker? |
|-----|---------------|--------|------|-------|-----------------|
| bonnie-runtime-outbox | */1 | 25s | yes | 40 | yes |
| bonnie-runtime-timers | 1-59/2 | 25s | yes | 40 | yes |
| bonnie-runtime-worker | 0-58/2 | 25s | yes | 12 tasks | yes |
| bonnie-runtime-reconcile | 3-58/5 | 45s | yes (300s TTL) | full reconcile | yes |
| process-mcp-event-queue | 2-59/3 | 25s | yes | 10 | yes |
| process-events | 2-57/5 | 25s | yes | bounded fetch | partial |
| process-scheduled-ai-tasks | 1-56/5 | 25s | yes | executor-defined | yes |
| social-publish | 4-59/5 | 25s | yes | cronPublish | yes |

---

## 6. Test Results

```
tests/unit/production-stabilization.test.mjs: 13/13 passed
```

---

## 7. Remaining Risks

- Redis not configured → in-process locks only protect single replica (documented fallback).
- `20260902140000` migration must be applied to production Supabase before full MCP receipt recovery.
- Heavy workflows still run in web process via `process-events`; further extraction to worker service recommended.
- Playwright lifecycle audit not fully re-run in this pass (existing `browserManager.ts` uses per-call sessions).

---

## 8. Railway Deployment Checklist

- [ ] Apply Supabase migration (see §9)
- [ ] Confirm `UPSTASH_REDIS_REST_URL` + token set for distributed locks
- [ ] Keep `NODE_OPTIONS=--max-old-space-size=6144` as headroom, not target
- [ ] Set `READINESS_LIGHT_DB=1` (default in production code path)
- [ ] Deploy and verify `/api/readiness` responds <100ms
- [ ] Monitor `[memory]` logs for RSS/heap warnings
- [ ] Verify cron 204 responses for `already_running` (expected, not errors)
- [ ] Retry Facebook publish after media proxy deploy

---

## 9. Supabase Migration Checklist

```bash
npx supabase db push
# or apply 20260902140000_production_stabilization_schema.sql via dashboard
```

Verify:
- `mcp_action_receipts.tool` exists
- `agent_event_inbox.run_id` exists
- `record_metered_usage_idempotent` updated

---

## 10. Safe Rollback Steps

1. Set `DISABLE_CRON_DISTRIBUTED_LOCK=true` to disable locking (restores overlap risk).
2. Set `DISABLE_CRON_MEMORY_GUARD=true` if cron deferrals are too aggressive.
3. Migration is additive-only — rollback code without dropping columns is safe.
4. Revert readiness change: set `READINESS_LIGHT_DB=false` to re-enable DB ping.
