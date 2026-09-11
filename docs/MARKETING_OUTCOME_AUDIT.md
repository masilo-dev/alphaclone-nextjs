# AlphaClone Marketing Outcome Audit

**Audit date:** June 2025  
**Scope:** Public marketing site (homepage, pricing, services, about, FAQ, feature pages, testimonials, nav)  
**Goal:** Sell business outcomes — not modules, “premium” positioning, or feature checklists.

---

## Executive verdict

| Question                               | Answer                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Does the site sell outcome or product? | **Was ~40% outcome / ~60% product.** Remediation in progress (see [Implementation](#implementation-june-2025)). |
| Is the pain clear?                     | Partially — “tool sprawl” lands; quantified business cost was missing                                           |
| Is transformation clear?               | Weak — few before/after workflows, no verified metrics                                                          |
| Why trust it?                          | Underdeveloped — anonymous quotes, meta “we have legal pages” proof                                             |
| Does it hide the platform?             | No — it over-exposed features and under-sold results                                                            |

**Core promise (site-wide):**

> Stop losing clients and revenue in the gaps between your CRM, inbox, projects, and invoices.

---

## Scoring (pre-remediation)

| Page                    | Pain | Outcome | Product | Trust |
| ----------------------- | ---- | ------- | ------- | ----- |
| Homepage `/`            | 4    | 3       | 4       | 2     |
| Pricing `/pricing`      | 3    | 2       | 5       | 3     |
| Services `/services`    | 5    | 4       | 4       | 2     |
| About `/about`          | 4    | 5       | 3       | 3     |
| Who we serve            | 4    | 3       | 4       | 2     |
| Customers               | 3    | 3       | 2       | 1     |
| FAQ                     | 2    | 1       | 5       | 2     |
| Marketing feature pages | 2    | 1       | 5       | 2     |

---

## What was wrong

### Positioning drift

Multiple competing frames: “AI Business OS”, “Operational Authority”, “Unified Operating Engine”, “Business Operating Platform”. Visitors could not repeat one outcome in their own words.

### Product-led proof

- Hero stats counted modules and trial days, not business results
- Pricing hero led with prestige (“Operational Authority”) and feature lists
- FAQ optimized for competitor SEO, not buyer outcomes
- Feature pages (`/marketing/*`) were 100% capability + comparison tables

### Trust gaps

- Testimonials were anonymous with star ratings — reads as fabricated
- “Limited-time offer” with no real deadline
- Homepage “Verification Signals” listed having legal pages, not customer success
- `/customers` had unnamed persona cards only

### Internal checklist violations

Per `docs/alphaclone-brand-messaging-checklist.md`:

- Testimonials not named/verifiable → **fail**
- Scarcity not real → **fail**
- Vague “enterprise-grade” without evidence → **risk**

**BS Continuum score (before):** 5–6. Target: 1–4.

---

## Outcome pillars (module map)

Lead with these; features are proof underneath.

| Outcome                      | Pain it kills                            | Modules (footnote)               |
| ---------------------------- | ---------------------------------------- | -------------------------------- |
| **Win & keep clients**       | Leads fall through cracks                | CRM, forms, AI outreach          |
| **Get paid without chasing** | Invoices disconnected from delivery      | Invoicing, accounting            |
| **Deliver without chaos**    | Sales context lost in projects           | Projects, tasks, contracts       |
| **Look professional**        | Scattered tools = weak client experience | Branded invoices, booking, video |
| **Reclaim time**             | Tab-switching and duplicate entry        | Unified workspace, automation    |

---

## Copy principles (going forward)

1. **Headline = outcome.** Subhead = who + how.
2. **Proof = workflow change**, not module count.
3. **Features belong in bullets**, not heroes.
4. **Social proof = named + verifiable**, or clearly labeled representative scenarios until real case studies exist.
5. **One primary CTA voice:** “Start 14-day trial — no card required.”
6. **No fake scarcity.** No star ratings on unverified quotes.

---

## Homepage structure (target)

1. Hero — pain + outcome + ICP + CTA
2. Before/after — three workflow transformations
3. How it works — connect → run client work → get paid
4. Outcome stories — representative scenarios (link to `/results`)
5. Capabilities — modules as enablers, not headlines
6. Pricing teaser — outcome + from $15
7. Trust — security, policies, support (substance, not meta)
8. Contact

---

## Implementation (June 2025)

| Item                                                 | Status | Location                                                               |
| ---------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| Outcome config (promise, before/after, case studies) | Done   | `src/config/marketingOutcomes.ts`                                      |
| Homepage hero + proof bar rewrite                    | Done   | `src/components/LandingPage.tsx`                                       |
| Before/after section on homepage                     | Done   | `src/components/LandingPage.tsx`                                       |
| Remove fake “limited-time offer”                     | Done   | `src/components/LandingPage.tsx`                                       |
| Replace meta stats section                           | Done   | `src/components/LandingPage.tsx`                                       |
| Pricing hero + plan taglines                         | Done   | `src/app/pricing/PricingPageContent.tsx`, `src/config/pricingPlans.ts` |
| Honest outcome scenarios (no star ratings)           | Done   | `src/config/marketingTestimonials.ts`, carousel                        |
| `/results` case study page                           | Done   | `src/app/results/page.tsx`                                             |
| `/customers` → `/results` redirect                   | Done   | `src/app/customers/page.tsx`                                           |
| Nav + footer Results link                            | Done   | `PublicNavigation`, `MarketingFooter`                                  |
| FAQ split (buyer vs product)                         | Done   | `src/config/faqItems.ts`, `src/app/faq/page.tsx`                       |
| Who-we-serve outcome rewrite + claim fixes           | Done   | `WhoWeServeContent.tsx`, `marketingOutcomes.ts`                        |

---

## Remaining work (needs real data)

- [ ] Replace representative scenarios with **named, permissioned customer quotes**
- [ ] Add quantified metrics (“saved X hours/week”, “paid Y days faster”) from actual users
- [x] Reframe `/faq` buyer section vs feature/competitor section
- [ ] Rewrite `/marketing/*` feature page heroes (copy updated in config; review live pages)
- [x] Audit `/who-we-serve` claims — removed inaccurate self-hostable / open-source SaaS claims
- [ ] Add demo video showing lead → invoice workflow end-to-end

---

## Quick copy reference

| Avoid (product)               | Prefer (outcome)                                     |
| ----------------------------- | ---------------------------------------------------- |
| 12 modules in one place       | One client journey from lead to paid invoice         |
| Operational Authority         | Run your client business without tool chaos          |
| Simple plans. Every feature.  | One price. Your whole operation connected.           |
| Includes Video                | Client meetings from their CRM record — no extra app |
| Verified apps you can connect | Works with the tools you already use                 |

---

## Review cadence

Before publishing any marketing copy, run `docs/alphaclone-brand-messaging-checklist.md` and confirm:

- [ ] Headline states a verifiable business outcome
- [ ] Social proof is real or explicitly labeled as illustrative
- [ ] No scarcity/urgency unless true
- [ ] Feature lists support the outcome; they do not replace it
