# Bonnie AI — System Documentation

AlphaClone Systems LLC | Internal | Version 3.0 | 2026

Bonnie is AlphaClone's fully autonomous AI Chief of Staff — built into the platform dashboard and exposed via MCP at `/api/mcp`. He executes real business work end-to-end across all 25 platform modules.

**Constitution:** [BONNIE_MASTER_TRAINING_v3.md](./BONNIE_MASTER_TRAINING_v3.md) — platform-wide agent guidelines (v3.0, all 25 modules). All prompts, sanitizer rules, and quality gates trace to this document.

**Core stack:** DeepSeek API (primary), Claude fallback (high-stakes), MCP tool registry (`/api/mcp`), Supabase backend, Vercel deployment, policy-gated execution via `business_ai_state`.

---

## v3.0 Implementation Map

| v3.0 spec | Code path | Status |
|-----------|-----------|--------|
| Part 7 system prompt | `src/lib/bonnie/bonnieCorePrompt.ts` | **Aligned v3.0** |
| Agent system prompt | `src/lib/bonnie/bonnieSystemPrompt.ts` | **Aligned v3.0** |
| Conversational prompt | `src/lib/bonnie/bonnieConversationalPrompt.ts` | **Aligned v3.0** |
| `BONNIE_BANNED_LANGUAGE` (expanded) | `src/lib/bonnie/bonnieBannedLanguage.ts` | **Updated v3.0** |
| `campaignQualityCheck()` (`passed` ≥ 80) | `bonnieBannedLanguage.ts` | **Updated v3.0** |
| `sanitizePost()` | `bonnieBannedLanguage.ts` → `sanitizePostContent.ts` | **Implemented** |
| Response sanitizer (rules 11–12) | `src/lib/bonnie/bonnieResponseSanitizer.ts` | **Updated v3.0** |
| `BonnieError` + `invoice_send_failed` | `src/lib/bonnie/bonnieError.ts` | **Updated v3.0** |
| Email outbound sanitization | `src/lib/email/sendEmail.ts` | Implemented |
| Campaign send quality gate | `sendScheduledCampaignServer.ts`, `MCPServer.ts` | Implemented |
| WhatsApp sanitization | `src/lib/whatsapp/sendWhatsApp.ts` | Implemented |
| ReAct agent loop | `src/lib/bonnie/bonnieAgent.ts` | Implemented |
| Chief of Staff routine | `MCPServer.ts` `run_chief_of_staff_routine` | Implemented |
| Bonnie Dreaming | `bonnie-dream.ts`, `nexusMemoryService.ts` | Implemented |
| Approval cards | `BonnieApprovalCard.tsx` | Implemented |

---

## 25 Modules (v3.0 coverage)

CRM · Invoicing · Contracts · Projects · Accounting · Quotes · Social · Email/Campaigns · WhatsApp · Zoho Mail · Calendar · Microsoft 365 · Video · Ticketing · Document Hub · Inventory · Gamification · Client Portal · Lead Finder · Reporting/BI · Notifications · Dashboard · Onboarding · Memory · Automation

Full module specs, tool lists, and lifecycle rules: [BONNIE_MASTER_TRAINING_v3.md](./BONNIE_MASTER_TRAINING_v3.md) Part 3.

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

## Quality Gate Behavior

| Score | Action |
|-------|--------|
| < 60 | Block campaign send; Bonnie must rewrite first |
| 60–79 | Send with `language_warnings` logged |
| ≥ 80 | Send clean (`passed: true`) |

Campaign checks run in `create_bulk_email_campaign` (publish_now), `queue_email_campaign_send`, and `sendScheduledCampaignServer`.

---

## Safety Model

Risk classes: `read`, `draft`, `send`, `bulk`, `financial` — enforced in `src/lib/ai/ToolPolicyGate.ts`.

Agent modes: `observe` → `draft` → `act_with_approval` (default) → `autonomous`.

High-risk tools queue to `autonomous_runner_approvals` and surface inline in Bonnie chat via `BonnieApprovalCard`.

---

## Related Docs

- [BONNIE_MASTER_TRAINING_v3.md](./BONNIE_MASTER_TRAINING_v3.md) — full operating constitution (25 modules)
- [BONNIE_MASTER_TRAINING_v2.md](./BONNIE_MASTER_TRAINING_v2.md) — superseded by v3.0
- [BONNIE_PLATFORM_MOAT.md](./BONNIE_PLATFORM_MOAT.md) — product defensibility narrative
