---
name: crm-follow-up
description: Follow up on CRM contacts and log activities. Use when user is in CRM or asks about contacts, clients, or relationship management.
allowed-tools: get_contacts create_contact log_contact_activity get_clients search_clients solo_owner_operator_brief
---

# CRM Follow-Up Skill

## When to use
- User asks about contacts, clients, or relationship follow-ups
- User is on the CRM module and wants next actions

## Workflow
1. Call `get_contacts` or `search_clients` to find relevant records
2. Use `log_contact_activity` to record calls, emails, or meetings
3. If unsure what to prioritize, call `solo_owner_operator_brief` for recommendations
4. Create tasks via `create_task` when follow-up dates are needed

## Rules
- Never fabricate contact IDs — use tool results
- Prefer logging activity before sending outbound messages
- Summarize findings in plain business language
