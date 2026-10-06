import { PLATFORM_MONTHLY_USD, PlatformPlan } from '@/config/platformBilling';
/** Provider-independent payment checks, shared by HTTP routes and workers. */
export function invoiceOutstanding(invoice: { total: unknown; amount_paid?: unknown; status: string }) {
  if (!['sent', 'viewed', 'overdue', 'partially_paid'].includes(invoice.status)) throw new Error('Invoice is not payable');
  const amount = Number(invoice.total) - Number(invoice.amount_paid || 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invoice has no outstanding balance');
  return amount;
}

export function invoicePaymentKey(paymentIntentId: string) {
  return `stripe:${paymentIntentId}`;
}

export function assertInvoicePayment(invoice: { id: string; tenant_id: string; currency: string }, payment: {
  metadata: Record<string, string>; currency: string; status: string; amount_received: number;
}) {
  if (payment.metadata.type !== 'business_invoice' || payment.metadata.invoiceId !== invoice.id ||
      payment.metadata.tenantId !== invoice.tenant_id || payment.currency.toLowerCase() !== invoice.currency.toLowerCase()) {
    throw new Error('Payment does not belong to this invoice');
  }
  if (payment.status !== 'succeeded' || payment.amount_received <= 0) throw new Error('Payment has not succeeded');
}

export function assertPlatformPrice(plan: PlatformPlan, price: { active: boolean; currency: string; unit_amount: number | null;
  tax_behavior: string | null; recurring: { interval: string; interval_count: number } | null }) {
  if (!price.active || price.currency !== 'usd' || price.unit_amount !== PLATFORM_MONTHLY_USD[plan] * 100 ||
      price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1 || price.tax_behavior !== 'exclusive') {
    throw new Error(`${plan} price configuration invalid: expected USD ${PLATFORM_MONTHLY_USD[plan]} monthly before tax`);
  }
}

export function redactStripeEvent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactStripeEvent);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, /client_secret|secret_key|access_token|refresh_token|webhook_secret/i.test(key) ? '[REDACTED]' : redactStripeEvent(item)]));
  return value;
}

export function assertStarterPrice(price: Parameters<typeof assertPlatformPrice>[1]) { assertPlatformPrice('starter', price); }
