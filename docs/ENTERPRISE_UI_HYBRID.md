# Enterprise UI — Hybrid Design System (v1)

AlphaClone uses **enterprise structural patterns** with the **existing brand palette** (teal, dark slate, violet accents). This is not the Office-style light theme from the original enterprise spec.

## Principles

1. **No hidden content** — lists and drawers scroll fully (`ac-scroll-full`)
2. **Mobile-first** — bottom drawer on mobile, right drawer on desktop
3. **Consistent KPI cards** — `MetricCard` / `ModuleStatCards` anatomy (32px value, trend, comparison)
4. **44px touch targets** — buttons, filters, row actions
5. **Semantic tables** — `ac-data-table` or `EnterpriseDataTable`

## Imports

```tsx
import {
  ModuleShell,
  ModulePageLayout,
  DetailDrawer,
  EnterpriseDataTable,
  EnterpriseTabWrapper,
  MetricCard,
  StatusBadge,
  dealStatusVariant,
  invoiceStatusVariant,
  quoteStatusVariant,
  ENTERPRISE,
} from "@/components/ui/enterprise";
```

## New dashboard modules checklist

- [x] Root: `ac-scroll-full ac-enterprise-module` (or wrapped by `EnterpriseTabWrapper` via Dashboard)
- [x] Summary row: `ModuleStatCards` or `MetricCard`
- [x] Detail views: `DetailDrawer` (not full-page replace for record detail)
- [x] Lists 20+ rows: `EnterpriseDataTable` or `useInfiniteScroll`
- [x] Status fields: `StatusBadge` + domain helpers (`dealStatusVariant`, etc.)
- [x] Forms: `useBlurValidation` via `Input` `validate` prop

## Migrated modules (v1)

| Module              | Table                          | Drawer                   | StatusBadge     |
| ------------------- | ------------------------------ | ------------------------ | --------------- |
| Tasks               | list + infinite scroll         | create + detail          | —               |
| Deals               | list + infinite scroll         | create + detail          | stage           |
| Quotes              | EnterpriseDataTable            | create + edit + detail   | status          |
| Finance             | EnterpriseDataTable (invoices) | expense + invoice detail | invoice/expense |
| Contact Submissions | EnterpriseDataTable            | detail                   | inbox           |
| CRM                 | responsive table               | create + qualify         | —               |
| DeepDesk            | split pane                     | create ticket            | —               |
| Admin Users         | EnterpriseDataTable            | —                        | user status     |
| Document Vault      | table                          | upload                   | —               |

## Tokens

See `ENTERPRISE` in `src/constants/design.ts` and utilities in `src/app/globals.css` (`ac-*` classes).

## Full-bleed routes

Mail, messages, tasks (edge layout), PWA settings — see `ENTERPRISE_FULL_BLEED_TABS` in `EnterpriseTabWrapper.tsx`.

## Intentional center modals

Small confirmations, compose email, payment flows, video rooms, and command palette remain center modals or full-screen overlays.
