import { z } from 'zod';

export const CAMPAIGN_STATUSES = [
  'draft',
  'pending_approval',
  'scheduled',
  'running',
  'paused',
  'completed',
  'cancelled',
  'archived',
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const VALID_CAMPAIGN_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ['pending_approval', 'scheduled', 'archived'],
  pending_approval: ['draft', 'scheduled', 'cancelled'],
  scheduled: ['draft', 'running', 'paused', 'cancelled'],
  running: ['paused', 'completed', 'cancelled'],
  paused: ['running', 'completed', 'cancelled'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

export const campaignCreateSchema = z.object({
  tenantId: z.uuid(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).optional().nullable(),
  objective: z.enum([
    'brand_awareness', 'lead_generation', 'product_promotion', 'event_registration',
    'customer_retention', 'customer_reactivation', 'upsell', 'cross_sell',
    'website_traffic', 'appointment_bookings', 'newsletter', 'product_launch', 'custom',
  ]),
  channels: z.array(z.enum([
    'email', 'sms', 'whatsapp', 'facebook', 'instagram', 'linkedin', 'google_ads',
    'website', 'landing_page', 'form', 'organic_social', 'referral', 'manual_outreach',
  ])).min(1).max(13),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).default('GBP'),
  budgetAmount: z.number().finite().nonnegative().max(999_999_999_999).optional().nullable(),
  startAt: z.iso.datetime({ offset: true }).optional().nullable(),
  endAt: z.iso.datetime({ offset: true }).optional().nullable(),
  timezone: z.string().trim().max(100).default('UTC'),
  requiresApproval: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).superRefine((value, context) => {
  if (value.startAt && value.endAt && new Date(value.endAt) <= new Date(value.startAt)) {
    context.addIssue({ code: 'custom', path: ['endAt'], message: 'End date must be after start date' });
  }
});

export const campaignTransitionSchema = z.object({
  tenantId: z.uuid(),
  campaignId: z.uuid(),
  status: z.enum(CAMPAIGN_STATUSES),
});

export function canTransitionCampaign(from: CampaignStatus, to: CampaignStatus): boolean {
  return VALID_CAMPAIGN_TRANSITIONS[from].includes(to);
}

export function assertCampaignTransition(
  from: CampaignStatus,
  to: CampaignStatus,
  options: { requiresApproval?: boolean; approvedAt?: string | null } = {},
): void {
  if (!canTransitionCampaign(from, to)) {
    throw new Error(`Campaign cannot move from ${from} to ${to}`);
  }
  if (
    options.requiresApproval &&
    ['scheduled', 'running'].includes(to) &&
    !options.approvedAt
  ) {
    throw new Error('Campaign approval is required before scheduling or launch');
  }
}

export function formatCampaignMoney(
  amount: number | null | undefined,
  currencyCode: string,
  locale = 'en-GB',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount ?? 0);
}

export function buildUtmUrl(
  destination: string,
  campaignName: string,
  medium: string,
  source: string,
): string {
  const url = new URL(destination);
  url.searchParams.set('utm_campaign', campaignName);
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_source', source);
  return url.toString();
}
