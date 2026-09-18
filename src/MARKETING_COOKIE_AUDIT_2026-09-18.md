# Marketing Site and Cookie UX Audit

**Repository:** `masilo-dev/alphaclone-nextjs`  
**Date:** 2026-09-18  
**Scope:** Public marketing shell, header, footer, cookie consent banner, cookie preference modal, and Cookie Policy page.

## Findings

The cookie banner previously offered only “Accept All” and “Manage”, with no direct essential-only choice. Its consent model exposed functional and analytics settings but omitted the Marketing category described by the Cookie Policy. This created a mismatch between the public policy and the actual preference center.

The Cookie Policy stated that visitors could open “Cookie Preferences” from the footer, but the marketing footer did not expose that control. The preference entry point was therefore difficult to discover after the banner was dismissed.

The cookie-policy category cards and icons used dynamically constructed Tailwind class names. Because utility scanning cannot reliably detect those runtime-generated class names, the intended category accent colors could be missing in production. The category accordions also lacked explicit button type and expanded-state accessibility metadata.

## Changes applied

The consent state now includes `marketing`, while remaining backward-compatible with existing stored preferences. The banner now presents clear choices for **Essential only**, **Manage**, and **Accept all**, links directly to the Cookie Policy, and uses a more structured, higher-contrast visual hierarchy. The preference modal now includes Functional, Analytics, and Marketing categories with accessible toggle states and dialog semantics.

The marketing footer now has a persistent **Cookie preferences** button that reopens the preference center. Marketing language-switcher styling was also refined with clearer focus and hover states.

The Cookie Policy now uses explicit static accent classes for each category, ensuring color rendering survives Tailwind production builds. Its accordion controls now expose `aria-expanded` and `aria-controls` and use explicit button types.

## Verification

`git diff --check` passes, and `npm run typecheck` passes with exit code 0. The changes are limited to the public marketing shell, legal cookie UI, and cookie policy presentation; authenticated dashboard behavior remains unchanged.
