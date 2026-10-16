/**
 * Invoice Monetary Mismatch, Duplicate Draft Detection, and Billing Reconciliation.
 *
 * Requirements (Manus Sections M, N, Q, R, S):
 * - Compare linked client, project, contract, currency, and amount.
 * - Distinguish deposits, installments, taxes, discounts, and prior billing from erroneous mismatches.
 * - Detect probable duplicate drafts (same client + amount within 7 days) without auto-merging.
 * - Reconcile billing summaries (Invoiced, Awaiting Payment, Overdue, Collected) with contributing invoice IDs.
 */

export interface ContractMismatchAuditResult {
  hasMismatch: boolean;
  isExplained: boolean;
  contractAmount: number;
  invoiceAmount: number;
  difference: number;
  currencyMatch: boolean;
  clientMatch: boolean;
  billingType: 'full_contract' | 'deposit' | 'installment' | 'scope_adjustment' | 'standalone' | 'unexplained';
  explanation?: string;
  flagMessage?: string;
}

export interface DuplicateDraftMatch {
  existingInvoiceId: string;
  existingInvoiceNumber: string;
  clientId: string;
  amount: number;
  currency: string;
  createdAt: string;
  matchReasons: string[];
  lineItemsCount: number;
}

export interface BillingSummaryCardData {
  title: string;
  amount: number;
  count: number;
  currency: string;
  contributingInvoiceIds: string[];
}

export interface BillingSummariesResult {
  invoiced: BillingSummaryCardData;
  awaitingPayment: BillingSummaryCardData;
  overdue: BillingSummaryCardData;
  collected: BillingSummaryCardData;
  qaRecordsExcludedCount: number;
}

/**
 * Audits an invoice against its linked contract to verify monetary alignment.
 * Never assumes every invoice equals the full contract (handles installments/deposits).
 */
export function auditInvoiceContractMismatch(params: {
  invoiceAmount: number;
  invoiceCurrency?: string | null;
  invoiceClientId?: string | null;
  invoiceBillingType?: string | null;
  invoiceExplanation?: string | null;
  contract?: {
    id: string;
    clientId?: string | null;
    totalAmount?: number | null;
    currency?: string | null;
    priorBilledAmount?: number | null;
  } | null;
}): ContractMismatchAuditResult {
  const {
    invoiceAmount,
    invoiceCurrency = 'EUR',
    invoiceClientId,
    invoiceBillingType,
    invoiceExplanation,
    contract,
  } = params;

  // Standalone invoice without contract is permitted
  if (!contract) {
    return {
      hasMismatch: false,
      isExplained: true,
      contractAmount: 0,
      invoiceAmount,
      difference: 0,
      currencyMatch: true,
      clientMatch: true,
      billingType: 'standalone',
      explanation: 'Standalone invoice without linked contract',
    };
  }

  const contractAmount = Number(contract.totalAmount || 0);
  const currencyMatch = !contract.currency || !invoiceCurrency || contract.currency.toUpperCase() === invoiceCurrency.toUpperCase();
  const clientMatch = !contract.clientId || !invoiceClientId || contract.clientId === invoiceClientId;
  const difference = Math.abs(contractAmount - invoiceAmount);

  // Exact amount match
  if (difference === 0 && currencyMatch && clientMatch) {
    return {
      hasMismatch: false,
      isExplained: true,
      contractAmount,
      invoiceAmount,
      difference: 0,
      currencyMatch: true,
      clientMatch: true,
      billingType: 'full_contract',
    };
  }

  // Legitimate installment, deposit, or documented scope adjustment
  const normalizedBillingType = String(invoiceBillingType || '').toLowerCase().trim();
  const isDocumented =
    normalizedBillingType === 'deposit' ||
    normalizedBillingType === 'installment' ||
    normalizedBillingType === 'scope_adjustment' ||
    Boolean(invoiceExplanation && invoiceExplanation.trim().length > 0);

  const billingType: ContractMismatchAuditResult['billingType'] =
    normalizedBillingType === 'deposit'
      ? 'deposit'
      : normalizedBillingType === 'installment'
      ? 'installment'
      : normalizedBillingType === 'scope_adjustment'
      ? 'scope_adjustment'
      : isDocumented
      ? 'installment'
      : 'unexplained';

  const flagMessage = !clientMatch
    ? `Recipient client mismatch: Invoice client (${invoiceClientId}) does not match contract client (${contract.clientId})`
    : !currencyMatch
    ? `Currency mismatch: Invoice is in ${invoiceCurrency} but contract is in ${contract.currency}`
    : difference > 0 && !isDocumented
    ? `Amount difference of ${invoiceCurrency} ${difference.toLocaleString()}: Invoice is ${invoiceCurrency} ${invoiceAmount.toLocaleString()} vs Contract total of ${contract.currency || invoiceCurrency} ${contractAmount.toLocaleString()}. Please specify installment/deposit type or authorized explanation.`
    : undefined;

  return {
    hasMismatch: difference > 0 || !currencyMatch || !clientMatch,
    isExplained: isDocumented && currencyMatch && clientMatch,
    contractAmount,
    invoiceAmount,
    difference,
    currencyMatch,
    clientMatch,
    billingType,
    explanation: invoiceExplanation || (isDocumented ? `Authorized ${billingType}` : undefined),
    flagMessage,
  };
}

/**
 * Detects probable duplicate drafts created within 7 days for the same client and amount.
 * Never automatically deletes or merges records; surfaces for user comparison.
 */
export function detectDuplicateInvoiceDrafts(
  targetDraft: {
    id?: string;
    clientId: string;
    total: number;
    currency?: string;
    lineItems?: Array<{ description?: string; quantity?: number; rate?: number }>;
    createdAt?: string;
  },
  existingInvoices: Array<{
    id: string;
    invoice_number?: string;
    client_id?: string;
    total?: number;
    currency?: string;
    status?: string;
    created_at?: string;
    line_items?: Array<{ description?: string }>;
  }>,
): DuplicateDraftMatch[] {
  const matches: DuplicateDraftMatch[] = [];
  const targetCreatedAt = targetDraft.createdAt ? new Date(targetDraft.createdAt).getTime() : Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  for (const inv of existingInvoices) {
    // Exclude the draft itself
    if (inv.id === targetDraft.id) continue;
    // Only compare against drafts or recent invoices
    if (inv.status && inv.status !== 'draft') continue;

    const reasons: string[] = [];
    const sameClient = inv.client_id && inv.client_id === targetDraft.clientId;
    const sameAmount = Number(inv.total || 0) === Number(targetDraft.total || 0);

    if (sameClient) reasons.push('Identical client');
    if (sameAmount) reasons.push(`Identical total amount (${targetDraft.total})`);

    const invCreatedAt = inv.created_at ? new Date(inv.created_at).getTime() : 0;
    const createdWithin7Days = Math.abs(targetCreatedAt - invCreatedAt) <= SEVEN_DAYS_MS;
    if (createdWithin7Days && invCreatedAt > 0) reasons.push('Created within 7 days of each other');

    // If both client and amount match within 7 days, flag as probable duplicate
    if (sameClient && sameAmount && createdWithin7Days) {
      matches.push({
        existingInvoiceId: inv.id,
        existingInvoiceNumber: inv.invoice_number || 'Draft',
        clientId: inv.client_id || '',
        amount: Number(inv.total || 0),
        currency: inv.currency || targetDraft.currency || 'EUR',
        createdAt: inv.created_at || new Date().toISOString(),
        matchReasons: reasons,
        lineItemsCount: Array.isArray(inv.line_items) ? inv.line_items.length : 0,
      });
    }
  }

  return matches;
}

/**
 * Reconciles billing summaries with invoice-level records.
 * Excludes restricted QA/demo records when requested and tracks contributing IDs.
 */
export function reconcileBillingSummaries(
  invoices: Array<{
    id: string;
    total?: number;
    amount_paid?: number;
    balance_due?: number;
    status?: string;
    currency?: string;
    due_date?: string;
    is_test?: boolean;
    metadata?: Record<string, unknown> | null;
  }>,
  options?: {
    excludeQaRecords?: boolean;
    currency?: string;
  },
): BillingSummariesResult {
  const excludeQa = options?.excludeQaRecords !== false;
  const targetCurrency = options?.currency || 'EUR';

  let qaExcluded = 0;
  const invoicedIds: string[] = [];
  const awaitingIds: string[] = [];
  const overdueIds: string[] = [];
  const collectedIds: string[] = [];

  let invoicedTotal = 0;
  let awaitingTotal = 0;
  let overdueTotal = 0;
  let collectedTotal = 0;

  for (const inv of invoices) {
    const isQa = Boolean(inv.is_test || inv.metadata?.is_qa || inv.metadata?.qa_record);
    if (excludeQa && isQa) {
      qaExcluded++;
      continue;
    }

    const status = String(inv.status || '').toLowerCase().trim();
    const total = Number(inv.total || 0);
    const amountPaid = Number(inv.amount_paid || 0);
    const balanceDue = Number(inv.balance_due ?? Math.max(0, total - amountPaid));

    // Exclude drafts and void/cancelled from official "Invoiced" totals
    if (status !== 'draft' && status !== 'cancelled' && status !== 'void') {
      invoicedTotal += total;
      invoicedIds.push(inv.id);
    }

    // Awaiting payment: sent, viewed, partially_paid with balance > 0
    if ((status === 'sent' || status === 'viewed' || status === 'partially_paid') && balanceDue > 0) {
      awaitingTotal += balanceDue;
      awaitingIds.push(inv.id);
    }

    // Overdue: status is overdue and balance > 0
    if (status === 'overdue' && balanceDue > 0) {
      overdueTotal += balanceDue;
      overdueIds.push(inv.id);
    }

    // Collected: all collected payments
    if (amountPaid > 0 || status === 'paid') {
      const settled = status === 'paid' && amountPaid === 0 ? total : amountPaid;
      collectedTotal += settled;
      collectedIds.push(inv.id);
    }
  }

  return {
    invoiced: {
      title: 'Invoiced',
      amount: invoicedTotal,
      count: invoicedIds.length,
      currency: targetCurrency,
      contributingInvoiceIds: invoicedIds,
    },
    awaitingPayment: {
      title: 'Awaiting Payment',
      amount: awaitingTotal,
      count: awaitingIds.length,
      currency: targetCurrency,
      contributingInvoiceIds: awaitingIds,
    },
    overdue: {
      title: 'Overdue',
      amount: overdueTotal,
      count: overdueIds.length,
      currency: targetCurrency,
      contributingInvoiceIds: overdueIds,
    },
    collected: {
      title: 'Collected',
      amount: collectedTotal,
      count: collectedIds.length,
      currency: targetCurrency,
      contributingInvoiceIds: collectedIds,
    },
    qaRecordsExcludedCount: qaExcluded,
  };
}
