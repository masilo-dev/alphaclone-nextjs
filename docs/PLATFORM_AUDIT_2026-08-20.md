# Platform Audit — 20 August 2026

## Scope and method

This audit traced the tenant-admin dashboard from its catch-all route through its client shell, service layer, API handlers, and Supabase-backed persistence. The review covered **CRM and leads, contacts, outbound email, ticketing, in-app notifications, plans and quotas, workspace branding, and audit records**. It also checked the repository's automated suite, type safety, route inventory, and production-readiness script.

| Flow | UI entry point | Persistence / delivery path | Audit outcome |
| --- | --- | --- | --- |
| CRM, leads, and contacts | `/dashboard/crm/workspace` | `CRMTab` → tenant-scoped lead/contact services → Supabase | Reads, writes, realtime lead updates, and lead-to-contact/deal conversion are tenant-scoped. |
| Email and outreach | Mail, outreach, CRM compose actions | `/api/email/send` → provider resolution → `email_logs` | Delivery results are recorded in the canonical email log with non-sensitive CRM context. |
| Tickets and customer notifications | `/dashboard/business/tickets` | `/api/tickets` → `/api/tickets/notify` → email and in-app notification services | Ticket persistence and notification dispatch are separated; provider failures are logged server-side. |
| Plans and quotas | `/dashboard/business/settings` | Tenant subscription state, Stripe endpoints, quota dashboard | Removed the fixed “45% used” display; settings now direct users to live quota data. |
| Branding and white-label identity | `/dashboard/business/settings` | `business_settings` + synchronized `tenants` branding fields | Saved logo, legal identity, address, color, and support email now propagate to tenant consumers. |
| Audit records | `/dashboard/business/audit` | `audit_logs` and `email_logs` under tenant RLS | Added a readable, searchable, tenant-scoped audit table with email delivery events. |

## Confirmed repairs

The settings screen previously queued notification and brand-color saves with timers that captured an earlier render’s state. A user could therefore see a changed toggle or selected color while the previously selected value was written. The save handlers now receive the explicit next state, and settings refresh the active tenant after a successful branding save.

Branding had been split between `business_settings` and the `tenants` record consumed by the dashboard shell and document utilities. The business-settings endpoint now synchronizes the approved tenant identity fields and `settings.branding` object after authorization. The dashboard root also applies the tenant primary color through the existing workspace design token.

The email endpoint attempted to write a `lead_id` field to `lead_outreach_log` despite its generic log schema and the endpoint’s `contactId` parameter. That best-effort write could silently fail and could not accurately represent a contact. The endpoint now carries safe CRM context into the canonical `email_logs` record, where both successful and failed provider attempts are logged.

A new **Audit trail** module is available under **Administration**. It reads `audit_logs` and `email_logs` for the selected tenant, supports text and severity filtering, and renders safe event summaries without displaying message bodies or secrets.

The social publishing test failure was corrected by producing `/PAGE_ID/posts/POST_ID` URLs when a verified composite Graph post ID matches the known page ID. The complete unit suite now passes.

## Validation

| Check | Result | Notes |
| --- | --- | --- |
| TypeScript | Passed | `npm run typecheck` completed without errors after the final changes. |
| Unit suite | Passed | `npm test`: **395 passed, 0 failed**. |
| Focused lint | Passed with one existing warning | No errors in changed files. The remaining warning is an existing `<img>` optimization recommendation in `SettingsPage`. |
| Production-readiness audit | Passed with one blocked check | Static audit checks passed; live data-integrity checks require database credentials. |
| Production build | Not conclusive in sandbox | Compilation and workflow bundling began successfully, but the build stalled during final optimization and was stopped. Existing Playwright `require.resolve` and service-worker registration warnings were emitted before the stall. |

## Remaining operational checks

> Live database and provider verification was intentionally not performed because this sandbox does not have the project’s Supabase or email-provider credentials. Before merging, run the production data-integrity audit and verify a real tenant's branding save, email send, ticket notification, and audit-table visibility against deployed RLS policies.

The ticket notification API treats customer email delivery as best-effort so ticket creation is not blocked by a mail-provider incident. The support UI should continue to avoid representing a ticket confirmation as a guaranteed delivered email unless the provider result is surfaced explicitly.

The broader repository lint run remains warning-only and reports 55 pre-existing warnings, chiefly unoptimized image usage and stale `eslint-disable` comments. Those were not mass-edited in this targeted data-flow pull request.

## Files changed

| Area | Files |
| --- | --- |
| Branding and notification persistence | `src/components/dashboard/SettingsPage.tsx`, `src/app/api/tenant/[tenantId]/business-settings/route.ts`, `src/components/dashboard/business/BusinessDashboard.tsx` |
| Email audit integrity | `src/app/api/email/send/route.ts`, `src/lib/email/sendEmail.ts` |
| Audit UI | `src/components/dashboard/AuditTrailPage.tsx`, `src/components/dashboard/business/BusinessDashboard.tsx`, `src/constants.ts` |
| Social regression | `src/lib/facebook/verifyFacebookPost.ts` |
