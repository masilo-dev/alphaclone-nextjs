# Page inventory

## CRM workspace (priority)

Source: `src/components/dashboard/CRMTab.tsx`, render section lines 2,139–2,490.

Required content:

- Compose Email, Quick Add, Lead Board, operational workflow, and sync actions.
- Leads Pool, Customers, and Active Book metrics.
- Pipeline integrity and client pulse.
- Leads, Customers, and Contacts modes with counts.
- Outlook sync notice when connected.
- Search, status/stage filters, list/board toggle, import, selection and bulk actions.
- Responsive table/card list and lead kanban.
- Add-record floating action, qualify/create/detail flows.

Known defects:

- Root and nested content force opaque slate backgrounds, covering the atmospheric shell.
- Header, stats, toolbar, and list use disconnected bands with inconsistent horizontal padding.
- Literal blue and token blue are mixed, making blue visually dominant.
- Desktop record rows still resemble the old CRM design.

## CRM subpages

Accounts, reports, follow-ups, console, and unified contacts must inherit the same frame, spacing, surfaces, and control language.

## Other modules

Leads, deals, tasks, projects, mail, social, documents, and business operations should consume the same shared OS surface and spacing primitives. Do not redesign their business logic while establishing the shared standard.
