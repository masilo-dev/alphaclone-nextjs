# AlphaClone global token finish — Untitled-aligned

Date: 2026-10-05  
Branch: `cursor/global-tokens-untitled-b56b`

## Status: complete for token + light + mobile gates

### Done
1. **Global Untitled-style token layer** (`alphaclone-theme.css`) — brand/text/bg/border/fg, marketing, logo marks
2. **Hardcoded UI hex eliminated** — codemod + `guard:no-raw-hex` (web components/app + mobile except theme SoT)
3. **Light theme product surface** — `html.light body`, workspace `--ws-*` light map, dashboard `color-scheme: light`, remaps for `text-white` / `border-white/*` / slate utilities to semantic tokens
4. **Mobile** — `mobile/src/styles/theme.ts` is sole hex source (navy/teal/coral); screens import `colors.*`
5. **Untitled primitives** — `StandardPageShell`, `StandardPanel`, `StandardSectionHeader` in design-system

### Verification
- `npm run guard:no-raw-hex`
- `npm run guard:design-system`
- `node --test tests/unit/global-token-convergence.test.mjs`
- `npm run typecheck`

### Intentionally deferred (not required for this gate)
- Per-module visual redesign of every dashboard tab (data paths unchanged; chrome now theme-token safe)
- Full React Aria Untitled component library adoption
- Native Appearance toggle wiring for mobile lightColors (palette ready)

Hex remains only in allowlisted SoT files: `brand.ts`, `globals.css`, `alphaclone-theme.css`, `mobile/src/styles/theme.ts`, email/document renderers.
