# Shared UI components

## Alphaclone OS primitives

- `src/components/ui/os/ModuleFrame.tsx`: standard module wrapper. It renders `ModuleHeader`, optional `SubNavigation`, and `.ac-module-frame-body`; module accent is exposed through `--module-accent`.
- `src/components/ui/os/ModuleHeader.tsx`: compact module identity, icon, title, meaning, and optional actions. Typography comes from `WORKSPACE.typography.pageTitle`.
- `src/components/ui/os/SubNavigation.tsx`: shared secondary route navigation; use it once per module.
- `src/components/ui/os/KpiCard.tsx`: OS metric card with restrained semantic accents.
- `src/components/ui/os/RecordHeader.tsx`: shared record detail identity and actions.
- `src/components/ui/ModulePageLayout.tsx`: list layout ordered as header, toolbar, stats, scrollable content. It currently adds inconsistent local spacing (`px-1 py-2 mb-2`, then independent stats margins).

## CRM components

- `src/components/dashboard/CRMTab.tsx`: legacy all-in-one CRM workspace (2,570 lines). Contains command actions, integration sync, metrics, pipeline integrity, client pulse, lead/customer/contact tabs, filters, list and board views, bulk actions, drawers, and modals.
- `src/components/dashboard/crm/CRMActionChips.tsx`: small contextual CRM actions.
- `src/components/dashboard/crm/CrmSyncToolbar.tsx`: provider sync controls.
- `src/components/dashboard/crm/RevenueLeakagePanel.tsx`: revenue risk panel.
- `src/components/dashboard/crm/KanbanBoard.tsx`: standalone pipeline board.
- `src/components/dashboard/crm/AccountsPage.tsx`, `SalesConsole.tsx`, `FollowUpQueue.tsx`, `CRMReportsTab.tsx`: CRM subpages with independent visual treatments.

## Current visual conflict

The shell uses atmospheric OS surfaces, but `CRMTab` applies opaque `bg-slate-950` on the root, tabs, toolbar, and record viewport. It also mixes literal `blue-*`, Indigo, slate, and `--brand-blue-*` styles. Preserve functions and states, but replace these nested page fills with shared translucent workspace surfaces. Blue should identify selection and primary action only.
