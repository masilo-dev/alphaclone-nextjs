/**
 * Canonical lead lifecycle. Transitions are explicit; outreach stops are hard.
 */

export const LEAD_LIFECYCLE_STAGES = [
  'DISCOVERED',
  'CONTACTABLE',
  'VERIFIED',
  'UNIQUE',
  'QUALIFIED',
  'SAVED',
  'ASSIGNED',
  'OUTREACH_READY',
  'CONTACTED',
  'REPLIED',
  'INTERESTED',
  'MEETING',
  'OPPORTUNITY',
  'CLIENT',
  'NURTURE',
  'CLOSED',
] as const;

export type LeadLifecycleStage = (typeof LEAD_LIFECYCLE_STAGES)[number];

const STAGE_ORDER = new Map(LEAD_LIFECYCLE_STAGES.map((stage, index) => [stage, index]));

const ALIASES: Record<string, LeadLifecycleStage> = {
  discovered: 'DISCOVERED',
  new: 'DISCOVERED',
  contactable: 'CONTACTABLE',
  verified: 'VERIFIED',
  unique: 'UNIQUE',
  qualified: 'QUALIFIED',
  saved: 'SAVED',
  assigned: 'ASSIGNED',
  outreach_ready: 'OUTREACH_READY',
  contacted: 'CONTACTED',
  replied: 'REPLIED',
  interested: 'INTERESTED',
  meeting: 'MEETING',
  meeting_booked: 'MEETING',
  opportunity: 'OPPORTUNITY',
  client: 'CLIENT',
  converted: 'CLIENT',
  nurture: 'NURTURE',
  closed: 'CLOSED',
  lost: 'CLOSED',
  disqualified: 'CLOSED',
};

export function normalizeLeadLifecycleStage(value: string | null | undefined): LeadLifecycleStage | null {
  if (!value) return null;
  const raw = String(value).trim();
  const upper = raw.toUpperCase().replace(/\s+/g, '_') as LeadLifecycleStage;
  if (STAGE_ORDER.has(upper)) return upper;
  return ALIASES[raw.toLowerCase()] || null;
}

export type LeadStopReason =
  | 'reply_received'
  | 'unsubscribed'
  | 'bounce_suppressed'
  | 'converted'
  | 'manually_paused'
  | 'dnc'
  | 'meeting_booked'
  | 'closed';

export function leadOutreachStopReason(state: {
  stage?: string | null;
  unsubscribed?: boolean;
  suppressed?: boolean;
  dnc?: boolean;
  bounced?: boolean;
  paused?: boolean;
}): LeadStopReason | null {
  if (state.unsubscribed) return 'unsubscribed';
  if (state.dnc) return 'dnc';
  if (state.bounced || state.suppressed) return 'bounce_suppressed';
  if (state.paused) return 'manually_paused';
  const stage = normalizeLeadLifecycleStage(state.stage);
  if (stage === 'REPLIED' || stage === 'INTERESTED') return 'reply_received';
  if (stage === 'MEETING') return 'meeting_booked';
  if (stage === 'CLIENT') return 'converted';
  if (stage === 'CLOSED') return 'closed';
  return null;
}

export function shouldStopLeadOutreach(state: Parameters<typeof leadOutreachStopReason>[0]): boolean {
  return leadOutreachStopReason(state) !== null;
}

export function canTransitionLeadStage(from: string | null | undefined, to: string): boolean {
  const next = normalizeLeadLifecycleStage(to);
  if (!next) return false;
  const current = normalizeLeadLifecycleStage(from);
  if (!current) return true;
  if (current === next) return true;
  if (next === 'CLOSED' || next === 'NURTURE' || next === 'CLIENT') return true;
  return (STAGE_ORDER.get(next) || 0) >= (STAGE_ORDER.get(current) || 0);
}

export function leadTransitionEventType(to: LeadLifecycleStage): string {
  switch (to) {
    case 'DISCOVERED':
      return 'lead.created';
    case 'QUALIFIED':
      return 'lead.qualified';
    case 'SAVED':
      return 'lead.saved';
    case 'CONTACTED':
      return 'lead.contacted';
    case 'REPLIED':
    case 'INTERESTED':
      return 'lead.replied';
    case 'CLIENT':
      return 'lead.converted';
    default:
      return 'lead.updated';
  }
}
