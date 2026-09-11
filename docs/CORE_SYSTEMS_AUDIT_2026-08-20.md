# Core Systems Audit — 20 August 2026

## Scope and safety boundary

This review covered Alphaclone’s **email and unified communications**, **Bonnie agentic controls**, **contacts**, **lead search**, and **project management** systems. The audit was deliberately non-outbound: no account was authenticated, no lead search was executed, no candidate was accepted, no email or reply was sent, no campaign was created, no outreach was started, and no Bonnie workflow was run.

> The local environment has no configured Supabase credentials or tenant test account. The findings below are based on UI-to-service/API tracing and safe automated validation. Live tenant verification remains a required release step.

## System status

| System | Confirmed operational path | Audit finding | Repair in this pull request |
| --- | --- | --- | --- |
| Lead search | Lead Finder uses authenticated tenant APIs and public-source discovery. The direct search path queries OpenStreetMap/Overpass, HERE or Foursquare, Firecrawl or DuckDuckGo, and optionally a browser source. | Search and review are real paths, but live execution requires a tenant session and configured source credentials. | No external search run. Existing source-error and availability states remain the user-facing recovery path. |
| Contacts | Contacts support tenant-scoped search, filtering, paging, export, single/bulk delete, activity timeline, and create/edit handoff through `contactService`. | The inspected contact CRUD flow is server-backed. The bulk-message control can start a communication flow, so it was not exercised. | No contact mutation or message was sent. |
| Project management | Projects load with tenant clients, support create/update/delete, stage changes with rollback on persistence failure, list/timeline/health views, and project task infrastructure. | The inspected core project lifecycle is server-backed and has existing project task/dependency coverage. | No project mutation was made. |
| Bonnie agentic workspace | Bonnie conversations, goals, approvals, instructions, streaming, task runs, and tool activity use tenant-scoped APIs. High-risk tools are approval-gated. | Opening the separate agent-console tab automatically posted to the autonomous-runner endpoint every five minutes, creating an unexpected side-effect path. | Removed the UI auto-trigger. Agent runs now require the explicit manual control or a deliberate server schedule. |
| Unified inbox | Inbox threads load from `unified_messages`; composing and replies are separate send paths; provider options load from tenant settings. | Star, archive, and trash only changed browser state. Archive contents disappeared after refresh because archived rows were excluded from the load query. | Added tenant-backed `star`, `archive`, and `trash` operations. Stored folders and stars now reload correctly. |
| Campaign management | The campaign builder has a tenant campaign API and a full builder component. | The primary campaign page supplied a simulated campaign list. The email workspace also displayed fixed delivery, revenue, warm-up, DNS, and provider-health figures. | Replaced simulated campaign records with a safe tenant-scoped campaign read. Removed fabricated inbox campaign and health indicators, and routed users to the actual campaign builder. |

## Confirmed safety improvements

The agent-console UI no longer executes `POST /api/autonomous/trigger` merely because the page is opened. This reduces the risk that a user reviewing Bonnie activity causes work to start unexpectedly. The manual-run route remains available to authorized users, and server-side schedules remain independent of the dashboard UI.

The email workspace no longer presents unverified operational data as real. Campaign activity now directs users to the campaign builder, which reads tenant data. The health panel only shows connected provider state and explicitly labels deliverability and DNS data as unavailable until a provider supplies verified reporting.

## Validation

| Check | Result | Notes |
| --- | --- | --- |
| TypeScript | Passed | `npm run typecheck` completed after the changes. |
| Focused lint | Passed with two existing warnings | There were no errors in changed files. The warnings recommend image optimization for two pre-existing image elements in the email workspace. |
| Full unit suite | One known master failure | The Facebook permalink test on master fails independently of this change. The correction is already in separate open PR #108 and was not duplicated here. |
| Unit suite excluding that known master regression | Passed | **388 passed, 0 failed**. |
| Live UI / database checks | Not run | The sandbox has no Supabase credentials or authorized tenant account. |
| Outbound safety | Maintained | No email, campaign, reply, lead search, Bonnie run, outreach, or external communication was dispatched. |

## Remaining release checks

A reviewer should test these journeys in a non-production tenant with disposable data: provider connection status, campaign-list reads, inbox star/archive/trash persistence, contact CRUD, one project lifecycle update, lead discovery results, and Bonnie’s explicit approval flow. Email and campaign delivery should be checked only against designated test recipients after provider configuration is verified.

## Files changed

| Area | Files |
| --- | --- |
| Safe agent-console behavior | `src/components/dashboard/AIAgentsTab.tsx` |
| Truthful campaign list | `src/components/dashboard/marketing/EmailCampaignsPage.tsx` |
| Inbox state and email health/campaign views | `src/components/dashboard/email/AlphaCloneEmailWorkspace.tsx` |
| Tenant inbox mutation endpoint | `src/app/api/tenant/[tenantId]/inbox/messages/route.ts` |
