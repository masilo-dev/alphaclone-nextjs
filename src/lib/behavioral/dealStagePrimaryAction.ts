/**
 * Von Restorff: one primary next action per deal stage.
 */

import type { ActionNextStepKey } from '@/components/common/showActionNextSteps';

export type DealStagePrimary =
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export interface DealStagePrimaryAction {
  label: string;
  href?: string;
  advanceStage?: boolean;
  packKey?: ActionNextStepKey;
}

const STAGE_PRIMARY: Record<DealStagePrimary, DealStagePrimaryAction> = {
  lead: {
    label: 'Qualify deal',
    advanceStage: true,
    packKey: 'deal_qualified',
  },
  qualified: {
    label: 'Send proposal',
    href: '/dashboard/quotes',
    packKey: 'deal_proposal',
  },
  proposal: {
    label: 'Move to negotiation',
    advanceStage: true,
    packKey: 'deal_proposal',
  },
  negotiation: {
    label: 'Close won',
    advanceStage: true,
    packKey: 'deal_closed_won',
  },
  closed_won: {
    label: 'Create invoice',
    href: '/dashboard/business/billing',
    packKey: 'invoice_created',
  },
  closed_lost: {
    label: 'Review pipeline',
    href: '/dashboard/deals',
    packKey: 'deal_closed_lost',
  },
};

export function resolveDealStagePrimaryAction(stage: string): DealStagePrimaryAction {
  const key = stage as DealStagePrimary;
  return STAGE_PRIMARY[key] ?? STAGE_PRIMARY.lead;
}
