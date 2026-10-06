import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceOutstanding, invoicePaymentKey, assertInvoicePayment, assertStarterPrice, assertPlatformPrice } from '../../src/lib/stripePaymentPolicy.ts';
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

test('approved monthly plan prices are checked independently', () => {
 const base = { active: true, currency: 'usd', tax_behavior: 'exclusive', recurring: { interval: 'month', interval_count: 1 } };
 for (const [plan, amount] of [['starter',1500],['pro',4500],['enterprise',8500]]) {
  assertPlatformPrice(plan, { ...base, unit_amount: amount });
  assert.throws(() => assertPlatformPrice(plan, { ...base, unit_amount: amount + 100 }));
 }
});

 test('invoice currency amounts round-trip without silently charging 100x or losing precision', async () => {
 const { invoiceAmountToStripe, stripeAmountToInvoice } = await import('../../src/lib/stripeInvoiceCurrency.ts');
 for (const [currency, major, minor] of [['usd',10.25,1025],['pln',20.50,2050],['eur',7.99,799],['jpy',500,500],['krw',1000,1000],['isk',5,500],['ugx',500,50000]]) {
 assert.equal(invoiceAmountToStripe(major,currency),minor);
 assert.equal(stripeAmountToInvoice(minor,currency),major);
 }
 for (const [amount,currency] of [[1.5,'jpy'],[1.5,'isk'],[1.005,'usd'],[1,'kwd'],[0,'usd'],[Infinity,'usd']]) assert.throws(() => invoiceAmountToStripe(amount,currency));
 });

test('signed Connect checkout and intent events update one invoice receipt; replay and forged tenant cannot duplicate it', async () => {
  const { stripe } = await import('../../src/lib/stripe.ts');
  const { POST } = await import('../../src/app/api/stripe/webhook/route.ts');
  const envNames = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','STRIPE_PLATFORM_ACCOUNT_ID','STRIPE_CONNECT_WEBHOOK_SECRET'];
  const oldEnv = Object.fromEntries(envNames.map(k=>[k,process.env[k]]));
  const originalFetch = globalThis.fetch;
  const originalRetrieve = stripe.paymentIntents.retrieve;
  const originalAccount = stripe.accounts.retrieve;
  const events = new Map(); const receipts = new Set(); let writes = 0;
  process.env.SUPABASE_URL = 'https://invoice-fixture.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = `fixture.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.fixture`;
  process.env.STRIPE_PLATFORM_ACCOUNT_ID = 'acct_platform_fixture';
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'fixture_connect_signing_only';
  stripe.accounts.retrieve = async () => ({ id: 'acct_platform_fixture' });
  stripe.paymentIntents.retrieve = async (id,options) => {
    assert.equal(options.stripeAccount,'acct_a');
    return { id, ...payment, customer: null };
  };
  globalThis.fetch = async (url,options={}) => {
    const uri = new URL(String(url));
    assert.equal(uri.hostname,'invoice-fixture.invalid','test must never call a real backend');
    const table = uri.pathname.split('/').pop(); const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};
    const headers = new Headers(options.headers); const single = headers.get('accept')?.includes('vnd.pgrst.object');
    const respond = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
    if(table === 'stripe_webhook_events') {
      if(method === 'POST') {
        if(events.has(body.stripe_event_id)) return respond({code:'23505',message:'duplicate'},409);
        events.set(body.stripe_event_id,{id:body.stripe_event_id,status:'retrying'});return respond([{id:body.stripe_event_id}],201);
      }
      const id = uri.searchParams.get('stripe_event_id')?.replace('eq.','');
      const row = events.get(id);
      if(method === 'PATCH') {
        if(uri.searchParams.has('or') && row?.status === 'processed') return respond([]);
        if(row) Object.assign(row,body);return respond([]);
      }
      return respond(single ? row : [row]);
    }
    if(table === 'tenants') {
      const value = uri.searchParams.has('stripe_connect_id') ? {id:'tenant-a'} : {stripe_connect_id:'acct_a'};
      return respond(single ? value : [value]);
    }
    if(table === 'business_invoices') return respond(invoice);
    if(table === 'record_business_invoice_payment') {
      if(!receipts.has(body.p_idempotency_key)) {writes++;receipts.add(body.p_idempotency_key);}
      assert.equal(body.p_amount,15);return respond([invoice]);
    }
    if(table === 'stripe_payments' || table === 'audit_logs') return respond([]);
    throw new Error(`Unexpected fixture request ${method} ${table}`);
  };
  const deliver = async (id,type,object) => {
    const payload = JSON.stringify({id,object:'event',type,account:'acct_a',created:Math.floor(Date.now()/1000),livemode:false,data:{object}});
    const signature = stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_CONNECT_WEBHOOK_SECRET});
    return POST(new Request('https://example.test/api/stripe/webhook',{method:'POST',body:payload,headers:{'stripe-signature':signature}}));
  };
  try {
    const checkout = {id:'cs_fixture',payment_status:'paid',payment_intent:'pi_fixture',metadata:payment.metadata};
    assert.equal((await deliver('evt_checkout_fixture','checkout.session.completed',checkout)).status,200);
    assert.equal((await deliver('evt_intent_fixture','payment_intent.succeeded',{id:'pi_fixture',...payment})).status,200);
    assert.equal((await deliver('evt_checkout_fixture','checkout.session.completed',checkout)).status,200);
    assert.equal(writes,1);
    assert.equal((await deliver('evt_forged_fixture','checkout.session.completed',{...checkout,metadata:{...payment.metadata,tenantId:'tenant-b'}})).status,500);
    assert.equal(writes,1);
  } finally {
    globalThis.fetch=originalFetch;stripe.paymentIntents.retrieve=originalRetrieve;stripe.accounts.retrieve=originalAccount;
    for(const k of envNames) {if(oldEnv[k]===undefined) delete process.env[k];else process.env[k]=oldEnv[k];}
  }
});
