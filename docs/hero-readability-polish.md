# Hero readability polish

Focused follow-up to the approved homepage. Headline, section order, brand colors and overall composition preserved.

Changes: stronger white background overlay; softer device/card shadows; opaque preview cards; shared 14px UI tokens for preview labels; increased card separation; widened mobile result card to prevent clipping; plain-language homepage explanation; descriptive preview status in place of the non-interactive View in CRM label; mobile screenshot lazy-loaded.

Validation: TypeScript typecheck and targeted ESLint passed. All 14 marketing atmosphere, CTA and performance guard tests passed using the repository's tsx/server-only test loader. git diff --check passed. Isolated Chromium hero fixture using repository styles checked 320, 360, 375, 390, 412, 430, 768, 1024 and 1440px: no horizontal overflow, result-card clipping or instruction/result-card overlap. Keyboard reached a CTA anchor; reduced-motion transition duration was 0.01ms.

Limits: isolated fixture omits Next image rendering, real font assets, surrounding navigation and runtime providers. Full application browser rendering stalled locally with missing service configuration; no full-page visual sign-off, production build, Lighthouse score or live deployment verification is claimed. Existing homepage end-to-end audit still targets an older hero implementation and requires a separate update. No dependencies, assets, animations or business logic added.
