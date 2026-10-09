/** Read-only presentation of recorded financial truth; never changes ledger state. */
export function portalInvoiceBilling(invoice: Record<string, any>, now = new Date()) {
  const rawTotal = Number(invoice.total ?? invoice.total_amount ?? 0);
  const rawPaid = Number(invoice.amount_paid ?? 0);
  const rawBalance = Number(invoice.balance_due ?? (rawTotal - rawPaid));
  const invalidAmounts = [rawTotal,rawPaid,rawBalance].some(value=>!Number.isFinite(value)||value<0);
  const currency = String(invoice.currency || invoice.currency_code || 'USD').toUpperCase();
  const invalidCurrency = !/^[A-Z]{3}$/.test(currency);
  const total = Number.isFinite(rawTotal) ? Math.max(0,rawTotal) : 0;
  const amountPaid = Number.isFinite(rawPaid) ? Math.max(0,rawPaid) : 0;
  const balanceDue = Number.isFinite(rawBalance) ? Math.max(0,rawBalance) : 0;
  const status = String(invoice.status || 'sent').toLowerCase();
  const metadata = invoice.metadata || {};
  const testEvidence = invoice.is_test_data === true || /^(E2E|TEST|QA)(?:[-\s]|$)/i.test(String(invoice.invoice_number || '')) || /\b(?:E2E|test) harness\b/i.test(String(invoice.notes || ''));
  const contradictory = Math.abs(total - amountPaid - balanceDue) > 0.01 || (['paid', 'completed'].includes(status) && balanceDue > 0) || (!['paid', 'completed', 'void', 'cancelled', 'canceled'].includes(status) && balanceDue === 0 && total > 0);
  const paymentPending = metadata.payment_pending_confirmation === true;
  const reviewReason = invalidAmounts || invalidCurrency ? 'Invoice amounts or currency are invalid. The business must reconcile this record before requesting payment.' : testEvidence ? 'This record contains test-harness evidence. The business must confirm whether it is a real bill before requesting payment.' : paymentPending ? 'A payment confirmation is awaiting business reconciliation. Do not pay again until the business confirms the remaining balance.' : contradictory ? 'Invoice status and recorded balance disagree. The business must reconcile this invoice before requesting payment.' : null;
  const paymentUrl = safePaymentUrl(invoice.payment_link || metadata.payment_link);
  const bankDetails = invoice.bank_details || (invoice.account_number && invoice.bank_name ? { bank_name: invoice.bank_name, account_number: invoice.account_number, branch_code: invoice.branch_code, swift_code: invoice.swift_code, reference: invoice.payment_reference || invoice.invoice_number } : null);
  const paymentDetails = bankDetails || invoice.mobile_payment_details || null;
  const actionable = balanceDue > 0 && !reviewReason && !['paid', 'completed', 'void', 'cancelled', 'canceled'].includes(status);
  return { total, amountPaid, balanceDue, currency: invalidCurrency ? 'XXX' : currency, status: actionable && invoice.due_date && String(invoice.due_date).slice(0,10) < now.toISOString().slice(0,10) ? 'overdue' : status, reviewReason, paymentUrl: actionable ? paymentUrl : null, paymentDetails: actionable ? paymentDetails : null, payable: actionable && Boolean(paymentUrl || paymentDetails) };
}
export function safePaymentUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null; } catch { return null; }
}
