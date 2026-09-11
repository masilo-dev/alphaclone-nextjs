# Alphaclone unified Email: audit and controlled migration

Date: 2026-07-26

## Executive finding

Email is currently a collection of provider and feature paths rather than one
domain. There are separate Zoho and Microsoft inbox hooks/views, provider send
routes for Brevo and SendGrid, `UnifiedEmailService`, `EmailProviderService`,
`emailService`, `inboxService`, direct SDK dispatch, and multiple webhook
routes. Provider choice and sender validation therefore vary by caller.

This implementation adds a provider-independent domain and an additive storage
projection. It does not switch production sends or copy credentials.

## Keep / improve / merge / migrate / replace

- **KEEP:** current OAuth callbacks, token refresh, Zoho and Microsoft mailbox
  clients, Brevo/SendGrid/Resend SDK code, SMTP support, attachments, templates,
  suppressions, webhook evidence, CRM logging and dashboard shell.
- **IMPROVE:** webhook verification, account health, incremental cursors,
  purpose-specific defaults, sender verification, account-level permissions,
  durable retries and safe body storage.
- **MERGE:** provider-specific inbox records into shared threads/messages;
  sender-address records into identities; send routes behind one queue/service.
- **MIGRATE:** `integrations` connections by reference, `email_sender_addresses`
  with lineage, existing message/log records after duplicate analysis, and
  business-setting defaults after validation.
- **REPLACE:** environment-variable provider detection in browser-facing code,
  direct module-to-provider sends, immediate send-before-job persistence, and
  provider-local suppression decisions.
- **REMOVE AFTER MIGRATION:** duplicate service and provider-specific UI
  orchestration. Provider adapters and OAuth flows remain.

## Concrete problems found

1. `UnifiedEmailService` advertises Gmail/Zoho/internal only and detects Zoho
   using a public environment variable; it does not unify the active providers.
2. `/api/email/send` accepts Zoho, Gmail, Brevo, SendGrid and Resend but omits
   Microsoft despite an existing Microsoft mailbox integration.
3. Brevo and SendGrid also have separate direct send routes.
4. Existing default resolution selects an administrator's integration when no
   user is supplied, which is not an account/sender authorisation decision.
5. Sending can occur before a durable outbound job exists.
6. Existing `emails`, `email_logs`, provider inbox records and
   `unified_messages` overlap.
7. `email_logs` originally constrained providers to SendGrid/Resend.
8. Sender addresses and provider credentials are stored separately without a
   canonical account relationship.
9. Several webhook entry points exist, increasing replay and divergent-state
   risk.

## Added foundation

- `unifiedEmailDomain.ts` defines providers, purposes, capabilities, explicit
  route selection, verified sender enforcement and provider-independent
  suppression.
- `providerAdapter.ts` defines the provider boundary used by future Zoho,
  Microsoft Graph, Brevo, SendGrid, SMTP and other adapters.
- `20260726230000_unified_email_foundation.sql` adds provider accounts, sender
  identities, threads, messages, recipients, outbound jobs, delivery events,
  defaults, indexes and tenant RLS.
- Existing connections and sender addresses are referenced and preserved.
  Secret-bearing `integrations.config` is never copied into the new tables.
- The rollback removes only unused unified projection tables.

## Safe cutover

1. Back up and apply the migration in staging.
2. Compare every provider connection and sender identity with its legacy source.
3. Implement adapters around the existing provider clients.
4. Dual-write inbound messages and compare provider IDs/Internet Message-IDs.
5. Route a test tenant through durable outbound jobs.
6. Validate suppression, consent, SendAs, Bcc access and webhook replay tests.
7. Migrate defaults by user, module and purpose; never silently choose an
   administrator's identity.
8. Switch module sends to the shared service, then switch inbox reads.
9. Retire duplicate orchestration only after message/send reconciliation.

## Current limitations

This is the safe domain and migration phase, not a claim that the full
69-deliverable production module is complete. Live provider adapters, worker,
sync cursors, unified UI routes, account permissions, collaboration, migration
reconciliation, provider webhooks and end-to-end tests remain required. No
production connection or message count can be reported without authorised
database/provider access.
