/**
 * Single source of truth for PUBLIC, marketing-facing pricing.
 *
 * Prices and tier names are kept in lockstep with the Stripe-backed billing
 * config in `src/services/tenancy/types.ts` (PLAN_PRICING). If you change a
 * price there, change it here too — both the marketing site and the in-app
 * upgrade screen should always tell the same story.
 */

export type PublicPlanId = 'free' | 'starter' | 'pro' | 'enterprise';

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
  limits: {
    leadsPerDay: string;
    outreachPerDay: string;
    socialPostsPerDay: string;
    emailActionsPerDay: string;
    mcpExecutionsPerDay: string;
    activeAutomations: string;
    connectedIntegrations: string;
    crmContacts: string;
  };
}

export const PUBLIC_PRICING_PLANS: PublicPricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    yearly: 0,
    tagline: 'Let founders genuinely experience AlphaClone and MCP with essential daily execution capability.',
    features: [
      '50 MCP lead creations / day',
      '20 Outreach actions / day',
      '1 LinkedIn post / day',
      '1 Facebook post / day',
      '1 Instagram post / day',
      '25 Email actions / day',
      '50 MCP/AI executions / day',
      '3 Active automations',
      '3 Connected integrations',
      '500 CRM contacts',
      'Basic reporting',
    ],
    cta: 'Start Free',
    ctaLink: '/auth/login?register=true&type=business&plan=free',
    limits: {
      leadsPerDay: '50/day',
      outreachPerDay: '20/day',
      socialPostsPerDay: '1/day each',
      emailActionsPerDay: '25/day',
      mcpExecutionsPerDay: '50/day',
      activeAutomations: '3',
      connectedIntegrations: '3',
      crmContacts: '500',
    },
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 15,
    yearly: 144,
    tagline: 'For solo founders actively running their business through AlphaClone.',
    features: [
      '100 MCP lead creations / day',
      '100 Outreach actions / day',
      '3 LinkedIn posts / day',
      '3 Facebook posts / day',
      '3 Instagram posts / day',
      '150 Email actions / day',
      '250 MCP/AI executions / day',
      '15 Active automations',
      '10 Connected integrations',
      '5,000 CRM contacts',
      'Standard reporting',
    ],
    cta: 'Choose Starter',
    ctaLink: '/auth/login?register=true&type=business&plan=starter',
    limits: {
      leadsPerDay: '100/day',
      outreachPerDay: '100/day',
      socialPostsPerDay: '3/day each',
      emailActionsPerDay: '150/day',
      mcpExecutionsPerDay: '250/day',
      activeAutomations: '15',
      connectedIntegrations: '10',
      crmContacts: '5,000',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 45,
    yearly: 432,
    tagline: 'For founders who want AlphaClone to actively execute sales, marketing and business operations.',
    highlight: true,
    badge: 'MOST POPULAR',
    features: [
      '500 MCP lead creations / day',
      '500 Outreach actions / day',
      '10 LinkedIn posts / day',
      '10 Facebook posts / day',
      '10 Instagram posts / day',
      '750 Email actions / day',
      '1,500 MCP/AI executions / day',
      '50 Active automations',
      '25 Connected integrations',
      '25,000 CRM contacts',
      'Advanced reporting',
      'Priority processing & support',
    ],
    cta: 'Go Pro',
    ctaLink: '/auth/login?register=true&type=business&plan=pro',
    limits: {
      leadsPerDay: '500/day',
      outreachPerDay: '500/day',
      socialPostsPerDay: '10/day each',
      emailActionsPerDay: '750/day',
      mcpExecutionsPerDay: '1,500/day',
      activeAutomations: '50',
      connectedIntegrations: '25',
      crmContacts: '25,000',
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 80,
    yearly: 768,
    tagline: 'For businesses that need maximum AlphaClone execution capacity.',
    features: [
      'Unlimited MCP lead creation*',
      'Unlimited outreach actions*',
      'Unlimited social publishing*',
      'Unlimited supported email actions*',
      'Unlimited MCP/AI usage*',
      'Unlimited workflows & automations',
      'Unlimited integrations',
      'Unlimited CRM contacts',
      'Advanced reporting & priority support',
      'Custom integrations where agreed',
      'Higher infrastructure limits',
    ],
    cta: 'Contact Sales',
    ctaLink: '/contact?topic=enterprise',
    limits: {
      leadsPerDay: 'Unlimited*',
      outreachPerDay: 'Unlimited*',
      socialPostsPerDay: 'Unlimited*',
      emailActionsPerDay: 'Unlimited*',
      mcpExecutionsPerDay: 'Unlimited*',
      activeAutomations: 'Unlimited',
      connectedIntegrations: 'Unlimited',
      crmContacts: 'Unlimited',
    },
  },
];

/** Lowest paid public monthly price */
export const PRICING_FROM = 15;
/** Highest public monthly price. */
export const PRICING_TO = 80;

