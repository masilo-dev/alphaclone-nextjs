# Alphaclone OS theme

## Direction

Alphaclone OS is a dark, calm, atmospheric business operating system. Its background should remain perceptible through restrained translucent layers. It is not a flat blue dashboard.

## Color roles

- Canvas: near-black graphite/navy atmosphere.
- Elevated surface: translucent charcoal/navy with subtle blur and a low-contrast white border.
- Strong surface: used sparingly for data tables, drawers, and focused work.
- Primary blue: action, focus, selected state, and CRM identity—not page fill.
- Semantic colors: teal/emerald for positive, amber for attention, rose for risk, violet/indigo for integrations.
- Text: near-white primary, slate secondary, muted slate metadata.

Actual tokens live in:

- `src/constants/brand.ts`
- `src/constants/design.ts`
- CSS variables such as `--brand-blue-500`, `--ws-text-secondary`, and per-module `--module-*-primary`.

## Shape and depth

- Outer panels: 16–20px radius.
- Controls: 10–12px radius; pills only for short statuses and filters.
- Borders: white at roughly 5–10% opacity.
- Shadows: soft black depth; avoid large blue glows.
- Blur: subtle and limited to elevated surfaces.

## Typography and spacing

- Clear OS page title, compact section labels, readable 13–14px operational text.
- Desktop page gutter 24px; tablet 16px; mobile 12px.
- Section gap 20px; related-control gap 8–12px.
- Dense record rows remain scannable and keep 44px minimum touch targets.

## Accessibility

Preserve visible focus, adequate contrast, reduced-motion behavior, keyboard access, and non-color status labels.
