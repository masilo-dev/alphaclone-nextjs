# Bonnie AI — System Documentation

AlphaClone Systems LLC | Internal | Version 1.0 | 2026

Bonnie is AlphaClone's fully autonomous, resident AI agent — built into the platform dashboard. He executes real business work end-to-end across CRM, invoicing, contracts, campaigns, social, WhatsApp, and automation modules.

**Core stack:** DeepSeek API (primary), MCP tool registry (`/api/mcp`), Supabase backend, Vercel deployment, policy-gated execution via `business_ai_state`.

For the full product narrative (modules A–Z, lead-to-cash flows, Nexus intelligence, roadmap), see the internal Bonnie AI v1.0 document. This file tracks **implementation status** in the codebase.

---

## Implementation Status Appendix

| Section | Doc claim | Code path | Status |
|---------|-----------|-----------|--------|
| Agent loop | ReAct plan → act → observe | `src/lib/bonnie/bonnieAgent.ts` | Implemented (8 rounds default, parallel tools, complex-mission routing) |
| MCP tools | 200+ tools | `src/lib/mcp/listAllTools.ts` `getUnifiedMcpTools()` | **Implemented (this release)** — registry + manifest + supplemental unified catalog |
| `business_ai_state` | Tenant audit posture | `src/services/mcp/mcpStore.ts`, `business-state.ts` | Implemented |
| `nexus_memory` | Persistent tenant facts | `src/services/nexusMemoryService.ts`, migration `20260627150000` | **Implemented (this release)** |
| `nexus_decision_log` | AI decision trace | `src/services/nexusDecisionLogService.ts` | **Implemented (this release)** |
| Bonnie Dreaming | Pattern extraction + memory merge | `bonnie-dream.ts`, `mergeDreamSession()` | **Implemented — dream approval now writes nexus_memory** |
| Approval cards in chat | Inline Approve/Edit/Cancel | `BonnieApprovalCard.tsx`, `BonnieChatPanel.tsx` | **Implemented (this release)** |
| Chief of Staff | Daily autonomous routine | `MCPServer.ts` `run_chief_of_staff_routine` | Implemented |
| `orchestrate_task` | Multi-agent gather → plan → execute | `bonnie-orchestrate.ts`, `nexus_orchestration_runs` | **Upgraded (this release)** |
| Module dock | Context-aware side panel on module pages | `ModulePageLayout` `showBonnieDock` + `BonnieModuleDock` | **Implemented** — CRM, Deals, Invoices, Tasks |
| Autopilot mode | Chief of Staff on demand | `bonnieAgent.ts` `runAutopilotMode` | **Implemented (this release)** |
| Durable workflows | Multi-step Vercel Workflow | `src/workflows/mcp-agent.ts` | **Expanded (this release)** |
| Voice interface | LiveKit + STT/TTS | `POST /api/bonnie/voice` + Grok intent parse | **Implemented** — Grok voice agent pipeline |
| Platform moat doc | 5-year defensibility | `docs/BONNIE_PLATFORM_MOAT.md` | **Published** |
| Full module catalog | All dashboard modules | `bonnieToolCatalog.ts` + platform custom tools | **Expanded** |
| Trust ledger | Audit evidence | `platform-advantage.ts` `trust_ledger` | **Enhanced with decision_log** |

---

## Key API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/bonnie/instruct` | Non-streaming agent chat |
| `POST /api/bonnie/stream` | SSE streaming chat |
| `GET /api/bonnie/approvals` | Pending Bonnie-scoped approvals |
| `PATCH /api/bonnie/approvals` | Edit approval payload before approve |
| `POST /api/autonomous/approve` | Approve/reject and resume tool |
| `POST /api/bonnie/voice` | Grok voice command → full agent execution |
| `POST /api/mcp` | MCP JSON-RPC tool server |

---

## Database Tables (Bonnie-related)

| Table | Purpose |
|-------|---------|
| `nexus_memory` | Persistent tenant memory facts |
| `nexus_decision_log` | Per-tool decision audit trail |
| `nexus_orchestration_runs` | Multi-agent orchestration history |
| `bonnie_dream_sessions` | Dreaming session patterns |
| `autonomous_runner_approvals` | High-risk action approval queue |
| `mcp_sessions` | Tool execution + business_ai_state metadata |

---

## Conversation Modes

| Mode | Trigger phrases | Behavior |
|------|-----------------|----------|
| Briefing | "brief me", "what needs attention" | Runs `solo_owner_operator_brief` + `get_business_snapshot` |
| Autopilot | "chief of staff", "autopilot" | Runs `run_chief_of_staff_routine` |
| Instruction | Default | Full DeepSeek tool loop |
| Query | Short data questions | Warm context + tool loop |

---

## Safety Model

Risk classes: `read`, `draft`, `send`, `bulk`, `financial` — enforced in `src/lib/ai/ToolPolicyGate.ts`.

Agent modes: `observe` → `draft` → `act_with_approval` (default) → `autonomous`.

High-risk tools queue to `autonomous_runner_approvals` and surface inline in Bonnie chat via `BonnieApprovalCard`. Meta orchestration tools (`orchestrate_task`, Chief of Staff) run without send-level friction.

---

## Verification Checklist

- [ ] Dream approval writes rows to `nexus_memory` and updates `business_ai_state.memory_summary`
- [ ] High-risk Bonnie tool call surfaces inline approval card; approve executes via `resumeApprovedTool`
- [ ] `trust_ledger` returns entries from `nexus_decision_log`
- [ ] `orchestrate_task` runs parallel subagents, plans actions, executes with policy gate
- [ ] "Brief me" returns executive summary without navigating to AI Agents tab
- [ ] `GET /api/mcp` and MCP `tools/list` return 200+ tools from `getUnifiedMcpTools()`
