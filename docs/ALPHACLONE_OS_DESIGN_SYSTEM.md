# Alphaclone OS Design System

Canonical tokens and shell for the authenticated Alphaclone Systems platform.

## Sources of truth

| Concern | Location |
|--------|----------|
| Brand colours, module identity, chart rules | `src/constants/brand.ts` |
| Workspace / enterprise layout tokens | `src/constants/design.ts` |
| CSS variables + shell chrome | `src/app/globals.css` |
| Custom module icons | `src/components/icons/alphaclone/` |
| Shared OS primitives | `src/components/ui/os/` |
| Module subnavigation map | `src/lib/dashboard/moduleSubnav.ts` |

## Brand rules

- Primary action colour: brand blue (`#356AF4`)
- Bonnie / intelligence: violet (`#8950F5`)
- Sidebar: deep navy in both light and dark mode
- Light canvas: `#F5F7FB`; dark canvas: `#0C1220`
- Do not flood module pages with the module colour — use it for icons, active markers, accents, and chart series

## Shared primitives

Import from `@/components/ui/os` or `@/components/ui/enterprise`:

- `ModuleFrame`, `ModuleHeader`, `SubNavigation`
- `KpiCard`, `AttentionPanel`, `TodayPanel`, `ModuleLauncher`
- `BonnieInsightCard`, `OverviewChartCard`
- `OsEmptyState`, `OsErrorState`, `OsLoadingBlock`

## Icons

Use `getModuleIcon(moduleId)` for module identity. Variants: `outline`, `filled`, `duotone`. Lucide remains acceptable for generic UI affordances (chevrons, close, search), not as final module marks.

## Progressive rollout

1. Tokens + shell (done)
2. Home dashboard (done)
3. Hub chrome + CRM overview (done)
4. Bonnie drawer, settings categories, communication composer shell (done)
5. Remaining module interiors adopt `KpiCard` / `RecordHeader` / OS states without replacing APIs or business logic

## Global assistants

- `BonnieDrawerProvider` + `BonnieDrawer` — contextual drawer from the FAB; full workspace still available
- `CommunicationComposer` — channel shell for record-level compose (inject existing send forms as children)
- Settings category nav maps admin areas without removing existing accordion sections
