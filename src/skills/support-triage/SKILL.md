---
name: support-triage
description: Triage support tickets and draft replies. Use on tickets/Deep-Desk module.
allowed-tools: get_tickets create_ticket draft_reply summarize_ticket
---

# Support Triage Skill

## When to use
- User asks about tickets, support backlog, or customer replies
- User is on tickets/Deep-Desk

## Workflow
1. `get_tickets` to list open/urgent items
2. `summarize_ticket` for agent briefing (via draft context)
3. `draft_reply` for customer-facing responses
4. `create_ticket` when escalating new issues

## Rules
- Prioritize urgent and open tickets
- Draft replies are empathetic and direct — no markdown
- Internal notes vs public replies must be distinguished when user specifies
