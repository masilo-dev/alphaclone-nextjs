/**
 * Diderot effect: bridge cross-module events to contextual next-step toasts.
 * Uses buildPropagationChain for execution semantics + showActionNextSteps for UI.
 */

import type { ActionNextStepKey } from '@/components/common/showActionNextSteps';
import { showActionNextSteps } from '@/components/common/showActionNextSteps';
import {
  buildPropagationChain,
  type CrossModulePropagationEvent,
} from '@/lib/execution/universalModuleEngine';

export type NavigateFn = (path: string) => void;

/** Maps propagation events to existing next-step packs where possible. */
const EVENT_TO_PACK: Partial<Record<string, ActionNextStepKey>> = {
  'email:meeting_requested': 'lead_qualified',
  'meeting:proposal_accepted': 'deal_proposal',
  'contracts:contract_signed': 'contract_signed',
  'projects:milestone_completed': 'invoice_created',
  'invoicing:payment_received': 'client_saved',
  'social:campaign_published': 'campaign_sent',
  'leads:lead_accepted': 'lead_finder_accepted',
  'quotes:quote_accepted': 'quote_to_invoice',
};

function eventKey(sourceModule: string, action: string): string {
  return `${sourceModule}:${action}`;
}

/**
 * Emit cross-module next steps after a business event completes.
 * Safe to call — no-op when no pack mapping exists.
 */
export function emitCrossModulePropagation(
  event: CrossModulePropagationEvent,
  navigate: NavigateFn
): void {
  buildPropagationChain(event);

  const key = eventKey(event.sourceModule, event.action);
  const packKey = EVENT_TO_PACK[key];
  if (packKey) {
    showActionNextSteps(packKey, navigate);
  }
}

/** Convenience wrappers for common lifecycle moments. */
export const propagation = {
  contractSigned: (tenantId: string, entityId: string, navigate: NavigateFn, userId?: string) =>
    emitCrossModulePropagation(
      {
        tenantId,
        userId,
        sourceModule: 'contracts',
        targetModule: 'invoicing',
        entityId,
        entityType: 'contract',
        action: 'contract_signed',
        payload: {},
        expectedOutcome: 'Invoice and project setup',
      },
      navigate
    ),
  paymentReceived: (tenantId: string, entityId: string, navigate: NavigateFn, userId?: string) =>
    emitCrossModulePropagation(
      {
        tenantId,
        userId,
        sourceModule: 'invoicing',
        targetModule: 'crm',
        entityId,
        entityType: 'invoice',
        action: 'payment_received',
        payload: {},
        expectedOutcome: 'Active client relationship',
      },
      navigate
    ),
  leadAccepted: (tenantId: string, entityId: string, navigate: NavigateFn, userId?: string) =>
    emitCrossModulePropagation(
      {
        tenantId,
        userId,
        sourceModule: 'leads',
        targetModule: 'crm',
        entityId,
        entityType: 'lead',
        action: 'lead_accepted',
        payload: {},
        expectedOutcome: 'Qualified CRM record',
      },
      navigate
    ),
  quoteAccepted: (tenantId: string, entityId: string, navigate: NavigateFn, userId?: string) =>
    emitCrossModulePropagation(
      {
        tenantId,
        userId,
        sourceModule: 'quotes',
        targetModule: 'contracts',
        entityId,
        entityType: 'quote',
        action: 'quote_accepted',
        payload: {},
        expectedOutcome: 'Contract or invoice',
      },
      navigate
    ),
};
