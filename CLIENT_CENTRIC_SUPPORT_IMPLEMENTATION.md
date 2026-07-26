# Alphaclone Client-Centric Support — Implementation and Audit

## Outcome

Alphaclone now has one canonical support domain around `tickets`. The dashboard no
longer unions `tickets` and `support_tickets` during reads. Existing support
records are copied once, with their IDs, timestamps, tenant, assignment, CRM
links, SLA due date and metadata preserved. The legacy table remains intact for
reconciliation and rollback.

## Existing architecture findings

| Area | Finding | Decision |
| --- | --- | --- |
| Tickets | `tickets` and `support_tickets` were both queried by the UI | **MERGE / MIGRATE** into `tickets`; stop runtime union |
| Ticket conversation | `ticket_comments` held public replies and internal notes | **MIGRATE** into `ticket_messages`; retain originals |
| CRM | `contacts` and `business_clients` are existing identities | **KEEP** and reference; never create a second client/company |
| Email | Canonical `email_provider_accounts`, `email_threads`, `email_messages`, recipients, jobs and delivery events exist | **KEEP / IMPROVE** by linking tickets and messages |
| Providers | Shared provider resolver, adapter contract and `sendEmailServer` exist | **KEEP**; ticket code must not call provider SDKs |
| Tasks/projects/invoices/contracts/documents | Canonical module records already exist | **KEEP**; link through `ticket_linked_records` |
| Tenant security | `tenant_users` membership and RLS pattern are established | **KEEP / IMPROVE** on every new support table |
| Notifications/automation | `business_automation_events` and ticket notification endpoint exist | **KEEP / IMPROVE** |
| Bonnie | Existing ticket draft and summary services exist | **KEEP** behind explicit agent actions |
| UI | `DeepDeskView` is the dashboard-native split workspace | **IMPROVE** in place; do not create an external helpdesk |
| Legacy support table | Still populated by channel workflows | **REMOVE AFTER MIGRATION**, only after producers are cut over and reconciliation passes |

## Unified architecture

`provider adapter → email_messages/email_threads → ticket ingestion/matching → tickets → ticket_messages`

All downstream context uses IDs of canonical records:

`contact/client/company ↔ ticket ↔ project/task/invoice/contract/document/meeting/social`

The migration adds:

- Support teams and members
- SLA policies and immutable SLA events
- Canonical ticket messages linked to canonical email messages
- Linked-record references
- Watchers and time entries
- Knowledge articles
- Support channels linked to shared provider accounts
- Explicit waiting responsibility, escalation, satisfaction and response timing
- Tenant indexes and RLS for every new table

## Threading and duplicate prevention

`matchInboundTicket` uses this order:

1. Existing provider or Internet Message-ID (idempotent duplicate)
2. `In-Reply-To`
3. RFC `References`
4. Provider thread ID
5. Explicit `[Ticket #TKT-…]` reference
6. New ticket

A similar or identical subject is never sufficient. Customer replies to resolved,
closed or customer-waiting tickets reopen the conversation. Open state is only
shown when a provider reports it; sending does not imply delivery or opening.

## Screen and route inventory

The production dashboard retains `/dashboard/business/tickets` as the canonical
authenticated route and workspace shell. The workspace provides queue filtering,
ticket detail, conversation, public reply/internal note modes, SLA state, status,
priority and Bonnie-assisted summary/draft.

Planned local views remain inside the Tickets module (not global sidebar items):
Overview, All, Mine, Unassigned, Waiting, Escalated, Overdue, Resolved, Closed,
Shared Inbox, Customers, Companies, Knowledge, Reports, SLA, Automations,
Channels, Teams and Settings.

Customer/company support views must reuse the same ticket API with
`contact_id`/`client_id`/`company_id` filters. No new identity tables are needed.

## Migration and preservation evidence

`20260727090000_client_centric_support.sql`:

- Inserts legacy support rows with the original primary key.
- Uses `NOT EXISTS` and `ON CONFLICT DO NOTHING`, so reruns cannot duplicate data.
- Preserves original ticket number, tenant, author/assignee, timestamps, SLA,
  resolution state, CRM relationships and metadata.
- Copies ticket comments with original IDs, authors, timestamps and internal
  visibility.
- Does not update or delete `support_tickets`, `ticket_comments`, CRM, email, or
  linked business records.
- Adds only references to canonical shared records.

Before cutover, compare per tenant:

```sql
select tenant_id, count(*) from support_tickets group by tenant_id;
select tenant_id, count(*) from tickets
where metadata ? 'legacySupportTicketId' group by tenant_id;
select t.tenant_id, count(*) from ticket_comments c
join tickets t on t.id = c.ticket_id group by t.tenant_id;
select tenant_id, count(*) from ticket_messages
where metadata ? 'legacyTicketCommentId' group by tenant_id;
```

Also compare open/closed totals, assignments, contact/client links, SLA due dates
and message timestamps. Keep the legacy writers enabled until counts match.

## Deployment checklist

1. Back up the database and record per-tenant reconciliation counts.
2. Deploy the unified email foundation migration first.
3. Run `20260727090000_client_centric_support.sql` in staging.
4. Run unit, type, RLS cross-tenant, webhook replay and stored-XSS tests.
5. Verify support mailbox sender identities and webhook signatures.
6. Reconcile ticket/comment counts and spot-check historical threads.
7. Deploy application code; monitor API errors, queue age, send failures and SLA events.
8. Cut each legacy producer to canonical `tickets` only.
9. Keep legacy tables for the agreed verification window.

## Rollback checklist

1. Stop new support ingestion.
2. Restore the prior application version.
3. Run `20260727090000_client_centric_support.down.sql`.
4. Re-enable legacy producers.
5. Reconcile legacy tables and email records.

The rollback intentionally does not delete tickets, comments, email, CRM or
business records. If new canonical support messages were created after cutover,
export them before dropping the new tables.

## Mailbox setup and provider limitations

- Connect Gmail, Microsoft, Zoho or SMTP through Alphaclone Email; designate the
  account as a shared support mailbox and verify a sender identity.
- Register provider webhooks, store secrets in the existing encrypted integration
  store, and verify signatures and replay IDs before ingestion.
- Grant only the provider scopes needed for read/send/thread metadata.
- Configure a default team, SLA policy, business timezone and holidays.
- Send a new message and a reply from an external mailbox; verify one ticket,
  preserved headers, the correct sender identity and delivery state.

Provider limitations:

- Open/click events exist only where the provider reports them and may be blocked
  by privacy features.
- SMTP alone normally has no inbound sync or reliable delivery/open events; IMAP
  and provider webhooks are separate capabilities.
- Gmail and Microsoft thread IDs are provider-specific; RFC headers remain the
  portable link.
- Bounces and delivery events can arrive out of order and must be idempotent.
- Shared-mailbox send-as permissions are administered by the provider.

## Tests

`ticket-support-domain.test.mjs` covers provider duplicate prevention, RFC
threading, explicit ticket references, subject non-matching, reopen behavior,
waiting responsibility and honest delivery labels.
