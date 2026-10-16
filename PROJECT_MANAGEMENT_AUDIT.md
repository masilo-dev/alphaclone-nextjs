# AlphaClone Systems — Project Management Module Audit

## 1. Executive Summary

This document presents the complete P0–P2 engineering audit of the Project Management module within AlphaClone Systems (`alphaclonesystems.com`). The audit investigates project lifecycle management, creation workflows across dashboard and MCP, task and milestone domain models, progress calculation, stage transitions, tenant isolation, and client portal synchronization.

All 12 previously reported project management defects were investigated, root causes identified, and fixes verified with automated unit and integration tests.

---

## 2. Architecture & Component Inventory

### 2.1 Domain Models & Database Persistence
- **Dual Table Schema**: `projects` and `business_projects` with cross-table schema resilience and tenant isolation (`tenant_id`).
- **Canonical Stage Model**: 5-step lifecycle defined in `src/lib/projects/projectEnums.ts`:
  1. `Initiation` (Step 1/5)
  2. `Planning` (Step 2/5)
  3. `Execution` (Step 3/5)
  4. `Review` (Step 4/5)
  5. `Closure` (Step 5/5)
- **Operational Status Model**: `Active`, `Pending`, `Completed`, `Declined`, `in_progress`, `review`, `cancelled`, `done`.
- **Milestones**: `project_milestones` managed via `src/services/milestoneService.ts` and `src/lib/projects/milestoneMutationServer.ts`.
- **Tasks**: `tasks` managed via `src/services/taskService.ts` and `src/lib/projects/projectTaskDomain.ts`.
- **Activity & Outbox**: `project_activity`, `workspace_activity`, and durable transactional outbox `project_notification_outbox`.

### 2.2 Core Services & Commands
| Component | File Path | Functionality |
| :--- | :--- | :--- |
| Project Create Command | `src/lib/execution/commands/projectCreateCommand.ts` | Transactional project creation, template hydration, idempotency, portal provisioning |
| Project Service | `src/services/projectService.ts` | Project queries, updates, real-time channels, role-based visibility |
| Project Stage Service | `src/services/projectStageService.ts` | Stage transition rules, requirements validation, backward transition guardrails |
| Milestone Server Service | `src/lib/projects/milestoneMutationServer.ts` | Atomic milestone mutations, calendar sync, progress recalculation |
| Task Domain Service | `src/services/taskService.ts` | Task lifecycles, subtasks, dependencies, progress triggers |
| Notification Outbox | `src/lib/projects/projectNotificationOutbox.ts` | Durable transactional delivery, suppression policies, reconciliation |

---

## 3. Detailed Audit of the 12 Identified Defects

### Defect 1: Stage dropdown displays Planning while the project card still displays Active
- **Component**: `src/components/dashboard/business/ProjectsPage.tsx`, `src/services/projectStageService.ts`
- **Root Cause**: Operational status (`Active`, `Completed`) and lifecycle stage (`Initiation`, `Planning`, `Execution`, `Review`, `Closure`) were rendered ambiguously without explicit labels. Additionally, transitioning out of `Closure` did not restore `status` to `Active`, leaving cards marked `Completed` while the dropdown showed `Planning`.
- **Remediation**:
  - Explicitly labeled `Status: {statusLabel}` in desktop and mobile views.
  - In `projectStageService.ts` and `handleStageUpdate`, transitioning to any stage other than `Closure` restores operational status to `Active`.

### Defect 2: Project step counts and progress do not match the selected stage
- **Component**: `src/components/dashboard/business/ProjectsPage.tsx`, `src/lib/projects/projectEnums.ts`
- **Root Cause**: Ad-hoc string matching and missing fallback baseline progress caused newly created or unseeded projects in later stages to display 0% progress and `Step 0/5`.
- **Remediation**:
  - Replaced ad-hoc stage mapping with canonical `toCanonicalProjectStage` and `STAGE_LIFECYCLE_STEP`.
  - Added baseline progress weighting for stage progression when tasks/milestones are not yet seeded.

### Defect 3: Initiation and Discovery appear as inconsistent stage concepts
- **Component**: `src/lib/execution/commands/projectCreateCommand.ts`, `src/app/api/tenant/[tenantId]/projects/route.ts`
- **Root Cause**: Creation commands and API routes defaulted `currentStage` to legacy `'Discovery'` instead of canonical `'Initiation'`.
- **Remediation**:
  - Updated API route schemas and create commands to default to `'Initiation'` and canonicalize with `toCanonicalProjectStage`.

### Defect 4: The UI gives no clear confirmation that a stage was saved
- **Component**: `src/components/dashboard/business/ProjectsPage.tsx`
- **Root Cause**: Backward transitions were disabled in the select dropdown (`disabled={idx < currentIdx}`), and successful transitions did not display an affirmative step indicator toast.
- **Remediation**:
  - Enabled backward stage selection with confirmation.
  - Added clear toast displaying `Stage saved: Step X/5 — StageName`.

### Defect 5: Invalid stage transitions fail without explaining the missing requirements
- **Component**: `src/components/dashboard/business/ProjectsPage.tsx`, `src/services/projectStageService.ts`
- **Root Cause**: `validateTransition` returned `missingRequirements`, but `handleStageUpdate` only displayed a generic error toast.
- **Remediation**:
  - Formatted missing requirements into user-friendly error alerts detailing exact missing fields (e.g. `Missing Project Name, Description, Due Date`).

### Defect 6 & 7: Projects created through MCP are not always visible & INVALID_ARGUMENT error
- **Component**: `src/lib/mcp/tools/projects.ts`, `src/lib/clientPortal/projects.ts`
- **Root Cause**:
  - MCP schema threw `INVALID_ARGUMENT` on empty string client IDs.
  - MCP create tool did not pass `portal_enabled`, defaulting `client_visible` to `false` in project metadata.
  - Non-admin dashboard users were filtered by strict `owner_id = userId`.
- **Remediation**:
  - Replaced strict UUID validation with `optionalUuidOrEmpty` in MCP tools.
  - Automatically enabled `portal_enabled`, generated `portal_token`, and set `client_visible: true` when `client_id` is provided.
  - Allowed workspace team members to view projects in their tenant.

### Defect 8 & 9: Milestone updates do not reliably notify clients & Client email notifications missing
- **Component**: `src/lib/projects/projectClientNotification.ts`, `src/lib/projects/projectNotificationOutbox.ts`
- **Root Cause**:
  - `loadProjectForClientNotify` only looked in `projects` (skipping `business_projects`).
  - Outbox was missing an `enqueueProjectNotification` utility to write to `project_activity` and `project_notification_outbox`.
- **Remediation**:
  - Added dual table lookup in `loadProjectForClientNotify`.
  - Implemented and exported `enqueueProjectNotification` for durable lifecycle event dispatch.

### Defect 10: Recent activity does not accurately reflect project events
- **Component**: `src/services/projectStageService.ts`, `src/lib/projects/milestoneMutationServer.ts`
- **Root Cause**: Milestone and stage transitions failed to emit client-visible `workspace_activity` records.
- **Remediation**:
  - Integrated `appendWorkspaceActivity` across stage updates and milestone mutations.

### Defect 11: The dashboard sometimes says everything is caught up despite outstanding work
- **Component**: `src/components/projects/ProjectTimeline.tsx`
- **Root Cause**: Timeline rendered "All Caught Up!" whenever `next_steps` was empty, even if the project was incomplete.
- **Remediation**:
  - Restricted "All Caught Up!" to completed projects (`progress === 100` or `Closure`); otherwise displays "No Scheduled Next Steps" with actionable guidance.

### Defect 12: Project and task data can become stale after changes
- **Component**: `src/services/taskService.ts`
- **Root Cause**: Task mutations only checked `related_to_project` when triggering progress recalculation, ignoring `project_id`.
- **Remediation**:
  - Updated `createTask`, `updateTask`, and `deleteTask` to check both `related_to_project || project_id`.

---

## 4. Test Evidence & Validation
- **Unit Test Baseline**: All 257 suites pass (`tests/unit/*.test.mjs`), including dedicated regression suite `tests/unit/project-portal-repairs.test.mjs`.
- **Production Guardrails**: `npm run validate:prod-guards` reports 0 violations.
