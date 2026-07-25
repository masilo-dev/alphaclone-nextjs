# AlphaClone Marketing Design System

Central tokens and rules for the public marketing website. Authenticated product UI is out of scope.

## Colour tokens

Defined on `.marketing-theme` in `src/styles/marketing-system.css`.

| Token | Value | Use |
| --- | --- | --- |
| `--background-root` | `#041027` | Page canvas |
| `--background-section` | `#081932` | Alternating sections |
| `--background-card` | `#0E213F` | Cards / surfaces |
| `--brand-primary` | `#18C7C8` | Primary CTA / accents |
| `--brand-secondary` | `#1688D8` | Support blue |
| `--brand-violet` | `#7357E8` | Rare support (CTA banners only) |
| `--text-primary` | `#F7FAFF` | Headings |
| `--text-secondary` | `#B8C4D8` | Body |
| `--text-muted` | `#8392AA` | Meta / captions |

Do not scatter raw hex values in components. Prefer CSS variables.

## Typography

- Headings: Space Grotesk
- Body: Inter Variable
- One `h1` per page
- Hero uses fluid clamp sizing from the CSS file

## Layout

- Main container: `--container-main` (1240px)
- Wide container: `--container-wide` (1440px)
- Section vertical rhythm: `--space-section-y`

## Components

| Component | Path |
| --- | --- |
| Shell | `MarketingShell.tsx` |
| Header | `MarketingHeader.tsx` |
| Footer | `MarketingFooter.tsx` |
| Homepage | `MarketingHomePage.tsx` |
| Product preview | `ProductPreview.tsx` |
| FAQ accordion | `FAQAccordion.tsx` |
| Pricing | `PricingPage.tsx` |
| Product template | `ProductPageTemplate.tsx` |
| Solution template | `SolutionPageTemplate.tsx` |
| CTAs | `CtaButtons.tsx` |

## Correct

- Outcome-led copy tied to real product behaviour
- Real pricing from `src/config/pricingPlans.ts`
- Verified integrations instead of invented customer logos
- Hide testimonials until named, approved quotes exist
- Transparent header over hero; navy blur after scroll

## Incorrect

- Fake stats (“65% productivity”, “10K+ businesses”)
- Invented testimonials or company logos
- Glassmorphism / glow on every card
- Generic AI filler copy (“revolutionise”, “supercharge”)
- Hardcoded prices that diverge from billing config

## Accessibility

- Skip link, landmarks, keyboard mega-menus, FAQ `aria-expanded`
- Focus rings on all interactive controls
- `prefers-reduced-motion` disables preview tilt and decorative motion
- Touch targets ≥ 44px in mobile nav

## CTA destinations

Preserved in `src/lib/marketing/cta.ts`:

- Trial → `/auth/login?register=true&type=business&plan=…`
- Demo → `/book-demo`
- Login → `/auth/login`
- UTM params preserved via `withPreservedQuery`
