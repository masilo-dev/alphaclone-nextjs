# Dashboard UI and Language Audit

**Repository:** `masilo-dev/alphaclone-nextjs`  
**Scope:** Authenticated dashboard shell, home module launcher, attention panel, account controls, and dashboard translation coverage.  
**Date:** 2026-09-18

## Findings

The dashboard language selector was difficult to discover because it was only available inside the account menu. The compact selector also displayed country codes (`GB`, `ES`, `PL`) without a clear selected-state affordance. The reusable selector had limited keyboard semantics and did not expose a visible language label in the main dashboard toolbar.

The dashboard also contained helper copy that bypassed the translation wrapper. The initial static audit found 27 dashboard strings used by `t(...)` without Spanish or Polish catalog entries. These strings would silently remain in English after changing the selected language, creating an inconsistent mixed-language experience.

The attention panel had additional hard-coded helper labels for its description, owner, and due date metadata. The account-menu selector listed only the English language labels, which was less clear for users reading the interface in another language.

## Changes applied

The dashboard toolbar now includes a visible language control next to the other global controls. It shows the current native language name and ISO code, uses a clear dropdown affordance, supports `aria-expanded`, `aria-haspopup`, `role="listbox"`, and `aria-selected`, and marks the active option with a check icon. The account-menu selector now shows native name, translated name, and code together.

The attention panel’s helper description, owner label, and due label now use the shared translation function. Spanish and Polish translations were added for the 27 previously uncovered dashboard strings, including account-menu labels, business dashboard module names, focus-mode controls, and workspace setup states.

## Verification

The final dashboard translation audit reports **221 unique dashboard translation keys with 0 missing catalog entries**. `git diff --check` passes, and `npm run typecheck` passes with exit code 0.

This audit covers dashboard strings routed through the existing `t(...)` wrapper. It does not claim that every free-form string in every dashboard feature has been internationalized; feature-specific forms and generated content may still contain intentionally localized or unwrapped copy and should be audited separately if full product-wide localization is required.
