/**
 * Document lifecycle state machines — valid transitions only.
 * Document status is never confused with payment status.
 */

import type { DocumentStatus, DocumentType } from './types';

export class InvalidTransitionError extends Error {
  constructor(
    public readonly documentType: string,
    public readonly from: DocumentStatus,
    public readonly to: DocumentStatus
  ) {
    super(`Invalid ${documentType} transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

const COMMON_TERMINAL: DocumentStatus[] = ['archived', 'void', 'superseded'];

/** General document lifecycle transitions. */
const GENERAL: Record<string, DocumentStatus[]> = {
  draft: ['under_review', 'awaiting_approval', 'approved', 'void', 'archived'],
  under_review: ['changes_requested', 'approved', 'rejected' as DocumentStatus, 'draft'],
  changes_requested: ['revised', 'draft', 'under_review'],
  revised: ['under_review', 'awaiting_approval', 'approved'],
  awaiting_approval: ['approved', 'changes_requested', 'draft'],
  approved: ['sent', 'void', 'archived', 'superseded'],
  sent: ['delivered', 'viewed', 'declined', 'expired', 'void', 'superseded'],
  delivered: ['viewed', 'accepted', 'declined', 'expired'],
  viewed: ['accepted', 'declined', 'awaiting_signature', 'expired'],
  accepted: ['awaiting_signature', 'active', 'converted_to_contract', 'converted_to_invoice', 'archived'],
  declined: ['draft', 'revised', 'archived', 'void'],
  awaiting_signature: ['partially_signed', 'signed', 'declined', 'expired'],
  partially_signed: ['signed', 'declined', 'expired'],
  signed: ['active', 'completed', 'archived', 'superseded'],
  active: ['completed', 'terminated', 'expired', 'archived', 'superseded'],
  completed: ['archived', 'superseded'],
  terminated: ['archived', 'superseded'],
  expired: ['archived', 'revised', 'restored', 'superseded'],
  superseded: ['archived', 'restored'],
  void: ['archived'],
  archived: ['restored'],
  restored: ['draft', 'under_review', 'active'],
  rejected: ['draft', 'revised', 'archived', 'void'],
};

const CONTRACT: Record<string, DocumentStatus[]> = {
  draft: ['under_review', 'changes_requested', 'approved', 'void', 'archived'],
  under_review: ['changes_requested', 'approved', 'draft'],
  changes_requested: ['draft', 'revised', 'under_review'],
  revised: ['under_review', 'approved'],
  approved: ['sent', 'void', 'superseded'],
  sent: ['viewed', 'declined', 'expired', 'void', 'superseded'],
  viewed: ['accepted', 'declined', 'awaiting_signature', 'expired'],
  accepted: ['awaiting_signature', 'signed', 'active'],
  awaiting_signature: ['partially_signed', 'signed', 'declined', 'expired'],
  partially_signed: ['signed', 'declined', 'expired'],
  signed: ['active', 'completed', 'archived', 'superseded'],
  active: ['completed', 'terminated', 'expired', 'archived', 'superseded'],
  completed: ['archived', 'superseded'],
  terminated: ['archived', 'superseded'],
  expired: ['archived', 'superseded'],
  declined: ['draft', 'revised', 'archived', 'void'],
  void: ['archived'],
  archived: ['restored'],
  restored: ['draft'],
  superseded: ['archived'],
};

/** Invoice lifecycle — payment statuses live here, separate from generic doc status. */
const INVOICE: Record<string, DocumentStatus[]> = {
  draft: ['approved', 'sent', 'void', 'archived'],
  approved: ['sent', 'void'],
  sent: ['viewed', 'partially_paid', 'paid', 'overdue', 'void'],
  viewed: ['partially_paid', 'paid', 'overdue', 'void'],
  partially_paid: ['paid', 'overdue', 'void'],
  paid: ['receipted', 'partially_refunded', 'refunded', 'archived'],
  overdue: ['partially_paid', 'paid', 'void'],
  receipted: ['archived', 'partially_refunded', 'refunded'],
  partially_refunded: ['refunded', 'archived'],
  refunded: ['archived'],
  void: ['archived'],
  archived: ['restored'],
  restored: ['draft'],
};

const QUOTE: Record<string, DocumentStatus[]> = {
  draft: ['approved', 'void', 'archived'],
  approved: ['sent', 'void'],
  sent: ['viewed', 'accepted', 'declined', 'expired', 'void'],
  viewed: ['accepted', 'declined', 'expired'],
  accepted: ['converted_to_contract', 'converted_to_invoice', 'archived'],
  declined: ['draft', 'archived', 'void'],
  expired: ['draft', 'archived'],
  converted_to_contract: ['archived'],
  converted_to_invoice: ['archived'],
  void: ['archived'],
  archived: ['restored'],
  restored: ['draft'],
};

const PROPOSAL: Record<string, DocumentStatus[]> = {
  draft: ['internal_review', 'approved', 'void', 'archived'],
  internal_review: ['approved', 'changes_requested', 'draft'],
  changes_requested: ['draft', 'revised'],
  revised: ['internal_review', 'approved'],
  approved: ['sent', 'void'],
  sent: ['viewed', 'accepted', 'declined', 'expired'],
  viewed: ['accepted', 'declined', 'expired'],
  accepted: ['converted_to_project', 'converted_to_contract', 'archived'],
  declined: ['draft', 'archived'],
  expired: ['draft', 'archived'],
  converted_to_project: ['archived'],
  converted_to_contract: ['archived'],
  void: ['archived'],
  archived: ['restored'],
  restored: ['draft'],
};

function machineFor(documentType: DocumentType): Record<string, DocumentStatus[]> {
  switch (documentType) {
    case 'contract':
    case 'msa':
    case 'sla':
    case 'sow':
    case 'nda':
    case 'employment_agreement':
      return CONTRACT;
    case 'invoice':
    case 'credit_note':
    case 'payment_reminder':
      return INVOICE;
    case 'quote':
    case 'estimate':
      return QUOTE;
    case 'proposal':
      return PROPOSAL;
    default:
      return GENERAL;
  }
}

export function allowedTransitions(
  documentType: DocumentType,
  from: DocumentStatus
): DocumentStatus[] {
  const machine = machineFor(documentType);
  return machine[from] || [];
}

export function canTransition(
  documentType: DocumentType,
  from: DocumentStatus,
  to: DocumentStatus
): boolean {
  if (from === to) return true;
  return allowedTransitions(documentType, from).includes(to);
}

export function assertTransition(
  documentType: DocumentType,
  from: DocumentStatus,
  to: DocumentStatus
): void {
  if (!canTransition(documentType, from, to)) {
    throw new InvalidTransitionError(documentType, from, to);
  }
}

/** Signed documents cannot be edited in place. */
export function isEditableStatus(status: DocumentStatus): boolean {
  return [
    'draft',
    'under_review',
    'changes_requested',
    'revised',
    'awaiting_approval',
    'internal_review',
  ].includes(status);
}

/** Editing a signed/accepted document requires amendment, not overwrite. */
export function requiresAmendment(status: DocumentStatus): boolean {
  return ['signed', 'active', 'completed', 'accepted', 'paid', 'receipted'].includes(status);
}

export function isTerminalStatus(status: DocumentStatus): boolean {
  return COMMON_TERMINAL.includes(status) || status === 'completed' || status === 'terminated';
}

/** A draft cannot become signed directly. */
export function assertNotDirectSign(from: DocumentStatus, to: DocumentStatus): void {
  if (from === 'draft' && (to === 'signed' || to === 'partially_signed')) {
    throw new InvalidTransitionError('document', from, to);
  }
}

/** Paid invoices cannot return to sent. Void invoices cannot be paid. */
export function assertInvoicePaymentRules(from: DocumentStatus, to: DocumentStatus): void {
  if (from === 'paid' && to === 'sent') {
    throw new InvalidTransitionError('invoice', from, to);
  }
  if (from === 'void' && (to === 'paid' || to === 'partially_paid')) {
    throw new InvalidTransitionError('invoice', from, to);
  }
}
