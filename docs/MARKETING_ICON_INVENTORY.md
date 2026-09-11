# AlphaClone marketing icon inventory

Custom AlphaClone icon language for major product/module symbols.
Utility chrome (chevrons, menu, close, social, external arrows) remains Lucide.

## Families

| Family | Variant | Size | Style |
| --- | --- | --- | --- |
| Navigation | `nav` | 16–20px | Geometric line + teal accent segment |
| Feature | `feature` | 28–40px | Duotone solid/outline, unique silhouette |
| Display | `display` | 48–64px | Layered symbolic graphics |
| Trust | `trust` | 18–20px | High-contrast compact marks |
| Metric | `metric` | 24–32px | Strong silhouette for outcome cards |

## Custom icons

| Name | Usage | Family | Accent |
| --- | --- | --- | --- |
| `crm` | Feature cards, nav, preview | feature/nav | teal |
| `leads` | Nav, solutions | feature/nav | cyan-blue |
| `projects` | Feature cards, nav, preview | feature/nav | blue-violet |
| `invoicing` | Feature cards, nav, preview | feature/nav | cyan-blue |
| `documents` | Feature cards, nav, resources | feature/nav | teal-blue |
| `calendar` | Module pages | feature | cyan-navy |
| `marketing` | Resources/blog | feature | violet-amber |
| `reports` | Outcomes, FAQ nav | feature/metric | blue-teal |
| `bonnie` | Feature cards, preview | feature | multi |
| `integrations` | Nav, outcomes | feature | blue-violet |
| `automation` | Company status | feature | teal |
| `security` | Company security | feature | security |
| `connected` | Connected ops, outcomes | feature/metric | multi |
| `growth` | How-it-works, solutions | display/feature | teal |
| `setup` | How-it-works | display | cyan-navy |
| `organisation` | How-it-works, agencies | display/feature | blue-violet |
| `workflow` | Outcomes, consultants | feature/metric | teal |
| `trust-card` | Hero trust notes | trust | active teal |
| `trust-clock` | Hero trust notes | trust | active teal |
| `trust-cancel` | Hero trust notes | trust | active teal |
| `trust-secure` | Hero trust notes | trust | active teal |
| `check` | Pricing lists, solutions | trust | teal |

## Utility-library icons retained

| Icon | Library | Where |
| --- | --- | --- |
| `ChevronDown` | Lucide | Header dropdowns |
| `Menu` / `X` | Lucide | Mobile nav |
| `ArrowRight` | Lucide | CTA / solution links |
| `ChevronLeft` / `ChevronRight` | Lucide | Carousel |
| `Facebook` / `Linkedin` / `Twitter` | Lucide | Footer social |

## Accessibility

- Decorative icons: `aria-hidden="true"` + `focusable="false"`
- Meaningful standalone: pass `title` and `decorative={false}`
- Status is never colour-only (pricing checks sit beside text labels)
- Icon-only controls keep aria-labels (mobile menu open/close)

## API

```tsx
<AlphaIcon name="crm" size="lg" variant="feature" />
<IconFrame size="md" accent="teal">
  <AlphaIcon name="crm" variant="feature" size="lg" />
</IconFrame>
```

## Confirmation

- No auth, billing, dashboard, or API behaviour changed
- Marketing surfaces only: homepage, header, pricing, solutions, feature cards, product preview
