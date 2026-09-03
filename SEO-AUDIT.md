# AlphaClone Systems SEO & Website Audit

**Audit date:** 2026-09-03  
**Production origin:** `https://alphaclonesystems.com`  
**Framework:** Next.js 16 App Router (`src/app/`)

---

## Executive Summary

AlphaClone Systems runs on Next.js with segmented sitemaps, centralized pricing (`src/config/pricingPlans.ts`), integration catalog (`src/config/integrations.ts`), and marketing positioning (`src/config/marketingPositioning.ts`). This pass aligned public metadata and hero copy with the **Business Execution Layer** category, fixed pricing contradictions across marketing surfaces, expanded `robots.txt` private routes, added noindex layouts for utility routes, and published three new indexable pages: `/execution-session`, `/how-it-works`, and `/reliability`.

**Remaining owner actions:** Legal review of Terms pricing section (still references Starter $15), customer proof assets, Search Console verification, production crawl test, and trial-length engineering alignment (14 vs 30 days).

---

## Critical Issues

| Issue | Status |
|-------|--------|
| Pricing contradiction ($15 Starter in legal vs Free/Pro/Premium in marketing) | **Partially fixed** — marketing aligned; **LegalDocs.tsx requires legal review** |
| Homepage positioned as “all-in-one OS” not execution layer | **Fixed** — hero + metadata updated |
| JSON-LD offered $15 Starter only | **Fixed** — AggregateOffer from `pricingPlans.ts` |
| Dashboard “zero founder involvement” copy | **Fixed** — `AIAgentsTab.tsx` |
| MCP social captions appended $15/month | **Fixed** — `MCPServer.ts` |
| No centralized integration marketing SSOT | **Fixed** — `src/config/integrations.ts` |
| Legal/terms pricing still Starter/Pro/Enterprise at $15/$45/$80 | **OPEN — OWNER VERIFICATION REQUIRED** |

---

## High Priority

| Issue | Resolution |
|-------|------------|
| Duplicate book-demo metadata (layout + page) | **Fixed** — metadata in layout only |
| `/billing` indexed via root robots | **Fixed** — `billing/layout.tsx` noindex + robots disallow |
| `/book` utility page without metadata | **Fixed** — noindex via `book/layout.tsx` |
| `/private-docs` robots only, no noindex meta | **Fixed** — `private-docs/layout.tsx` |
| robots.txt gaps (auth, alpha, onboarding, etc.) | **Fixed** — expanded disallow list |
| Footer missing legal links (privacy choices, data deletion) | **Fixed** |
| `/claude-manus-integrations` orphan | **Fixed** — footer link added |
| Canonical URL inconsistency (hardcoded vs helper) | **Improved** — `buildMarketingMetadata()` helper added |
| Unsupported “5+ tools replaced” stat | **Fixed** — replaced in `marketingOutcomes.ts` |
| Unsupported “thousands of users” / “15+ hours” on guide | **Fixed** — PlatformGuide copy softened |

---

## Medium Priority

| Issue | Notes |
|-------|-------|
| Static sitemap `lastModified` = 2026-08-21 for all URLs | Consider dynamic dates on deploy |
| `/services` FAQPage schema overlaps `/faq` | Monitor for duplicate FAQ rich results |
| Token routes (invoice, quote, portal) rely on robots only | Add layout noindex when touched |
| `SEO.tsx` (react-helmet) unused legacy | Safe to delete in future cleanup |
| Free plan not in `CreateBusinessOnboarding` UI | Product/onboarding gap |
| WhatsApp shown on homepage integration grid | Marketing grid vs public catalog mismatch — review |

---

## Low Priority

| Issue | Notes |
|-------|-------|
| Twitter handle legacy `@alphaclone` in unused SEO.tsx | N/A once file removed |
| Search page noindex + WebSite SearchAction | Intentional tension |
| Blog posts dynamic sitemap only on main `/sitemap.xml` | Acceptable |

---

## Route Inventory

| Route | Indexable? | Search intent | Title (summary) | H1 focus | Canonical | Schema | Status |
|-------|:------------:|---------------|-----------------|----------|-----------|--------|--------|
| `/` | Yes | Business execution layer | Execution layer hero | Hero H1 | `absoluteUrl('/')` | Root SoftwareApplication + Org | **Updated** |
| `/pricing` | Yes | Plan comparison | From $45/month | Pricing | `/pricing` | — | OK |
| `/services` | Yes | Platform overview | Operating system | Services | `/services` | FAQPage | OK |
| `/execution-session` | Yes | Consultation / workflow fit | Execution Session | Session H1 | `/execution-session` | Breadcrumb | **New** |
| `/how-it-works` | Yes | Category education | How It Works | Mechanism | `/how-it-works` | Breadcrumb | **New** |
| `/reliability` | Yes | Trust / control | Reliability | Trust H1 | `/reliability` | Breadcrumb | **New** |
| `/crm` | Yes | CRM software | CRM module | CRM | `/crm` | Breadcrumb | OK |
| `/lead-management` | Yes | Lead management | Leads | Leads | `/lead-management` | Breadcrumb | OK |
| `/docs` | Yes | Product documentation | Docs | Docs | `/docs` | JSON-LD | OK |
| `/faq` | Yes | Purchase FAQ | FAQ | FAQ | `/faq` | FAQPage | OK |
| `/ecosystem` | Yes | Integrations | Ecosystem | Integrations | `/ecosystem` | — | OK — uses `integrations.ts` |
| `/legal/*` | Yes | Legal/trust | Policy titles | Policy H1 | Canonical paths | — | OK |
| `/dashboard/*` | No | App | — | — | — | noindex layout | OK |
| `/billing` | No | Account billing | — | — | — | noindex layout | **Fixed** |
| `/book` | No | Booking utility | — | Book meeting | — | noindex | **Fixed** |
| `/auth/*` | No | Auth | Login layout | — | — | partial | robots expanded |
| `/alpha` | No | Internal | — | — | — | noindex | robots expanded |

*(Full inventory: 97 `page.tsx` routes — 40+ indexable marketing/legal, remainder auth/app/token.)*

---

## Contradictions Found

### Pricing tiers

| Location A | Location B | Conflict | Source of truth | Resolution |
|------------|------------|----------|-----------------|------------|
| `pricingPlans.ts` — Free $0, Pro $45, Premium $80 | `LegalDocs.tsx` — Starter $15, Pro $45, Enterprise $80 | Plan names and entry price | **Marketing:** `pricingPlans.ts` | Marketing updated; **legal requires attorney review** |
| `PLAN_PRICING.starter` $15 | Public Free $0 | Legacy Stripe tier | Both valid internally; map starter→pro at checkout | Document in support API (done) |
| FAQ/services copy | Pricing page | Was $15 vs $45 | `pricingPlans.ts` | **Fixed** |
| Trial 14 days (marketing/login) | `TRIAL_LIMITS.TRIAL_DAYS: 30` | Trial length | **OWNER VERIFICATION REQUIRED** | Not changed |

### Product claims

| Location A | Location B | Conflict | Resolution |
|------------|------------|----------|------------|
| `AIAgentsTab` “zero founder involvement” | Execution layer positioning | Autonomy overclaim | **Fixed** — approval-focused copy |
| `integrations.ts` WhatsApp COMING_SOON | Homepage integration grid shows WhatsApp | Availability | **Flag** — align grid with catalog |
| `marketingTestimonials.ts` | Implied real quotes | Representative only | Disclaimers present — OK |

---

## Changes Implemented

| File | Why |
|------|-----|
| `src/config/pricingPlans.ts` | `MARKETING_PRICING`, `buildPublicPlanOffers()` |
| `src/config/integrations.ts` | Public integration SSOT |
| `src/config/marketingPositioning.ts` | Execution layer copy SSOT |
| `src/lib/seo/metadata.ts` | `buildMarketingMetadata()`, `buildPrivateMetadata()` |
| `src/app/layout.tsx` | Execution layer metadata + AggregateOffer JSON-LD |
| `src/app/page.tsx` | Homepage metadata |
| `src/app/robots.ts` | Expanded private routes |
| `src/app/billing/layout.tsx`, `book/layout.tsx`, `private-docs/layout.tsx` | noindex |
| `src/app/execution-session/page.tsx` | New offer page |
| `src/app/how-it-works/page.tsx` | Category mechanism page |
| `src/app/reliability/page.tsx` | Trust/limits page |
| `src/components/pages/ExecutionSessionPage.tsx` etc. | Page content |
| `src/components/marketing/system/MarketingHomePage.tsx` | Hero repositioning |
| `src/lib/marketing/cta.ts`, `siteNavigation.ts` | CTAs + nav |
| `src/lib/seo/sitemapData.ts`, `siteEntity.ts` | Sitemap + nav schema |
| `src/components/marketing/system/MarketingFooter.tsx` | Links + blurb |
| `src/config/faqItems.ts`, `marketingCopy.ts`, `marketingOutcomes.ts` | Pricing + claims |
| `src/components/pages/PlatformGuide.tsx` | Pricing + unsupported stats |
| `src/components/pages/EcosystemPage.tsx` | Uses `PUBLIC_INTEGRATIONS` |
| `src/app/docs/DocsPageContent.tsx` | Dynamic pricing line |
| `src/app/llms.txt/route.ts` | Pricing alignment |
| `src/components/dashboard/AIAgentsTab.tsx` | Remove zero-founder claims |
| `src/services/mcp/MCPServer.ts` | Pricing caption fix |
| `src/config/promotionMonth.ts` | September Premium unlimited promotion (factual) |
| `src/lib/marketing/homeIntegrationDisplay.ts` | Homepage grid from integration catalog |
| `docs/PROOF-VIDEO-SHOT-LIST.md` | Quote-to-cash proof video script |

---

## Promotion month (Premium unlimited)

- **Config:** `src/config/promotionMonth.ts` — September highlights **Premium = unlimited AlphaClone daily execution** (not a fake discount).
- **UI:** `PromotionMonthBanner` on homepage (during promotion month) and `/pricing` (always).
- **Opt out:** `NEXT_PUBLIC_PROMO_PREMIUM_UNLIMITED=false`
- **Proof video:** `docs/PROOF-VIDEO-SHOT-LIST.md`

---

## Remaining Manual Actions

| Route | Intent | Keyword | Suggested title | Suggested H1 | Content purpose | Internal links | Enough content? |
|-------|--------|---------|-----------------|--------------|-----------------|----------------|-----------------|
| `/integrations/[slug]` | Integration SEO | “AlphaClone Gmail integration” | Per integration | “Connect {name}” | Status, setup, limits | `/ecosystem`, `/docs` | **When** page template uses `integrations.ts` — not bulk-generated |
| `/invoicing` | Product intent | “invoicing for consultants” | Invoicing & billing | Same | Quote-to-cash workflow | `/crm`, `/pricing` | **Yes** — module exists; page not yet built |
| `/solutions/freelancers` | Audience | “freelancer business software” | For freelancers | Same | Differentiated from solo-founders | Features, session | **Defer** — risk duplicate with solo-founders |
| `/use-cases` | Workflow hub | “business workflow automation” | Use cases | Workflow examples | Anchor workflows only | `/how-it-works` | **Partial** — could index anchor workflows |

---

## Legal/Compliance Review Required

**Engineering/content (addressed or flagged):**
- Marketing pricing aligned to `pricingPlans.ts`
- Unsupported stats removed or softened
- Integration availability from catalog

**Requires qualified legal review (not changed):**
- `LegalDocs.tsx` subscription tier paragraph (Starter $15 / Enterprise naming)
- SOC 2 / “enterprise-grade” language in security/compliance pages if claimed as certification
- Refund and SLA cross-links accuracy
- GDPR/CCPA representation vs actual consent implementation (CookieBanner + `ConsentAwareAnalytics` — verify in production)

---

## Remaining Manual Actions

1. **Legal:** Align Terms of Service pricing with public Free/Pro/Premium or document legacy Starter mapping.
2. **Product:** Resolve 14-day vs 30-day trial in `tenancy/types.ts`.
3. **Proof:** Record quote-to-cash demo video for `/execution-session` and homepage.
4. **Search Console:** Verify property, submit sitemaps, inspect canonical for `/`.
5. **Production crawl:** Screaming Frog or GSC URL inspection on new routes.
6. **Customer research:** Replace representative testimonials with permissioned quotes.
7. **Performance:** Lighthouse on homepage after hero change.
8. **Onboarding:** Add Free plan to business creation UI.
9. **Homepage integrations grid:** Remove or badge WhatsApp/coming-soon items per `integrations.ts`.

---

*Generated as part of production-readiness SEO and GTM alignment pass.*
