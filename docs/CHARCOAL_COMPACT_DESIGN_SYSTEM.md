# AlphaClone Systems — Charcoal Dark & Compact Density Design System

## 1. System Overview

AlphaClone Systems uses a premium charcoal dark theme by default, eliminating legacy blue-heavy backgrounds (`#0D0F18`, `#171A26`, `#1B1E2B`) and radial light gradients in favor of an ultra-clean, productivity-focused dark aesthetic.

The application also enforces an **Ultra-Compact Global Density System** designed for high information density, rapid scanning, and minimal wasted whitespace while preserving accessibility and touch friendliness.

---

## 2. Semantic Color Tokens

### Charcoal Dark Palette (`[data-theme="dark"]`, `html.dark`)

```css
:root[data-theme="dark"], html.dark {
  color-scheme: dark;

  --app-bg: #111113;
  --sidebar-bg: #151517;
  --header-bg: #151517;

  --surface-1: #19191C;
  --surface-2: #202024;
  --surface-3: #29292E;

  --border-subtle: #2C2C31;
  --border-strong: #3A3A40;

  --text-primary: #F2F2F3;
  --text-secondary: #B0B0B8;
  --text-muted: #85858F;

  --accent: #4D8DFF;
  --success: #36B98A;
  --warning: #E5AC55;
  --danger: #E36B72;
}
```

### Surface Elevation Roles

| Token | Hex | Role |
|---|---|---|
| `--app-bg` | `#111113` | Root page background, full-bleed canvas |
| `--sidebar-bg` | `#151517` | Left navigation sidebar background |
| `--header-bg` | `#151517` | Top sticky toolbar and navigation bar |
| `--surface-1` | `#19191C` | Primary cards, panels, list containers |
| `--surface-2` | `#202024` | Hover states, secondary cards, active items |
| `--surface-3` | `#29292E` | Modals, flyouts, popovers, elevated sheets |
| `--border-subtle` | `#2C2C31` | Default component borders, dividers |
| `--border-strong` | `#3A3A40` | Focused borders, active tabs, modal borders |

---

## 3. Density Modes

The application supports two density modes, toggled via the Theme/Density control in the header:

### Mode 1: Compact (Default)
- **Active Attribute**: `[data-density="compact"]` (or default on `:root`)
- **Storage**: `localStorage.getItem('ac-density') === 'compact'`
- **Typography**:
  - Page Headings: `17–19px` (`1.125rem`), font-semibold
  - Section Headings: `13–15px` (`0.875rem`), font-semibold
  - Card Headings: `12–13px` (`0.8125rem`), font-medium
  - Body Text: `12–13px` (`0.78125rem`), line-height: 1.4
  - Form & Table Labels: `11–12px` (`0.75rem`), font-medium
- **Controls**:
  - Buttons: `28–32px` (`h-7` sm, `h-7.5 md:h-8` md/default)
  - Inputs: `30–34px` (`min-h-[30px] sm:min-h-[32px]`)
  - Table Rows: `32–38px` (`h-[34px]`, padding `8px 12px`)
  - Card Padding: `8–12px` (`p-2 sm:p-2.5 md:p-3`)
  - Standard Gaps: `4–8px` (`gap-2 md:gap-2.5`)

### Mode 2: Comfortable (Accessibility Opt-in)
- **Active Attribute**: `[data-density="comfortable"]`
- **Storage**: `localStorage.getItem('ac-density') === 'comfortable'`
- **Typography**:
  - Page Headings: `22px` (`1.375rem`)
  - Section Headings: `16px` (`1rem`)
  - Body Text: `14px` (`0.875rem`), line-height: 1.55
- **Controls**:
  - Buttons: `36–40px`
  - Table Rows: `44–48px` (padding `14px 16px`)
  - Card Padding: `16–20px`
  - Standard Gaps: `12–16px`

---

## 4. Mobile & PWA Optimization

On mobile screens (320px – 768px):
- Visual sizing remains compact while interactive elements maintain accessible touch areas (`min-h-10 min-w-10` to `min-h-11 min-w-11`).
- Page padding automatically adjusts to `12px` horizontally with safe-area inset preservation.
- All tables and tab lists use inline horizontal scrolling with touch deceleration (`-webkit-overflow-scrolling: touch`), preventing horizontal page overflow.

---

## 5. Architectural Rules & Guards

1. **No Raw Hex In Components**: All colors must use CSS variables (`var(--app-bg)`, `var(--surface-1)`, etc.) or semantic utility classes. Raw `#RRGGBB` hex codes outside designated token source files will trigger `guard-no-raw-hex.mjs`.
2. **No CSS Zoom Hacks**: Sizing must be token-driven via CSS variables, typography tokens, and padding classes. `zoom:` or `transform: scale()` on root containers is prohibited and blocked by `guard-charcoal-density.mjs`.
3. **CI Validation**: Both `guard-charcoal-density.mjs` and `guard-no-raw-hex.mjs` run automatically as part of `npm run validate:prod-guards`.
