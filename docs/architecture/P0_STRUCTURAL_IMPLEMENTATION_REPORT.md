# P0 Structural Implementation — Completion Report

**Date:** 2026-10-05  
**Branch:** `cursor/p0-structural-implementation-b56b` (or continuation of audit branch)  
**Scope:** Structural execution substrate only — no new agents/modules/frameworks.

---

## 1. ROOT CAUSES REMOVED

| Failure class | Structural fix |
| --- | --- |
| MCP silent policy bypass | `ToolPolicyGate` no longer early-returns for `source=mcp`; MCP auto-allow is explicit (`mcp_connector_auto_allow`, `approvalState: mcp_auto_allowed`) after full evaluation |
| Duplicate policy evaluators on MCP path | Removed pre-registry policy block from `MCPServer`; unified guard in `executeTool` |
| Ticket MCP inline SQL bypass | Removed ~230 lines from `/api/mcp/route.ts`; tickets flow through registry + gateway |
| Multiple lead promotion paths | `promoteToCanonicalLead` service; review API + discovery worker auto-accept use it |
| LLM completion hallucination | `execution_truth` envelope on registry tool JSON responses |
| Ambiguous timeout outcomes | Gateway maps to `unknown_execution_state` / `UNKNOWN_EXECUTION_STATE` vocabulary |

---

## 2. EXECUTION PATH BEFORE / AFTER

**Before (MCP write):**
`POST /api/mcp` → optional inline ticket SQL **or** `executeTool` (no policy) **or** MCPServer (policy then executeTool again)

**After:**
`POST /api/mcp` → `executeTool(..., { executionSource: 'mcp' })` → `guardToolExecution` (policy + idempotency) → tool handler → `execution_truth` enrichment

**Before (Bonnie):**
`evaluateToolPolicy` → `executeTool` (no skip) → **double evaluation risk**

**After:**
`evaluateToolPolicy` → `executeTool(..., { skipPolicyEvaluation: true, executionSource: bonnie })`

**Before (lead candidate accept):**
Route-local upsert into `leads`

**After:**
`promoteToCanonicalLead` → `executeMcpWrite` → `leads` upsert + event + candidate link

---

## 3. POLICY CONVERGENCE

Single evaluator: **`evaluateToolPolicy`** (`ToolPolicyGate.ts`)

| Source | Behavior |
| --- | --- |
| `mcp` | Full tenant/mode/readiness evaluation; auto-allow with explicit attribute unless high-risk financial/bulk + tenant requires approval |
| `bonnie` | Same evaluator; queues approvals for send/bulk/financial per workspace mode |
| `cron` / `ui` / `playbook` | Supported source types for future callers; use same function |

Entry points:
- MCP: `tool-registry.executeTool` with `executionSource: 'mcp'`
- Bonnie: `executeSingleBonnieTool` then `executeTool` with skip flag
- MCPServer registry path: passes `executionSource: 'mcp'`

---

## 4. WRITE COVERAGE (gateway + policy)

**Now behind `executeMcpWrite` + registry policy (tickets):**
- `create_ticket`, `update_ticket`, `escalate_ticket` (tickets-ops)
- Lead promotion (`promoteToCanonicalLead` / internal tool name `promote_lead_candidate`)
- Existing: `send_email`, `publish_social_post` (unchanged paths, already gateway-backed)

**Remaining bypasses (explicit — not hidden):**
- UI API routes (`/api/email/send`, `/api/invoices/*`, etc.) — shared domain services but not yet wrapped by `executeTool` guard
- Direct provider routes (`/api/brevo/send`, etc.)
- `create_lead` / CRM writes via `insertLeadCompat` without promotion service (intentional CRM-native creates; **candidate/scraper promotion** is canonicalized)
- Doc OS in-memory writes
- MCPServer legacy switch cases for non-registry tools
- Cron jobs invoking services directly

---

## 5. IDEMPOTENCY COVERAGE

**Required at registry guard (`idempotency_key`) for:**
`send_email`, `reply_to_email`, Microsoft/Gmail send aliases, social publish/create post tools, invoice send/create, quote send, contract send/create, `create_project`, `promote_lead_candidate`

**Lead promotion:** deterministic keys `lead-promote:{kind}:{id}` and review route `lead-candidate-review:{tenant}:{candidate}`

**Protected via gateway receipt replay:** all `executeMcpWrite` callers with supplied keys

**Still unprotected:** many medium-risk MCP writes (draft CRM updates), UI forms without keys

---

## 6. VERIFICATION COVERAGE

| Capability | State |
| --- | --- |
| Social publish | Verified + reconcile crons (existing) |
| Email send | Durable queue + verification service (existing); gateway UNKNOWN on timeout |
| Invoice/contract send | Durable routers (existing) |
| Ticket writes | Receipt `status: verified` on DB success |
| Lead promotion | Receipt + tenant event `VERIFIED` |
| LLM responses | `execution_truth.verification_state` — must not claim completion unless `VERIFIED` |

---

## 7. LEAD PROMOTION

**Canonical service:** `src/services/leads/canonicalLeadPromotion.ts`

**Callers updated:**
- `POST /api/leads/candidates/[id]/review` (accept)
- `lead-discovery-worker` auto-accept sync

**Old paths (still exist for other flows — next slice):**
- `insertLeadCompat` / MCP `create_lead` for native CRM creates
- Scraper rows without explicit promotion call (staging only until promoted)
- Webhooks / forms direct `leads.insert`

**Handoff invariant:** acquisition tables remain staging; **promotion service** is the only path from `lead_candidates` → `leads` in updated flows.

---

## 8. DATABASE CHANGES

**No migrations in this slice.** Reused `external_actions`, `mcp_action_receipts`, `leads`, `lead_candidates`, `tickets`.

**No production data destroyed or truncated.**

---

## 9. TEST RESULTS

Added: `tests/unit/p0-execution-substrate.test.mjs` (policy source parity, guard wiring, ticket bypass removal, lead promotion service, execution states, LLM truth gate).

Run: `node --import tsx --test tests/unit/p0-execution-substrate.test.mjs`

---

## 10. REMAINING P0 RISKS

1. UI/API routes still bypass `executeTool` guard (service-level sharing only)
2. Not all external_write MCP tools use `executeMcpWrite` yet
3. `create_lead` MCP path not routed through promotion service (by design for native CRM — document clearly)
4. Scraper → CRM promotion not fully wired except via worker auto-accept
5. Financial MCP bulk may still auto-allow when tenant disables high_risk_approval — verify tenant settings in production

---

## 11. NEXT RECOMMENDED STRUCTURAL SLICE (P0 continuation — do not start P1 features)

1. Wrap top UI write APIs with the same `guardToolExecution` + gateway pattern (email send, invoice send, social schedule)
2. Extend `executeMcpWrite` coverage to remaining external_write tools in registry audit list
3. Wire scraper promotion entrypoint to `promoteToCanonicalLead`
4. Add reconciliation cron hook for `unknown_execution_state` rows in `external_actions`

---

*Implementation evidence: see git diff on this branch.*
