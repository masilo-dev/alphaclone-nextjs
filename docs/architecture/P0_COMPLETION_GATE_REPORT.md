# P0 Completion Gate Report

**Date:** 2026-10-05  
**Branch:** `cursor/p0-completion-gate-b56b`  
**Scope:** Close P0 execution gaps only — no P1, no new agents/features.

---

## A. P0 exit criteria (PASS/FAIL)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Critical external writes share source-neutral execution guarantees | **PARTIAL → improved** | `executeDomainExternalWrite` (`src/lib/execution/domainExternalWrite.ts`); MCP via `executeMcpWrite` adapter; UI email + invoice + quote policy/receipt path |
| 2 | MCP/UI/Bonnie/cron cannot silently bypass policy for critical actions | **PARTIAL** | UI email/invoice/quote call `guardDomainCapability`; MCP still uses registry guard; cron social/contract paths not fully converged |
| 3 | Important external effects idempotent across surfaces | **PARTIAL** | Shared keys: `invoiceSendIdempotencyKey`, `buildTenantEmailIdempotencyKey`, receipt replay in domain write |
| 4 | Provider timeout does not cause blind duplicate execution | **PASS** (critical gateway paths) | UNKNOWN + receipt/idempotency replay; reconciliation worker does not re-execute |
| 5 | UNKNOWN states actively reconciled | **PASS** (initial loop) | `reconcileUnknownExternalActions` + cron `GET /api/cron/reconcile-external-actions` |
| 6 | LLMs cannot claim VERIFIED from unverified state | **PASS** | Existing `execution_truth` + `llmTruthfulResponse` (unchanged, still enforced on MCP) |
| 7 | Scraper/candidate → CRM uses one promotion boundary | **PARTIAL → improved** | `promoteToCanonicalLead`; `mcp-sync` now promotes (no `create_lead` bypass) |
| 8 | High-risk financial money movement cannot get unsafe MCP auto authority | **PASS** | `FINANCIAL_MONEY_MOVEMENT_TOOLS` + `isFinancialMoneyMovementTool` blocks MCP auto-allow |
| 9 | Tenant identity from authenticated context | **PASS** (wired routes) | `requireTenantAccess`; no LLM tenant override on updated API routes |
| 10 | Legacy bypasses inventoried | **PASS** | `P0_EXTERNAL_WRITE_INVENTORY.md` + deprecated provider route telemetry |

**Overall recommendation:** **P0 NOT COMPLETE** — structural substrate is materially stronger, but social publish/schedule UI, contract send, project create, and several cron/worker paths remain **PARTIAL/BYPASS**. Do **not** start P1 until those are CANONICAL or explicitly accepted as non-critical.

---

## B. Critical-write matrix (top UI actions)

| Action | UI route | Domain command | Policy | Idempotency | Receipt | UNKNOWN | Event | Class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Email send | `/api/email/send` | `executeSendEmailCommand` | yes | domain + header/body | `executeDomainExternalWrite` | gateway | email pipeline | **CANONICAL** |
| Email reply | CRM/email modules | `EmailExecutionService` | MCP guard only | email key | partial | gateway on MCP | partial | **PARTIAL** |
| Social publish | `/api/social/schedule` (publish_now) | inline providers | no | partial | partial | partial | partial | **BYPASS** |
| Social schedule | same | DB + cron | no | partial | partial | cron | partial | **PARTIAL** |
| Invoice create | accounting routes | domain services | partial | partial | partial | — | partial | **PARTIAL** |
| Invoice send | `/api/invoices/send` | `executeInvoiceSendCommand` | yes | `invoiceSendIdempotencyKey` | domain write | queued workflow | workflow | **CANONICAL** |
| Quote send | `/api/quotes/send` | policy + `/api/email/send` | yes | `quoteSendIdempotencyKey` | via email command | via email | quote update | **PARTIAL** |
| Contract send | `/api/contracts/management` | `sendEmailServer` direct | no | no | no | — | partial | **BYPASS** |
| Project create | revenue-lifecycle / MCP | mixed | MCP only | MCP only | partial | — | partial | **PARTIAL** |

Full generated inventory: [`P0_EXTERNAL_WRITE_INVENTORY.md`](./P0_EXTERNAL_WRITE_INVENTORY.md).

---

## C. Remaining bypasses

- Direct provider SDK routes: `/api/brevo/send`, `/api/sendgrid/send`, `/api/resend/send` (deprecated telemetry added).
- `/api/gmail/messages/send` — OAuth adapter, not yet wrapped in domain command.
- `/api/social/schedule` — can publish to Facebook/LinkedIn without `executeDomainExternalWrite`.
- `/api/contracts/management` contract email sends.
- MCPServer legacy switch tools not in registry.
- Native `create_lead` for intentional CRM creates (not acquisition promotion).

---

## D. Cross-surface idempotency test evidence

- Unit: `invoiceSendIdempotencyKey` stable across recipient order (`p0-completion-gate.test.mjs`).
- Unit: email key material matches `buildTenantEmailIdempotencyKey` (`p0-completion-gate.test.mjs`).
- Unit: `findReceiptByIdempotency` in domain write primitive (collision replay contract).
- **Not yet:** live dual-flight UI+MCP integration test against Supabase (requires env).

---

## E. Policy test evidence

- Static: MCP money movement must queue (`isFinancialMoneyMovementTool` in `ToolPolicyGate`).
- Static: UI email/invoice routes invoke `guardDomainCapability` with `executionSource: 'ui'`.
- **Not yet:** automated policy matrix against live tenant rules rows.

---

## F. Financial-risk test evidence

| Action | Effect class | MCP auto-allow when high-risk off |
| --- | --- | --- |
| create_invoice | record-keeping | allowed after evaluation |
| send_invoice | external delivery | send-class + domain command |
| record_payment / refund / payout | **money movement** | **never** MCP auto-allow |
| bulk financial MCP | external | queues when `highRiskRequired` |

---

## G. UNKNOWN reconciliation evidence

- `reconcileUnknownExternalActions` queries `external_actions.status = unknown_execution_state`.
- Email/social evidence checks against `emails` / `social_posts` when `provider_reference` present.
- Cron: `/api/cron/reconcile-external-actions`.
- Does **not** re-invoke provider write APIs.

---

## H. Lead-promotion evidence

- `promoteToCanonicalLead` unchanged canonical boundary.
- `POST /api/internal/leads/mcp-sync` now calls promotion (removed Bonnie `create_lead` bypass).
- Discovery worker + candidate review already on promotion service.

---

## I. Tenant-isolation evidence

- Updated routes use `requireTenantAccess(tenantId, req)` — body `tenantId` cannot bypass session tenant membership.
- **Not yet:** dedicated service-level cross-tenant negative tests with mocks.

---

## J. Database migrations

**None** — uses existing `external_actions`, `mcp_action_receipts`, payload fields for reconciliation metadata.

---

## K. Production-data impact

- No schema change.
- New cron should be scheduled for reconciliation (optional but recommended).
- Deprecated provider routes log warnings only.

---

## L. Test results

```
node --import tsx --test tests/unit/p0-completion-gate.test.mjs tests/unit/p0-execution-substrate.test.mjs
# 18/18 pass
```

---

## M. Remaining P0 blockers

1. Social publish/schedule UI → domain command + `executeDomainExternalWrite`.
2. Contract send → shared command (package-ops / management route).
3. Project create UI → align with MCP `create_project` guard + domain write.
4. Cron/worker email and chase paths → `executionSource: 'cron'` + policy context.
5. Live cross-surface collision tests with mocked providers.
6. Service-level tenant isolation regression tests.

---

## N. Recommendation

**P0 NOT COMPLETE** — proceed with another P0 slice on social/contract/cron convergence before P1.
