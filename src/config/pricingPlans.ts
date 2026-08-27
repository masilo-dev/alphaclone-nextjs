/**
 * Single source of truth for PUBLIC, marketing-facing pricing.
 *
 * Plan limits: FREE = 50/day per category · PRO = 300/day · PREMIUM = Unlimited
 * Keep in sync with `src/lib/entitlements/planEntitlements.ts` and Stripe PLAN_PRICING.
 */

import { FREE_DAILY_LIMIT, PRO_DAILY_LIMIT } from '@/lib/entitlements/planEntitlements';

export type PublicPlanId = 'free' | 'pro' | 'premium';

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

const FREE_LIMIT = `${FREE_DAILY_LIMIT}/day`;
const PRO_LIMIT = `${PRO_DAILY_LIMIT}/day`;

export const PUBLIC_PRICING_PLANS: PublicPricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    yearly: 0,
    tagline: 'Experience the full AlphaClone platform with meaningful daily execution on every module.',
    features: [
      `${FREE_DAILY_LIMIT} emails sent / day`,
      `${FREE_DAILY_LIMIT} leads added / day`,
      `${FREE_DAILY_LIMIT} CRM actions / day`,
      `${FREE_DAILY_LIMIT} outreach actions / day`,
      `${FREE_DAILY_LIMIT} social publishing actions / day`,
      `${FREE_DAILY_LIMIT} documents, contracts, proposals & invoices / day`,
      `${FREE_DAILY_LIMIT} automation & MCP executions / day`,
      `${FREE_DAILY_LIMIT} bulk lead import max / day`,
      'Read-only CRM, reports & inbox views — unlimited',
      'Bonnie AI assistant included',
      'MCP access for ChatGPT, Claude, Manus & Cursor',
    ],
    cta: 'Start Free',
    ctaLink: '/auth/login?register=true&type=business&plan=free',
    limits: {
      emailsPerDay: FREE_LIMIT,
      leadsPerDay: FREE_LIMIT,
      crmActionsPerDay: FREE_LIMIT,
      outreachPerDay: FREE_LIMIT,
      socialPerDay: FREE_LIMIT,
      documentsPerDay: FREE_LIMIT,
      automationsPerDay: FREE_LIMIT,
      mcpExecutionsPerDay: FREE_LIMIT,
      bulkLeadsPerDay: FREE_LIMIT,
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
    id: 'premium',
    name: 'Premium',
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
    cta: 'Go Premium',
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

export const PRICING_FROM = 45;
export const PRICING_TO = 80;

/** Map legacy checkout plan ids to canonical public ids */
export function normalizeCheckoutPlanId(planId: string): PublicPlanId | 'starter' | 'enterprise' {
  const p = planId.toLowerCase();
  if (p === 'starter') return 'pro';
  if (p === 'enterprise') return 'premium';
  return p as PublicPlanId;
}
