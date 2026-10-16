# AlphaClone Systems — Product Tour & Help Center Engineering Audit

## 1. Executive Summary & Capabilities
The Product Tour & Help Center module delivers non-blocking, guided onboarding tours, versioned walkthrough state persistence in localStorage, and an indexed enterprise terminology glossary with contextual search.

## 2. Competitive Benchmark
- **Competitors**: Userpilot, Appcues, Intercom Product Tours.
- **Comparison**:
  - *Userpilot / Appcues*: External scripts that inject bloated iframes and slow down LCP.
  - *AlphaClone Systems*: Native Joyride integration with internal scroll clamping (`resetWindowScroll`), dismissible and resumable walkthrough records (`src/lib/onboarding/walkthroughService.ts`), and localized glossary search (`src/config/platformGlossary.ts`).

## 3. Defects Identified & Repaired
- **DEF-HLP-01 (P1: App Shell Scroll Offset Disruption)**:
  - *Root Cause*: Third-party tooltips scrolling the global window object threw the fixed-height app shell above the fold, causing visual blank screens.
  - *Repair*: Added `resetWindowScroll()` and oversized anchor protection in `src/components/onboarding/ProductTour.tsx`.
  - *Files Changed*: `src/components/onboarding/ProductTour.tsx`.

## 4. Automated Test Evidence
- **Suite**: `tests/unit/final-10-modules.test.mjs` (Test 6).
- **Result**: PASSED (Walkthrough record versioning, state persistence, and glossary search verified).\n