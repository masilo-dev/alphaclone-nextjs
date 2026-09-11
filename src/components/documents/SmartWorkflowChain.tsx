'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Bot } from 'lucide-react';
import { BusinessFlowGuardrail, type FlowGuardrailContext } from '@/components/business/BusinessFlowGuardrail';

export interface SmartWorkflowStep {
  id: string;
  label: string;
  description: string;
  href: string;
  primary?: boolean;
}

interface SmartWorkflowChainProps {
  context: FlowGuardrailContext;
  steps?: SmartWorkflowStep[];
  className?: string;
}

const DEFAULT_STEPS: Record<string, SmartWorkflowStep> = {
  proposal_accepted: {
    id: 'generate-contract',
    label: 'Generate contract',
    description: 'Proposal accepted — create a contract for signature.',
    href: '/dashboard/business/contracts/manage',
    primary: true,
  },
  contract_signed: {
    id: 'generate-invoice',
    label: 'Send invoice',
    description: 'Contract signed — bill the client for the agreed work.',
    href: '/dashboard/business/billing/manage',
    primary: true,
  },
  invoice_paid: {
    id: 'create-project',
    label: 'Start project',
    description: 'Payment received — set up delivery and tasks.',
    href: '/dashboard/business/projects/manage',
    primary: true,
  },
};

export function SmartWorkflowChain({ context, steps, className }: SmartWorkflowChainProps) {
  const suggestedSteps = steps || [];

  if (context.hasPayment && !context.hasProject) {
    suggestedSteps.push(DEFAULT_STEPS.invoice_paid);
  }
  if (context.hasContract && !context.hasInvoice) {
    suggestedSteps.push(DEFAULT_STEPS.contract_signed);
  }
  if (context.hasProposal && !context.hasContract) {
    suggestedSteps.push(DEFAULT_STEPS.proposal_accepted);
  }

  if (suggestedSteps.length === 0 && !context.hasInvoice) {
    return <BusinessFlowGuardrail context={context} className={className} />;
  }

  return (
    <div className={className}>
      <BusinessFlowGuardrail context={context} />
      {suggestedSteps.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ws-text-tertiary)] flex items-center gap-1">
            <Bot className="w-3 h-3" aria-hidden="true" />
            Suggested next step
          </p>
          {suggestedSteps.map((step) => (
            <Link
              key={step.id}
              href={step.href}
              className={`block p-3 rounded-lg border transition-colors ${
                step.primary
                  ? 'border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10'
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[12px] font-medium text-[var(--ws-text-primary)]">{step.label}</p>
                  <p className="text-[11px] text-[var(--ws-text-secondary)] mt-0.5">{step.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-teal-400 shrink-0" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default SmartWorkflowChain;
