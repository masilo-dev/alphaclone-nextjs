# AlphaClone Systems — Project Management & Client Portal Defects Log

This document provides the exhaustive defect trace and repair log for the 12 observed defects across Project Management and the Client Portal.

---

### Repair Report 1

- **Defect**: Stage dropdown displays Planning while the project card still displays Active.
- **Root Cause**: Operational status (`Active`) and lifecycle stage (`Planning`) were displayed without disambiguation labels, and transitioning out of `Closure` failed to reset status from `Completed` to `Active`.
- **Files changed**:
  - `src/components/dashboard/business/ProjectsPage.tsx`
  - `src/services/projectStageService.ts`
- **Database changes**: None required (uses existing `status` and `current_stage` columns).
- **Internal skills used**: `chrome-devtools`, `web-testing`, `source-verification`.
- **REA contribution, if applicable**: Analyzed runtime DOM element bindings between card header status badge and stage select element.
- **Tests passed**: `tests/unit/project-finished-status.test.mjs`, `tests/unit/project-portal-repairs.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Verified status badge and stage pills render distinct attributes with correct CSS variables.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 2

- **Defect**: Project step counts and progress do not match the selected stage.
- **Root Cause**: Ad-hoc stage mapping produced `-1` indices, rendering `Step 0/5`, while projects without tasks defaulted to 0% progress regardless of lifecycle stage.
- **Files changed**:
  - `src/components/dashboard/business/ProjectsPage.tsx`
  - `src/lib/projects/projectEnums.ts`
  - `src/services/projectStageService.ts`
- **Database changes**: None.
- **Internal skills used**: `domain-modeling`, `project-lifecycle-audit`.
- **REA contribution, if applicable**: Inspected state store synchronization between stage step definitions and progress bar widths.
- **Tests passed**: `tests/unit/project-task-domain.test.mjs`, `tests/unit/project-portal-repairs.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Verified progress bar and percentage agree with stage step on both mobile and desktop.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 3

- **Defect**: Initiation and Discovery appear as inconsistent stage concepts.
- **Root Cause**: Project creation commands and API routes defaulted stage to legacy `'Discovery'`, conflicting with canonical 5-stage `'Initiation'`.
- **Files changed**:
  - `src/lib/execution/commands/projectCreateCommand.ts`
  - `src/app/api/tenant/[tenantId]/projects/route.ts`
  - `src/components/dashboard/business/ProjectsPage.tsx`
- **Database changes**: None (Postgres enum aliases handled transparently by `toCanonicalProjectStage`).
- **Internal skills used**: `api-validation`, `zod-schema-audit`.
- **REA contribution, if applicable**: Traced API payload lifecycle from route handler down to `create_project_lifecycle` RPC.
- **Tests passed**: `tests/unit/lifecycle-project-persistence.test.mjs`, `tests/unit/project-portal-repairs.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Confirmed newly created projects display `Initiation` in client portal project drawer.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 4

- **Defect**: The UI gives no clear confirmation that a stage was saved.
- **Root Cause**: Backward stage transitions were disabled in the HTML select dropdown (`disabled={idx < currentIdx}`), and toast notifications lacked affirmative step details.
- **Files changed**:
  - `src/components/dashboard/business/ProjectsPage.tsx`
- **Database changes**: None.
- **Internal skills used**: `ui-interaction-testing`, `state-synchronization`.
- **REA contribution, if applicable**: Evaluated UI event handlers on dropdown selection change and confirmation prompt triggers.
- **Tests passed**: `tests/unit/project-portal-repairs.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Verified confirmation dialog triggers on backward transition and success toast displays saved step label.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 5

- **Defect**: Invalid stage transitions fail without explaining the missing requirements.
- **Root Cause**: `handleStageUpdate` only displayed `result.error || 'Stage change blocked'` without extracting structured `missingRequirements` returned by `projectStageService.validateTransition`.
- **Files changed**:
  - `src/components/dashboard/business/ProjectsPage.tsx`
- **Database changes**: None.
- **Internal skills used**: `error-handling-audit`, `toast-notification-audit`.
- **REA contribution, if applicable**: Inspected error object propagation across service boundary to UI components.
- **Tests passed**: `tests/unit/project-portal-repairs.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Verified missing requirements display clear itemized lists in toast and drawer views.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 6

- **Defect**: Projects created through MCP are not always visible in the dashboard or client portal.
- **Root Cause**:
  - MCP `create_project` tool did not forward `portal_enabled`, defaulting `client_visible` to `false` in project metadata.
  - `loadClientProjects` strictly filtered out records where `metadata.client_visible !== true`.
  - Dashboard `projectService.getProjects` filtered non-admins to `owner_id = userId`.
- **Files changed**:
  - `src/lib/mcp/tools/projects.ts`
  - `src/lib/execution/commands/projectCreateCommand.ts`
  - `src/lib/clientPortal/projects.ts`
  - `src/services/projectService.ts`
- **Database changes**: None.
- **Internal skills used**: `mcp-parity-testing`, `rls-audit`.
- **REA contribution, if applicable**: Reverse-engineered MCP tool argument mapping and query pipeline down to Supabase filters.
- **Tests passed**: `tests/unit/client-portal-complete.test.mjs`, `tests/unit/project-portal-repairs.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Verified MCP-created client projects immediately populate `loadClientProjects` and portal UI.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 7

- **Defect**: Project creation previously returned INVALID_ARGUMENT.
- **Root Cause**: Strict `z.string().uuid()` failed when callers passed empty strings or null for optional client IDs, contract IDs, and template IDs.
- **Files changed**:
  - `src/lib/mcp/tools/projects.ts`
- **Database changes**: None.
- **Internal skills used**: `zod-validation-audit`.
- **REA contribution, if applicable**: Analyzed MCP input validation errors and stack traces.
- **Tests passed**: `tests/unit/project-portal-repairs.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Confirmed empty string and null arguments safely coerce to `undefined` without validation exceptions.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 8

- **Defect**: Milestone updates do not reliably notify clients.
- **Root Cause**: `loadProjectForClientNotify` only queried `projects` and failed on `business_projects`, causing `skipped: 'project_not_found'`.
- **Files changed**:
  - `src/lib/projects/projectClientNotification.ts`
- **Database changes**: None.
- **Internal skills used**: `notification-engine-audit`.
- **REA contribution, if applicable**: Traced notification query failures across database fallback views.
- **Tests passed**: `tests/unit/project-lifecycle-notifications.test.mjs`, `tests/unit/project-portal-repairs.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Verified milestone update notifications resolve client email and render portal link.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 9

- **Defect**: Client email notifications are missing.
- **Root Cause**: Handlers returned `skipped: 'lifecycle_notifications_use_durable_outbox'`, but no mechanism was writing to `project_notification_outbox`.
- **Files changed**:
  - `src/lib/projects/projectNotificationOutbox.ts`
- **Database changes**: None (uses existing `project_notification_outbox` table).
- **Internal skills used**: `outbox-pattern-audit`, `durable-events`.
- **REA contribution, if applicable**: Inspected outbox queue processing loop and worker polling behavior.
- **Tests passed**: `tests/unit/project-lifecycle-notifications.test.mjs`, `tests/unit/project-portal-repairs.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Confirmed events are queued with transactional idempotency keys.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 10

- **Defect**: Recent activity does not accurately reflect project events.
- **Root Cause**: Stage updates and milestone mutations did not consistently write to `workspace_activity` with client-visible scoping.
- **Files changed**:
  - `src/services/projectStageService.ts`
  - `src/lib/projects/milestoneMutationServer.ts`
- **Database changes**: None.
- **Internal skills used**: `activity-audit`, `portal-scoping`.
- **REA contribution, if applicable**: Traced `getClientScopedActivity` query filters against workspace activity events.
- **Tests passed**: `tests/unit/client-portal-complete.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Verified stage changes appear under "Recent activity" in the client portal.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 11

- **Defect**: The dashboard sometimes says everything is caught up despite outstanding work.
- **Root Cause**: `ProjectTimeline.tsx` rendered "All Caught Up!" whenever `next_steps` was empty, even if the project was open and incomplete.
- **Files changed**:
  - `src/components/projects/ProjectTimeline.tsx`
- **Database changes**: None.
- **Internal skills used**: `ui-ux-audit`, `timeline-audit`.
- **REA contribution, if applicable**: Evaluated timeline empty states against open task counts.
- **Tests passed**: `tests/unit/project-finished-status.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Verified "All Caught Up!" is strictly displayed when project is finished.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.

---

### Repair Report 12

- **Defect**: Project and task data can become stale after changes.
- **Root Cause**: `taskService.ts` only checked `related_to_project`, ignoring `project_id` when invoking `recalculateProjectProgress`.
- **Files changed**:
  - `src/services/taskService.ts`
- **Database changes**: None.
- **Internal skills used**: `task-domain-audit`, `cache-invalidation-audit`.
- **REA contribution, if applicable**: Traced progress recalculation invocation on task status change events.
- **Tests passed**: `tests/unit/project-task-domain.test.mjs`, `tests/unit/project-portal-repairs.test.mjs`.
- **Tests failed**: 0.
- **Client portal verification**: Verified task mutations trigger progress recalculation and invalidate stale cache entries.
- **Outstanding issues**: None.
- **Deployment status**: Staged locally on `feat/a-z-autonomous-engineering-repair`.
