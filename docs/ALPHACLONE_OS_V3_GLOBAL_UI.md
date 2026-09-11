# AlphaClone OS v3 — Global UI Contract

AlphaClone OS v3 upgrades interaction quality globally without changing AlphaClone's brand identity.

## Non-negotiable brand identity

- Primary AlphaClone blue remains `#356AF4`.
- Bonnie / intelligence violet remains `#8950F5`.
- Deep navy remains the navigation identity.
- Light canvas remains `#F5F7FB`; dark canvas remains `#0C1220`.
- Existing AlphaClone module icons and brand marks remain canonical.
- Do not imitate Apple colors, logos, macOS window chrome, or product-specific visual branding.

## Design equation

**AlphaClone identity + Apple/HIG interaction discipline + enterprise clarity + execution-first UX.**

The objective is Apple-level discipline, not an Apple clone.

## Global scope

This design contract applies to the authenticated application and public marketing experience, including:

- Home / dashboard
- CRM and clients
- Leads and prospecting
- Projects and project management
- Marketing Hub and campaigns
- Social publishing
- Documents, contracts and signatures
- Invoices and Money Hub
- Calendar
- Nexus / integrations
- Bonnie AI
- Control/admin surfaces
- Settings
- Authentication and onboarding
- Public landing and marketing pages

It is a global design-system migration, not a tenant feature flag.

## Interaction principles

1. Content remains visually dominant; controls recede until needed.
2. Use generous, consistent spacing and strong typographic hierarchy.
3. Prefer one clear primary action per context.
4. Reduce unnecessary borders, gradients, shadows and decorative noise.
5. Use depth to communicate hierarchy, not decoration.
6. Use translucent/material surfaces selectively for navigation, Bonnie, command surfaces, sheets, popovers, floating controls and modal layers.
7. Do not apply glass to every card, table or record surface.
8. Dense enterprise data remains readable and predominantly solid.
9. Motion communicates state, hierarchy and causality.
10. All motion must respect `prefers-reduced-motion`.
11. Touch targets, keyboard navigation, focus states and contrast are product requirements.
12. Mobile, tablet and desktop layouts share the same information hierarchy rather than becoming unrelated designs.

## Motion

Use shared spring-based motion primitives instead of arbitrary page-level easing.

Recommended semantic motion roles:

- `responsive`: small controls, toggles, segmented controls, selection indicators.
- `standard`: drawers, popovers, contextual panels and navigation transitions.
- `expressive`: Bonnie/command surfaces and larger state changes, used sparingly.

Transitions should be interruptible and should preserve spatial continuity. Reduced-motion mode removes decorative transforms and uses immediate or short opacity/state changes.

## Material and depth

Semantic surface hierarchy:

1. `canvas` — application background.
2. `content` — primary records, tables, forms and work areas.
3. `elevated` — menus, contextual panels and temporary secondary content.
4. `floating` — navigation controls, command bars, popovers and sheets.
5. `intelligence` — Bonnie/AI contextual surfaces, retaining Bonnie violet identity.

Glass/material treatment is permitted mainly at levels 3–5. Levels 1–2 prioritize legibility and information density.

## Projects reference implementation

Projects is the first reference module for the global system. Its information architecture should progressively converge on:

**Overview → Tasks → Timeline → Files / Design → Activity → Financials**

Bonnie actions are contextual rather than permanently competing with project content. Health, blockers, approvals and payment state use calm status language and progressive disclosure.

Once validated, these primitives and interaction patterns roll out to every module listed above.

## Marketing site

The public site uses the same brand and motion language with greater editorial spacing and product storytelling:

- confident typography and hierarchy
- generous whitespace
- real product UI as proof
- controlled scroll motion
- fewer decorative effects
- obvious CTA hierarchy
- reduced-motion and accessibility support

The product story remains execution-first: an AI instruction becomes an AlphaClone action.

## Engineering rules

- Extend the existing `src/constants/brand.ts`, `src/constants/design.ts`, `src/app/globals.css`, `src/components/ui/os/`, `src/components/ui/enterprise/` and AlphaClone icon system.
- Do not create a second competing design system.
- Shared primitives first; module-specific overrides only when the workflow requires them.
- Preserve APIs and business logic during visual migration.
- Migrate progressively so each module remains usable throughout rollout.
- Avoid broad one-shot page rewrites where primitive-level changes can produce the same consistency.

## Rollout order

1. Global tokens, material levels and motion primitives.
2. Application shell, sidebar, top navigation, mobile navigation and command surfaces.
3. Projects reference implementation.
4. Bonnie contextual surfaces.
5. CRM and Leads.
6. Marketing Hub and Social.
7. Documents, Contracts and Signatures.
8. Invoices and Money Hub.
9. Calendar and Nexus.
10. Settings, Control, Auth and Onboarding.
11. Public landing/marketing site.
12. Accessibility, responsive and visual-regression audit across all modules.
