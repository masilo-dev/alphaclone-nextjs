# Bonnie AI — 5-Year Platform Moat

AlphaClone is not a chatbot wrapper. It is a **Business OS with a resident agent** — Bonnie — that executes real work across your tenant data, integrations, and workflows.

This document explains why AlphaClone stays defensible even as Claude, Grok, ChatGPT, and future models improve.

---

## The moat (why models alone cannot replace us)

| Layer | What it is | Why external AI cannot copy it |
|-------|------------|--------------------------------|
| **Tenant data plane** | CRM, deals, invoices, leads, tickets, campaigns — scoped by RLS | Models have no access to your live business DB |
| **200+ MCP tools** | Real execution, not simulated responses | Connectors + policy gates + audit trail |
| **nexus_memory** | Persistent qualification criteria, patterns, preferences | Cross-session learning tied to your workspace |
| **nexus_decision_log** | Every tool decision recorded | Compliance + trust ledger |
| **Approval queue** | Inline Approve/Edit/Cancel for sends/financial | Enterprise-safe autonomy |
| **Durable workflows** | Vercel Workflow missions (invoice/contract/lead lifecycles) | Multi-hour jobs with verification |
| **Multi-model router** | DeepSeek (agent), Grok (voice/social), Claude/OpenAI fallback | Best model per task — not locked to one vendor |
| **Integration mesh** | Facebook, WhatsApp, Microsoft, LinkedIn, Stripe, scraper | OAuth + webhooks + tenant isolation |

**ChatGPT/Claude in a browser** can draft text. **Bonnie** drafts, scores, finds leads, sends (with approval), logs decisions, and remembers your criteria — inside one OS.

---

## Model-agnostic architecture

```
User → Bonnie Agent (plan/act/observe)
         ├── DeepSeek — agent loops (cost-efficient)
         ├── Grok (xAI) — voice, social, realtime tone
         ├── Claude / OpenAI — fallback via aiRouter
         └── Tool execution → MCP → Supabase → Integrations
```

When a new model ships, we swap the router — not the product. Your workflows, memory, and audit trail stay.

---

## Module coverage (Bonnie today)

| Module | Capabilities |
|--------|----------------|
| **CRM / Clients** | Contacts, clients, activity logs, customer 360 |
| **Leads** | Find, qualify, scraper campaigns, Facebook search, ingest paste → lead |
| **Deals** | Pipeline, stage moves, scoring, win probability |
| **Quotes** | List, create, send (module dock) |
| **Invoices / Accounting** | AR, revenue, send, chase, snapshots |
| **Contracts** | Create, send, lifecycle workflows |
| **Campaigns** | Diagnose, bulk send, sequences |
| **Social** | LinkedIn, Facebook, schedule, Grok video scripts |
| **WhatsApp** | Send, chatbot, status |
| **Mail / Inbox** | Microsoft mail, email → lead context |
| **Tasks / Projects** | CRUD, project tasks |
| **Meetings / Calendar** | Schedule, Teams |
| **Tickets** | Create, list, summarize, escalate |
| **Automation** | Playbooks, Chief of Staff, orchestrate_task |
| **Analytics** | Dashboard stats, API health, proactive brief |
| **Workspace** | Full account overview, integration health, autonomous rules |

---

## Voice (Grok-powered)

`POST /api/bonnie/voice` — spoken transcript → Grok normalizes intent → full Bonnie agent executes → speakable summary.

Browser speech-to-text can call this endpoint. Bonnie is not text-only.

---

## Roadmap pillars (2026–2031)

1. **Proactive agent** — cron briefings pushed to widget without asking
2. **Specialist subagents** — parallel CRM + finance + leads agents per orchestration
3. **Auto-resume after approval** — mission continues when you tap Approve
4. **Module dock on every page** — context-aware everywhere
5. **Tenant-trained playbooks** — Bonnie writes and replays your SOPs
6. **Marketplace skills** — install vertical packs (HVAC, dental, legal)
7. **MCP as platform API** — Claude/Grok/Manus connect *to* AlphaClone, not the reverse

---

## Positioning

> **Claude is a brain. AlphaClone is the business body.**

Bonnie is the nervous system — senses (data), decides (policy + memory), acts (tools), remembers (nexus), and asks permission (approvals) before irreversible sends.

That combination is the 5-year moat.
