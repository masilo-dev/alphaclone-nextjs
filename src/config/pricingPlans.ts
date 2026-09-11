/**
 * Single source of truth for PUBLIC, marketing-facing pricing.
 *
 * Prices and tier names are kept in lockstep with the Stripe-backed billing
 * config in `src/services/tenancy/types.ts` (PLAN_PRICING). If you change a
 * price there, change it here too — both the marketing site and the in-app
 * upgrade screen should always tell the same story.
 */

export type PublicPlanId = 'starter' | 'pro' | 'enterprise';

export interface PublicPricingPlan {
  id: PublicPlanId;
  name: string;
  /** Monthly price in USD. */
  price: number;
  /** Annual price in USD (billed yearly). */
  yearly: number;
  tagline: string;
  highlight?: boolean;
  badge?: string;
  features: string[];
  cta: string;
  ctaLink: string;
}

export const PUBLIC_PRICING_PLANS: PublicPricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 15,
    yearly: 144,
    tagline: 'Win clients, send invoices, and deliver work — without a scattered tool stack.',
    features: [
      'Up to 25 team members',
      '50 active projects',
      '25GB secure storage',
      'Unified CRM & deal pipeline',
      'Automated invoicing & P&L',
      'Contract engine with e-signatures',
      'Native 1-hour video meetings',
      'Advanced booking & scheduling',
      'Automated workflows',
      'Email support',
    ],
    cta: 'Start 14-Day Free Trial',
    ctaLink: '/auth/login?register=true&type=business&plan=starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 45,
    yearly: 432,
    tagline: 'Scale outreach and automation when manual follow-up becomes the bottleneck.',
    highlight: true,
    badge: 'Best for growing teams',
    features: [
      'Everything in Starter, plus:',
      'Unlimited team members & projects',
      '100GB secure storage',
      'Unlimited video meetings',
      'Bonnie AI sales assistant',
      'Custom API access',
      'Custom domain',
      'Priority support',
    ],
    cta: 'Start 14-Day Free Trial',
    ctaLink: '/auth/login?register=true&type=business&plan=pro',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 80,
    yearly: 768,
    tagline: 'Priority support and headroom when client volume and data needs grow.',
    features: [
      'Everything in Pro, plus:',
      '500GB secure storage',
      'Advanced AI features & higher AI limits',
      'Priority infrastructure',
      'Dedicated onboarding',
      'Priority + SLA support',
    ],
    cta: 'Start 14-Day Free Trial',
    ctaLink: '/auth/login?register=true&type=business&plan=enterprise',
  },
];

/** Lowest public monthly price, handy for "from $X/mo" copy. */
export const PRICING_FROM = Math.min(...PUBLIC_PRICING_PLANS.map((p) => p.price));
/** Highest public monthly price. */
export const PRICING_TO = Math.max(...PUBLIC_PRICING_PLANS.map((p) => p.price));
