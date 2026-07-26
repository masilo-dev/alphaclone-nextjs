/**
 * Canonical financial-domain primitives.
 *
 * Money crosses the API boundary as decimal strings. Arithmetic is performed
 * with scaled integers so browser/server IEEE-754 rounding cannot change an
 * invoice, allocation, or journal balance.
 */
export const MONEY_SCALE = 4;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TEN = BigInt(10);
const SCALE_FACTOR = TEN ** BigInt(MONEY_SCALE);

export type InvoiceLifecycleStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'issued'
  | 'voided'
  | 'written_off'
  | 'archived';

export type InvoiceDeliveryStatus =
  | 'not_sent'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'viewed'
  | 'failed'
  | 'bounced';

export type InvoicePaymentStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'overpaid'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed'
  | 'written_off';

export interface CanonicalInvoiceLineInput {
  description: string;
  quantity: string;
  unitPrice: string;
  discountType?: 'fixed' | 'percentage' | null;
  discountValue?: string;
  taxRate?: string;
}

export interface CanonicalInvoiceLine extends CanonicalInvoiceLineInput {
  netAmount: string;
  taxAmount: string;
  grossAmount: string;
}

export interface InvoiceBalanceEvidence {
  invoiceTotal: string;
  successfulAllocations: string;
  creditsApplied?: string;
  refunds?: string;
  writeOffs?: string;
  disputed?: boolean;
}

function assertDecimal(value: string): void {
  if (!/^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    throw new Error(`Invalid decimal amount: ${value}`);
  }
}

export function decimalToScaled(value: string, scale = MONEY_SCALE): bigint {
  assertDecimal(value);
  const negative = value.trim().startsWith('-');
  const unsigned = negative ? value.trim().slice(1) : value.trim();
  const [whole, fraction = ''] = unsigned.split('.');
  const padded = `${fraction}${'0'.repeat(scale)}`;
  const retained = padded.slice(0, scale);
  const discarded = padded.slice(scale);
  let scaled = BigInt(whole) * TEN ** BigInt(scale) + BigInt(retained || '0');
  if (discarded[0] && Number(discarded[0]) >= 5) scaled += ONE;
  return negative ? -scaled : scaled;
}

export function scaledToDecimal(value: bigint, scale = MONEY_SCALE): string {
  const negative = value < ZERO;
  const absolute = negative ? -value : value;
  const factor = TEN ** BigInt(scale);
  const whole = absolute / factor;
  const fraction = (absolute % factor).toString().padStart(scale, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function multiply(a: string, b: string): bigint {
  const product = decimalToScaled(a) * decimalToScaled(b);
  return (product + SCALE_FACTOR / BigInt(2)) / SCALE_FACTOR;
}

function percentage(amount: bigint, rate: string): bigint {
  const rateScaled = decimalToScaled(rate);
  return (amount * rateScaled + BigInt(50) * SCALE_FACTOR) / (BigInt(100) * SCALE_FACTOR);
}

export function calculateInvoiceLine(input: CanonicalInvoiceLineInput): CanonicalInvoiceLine {
  if (!input.description.trim()) throw new Error('Line item description is required');
  const quantity = decimalToScaled(input.quantity);
  const unitPrice = decimalToScaled(input.unitPrice);
  if (quantity <= ZERO || unitPrice < ZERO) throw new Error('Quantity must be positive and unit price cannot be negative');

  const base = multiply(input.quantity, input.unitPrice);
  const discountValue = input.discountValue || '0';
  const discount = input.discountType === 'percentage'
    ? percentage(base, discountValue)
    : decimalToScaled(discountValue);
  if (discount < ZERO || discount > base) throw new Error('Discount cannot exceed the line amount');

  const net = base - discount;
  const tax = percentage(net, input.taxRate || '0');
  const gross = net + tax;
  return {
    ...input,
    netAmount: scaledToDecimal(net),
    taxAmount: scaledToDecimal(tax),
    grossAmount: scaledToDecimal(gross),
  };
}

export function deriveInvoicePaymentStatus(evidence: InvoiceBalanceEvidence): {
  status: InvoicePaymentStatus;
  balanceDue: string;
} {
  const total = decimalToScaled(evidence.invoiceTotal);
  const allocations = decimalToScaled(evidence.successfulAllocations);
  const credits = decimalToScaled(evidence.creditsApplied || '0');
  const refunds = decimalToScaled(evidence.refunds || '0');
  const writeOffs = decimalToScaled(evidence.writeOffs || '0');
  if ([total, allocations, credits, refunds, writeOffs].some((amount) => amount < ZERO)) {
    throw new Error('Balance evidence cannot contain negative amounts');
  }

  const settled = allocations + credits + writeOffs - refunds;
  const balance = total - settled;
  if (evidence.disputed) return { status: 'disputed', balanceDue: scaledToDecimal(balance > ZERO ? balance : ZERO) };
  if (writeOffs > ZERO && balance <= ZERO) return { status: 'written_off', balanceDue: '0.0000' };
  if (refunds > ZERO && allocations - refunds <= ZERO) return { status: 'refunded', balanceDue: scaledToDecimal(total) };
  if (refunds > ZERO) return { status: 'partially_refunded', balanceDue: scaledToDecimal(balance > ZERO ? balance : ZERO) };
  if (settled <= ZERO) return { status: 'unpaid', balanceDue: scaledToDecimal(total) };
  if (balance > ZERO) return { status: 'partially_paid', balanceDue: scaledToDecimal(balance) };
  if (balance === ZERO) return { status: 'paid', balanceDue: '0.0000' };
  return { status: 'overpaid', balanceDue: '0.0000' };
}

export function assertBalancedJournal(lines: Array<{ debit: string; credit: string }>): void {
  if (lines.length < 2) throw new Error('A journal requires at least two lines');
  const debit = lines.reduce((sum, line) => sum + decimalToScaled(line.debit), ZERO);
  const credit = lines.reduce((sum, line) => sum + decimalToScaled(line.credit), ZERO);
  if (debit <= ZERO || debit !== credit) throw new Error('Journal debits and credits must balance');
  for (const line of lines) {
    const lineDebit = decimalToScaled(line.debit);
    const lineCredit = decimalToScaled(line.credit);
    if ((lineDebit > ZERO) === (lineCredit > ZERO)) throw new Error('Each journal line must have exactly one side');
  }
}
