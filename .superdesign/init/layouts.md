# Layouts

## Dashboard shell

`src/components/Dashboard.tsx` owns routing and the application shell. CRM routes resolve as:

- `/dashboard/crm` → `CrmDashboard` (overview)
- `/dashboard/crm/workspace` → `CRMTab`
- `/dashboard/crm/unified-contacts` → `ClientsPage`
- `/dashboard/crm/reports` → `CRMReportsTab`
- `/dashboard/crm/console` → `SalesConsole`
- `/dashboard/crm/accounts` → `AccountsPage`
- `/dashboard/crm/follow-ups` → `FollowUpQueue`

The global dashboard already provides the atmospheric background, rail/header, and responsive viewport. Module pages must not paint an opaque page-sized background over it.

## Standard module frame

`ModuleFrame`:

1. Module identity header
2. One shared secondary navigation
3. Module body

It uses `space-y-5`, `.ac-scroll-full`, and `.ac-enterprise-module`.

## Standard list module

`ModulePageLayout`:

1. Optional contextual header
2. Optional toolbar
3. Optional stat section
4. Scrollable primary content

For the redesign, place all four inside a consistent content container with 24px desktop gutters, 16px tablet gutters, 12px mobile gutters, and a predictable 16–20px vertical rhythm. Avoid separate full-width background bands for every section.

## CRM workspace dependency tree

Dashboard shell
└── ModuleFrame (CRM identity + CRM subnavigation)
    └── CRM workspace
        ├── Compact command row
        ├── CRM health summary
        │   ├── KPI cards
        │   ├── Pipeline integrity
        │   └── Client pulse
        ├── Workspace toolbar
        │   ├── Leads / Customers / Contacts tabs
        │   ├── Search
        │   ├── Filters and list/board toggle
        │   └── Bulk actions
        └── Data workspace
            ├── Record list
            ├── Lead kanban
            └── Record drawer / creation flows
