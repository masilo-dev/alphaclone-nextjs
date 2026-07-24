# Bonnie AI Workspace Redesign

**Date:** 2026-07-24  
**Branch:** `bonnie/bonnie-ai-workspace-redesign-218f`

---

## 1. Existing implementation audit

### Strengths (reuse)
- Agent loop: `src/lib/bonnie/bonnieAgent.ts`
- SSE streaming: `POST /api/bonnie/stream`
- Tool policy + approvals: `ToolPolicyGate`, `BonnieApprovalCard`, `autonomous_runner_approvals`
- Schema: `bonnie_conversations`, `bonnie_messages`, `bonnie_workflows`
- Agentic OS: `src/lib/bonnie/os/*`

### Gaps vs ChatGPT-like workspace
| Need | Today |
|------|--------|
| Conversation sidebar / search / pin / archive | Single active thread only |
| Full-page AI workspace | Ops console (logs + chat) |
| Rich composer (attach, @mentions, modes) | Textarea + mic |
| Context panel | Autonomy logs, not record context |
| Clean tool activity cards | Mostly raw tool lists |
| Welcome / suggestions | Intro message only |

### Console errors you pasted
`Permissions-Policy` bluetooth/web-share, Datadog RUM (`service: claude-ai`), ScreenDemos CORS — those are from **claude.ai / browser extensions**, not Alphaclone. Ignore for this redesign.

`campaign_recipients_contact_id_fkey` is a separate CRM bug (orphan contact ids on draft save). Tracked as follow-up, not part of this UI redesign.

---

## 2. Proposed architecture

```text
BonnieWorkspaceShell
├── BonnieSidebar          (conversations, agents, workflows, workspace)
├── Main
│   ├── Header             (title, model, status, share/export)
│   ├── BonnieWelcome      | BonnieChatPanel (messages + streaming)
│   └── BonnieComposer     (attach, mentions, modes, stop)
└── BonnieContextPanel     (task, records, permissions, approvals)
```

**Data:** extend `bonnie_conversations` with `pinned`, `archived_at`, `metadata`.  
**API:** list/create/get/patch/delete conversations; keep stream route; pass `conversationId`.  
**Security:** existing `requireTenantAccess` + RLS; every tool still goes through `ToolPolicyGate`.

---

## 3. Files changed (this phase)

- `docs/BONNIE_WORKSPACE_REDESIGN.md` (this doc)
- `supabase/migrations/20260724153000_bonnie_conversation_workspace.sql`
- `src/app/api/bonnie/conversations/route.ts`
- `src/app/api/bonnie/conversations/[id]/route.ts` (new)
- `src/hooks/useBonnieConversations.ts` (new)
- `src/components/dashboard/bonnie/workspace/*` (new shell)
- `src/components/dashboard/bonnie/BonnieFullView.tsx` (mount shell)
- `src/components/dashboard/bonnie/BonnieChatPanel.tsx` (conversationId, stop, activity cards)
- `tests/unit/bonnie-workspace-shell.test.mjs`

---

## 4. Database changes

```sql
ALTER TABLE bonnie_conversations
  ADD pinned boolean DEFAULT false,
  ADD archived_at timestamptz,
  ADD metadata jsonb DEFAULT '{}';
```

---

## 5. Security risks

| Risk | Mitigation |
|------|------------|
| Cross-tenant conversation leak | Filter by tenant_id + user_id; RLS |
| Client-only permission checks | Server `requireTenantAccess` on all routes |
| Silent high-risk tools | Keep ToolPolicyGate + approval cards |
| Prompt injection via @mentions | Mentions resolve server-side by id + membership |

---

## 6. Phased plan

1. **Done in this PR:** shell layout, sidebar, multi-conversation API, welcome, context panel, composer chrome, tool activity cards, stop generation, tests  
2. **Next:** file upload pipeline, @record pickers backed by search APIs, workflow stepper UI, share/export PDF  
3. **Later:** voice polish, deep research mode backend, full keyboard a11y audit, module “Ask Bonnie” entry points everywhere

---

## After implementation checklist

See PR description for completed features, remaining limitations, and verification notes.
