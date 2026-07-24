# Alphaclone Systems — AI Policy Statement

**Document owner:** Platform / Compliance  
**Version:** 1.0  
**Effective:** 2026-07-24  
**Frameworks:** ISO/IEC 42001 Clause 5.2 | EU AI Act transparency | NIST AI RMF Govern

## Purpose

This policy defines ethical boundaries, safety goals, and operating principles for Bonnie and all AI connectors (MCP, Claude, ChatGPT, Cursor) on Alphaclone Systems.

## Scope

Applies to all tenants, operators, and external AI clients that invoke Alphaclone tools.

## Principles

1. **Human oversight for high-risk actions** — send, bulk, and financial tools require approval unless autonomous mode is explicitly enabled with Enterprise DPA acceptance.
2. **Fail closed** — if the approval queue or policy evaluation fails, high-risk actions are denied rather than executed unsupervised.
3. **Tenant isolation** — AI agents never cross workspace boundaries; membership is revalidated on every request.
4. **Transparency** — AI-assisted outputs are labeled where customer-facing; legal AI disclaimers are published under `/legal`.
5. **Data minimization** — activity logs must not store full inbound email bodies; marketing sends require consent (`email_opt_in`).
6. **No prohibited uses** — Alphaclone must not be used for Annex III high-risk purposes (biometric ID, credit scoring, employment evaluation) without a dedicated high-risk AIMS program.

## Autonomy tiers

| Mode | Behavior |
|------|----------|
| Observe | Read-only decision support |
| Draft | Draft content; no external send |
| Act with approval (default) | High-risk tools queue to Approval Center / MCP approve tools |
| Autonomous | Allowed only with DPA + runner rules (`auto_send_enabled` and `high_risk_approval_required=false`) |

## Enforcement

- `src/lib/ai/ToolPolicyGate.ts`
- Approval Center + `approve_pending_action` MCP tool
- Enterprise DPA (`dpa_acceptances`)

## Review

This policy is reviewed at least annually or after material AI capability changes.
