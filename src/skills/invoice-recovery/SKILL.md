---
name: invoice-recovery
description: Recover overdue invoices and AR aging. Use for billing, accounting, or unpaid invoice requests.
allowed-tools: get_invoices accounting_snapshot send_invoice nexus_invoice_chasing run_playbook
---

# Invoice Recovery Skill

## When to use
- User asks about overdue invoices, AR aging, or payment collection
- User is on accounting/billing pages

## Workflow
1. Call `get_invoices` with status filters for overdue/unpaid
2. Run `accounting_snapshot` for AR summary
3. For gentle reminders use `nexus_invoice_chasing`
4. For explicit send actions use `send_invoice` (may require approval)
5. Optionally `run_playbook` with `overdue_invoice_reminder`

## Rules
- Confirm invoice IDs from tool results before sending
- High-risk sends may queue for approval — inform the user
- Report amounts and counts clearly
