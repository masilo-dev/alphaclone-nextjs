# AlphaClone global token finish — Untitled-aligned

Date: 2026-10-05  
Branch: `cursor/global-tokens-untitled-b56b`

## 1. What was audited

- `src/app/globals.css` (`@theme`, `:root`, marketing theme, workspace `--ws-*`)
- `src/constants/brand.ts` / `design.ts`
- Shared primitives: `button`, `input`, `badge`, `sheet`
- Competing stylesheets: `alphaclone-os-v3*.css`, marketing CSS, apple-fluid, crisp-product
- Untitled UI React docs: installation, theming, typography (semantic `--color-brand-*`, `--color-text-*`, `--color-bg-*`, `--color-border-*`)

## 2. What was changed

- Added `src/styles/alphaclone-theme.css` as finishing Untitled-style semantic token layer
- Loaded it from `layout.tsx` immediately after `globals.css`
- Converged legacy `--brand-blue-*`, `--ac-accent`, `--ac-bonnie`, neon dashboard electric/violet to **navy / teal / coral**
- Remapped intelligence/Bonnie from purple to navy slate
- Updated marketing luxury shadows away from purple glow
- Synced module identity accents in `brand.ts`
- Hardened `design-system-guard.mjs` + unit tests
- Updated OS design docs to match the finished tokens

## 3. Untitled UI patterns adopted

- Semantic token naming: `--color-brand-*`, `--color-text-*`, `--color-bg-*`, `--color-border-*`, `--color-fg-*`
- Brand scale 50–950
- Soft shadow ladder (`xs`→`xl`), restrained radius scale
- Light/dark semantic overrides without OS-preference bleed

## 4. AlphaClone components / tokens created

- `alphaclone-theme.css` finishing layer + utility helpers (`.ac-text-*`, `.ac-bg-*`, `.ac-border-*`, `.ac-ring-brand`)
- `BRAND_INTELLIGENCE` alias in `brand.ts`

## 5. Functionality preserved

- No API/backend/auth/RLS changes
- Existing `--ws-*` workspace consumers keep working via aliases
- Button/input/badge continue using semantic CSS vars

## 6. Issues discovered

- Dual brand truth: electric blue `#356AF4` + purple `#8950F5` in CSS vs teal/navy/coral in `brand.ts`
- Neon dashboard tokens (`#00f0ff`, `#7f00ff`)
- Marketing theme purple luxury glow
- Docs still claimed violet Bonnie / electric primary

## 7. Issues fixed

- Global accent / brand-blue / bonnie / marketing / neon dashboard aliases
- Focus ring tokens
- Module identity purple accents
- Guard + regression coverage for token drift

## 8. Issues remaining

- Hardcoded `#356AF4` / `#8950F5` still exist in some feature modules (outbound, hubs, billing, etc.) — next pass should replace with tokens
- Full Untitled UI component adoption (tables/drawers/modals/shell IA per 19-phase brief) is **not** complete; this PR finishes the **global token foundation**
- Chakra remnants and multiple CSS layers still coexist

## 9–14. Status snapshot

| Area | Status |
|------|--------|
| Mobile | Token cascade applies; no dedicated 320–1024 redesign in this PR |
| Accessibility | Focus ring now teal semantic; React Aria Untitled components not yet adopted |
| Performance | CSS-only; no new client JS |
| Functional regression | Design guards + token unit tests; backend untouched |
| Backend risks | None introduced |
| Design inconsistencies remaining | Module-level hardcoded hex + multi-stylesheet stack |

## Final standard note

This delivery makes AlphaClone **one coherent token system** (Untitled language + AlphaClone identity). Module-by-module Untitled UI shell/component migration remains the next program phase.
