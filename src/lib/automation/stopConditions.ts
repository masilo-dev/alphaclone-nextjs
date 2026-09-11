import { leadOutreachStopReason } from '@/lib/leads/leadLifecycle';

export type AutomationDomain =
  | 'lead_outreach'
  | 'invoice_chase'
  | 'contract_chase'
  | 'task_chase'
  | 'project_chase';

export function automationStopReason(domain: AutomationDomain, state: Record<string, unknown>): string | null {
  const status = String(state.status || state.stage || '').toLowerCase();

  switch (domain) {
    case 'lead_outreach':
      return leadOutreachStopReason({
        stage: String(state.stage || state.status || ''),
        unsubscribed: Boolean(state.unsubscribed),
        suppressed: Boolean(state.suppressed),
        dnc: Boolean(state.dnc),
        bounced: Boolean(state.bounced),
        paused: Boolean(state.paused),
      });
    case 'invoice_chase':
      if (['paid', 'void', 'cancelled', 'canceled', 'disputed'].includes(status)) return status || 'paid';
      return null;
    case 'contract_chase':
      if (['signed', 'fully_signed', 'declined', 'rejected', 'expired', 'voided', 'cancelled', 'terminated'].includes(status)) {
        return status;
      }
      return null;
    case 'task_chase':
      if (['completed', 'done', 'cancelled', 'canceled', 'archived'].includes(status)) return status;
      return null;
    case 'project_chase':
      if (['completed', 'archived', 'cancelled', 'canceled'].includes(status)) return status;
      return null;
    default: {
      const _exhaustive: never = domain;
      return _exhaustive;
    }
  }
}

export function shouldStopAutomation(domain: AutomationDomain, state: Record<string, unknown>): boolean {
  return automationStopReason(domain, state) !== null;
}
