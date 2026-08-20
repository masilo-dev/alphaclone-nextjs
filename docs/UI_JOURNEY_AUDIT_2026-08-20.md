# Safe UI Journey Audit — 20 August 2026

## Scope and safety boundary

This review examined the tenant-admin user interface for **lead finding, project and record management, contracts, unified email and outbound communications, Microsoft-connected communication, tasks, and notifications**. It intentionally did **not** authenticate to a customer workspace, run a lead search, accept a real lead, send or reply to email, start outreach, or invoke any other external communication.

> The sandbox contains no tenant test credentials and no local Supabase configuration. All persistence findings below were established by tracing the UI handlers, protected API routes, service contracts, and automated tests. Live production confirmation still requires an authorized test workspace.

## Module findings

| Module | Current operational status | UI finding | Outcome of this change |
| --- | --- | --- | --- |
| Lead Finder | The lead search path uses authenticated, tenant-scoped APIs and real public sources including OpenStreetMap/Overpass, HERE or Foursquare, Firecrawl or DuckDuckGo, and an optional browser source. | The result-table action was a visible ellipsis button with no action. Lists, outreach, and settings remain informational empty states. | Replaced the inert action with **Accept** and **Reject** controls. Accept saves the reviewed candidate to CRM through the existing API and explicitly states that no outreach is sent. |
| Project management | Project loading and create/update/delete actions use `projectService`; project tasks and timeline views are server-backed. | No confirmed local-only CRUD defect found in the inspected service path. | No change required. |
| Contracts | Contract loading, drafting, save, lifecycle, and send-modal preparation use existing server-backed flows. | No confirmed inert control found in the inspected lifecycle path. | No change required. |
| Unified email inbox | Inbox data loads from `unified_messages`; AI drafting and send handlers are separate from inbox state actions. | Star, archive, and delete controls changed only local React state. Archived threads were excluded from every load, leaving the Archive folder empty after refresh. | Added tenant API persistence for **star**, **archive**, and **move to trash**. The inbox now loads persisted folders and restores state on refresh. No mail send path was exercised or changed. |
| Microsoft / unified communications | The Microsoft integration panel reads connection status, starts OAuth, disconnects, and tests an existing connection through its service layer. | Full live verification requires Microsoft configuration and an authenticated tenant. | No change required; this remains configuration-dependent. |
| Tasks | The task workspace loads tenant-scoped tasks and related records, then uses its tenant API for create/update/complete/delete operations. | No confirmed inert CRUD action found. | No change required. |
| Notifications | The notification bell reads tenant-scoped notifications and writes through the notification API. | Mark-read, mark-all, and delete changed the display optimistically without recovery when an API request failed. | Added rollback and an error message when persistence fails, preventing a misleading local state. |
| Protected routes | The dashboard shell redirected unauthenticated users but then rendered `null`. | In a no-session environment, this produced a blank protected route until the redirect completed. | Added a visible **Sign-in required** recovery panel with a direct login link. |

## Lead Finder: real or not?

The **Omni Lead Finder** has a genuine authenticated server path. It creates or advances a search job and falls back to the direct scraper endpoint when the queue is unavailable. The direct endpoint queries real public data sources, enriches website contact details where available, deduplicates, applies tenant access checks, and returns source errors when no provider can produce results. This does not mean that every visible Lead Finder tab is complete: the alternate `ScraperCampaignsPage` still presents Lists, Outreach, and Settings as empty-state screens, and its Import button currently only displays an informational message.

The new Accept action calls `POST /api/leads/candidates/:id/review`. That endpoint records the review, creates or updates the CRM lead, links the candidate to it, and records activity. It does not send email or initiate outreach.

## Validation

| Check | Result | Notes |
| --- | --- | --- |
| TypeScript | Passed | `npm run typecheck` completed after the UI repairs. |
| Focused lint | Passed with two existing warnings | No lint errors in changed files. Both warnings are existing image-optimization recommendations in the email workspace. |
| Full unit suite | Baseline failure identified | Master has one existing Facebook permalink test failure. The missing fix is already included in the separate open PR #108 and was deliberately not duplicated here. |
| Unit suite excluding that known baseline regression | Passed | **388 passed, 0 failed**. |
| Browser smoke test | Safely skipped | The existing smoke suite skips all authenticated checks when tenant credentials are absent. |
| Protected-route browser check | Passed after retry | With an 8 GB Node heap, the local server redirected the lead-finder route to the visible login page. No form was submitted. |

The default local Next.js development server exhausted its initial JavaScript heap while compiling the dashboard route. A single retry with an 8 GB heap completed the route compilation successfully. This is a sandbox validation constraint, not a verified production incident.

## Files changed

| Area | Files |
| --- | --- |
| Visible protected-route recovery | `src/app/dashboard/[[...slug]]/DashboardClientPage.tsx` |
| Lead review controls | `src/components/dashboard/leads/ScraperCampaignsPage.tsx` |
| Unified inbox persistence | `src/components/dashboard/email/AlphaCloneEmailWorkspace.tsx`, `src/app/api/tenant/[tenantId]/inbox/messages/route.ts` |
| Notification persistence recovery | `src/components/dashboard/NotificationCenter.tsx` |
