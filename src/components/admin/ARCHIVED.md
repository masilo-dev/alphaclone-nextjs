# Archived admin components

## SuperAdminDashboard.tsx (removed)

The monolith at `src/components/admin/SuperAdminDashboard.tsx` was **never wired to any route**. It contained mock metrics, simulated admin actions, and duplicated the live implementation under `src/components/dashboard/admin/`.

**Use instead:**
- `/dashboard/admin/tenants` → `SuperAdminTenantsTab.tsx`
- `/dashboard/admin/users` → `SuperAdminUsersTab.tsx`
- `/dashboard/admin/settings` → `GlobalSettingsTab.tsx`
- `/dashboard/admin/operations` → `OperationsConsoleTab.tsx`

## UserLocationTable.tsx (unwired)

`UserLocationTable.tsx` remains in the codebase but is not linked from navigation. Wire it to a platform admin route or remove in a future cleanup pass.
