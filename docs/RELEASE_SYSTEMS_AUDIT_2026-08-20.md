# Release Systems Audit — 20 August 2026

## Scope and safety boundary

This audit reviewed the accounting, invoice, quotation, follow-up, notification, document, project, audit-trail, Supabase, email-confirmation, PWA, public-portal, and platform-owner administration paths. The implementation and validation work was **non-outbound**. No email, OTP, push notification, campaign, reminder, tenant change, deletion, project update, document update, or other external action was dispatched.

> The local environment has no configured Supabase credentials, database URL, remote project link, or authorized disposable tenant. Static code paths and automated checks were reviewed, but database, authentication, edge-function, and provider delivery cannot be represented as live-passed until those release prerequisites are supplied.

## Confirmed system paths

| Area | Confirmed release path | Audit conclusion |
| --- | --- | --- |
| Accounting, invoices, and quotations | Invoices, public payment links, lifecycle transitions, receipts, and quote links have dedicated tenant-scoped API and service paths. | The core application model is real, with direct unit coverage of invoice and lifecycle rules. |
| Invoice follow-up | The overdue-reminder job requires cron authorization, keeps invoice writes tenant-scoped, honors `auto_followup_enabled`, deduplicates reminder types, records `invoice_reminders`, and writes invoice audit events. | Automatic reminder behavior is implemented, but its live delivery requires a configured provider and a test tenant. |
| Project updates | A tenant project update emits a business automation event; changed stage and progress invoke client-notification helpers, and a project-owner update is sent when an owner email exists. Client delivery requires an enabled public project portal and a client address, and events record successful client update delivery. | Project update automation is implemented and deduplicated. It should be checked against notification preferences before enabling high-volume production traffic. |
| Documents | Dedicated public data rooms and project portals are present. Document expiry and missing-document alerts are generated for workspace notifications. | A general document-status-to-client-email workflow was not found. It should not be claimed as automatic until an explicit recipient, preference, and delivery-policy design is implemented. |
| Audit trails and MCP | Bonnie/MCP tool executions persist tenant-scoped tool names, arguments, results, status, idempotency keys, and external references. The platform audit UI also exposes tenant audit records. | Contact actions can be traced, but operational UI should continue to redact sensitive email content and secret values. |
| Email sign-up and confirmation | Email/password registration uses Supabase sign-up with an email-confirmation callback, tenant bootstrap after a valid session, and an idempotent welcome-email path. | Email confirmation is implemented. Email OTP/magic-link sign-in is **not** implemented; the only OTP-like flow found is authenticator-app TOTP MFA. |
| Platform owner controls | Tenant listing, status changes, and deletion scheduling use `requirePlatformSuperAdmin` server checks and platform-admin audit logging. | Platform-owner tenant administration is server-protected and separated from tenant-admin functions. |
| Supabase edge functions | Functions exist for Azure Communication Services, Microsoft OAuth exchange/refresh, Teams tokens, and the workflow engine. | Live execution cannot be verified locally: there is no repository project configuration file and the required Supabase/Azure secrets must be set in the deployed function environment. |

## Implemented repairs

| Repair | Why it matters |
| --- | --- |
| Reused a previously captured Android install prompt | Android emits the install event once per browsing session. Reusing the saved prompt prevents an install control from waiting on an event that will not fire again. |
| Reduced installed-app shortcuts from six to five | The installed PWA now follows the documented focused navigation limit, reducing the feeling of a full duplicate dashboard in Android app chrome. |
| Exposed real shared project portals in the no-login client finance portal | Clients can now open only their own explicitly public, non-expired project portals and see status, stage, and progress rather than a placeholder. |
| Clarified document access in the finance portal | The finance link now states that documents require a dedicated shared project portal or data-room link; it does not imply that unshared files are available. |

## PWA assessment

The service worker uses a bounded cache for immutable Next static assets and network-only handling for APIs, dashboard routes, third-party data, and private documents. Its documented architecture intentionally avoids caching business responses. The Android experience could nevertheless feel stuck when a late-mounted install prompt misses `beforeinstallprompt`, or when a user is waiting on an app update. The prompt reuse repair addresses the first issue. The update flow already requires an explicit user choice, which protects in-progress work but means a waiting update will not activate until the user selects **Update**.

The PWA does not need to mirror every platform module. The installed navigation is intentionally limited to Home, CRM, Work, Money, and Bonnie. Communications and all other modules remain reachable through the regular workspace navigation.

## Release gates and remaining work

| Gate | Status | Required action before a production claim |
| --- | --- | --- |
| TypeScript | Passed | No action required for this change set. |
| Focused lint | Passed with one existing image-optimization warning | Consider replacing the public portal logo `<img>` with an optimized image component when external branding rules permit it. |
| Safe unit validation | Passed: 388/388 | No action required for this change set. The known unrelated Facebook permalink regression was excluded because it is covered by separate PR #108. |
| Static production audit | Passed 5 checks; data-integrity audit blocked | Run the data-integrity check against a disposable linked Supabase project. |
| Database migration check | Blocked | Set `DATABASE_URL` in the secure validation environment, then run the migration check and deploy migration verification. |
| Supabase edge functions | Static-only | Link the correct Supabase project, configure the listed Azure/Supabase secrets, deploy functions, and run authenticated smoke tests. |
| Email confirmation, OTP, and transactional delivery | Static-only | Test email confirmation with a designated test mailbox. Decide whether passwordless email OTP is a required feature; it is not currently present. |
| Automated project and invoice emails | Static-only | Use a designated test tenant, client, project, and inbox to validate success, deduplication, provider evidence, audit records, opt-out/preference behavior, and failure recovery. |
| Public portals | Static-only | Use expiring test portal tokens to verify project isolation, document-data-room isolation, link expiry, password rules, and client access. |

## Recommended release sequence

Run the database and edge-function checks in a disposable tenant before production deployment. After confirmed email and portal tests, enable recurring invoice and project-update automation only for the tenant that has approved its recipients and communication settings. Keep document-status email automation disabled until its recipient, consent, preference, and audit policy is implemented. Do not promote a local static pass to a claim that Supabase, email, push, or edge functions are live.

## Files changed

| Area | Files |
| --- | --- |
| Android install recovery | `src/services/pwaService.ts` |
| Focused PWA navigation | `src/app/manifest.ts` |
| No-login project data contract | `src/services/finance/clientFinancePortalService.ts` |
| No-login project status UI | `src/app/portal/[token]/page.tsx` |
