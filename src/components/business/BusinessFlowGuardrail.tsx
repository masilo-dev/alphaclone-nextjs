'use client';

import React from 'react';
import { AlertTriangle, ArrowRight, Bot } from 'lucide-react';
import Link from 'next/link';

export type BusinessFlowStep = 'lead' | 'qualified' | 'proposal' | 'contract' | 'invoice' | 'payment' | 'project';

export interface FlowGuardrailContext {
  hasProposal?: boolean;
  hasContract?: boolean;
  hasInvoice?: boolean;
  hasPayment?: boolean;
  hasProject?: boolean;
  dealStage?: string;
}

export interface FlowSuggestion {
  id: string;
  message: string;
  actionLabel: string;
  href: string;
  severity: 'warning' | 'info';
}

const FLOW_ORDER: BusinessFlowStep[] = ['lead', 'qualified', 'proposal', 'contract', 'invoice', 'payment', 'project'];

export function getFlowSuggestions(ctx: FlowGuardrailContext): FlowSuggestion[] {
  const suggestions: FlowSuggestion[] = [];

  if (ctx.hasInvoice && !ctx.hasContract && !ctx.hasProposal) {
    suggestions.push({
      id: 'invoice-before-contract',
      message: 'This invoice was created without a signed contract. Clients may question charges.',
      actionLabel: 'Create contract',
      href: '/dashboard/business/contracts/manage',
      severity: 'warning',
    });
  }

  if (ctx.hasContract && !ctx.hasProposal) {
    suggestions.push({
      id: 'contract-before-proposal',
      message: 'A contract exists but no proposal was sent first. Consider sending a proposal for clarity.',
      actionLabel: 'Create proposal',
      href: '/dashboard/business/quotes',
      severity: 'info',
    });
  }

  if (ctx.hasPayment && !ctx.hasProject) {
    suggestions.push({
      id: 'payment-no-project',
      message: 'Payment received — ready to start delivery?',
      actionLabel: 'Create project',
      href: '/dashboard/business/projects/manage',
      severity: 'info',
    });
  }

  if (ctx.dealStage === 'proposal' && !ctx.hasProposal) {
    suggestions.push({
      id: 'deal-needs-proposal',
      message: 'This deal is in proposal stage but no proposal document exists yet.',
      actionLabel: 'Send proposal',
      href: '/dashboard/business/quotes',
      severity: 'warning',
    });
  }

  return suggestions;
}

interface BusinessFlowGuardrailProps {
  context: FlowGuardrailContext;
  className?: string;
}

export function BusinessFlowGuardrail({ context, className }: BusinessFlowGuardrailProps) {
  const suggestions = getFlowSuggestions(context);
  if (suggestions.length === 0) return null;

  return (
    <div className={className}>
      {suggestions.map((s) => (
        <div
          key={s.id}
          className={`mb-2 p-3 rounded-lg border flex items-start gap-3 ${
            s.severity === 'warning'
              ? 'border-amber-500/25 bg-amber-500/5'
              : 'border-teal-500/20 bg-teal-500/5'
          }`}
        >
          {s.severity === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <Bot className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-[var(--ws-text-secondary)]">{s.message}</p>
            <Link
              href={s.href}
              className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-teal-400 hover:text-teal-300"
            >
              {s.actionLabel}
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export { FLOW_ORDER };
export default BusinessFlowGuardrail;
