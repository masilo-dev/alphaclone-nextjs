# Extractable component opportunities

## Implement first

- `OsWorkspaceSurface`: translucent atmospheric content surface with restrained border and optional elevation.
- `ModuleSection`: consistent section heading, description, action slot, spacing, and surface treatment.
- `ModuleToolbar`: responsive search/filter/action bar with one spacing contract.
- `SegmentedViewControl`: shared tabs or list/board control; blue limited to the active item.
- `IntegrationNotice`: semantic compact provider notice that does not become a full-width blue band.
- `RecordListSurface`: shared list/table container and row spacing.

## Reuse existing

- `ModuleFrame`
- `ModuleHeader`
- `SubNavigation`
- `ModulePageLayout`
- `KpiCard`
- `RecordHeader`
- `StandardStatusBadge`

## Do not duplicate

- Secondary navigation
- Page-size background layers
- Per-module search bars, segmented controls, or status badge color maps
- Literal blue palettes when a brand/module token exists
