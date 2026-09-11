# Projects and Tasks rebuild audit

## Current architecture findings

The production domain is usable but fragmented. `projects` is an early portfolio table
extended by later migrations; `tasks` is a CRM-oriented single-assignee table. The
dashboard exposes competing project pages (`ProjectsDashboard`, `ProjectsPage`, and
`ProjectsTab`) and two task implementations (`TasksTab` and `TaskScheduler`). Several
views read Supabase directly in the browser. Status vocabularies differ between schema,
services, APIs, and UI. Subtasks and attachments are embedded JSON, task deletion was
physical, and assignments could represent only one user.

## Reuse map

- **KEEP:** existing `projects` and `tasks` IDs and rows, tenant membership, API auth,
  shared dashboard shell, CRM relations, Calendar task reads, notifications,
  automations, comments, files/Documents, contracts, invoices, Bonnie runtime.
- **IMPROVE:** project/task APIs, status validation, soft deletion, indexes, activity,
  explainable progress/health, local navigation, loading/empty/mobile states.
- **MERGE:** `owner_id` into compatibility-backed `owner_user_id`;
  `related_to_project` into `project_id`; `assigned_to` into `task_assignees`.
- **MIGRATE:** legacy assignments and project/task relations are backfilled additively.
- **REPLACE:** JSON subtasks with checklist/subtask records for new features; UI-only
  transition rules with server validation.
- **REMOVE AFTER MIGRATION:** duplicate project/task screens and legacy compatibility
  columns, only after dual-read count validation and an observation window.

## Migration and rollback

`20260726200000_projects_tasks_operating_system.sql` is additive. It never changes
primary keys, drops tables, truncates, or deletes rows. The rollback intentionally
removes access policies only and retains new data for recovery.

Before cutover compare per tenant: project/task counts, assignment counts, status
distribution, due dates, completed timestamps, project links, comments/files, and time
totals. Keep reads and writes on compatibility columns until those comparisons pass.

## Known limitations

This foundation does not claim the later removal phase is complete. Rich-text editing,
critical-path scheduling, formula parsing, durable recurrence execution, billing side
effects, full report export, and every proposed project subview still require staged
product work and production-schema verification. No financial side effect is enabled.
