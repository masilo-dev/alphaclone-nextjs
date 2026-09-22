/**
 * Single source of truth for PUBLIC, marketing-facing pricing.
 *
 * Public plans: Starter $15 · Pro $45 · Enterprise $80.
 * Keep in sync with `src/lib/entitlements/planEntitlements.ts` and Stripe PLAN_PRICING.
 */

import { PRO_DAILY_LIMIT } from '@/lib/entitlements/planEntitlements';

// Includes legacy ids because dashboard/billing compatibility still accepts them;
// the public pricing array below exposes only Starter, Pro, and Enterprise.
export type PublicPlanId = 'free' | 'starter' | 'pro' | 'premium' | 'enterprise';

/** Legacy Stripe plan ids still accepted at checkout */
export type LegacyPlanId = 'starter' | 'enterprise';

export interface PublicPricingPlan {
  id: PublicPlanId;
  name: string;
  price: number;
  yearly: number;
  tagline: string;
  highlight?: boolean;
  badge?: string;
  features: string[];
  cta: string;
  ctaLink: string;
  limits: {
    emailsPerDay: string;
    leadsPerDay: string;
    crmActionsPerDay: string;
    outreachPerDay: string;
    socialPerDay: string;
    documentsPerDay: string;
    automationsPerDay: string;
    mcpExecutionsPerDay: string;
    bulkLeadsPerDay: string;
  };
}

const PRO_LIMIT = `${PRO_DAILY_LIMIT}/day`;

export const PUBLIC_PRICING_PLANS: PublicPricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 15,
    yearly: 144,
    tagline: 'Essential execution capacity for solo founders getting their core workflows connected.',
    features: [
      `${PRO_DAILY_LIMIT} emails sent / day`,
      `${PRO_DAILY_LIMIT} leads added / day`,
      `${PRO_DAILY_LIMIT} CRM actions / day`,
      `${PRO_DAILY_LIMIT} outreach actions / day`,
      `${PRO_DAILY_LIMIT} social publishing actions / day`,
      `${PRO_DAILY_LIMIT} documents, contracts, proposals & invoices / day`,
      `${PRO_DAILY_LIMIT} automation & MCP executions / day`,
      `${PRO_DAILY_LIMIT} bulk lead import max / day`,
      'Read-only actions unlimited across all modules',
    ],
    cta: 'Choose Starter',
    ctaLink: '/auth/login?register=true&type=business&plan=starter',
    limits: {
      emailsPerDay: PRO_LIMIT,
      leadsPerDay: PRO_LIMIT,
      crmActionsPerDay: PRO_LIMIT,
      outreachPerDay: PRO_LIMIT,
      socialPerDay: PRO_LIMIT,
      documentsPerDay: PRO_LIMIT,
      automationsPerDay: PRO_LIMIT,
      mcpExecutionsPerDay: PRO_LIMIT,
      bulkLeadsPerDay: PRO_LIMIT,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 45,
    yearly: 432,
    tagline: 'Serious daily operating capacity for solo founders and small teams running real workflows.',
    highlight: true,
    badge: 'Recommended for active founders',
    features: [
      `${PRO_DAILY_LIMIT} emails sent / day`,
      `${PRO_DAILY_LIMIT} leads added / day`,
      `${PRO_DAILY_LIMIT} CRM actions / day`,
      `${PRO_DAILY_LIMIT} outreach actions / day`,
      `${PRO_DAILY_LIMIT} social publishing actions / day`,
      `${PRO_DAILY_LIMIT} documents, contracts, proposals & invoices / day`,
      `${PRO_DAILY_LIMIT} automation & MCP executions / day`,
      `${PRO_DAILY_LIMIT} bulk lead import max / day`,
      'Read-only actions unlimited across all modules',
      'Priority processing & support',
    ],
    cta: 'Go Pro',
    ctaLink: '/auth/login?register=true&type=business&plan=pro',
    limits: {
      emailsPerDay: PRO_LIMIT,
      leadsPerDay: PRO_LIMIT,
      crmActionsPerDay: PRO_LIMIT,
      outreachPerDay: PRO_LIMIT,
      socialPerDay: PRO_LIMIT,
      documentsPerDay: PRO_LIMIT,
      automationsPerDay: PRO_LIMIT,
      mcpExecutionsPerDay: PRO_LIMIT,
      bulkLeadsPerDay: PRO_LIMIT,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 80,
    yearly: 768,
    tagline: 'Truly unlimited AlphaClone execution — only external provider and safety limits apply.',
    features: [
      'Unlimited emails sent*',
      'Unlimited leads added*',
      'Unlimited CRM actions*',
      'Unlimited outreach actions*',
      'Unlimited social publishing*',
      'Unlimited documents, contracts, proposals & invoices*',
      'Unlimited automations & MCP executions*',
      'Unlimited bulk operations*',
      'Unlimited agent workflows*',
      'Usage tracked for analytics — never capped by AlphaClone',
      '* Subject to connected provider API limits and platform anti-abuse safeguards',
    ],
    cta: 'Choose Enterprise',
    ctaLink: '/auth/login?register=true&type=business&plan=enterprise',
    limits: {
      emailsPerDay: 'Unlimited',
      leadsPerDay: 'Unlimited',
      crmActionsPerDay: 'Unlimited',
      outreachPerDay: 'Unlimited',
      socialPerDay: 'Unlimited',
      documentsPerDay: 'Unlimited',
      automationsPerDay: 'Unlimited',
      mcpExecutionsPerDay: 'Unlimited',
      bulkLeadsPerDay: 'Unlimited',
    },
  },
];

export const PRICING_FROM = 15;
export const PRICING_TO = 80;

/** Reusable marketing copy — import instead of hard-coding prices in pages. */
export const MARKETING_PRICING = {
  starterPlanName: 'Starter',
  proPlanName: 'Pro',
  enterprisePlanName: 'Enterprise',
  paidFromMonthly: PRICING_FROM,
  paidToMonthly: PRICING_TO,
  /** Primary CTA label for signup buttons */
  primaryCtaLabel: 'Get started',
  /** Short price line for hero sections and comparisons */
  startingPriceLine: 'Plans start at $15/month',
  /** One-line competitor comparison anchor */
  paidFromPhrase: '$15/month for Starter',
  /** Schema.org / meta description snippet */
  metaPriceSnippet:
    'Starter is $15/month, Pro is $45/month, and Enterprise is $80/month.',
  enterpriseUnlimitedLine:
    'Enterprise includes the highest AlphaClone execution capacity (provider and safety limits still apply).',
} as const;

/** Build SoftwareApplication offers array for JSON-LD from public plans. */
export function buildPublicPlanOffers(siteUrl: string) {
  return PUBLIC_PRICING_PLANS.filter((p) => p.price >= 0).map((plan) => ({
    '@type': 'Offer' as const,
    name: `${plan.name} Plan`,
    price: plan.price.toFixed(2),
    priceCurrency: 'USD',
    priceValidUntil: '2027-01-01',
    priceSpecification: {
      '@type': 'PriceSpecification' as const,
      price: plan.price.toFixed(2),
      priceCurrency: 'USD',
      valueAddedTaxIncluded: false,
      billingIncrement: 1,
      unitCode: 'MON',
    },
    description: plan.tagline,
    url: `${siteUrl}/pricing`,
    availability: 'https://schema.org/InStock',
  }));
}

/** Map legacy checkout plan ids to canonical public ids */
export function normalizeCheckoutPlanId(planId: string): PublicPlanId {
  const p = planId.toLowerCase();
  if (p === 'premium') return 'enterprise';
  return p as PublicPlanId;
}
