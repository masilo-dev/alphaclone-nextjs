export type LifecycleIssueCode =
  | 'INVOICE_PAID_WITHOUT_PAYMENT_EVIDENCE'
  | 'INVOICE_PAYMENT_STATE_MISMATCH'
  | 'CONTRACT_SIGNED_WITHOUT_SIGNATURE_EVIDENCE'
  | 'CONTRACT_SIGNATURE_STATE_MISMATCH'
  | 'QUOTE_EXPIRED_STATE_MISMATCH';

export type LifecycleIssue = {
  code: LifecycleIssueCode;
  entity: 'invoice' | 'contract' | 'quote';
  entity_id: string;
};

const SIGNED_CONTRACT_STATES = new Set(['signed', 'fully_signed', 'client_signed']);

export function inspectInvoiceLifecycle(row: {
  id: string;
  status?: string | null;
  paid_at?: string | null;
  amount_paid?: number | null;
  total?: number | null;
}): LifecycleIssue[] {
  const status = String(row.status || '').toLowerCase();
  const amountPaid = Number(row.amount_paid || 0);
  const total = Number(row.total || 0);
  const hasPaymentEvidence = Boolean(row.paid_at) && amountPaid >= total && total > 0;

  if (status === 'paid' && !hasPaymentEvidence) {
    return [{ code: 'INVOICE_PAID_WITHOUT_PAYMENT_EVIDENCE', entity: 'invoice', entity_id: row.id }];
  }
  if (status !== 'paid' && hasPaymentEvidence) {
    return [{ code: 'INVOICE_PAYMENT_STATE_MISMATCH', entity: 'invoice', entity_id: row.id }];
  }
  return [];
}

export function inspectContractLifecycle(row: {
  id: string;
  status?: string | null;
  lifecycle_status?: string | null;
  signed_at?: string | null;
  client_signed_at?: string | null;
  admin_signed_at?: string | null;
}): LifecycleIssue[] {
  const state = String(row.lifecycle_status || row.status || '').toLowerCase();
  const claimsSigned = SIGNED_CONTRACT_STATES.has(state);
  const hasSignatureEvidence = Boolean(row.signed_at || row.client_signed_at || row.admin_signed_at);

  if (claimsSigned && !hasSignatureEvidence) {
    return [{ code: 'CONTRACT_SIGNED_WITHOUT_SIGNATURE_EVIDENCE', entity: 'contract', entity_id: row.id }];
  }
  if (!claimsSigned && hasSignatureEvidence) {
    return [{ code: 'CONTRACT_SIGNATURE_STATE_MISMATCH', entity: 'contract', entity_id: row.id }];
  }
  return [];
}

export function inspectQuoteLifecycle(row: {
  id: string;
  status?: string | null;
  valid_until?: string | null;
}, now = new Date()): LifecycleIssue[] {
  const status = String(row.status || '').toLowerCase();
  if (!row.valid_until || ['accepted', 'rejected', 'converted', 'expired'].includes(status)) return [];
  if (new Date(`${row.valid_until}T23:59:59.999Z`).getTime() < now.getTime()) {
    return [{ code: 'QUOTE_EXPIRED_STATE_MISMATCH', entity: 'quote', entity_id: row.id }];
  }
  return [];
}

export function isOperationalRecord(row: { is_test_data?: boolean | null }): boolean {
  return row.is_test_data !== true;
}
