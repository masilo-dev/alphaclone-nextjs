import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceOutstanding, invoicePaymentKey, assertInvoicePayment, assertStarterPrice } from '../../src/lib/stripePaymentPolicy.ts';
const validPrice = { active: true, currency: 'usd', unit_amount: 1500, recurring: { interval: 'month', interval_count: 1 }, tax_behavior: 'exclusive' };
test('Starter must be exactly USD 15 monthly with exclusive tax', () => {
  assert.doesNotThrow(() => assertStarterPrice(validPrice));
  for (const change of [{ unit_amount: 2000 }, { currency: 'eur' }, { active: false }, { tax_behavior: 'inclusive' }, { recurring: { interval: 'year', interval_count: 1 } }, { recurring: { interval: 'month', interval_count: 2 } }]) {
    assert.throws(() => assertStarterPrice({ ...validPrice, ...change }));
  }
});
test('payable amount uses balance and never resets fully paid invoices to total', () => {
  assert.equal(invoiceOutstanding({ total: '100', amount_paid: '25', status: 'sent' }), 75);
  for (const invoice of [{ total: 100, amount_paid: 100, status: 'sent' }, { total: 100, status: 'paid' }, { total: 100, status: 'void' }, { total: 'bad', status: 'sent' }]) assert.throws(() => invoiceOutstanding(invoice));
});
const invoice = { id: 'invoice-a', tenant_id: 'tenant-a', currency: 'USD' };
const payment = { status: 'succeeded', currency: 'usd', amount_received: 1500, metadata: { type: 'business_invoice', invoiceId: 'invoice-a', tenantId: 'tenant-a' } };
test('reconciliation rejects unrelated invoices, tenants, currencies and unconfirmed money', () => {
  assert.doesNotThrow(() => assertInvoicePayment(invoice, payment));
  for (const change of [{ status: 'processing' }, { amount_received: 0 }, { currency: 'eur' }, { metadata: { ...payment.metadata, invoiceId: 'invoice-b' } }, { metadata: { ...payment.metadata, tenantId: 'tenant-b' } }, { metadata: { ...payment.metadata, type: 'platform_subscription' } }]) assert.throws(() => assertInvoicePayment(invoice, { ...payment, ...change }));
});
test('Checkout, PaymentIntent webhook and UI reconciliation share one receipt key', () => {
  assert.equal(invoicePaymentKey('pi_paid'), 'stripe:pi_paid');
});
test('webhook audit payload never persists client secrets or tokens', async () => {
  const { redactStripeEvent } = await import('../../src/lib/stripePaymentPolicy.ts');
  assert.deepEqual(redactStripeEvent({ id: 'evt_1', data: { object: { client_secret: 'private', access_token: 'token', amount: 1500 } } }),
    { id: 'evt_1', data: { object: { client_secret: '[REDACTED]', access_token: '[REDACTED]', amount: 1500 } } });
});
test('unsigned and invalid webhook signatures are rejected before database access', async () => {
  const oldKey = process.env.STRIPE_SECRET_KEY;
  const oldSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_local_fixture_only';
  process.env.STRIPE_WEBHOOK_SECRET = 'local_signing_fixture';
  try {
    const { POST } = await import('../../src/app/api/stripe/webhook/route.ts');
    for (const signature of ['', 'invalid']) {
      const result = await POST(new Request('https://example.test/api/stripe/webhook', { method: 'POST', body: '{}', headers: { 'stripe-signature': signature } }));
      assert.equal(result.status, 400);
    }
  } finally {
    if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = oldKey;
    if (oldSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
  }
});
test('missing Connect and cross-tenant mappings never reach a payment API', async () => {
  const { requireInvoiceStripeAccount, reconcileInvoiceStripePayment } = await import('../../src/lib/stripeInvoiceExecution.ts');
  function tenantDatabase(connection) {
    const chain = { select() { return this; }, eq() { return this; }, async single() { return { data: { stripe_connect_id: connection }, error: null }; } };
    return { from() { return chain; } };
  }
  await assert.rejects(requireInvoiceStripeAccount(tenantDatabase(null), 'tenant-a'), /finish connecting Stripe/);
  await assert.rejects(reconcileInvoiceStripePayment(tenantDatabase('acct_a'), 'tenant-a', 'invoice-a', 'pi_1', 'acct_b'), /does not belong/);
});
test('successful invoice reconciliation uses connected account and replays one ledger key', async () => {
  const { stripe } = await import('../../src/lib/stripe.ts');
  const { reconcileInvoiceStripePayment } = await import('../../src/lib/stripeInvoiceExecution.ts');
  const original = stripe.paymentIntents.retrieve;
  const requests = [];
  stripe.paymentIntents.retrieve = async (id, options) => {
    requests.push(options);
    return { id, ...payment, customer: null };
  };
  const keys = new Set();
  let recorded = 0;
  const admin = {
    from(table) {
      const chain = { select() { return this; }, eq() { return this; },
        async single() { return { data: table === 'tenants' ? { stripe_connect_id: 'acct_a' } : invoice, error: null }; },
        async upsert(row) { assert.equal(row.metadata.stripe_account_id, 'acct_a'); return { error: null }; } };
      return chain;
    },
    async rpc(name, args) {
      assert.equal(name, 'record_business_invoice_payment');
      if (!keys.has(args.p_idempotency_key)) { recorded++; keys.add(args.p_idempotency_key); }
      return { data: [invoice], error: null };
    },
  };
  try {
    await reconcileInvoiceStripePayment(admin, 'tenant-a', 'invoice-a', 'pi_one', 'acct_a');
    await reconcileInvoiceStripePayment(admin, 'tenant-a', 'invoice-a', 'pi_one', 'acct_a');
    assert.equal(recorded, 1);
    assert.deepEqual([...keys], ['stripe:pi_one']);
    assert.deepEqual(requests, [{ stripeAccount: 'acct_a' }, { stripeAccount: 'acct_a' }]);
  } finally { stripe.paymentIntents.retrieve = original; }
});
test('tenant customer subscription requests cannot use platform or another tenant scope', async () => {
  const { tenantSubscriptionRequestOptions } = await import('../../src/lib/stripeTenantSubscriptionScope.ts');
  const mapping = { tenantId: 'tenant-a', clientId: 'client-a', stripeAccountId: 'acct_a', stripeCustomerId: 'cus_a', stripeSubscriptionId: 'sub_a', status: 'active', priceId: 'price_a' };
  assert.deepEqual(tenantSubscriptionRequestOptions(mapping, { tenantId: 'tenant-a', stripeAccountId: 'acct_a' }), { stripeAccount: 'acct_a' });
  assert.throws(() => tenantSubscriptionRequestOptions(mapping, { tenantId: 'tenant-b', stripeAccountId: 'acct_a' }));
  assert.throws(() => tenantSubscriptionRequestOptions(mapping, { tenantId: 'tenant-a', stripeAccountId: 'acct_platform' }));
});
