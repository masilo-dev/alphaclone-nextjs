/** Stripe charge units, not payout units. See https://docs.stripe.com/currencies. */
const ZERO_DECIMAL = new Set(['bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','vnd','vuv','xaf','xof','xpf']);
const WHOLE_ONLY = new Set(['isk','ugx']);
const THREE_DECIMAL = new Set(['bhd','jod','kwd','omr','tnd']);
function chargeScale(currency: string) {
  const code = currency.toLowerCase();
  if (!/^[a-z]{3}$/.test(code)) throw new Error('Invalid invoice currency');
  // Native invoices store two-decimal monetary totals. Do not silently truncate three-decimal invoices.
  if (THREE_DECIMAL.has(code)) throw new Error('Three-decimal invoice currencies require native precision support');
  return ZERO_DECIMAL.has(code) ? 1 : 100;
}
export function invoiceAmountToStripe(amount: number, currency: string) {
  const scale = chargeScale(currency);
  const units = amount * scale;
  const rounded = Math.round(units);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(rounded) || rounded <= 0 ||
      Math.abs(units - rounded) > 0.000001 || (WHOLE_ONLY.has(currency.toLowerCase()) && rounded % 100 !== 0)) {
    throw new Error('Invoice amount cannot be represented exactly in this currency');
  }
  return rounded;
}
export function stripeAmountToInvoice(units: number, currency: string) {
  const scale = chargeScale(currency);
  if (!Number.isSafeInteger(units) || units <= 0 || (WHOLE_ONLY.has(currency.toLowerCase()) && units % 100 !== 0)) {
    throw new Error('Invalid Stripe payment amount');
  }
  return units / scale;
}
