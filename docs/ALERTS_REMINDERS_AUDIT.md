# AlphaClone Systems — Alerts, Reminders & Notifications System Audit

**Audit Date:** October 2026  
**Audited Systems:** Contract Signature Reminders, Invoice Overdue Chaser, Task Reminders, Universal Chaser Engine  
**Target Code:** `src/services/contractSignatureReminderService.ts`, `src/app/api/cron/contract-signature-reminders/route.ts`, `src/lib/chaser/`  

---

## 1. Executive Summary

The AlphaClone Systems Alerts, Reminders & Notifications module drives proactive follow-ups for pending signatures, overdue invoices, expiring contracts, and project milestones. This audit evaluated the automated cron runners, cooldown algorithms, idempotency protections, and multi-channel notification outboxes.

---

## 2. Notification Engine Architecture

```
[Cron Trigger / Vercel Cron]
             │
             ▼
[GET /api/cron/contract-signature-reminders]
             │
             ▼
[Universal Chaser / contractSignatureReminderService]
             │
             ├─► 1. Query pending contracts in [sent, viewed, negotiating]
             ├─► 2. Exclude terminal & draft statuses [completed, declined, voided, draft]
             ├─► 3. Filter next eligible signatory by signing_order
             ├─► 4. Evaluate cooldown: check events in last 3 days
             ├─► 5. Generate secure signing token (14-day expiry)
             ├─► 6. Dispatch email via executeSendEmailCommand (idempotent key)
             ├─► 7. Record event in contract_signature_events & contract_audit_trail
             └─► 8. Log system notification in unified_notifications
```

---

## 3. Cooldown & Idempotency Rules

1. **3-Day Signature Reminder Cooldown:**
   - Before dispatching a reminder to `email`, the service checks `contract_signature_events` for any `requested` or `delivered` events within the last 72 hours (`Date.now() - 3 * 86400_000`).
   - If found, the reminder is skipped (`skipped += 1`), preventing spam.
   - An explicit `force: true` parameter bypasses the cooldown for manual workspace operator triggers.
2. **Deterministic Idempotency Key:**
   - Email dispatch uses idempotency key `contract-remind:{tenantId}:{contractId}:{partyId}:{YYYY-MM-DD}`.
   - Even in concurrent cron runs or network replays, duplicate emails are structurally blocked at the transmission gateway.
3. **Cancellation & Terminal Exclusions:**
   - Reminders automatically terminate when a contract transitions to `draft`, `prepared`, `fully_signed`, `signed`, `active`, `completed`, `terminated`, `declined`, `rejected`, `expired`, `voided`, or `cancelled`.

---

## 4. Defect Findings & Remediated Behavior

- **Legacy Query Desynchronization:** Previous query `.in("lifecycle_status", ["sent", "viewed", "negotiating"])` omitted legacy records where `lifecycle_status` was NULL but `status` was `'sent'`. Remediated with `.or("lifecycle_status.in.(sent,viewed,negotiating),status.in.(sent,viewed,pending_signature)")`.
- **Terminal Status Leakage:** Remediated `sendOrderedContractSignatureReminders` to immediately return `{ complete: true, sent: 0, skipped: 0 }` when contract status matches any terminal or non-actionable state.
