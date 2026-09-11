/**
 * Invoice, receipt, and quote engines.
 */

import { newId } from '../cryptoUtil';
import type {
  DocumentBrandProfile,
  InvoiceLineItem,
  InvoicePaymentStatus,
  InvoiceStructuredData,
  PaymentTransaction,
} from '../types';

export function recalculateInvoiceTotals(
  lineItems: InvoiceLineItem[],
  tax: number,
  discount: number,
  amountPaid: number
): Pick<InvoiceStructuredData, 'subtotal' | 'tax' | 'discount' | 'total' | 'amount_paid' | 'balance_due'> {
  const items = lineItems.map((li) => ({
    ...li,
    amount: Number((li.quantity * li.unit_price - (li.discount || 0)).toFixed(2)),
  }));
  const subtotal = Number(items.reduce((s, i) => s + i.amount, 0).toFixed(2));
  const total = Number((subtotal + tax - discount).toFixed(2));
  const balance_due = Number((total - amountPaid).toFixed(2));
  return { subtotal, tax, discount, total, amount_paid: amountPaid, balance_due };
}

export function buildInvoiceData(input: {
  brand: DocumentBrandProfile;
  client: InvoiceStructuredData['client'];
  invoice_number: string;
  issue_date: string;
  due_date: string;
  line_items: InvoiceLineItem[];
  tax?: number;
  discount?: number;
  amount_paid?: number;
  payment_terms?: string;
  payment_method?: string;
  payment_link?: string;
  notes?: string;
  related_contract_id?: string;
  related_quote_id?: string;
  payment_transactions?: PaymentTransaction[];
  payment_status?: InvoicePaymentStatus;
}): InvoiceStructuredData {
  const tax = input.tax || 0;
  const discount = input.discount || 0;
  const amount_paid = input.amount_paid || 0;
  const totals = recalculateInvoiceTotals(input.line_items, tax, discount, amount_paid);
  const line_items = input.line_items.map((li) => ({
    ...li,
    amount: Number((li.quantity * li.unit_price - (li.discount || 0)).toFixed(2)),
  }));

  let payment_status: InvoicePaymentStatus = input.payment_status || 'draft';
  if (totals.balance_due <= 0 && totals.amount_paid > 0) payment_status = 'paid';
  else if (totals.amount_paid > 0 && totals.balance_due > 0) payment_status = 'partially_paid';

  return {
    supplier: {
      legal_business_name: input.brand.legal_business_name,
      trading_name: input.brand.trading_name,
      tax_vat_number: input.brand.tax_vat_number,
      physical_address: input.brand.physical_address,
      business_email: input.brand.business_email,
      telephone: input.brand.telephone,
      bank_details: input.brand.bank_details,
      payment_instructions: input.brand.payment_instructions,
    } as InvoiceStructuredData['supplier'],
    client: input.client,
    invoice_number: input.invoice_number,
    issue_date: input.issue_date,
    due_date: input.due_date,
    currency: input.brand.default_currency,
    line_items,
    ...totals,
    payment_terms: input.payment_terms,
    payment_method: input.payment_method,
    payment_link: input.payment_link,
    bank_details: input.brand.bank_details,
    notes: input.notes,
    related_contract_id: input.related_contract_id,
    related_quote_id: input.related_quote_id,
    payment_transactions: input.payment_transactions || [],
    payment_status,
  };
}

export interface ReceiptData {
  receipt_number: string;
  invoice_reference: string;
  payment_date: string;
  payer: string;
  payment_provider?: string;
  transaction_reference: string;
  amount_received: number;
  currency: string;
  remaining_balance: number;
  verification_qr_payload?: string;
}

/** Create a receipt only when payment is confirmed with transaction evidence. */
export function createReceiptFromPayment(input: {
  invoice_number: string;
  transaction: PaymentTransaction;
  remaining_balance: number;
  receipt_number?: string;
}): ReceiptData {
  if (!input.transaction.verified) {
    throw new Error('Cannot create receipt without verified payment evidence.');
  }
  return {
    receipt_number: input.receipt_number || `RCT-${newId().slice(0, 8).toUpperCase()}`,
    invoice_reference: input.invoice_number,
    payment_date: input.transaction.paid_at,
    payer: input.transaction.payer_name || 'Payer',
    payment_provider: input.transaction.provider,
    transaction_reference: input.transaction.reference,
    amount_received: input.transaction.amount,
    currency: input.transaction.currency,
    remaining_balance: input.remaining_balance,
    verification_qr_payload: `receipt:${input.invoice_number}:${input.transaction.reference}`,
  };
}

export interface QuoteData {
  quote_number: string;
  validity_period_days: number;
  expiry_date: string;
  scope?: string;
  line_items: InvoiceLineItem[];
  optional_items?: InvoiceLineItem[];
  tax: number;
  assumptions?: string[];
  exclusions?: string[];
  acceptance_action?: string;
  currency: string;
  subtotal: number;
  total: number;
}

export function buildQuoteData(input: {
  quote_number: string;
  currency: string;
  validity_period_days: number;
  issue_date: string;
  line_items: InvoiceLineItem[];
  optional_items?: InvoiceLineItem[];
  tax?: number;
  scope?: string;
  assumptions?: string[];
  exclusions?: string[];
}): QuoteData {
  const tax = input.tax || 0;
  const line_items = input.line_items.map((li) => ({
    ...li,
    amount: Number((li.quantity * li.unit_price - (li.discount || 0)).toFixed(2)),
  }));
  const subtotal = Number(line_items.reduce((s, i) => s + i.amount, 0).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));
  const issue = new Date(input.issue_date);
  const expiry = new Date(issue);
  expiry.setDate(expiry.getDate() + input.validity_period_days);

  return {
    quote_number: input.quote_number,
    validity_period_days: input.validity_period_days,
    expiry_date: expiry.toISOString().slice(0, 10),
    scope: input.scope,
    line_items,
    optional_items: input.optional_items,
    tax,
    assumptions: input.assumptions,
    exclusions: input.exclusions,
    acceptance_action: 'Accept this quote to proceed to contract or invoice.',
    currency: input.currency,
    subtotal,
    total,
  };
}

/** Convert an approved quote into invoice structured data without retyping. */
export function convertQuoteToInvoiceData(
  quote: QuoteData,
  brand: DocumentBrandProfile,
  client: InvoiceStructuredData['client'],
  invoice_number: string,
  issue_date: string,
  due_date: string
): InvoiceStructuredData {
  return buildInvoiceData({
    brand,
    client,
    invoice_number,
    issue_date,
    due_date,
    line_items: quote.line_items,
    tax: quote.tax,
    related_quote_id: quote.quote_number,
    payment_status: 'draft',
  });
}
