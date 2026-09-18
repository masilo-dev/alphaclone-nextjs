# Cross-Module Integration and New-User Readiness Audit

**Repository:** `masilo-dev/alphaclone-nextjs`  
**Date:** 2026-09-18  
**Scope:** Contracts, Sales/Lead Finder, CRM, Campaigns, Instagram/social, and new-user setup.

## Fixes applied in this pass

The new workspace creation flow no longer calls `switchTenant` against a stale React closure immediately after refreshing memberships. It registers the returned owner membership, sets the active tenant, clears tenant-scoped state, and redirects to the dashboard. The setup screen no longer claims that the unpersisted sector selector shapes workspace defaults.

The main dashboard now renders Lead Finder for both `/dashboard/leads/campaigns` and the normalized `/dashboard/leads/finder` route. Lead Finder also explains when a workspace is missing and provides a setup link, explains that candidate review requires an admin role, labels unsupported import/discovery modes as coming soon, and stops presenting the import toast as a ready workflow.

## Remaining production blockers

### Contracts

The e-sign path needs a server-side signing state machine and evidence model reconciliation. Audit action values do not match the committed check constraint, public token signing cannot satisfy a non-null authenticated user consent field, owner signatures bypass the compliant signing API, and contract write endpoints lack role checks. Completion certificates and signed-PDF verification are defined but not invoked. Email provider readiness is also not preflighted before Send.

### Sales and Lead Finder

Queued searches depend on a separately deployed worker or cron endpoint. The repository does not prove that production runs either. Search status needs queue health, stale-job recovery, source-specific errors, and retry controls. Candidate acceptance should be atomic with CRM lead creation. The active UI still needs mobile review controls and should not expose a successful search result when the worker has failed.

### CRM

Unified contacts mix canonical contacts and business clients while routing edits through client APIs, so unlinked contacts can display but fail to update correctly. Drip sequences, AI proposals, and churn playbooks contain local/demo behavior that should be implemented or labeled as previews. Public embed forms need opaque form tokens, rate limiting, abuse controls, and server-side form lookup instead of raw tenant IDs. CRM needs an actionable no-workspace state, provider readiness, retry diagnostics, and role-gated destructive actions.

### Campaigns

Legacy integration records can appear connected while campaign preflight requires separate provider-account and verified sender-identity records. The execution resolver must use decrypted credentials or credential references consistently. Scheduled campaigns require a registered production scheduler. Audience validation must support the documented lead/client identifiers. Campaign write and send actions need explicit roles. Daily sequences, analytics counters, and the spam-check badge must not be advertised until the underlying workers and reconciliation paths exist.

### Instagram and social

Immediate Share currently creates a scheduled row without a due timestamp and can display a false “published” success. Instagram photo publishing is asynchronous but the UI clears the draft as if complete. OAuth must fail when no tenant is resolved, and the base Instagram migration/deployment secrets must be reproducible. Instagram inbox claims need real scopes, webhook verification, subscriptions, and production handlers, or should be clearly marked unavailable.

### New-user setup

Email-confirmation and OAuth callback branches should invoke the same idempotent onboarding provisioning service as direct registration. Add confirmation resend/recovery. Provider goal selections need readiness checks and links to live connector settings. Durable server-backed onboarding state should replace browser-only flags. Legacy SetupWizard routes and endpoints should be removed or rewired rather than left as apparently available setup paths.

## Recommended implementation order

1. Deploy and monitor workers/schedulers for Lead Finder and campaigns.
2. Fix provider readiness and sender identity creation as one authoritative integration flow.
3. Repair Instagram async status and false-success behavior.
4. Harden Contracts signing evidence, role checks, immutable versions, and certificates.
5. Complete CRM entity routing and public embed security.
6. Consolidate onboarding callback provisioning and remove obsolete setup surfaces.

## Second fix pass

Instagram publishing now distinguishes a verified publication from an asynchronous pending operation. The API returns `202` and `pending_verification` when there is no verified provider post ID, while the UI preserves the draft and tells the user that publication still needs verification. Campaign scheduling now checks the update result before showing a successful scheduled state, and sequence copy explicitly identifies the remaining sequence as a preview until enrollment is connected. The public embed lead endpoint now validates UUIDs, email addresses, field lengths, and tenant existence before inserting a lead.

The embed endpoint still requires a future opaque per-form token, rate limiting, and origin/abuse controls before it should be treated as hardened for arbitrary public traffic. Instagram still requires reconciliation monitoring, Meta scopes, and production webhook/integration configuration.
