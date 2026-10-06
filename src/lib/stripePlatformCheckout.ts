import { PLATFORM_PRICE_ENV, PlatformPlan } from '@/config/platformBilling';
import { verifyStripePlatformIdentity } from '@/lib/stripePlatformIdentity';
import 'server-only';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { assertPlatformPrice } from '@/lib/stripePaymentPolicy';

/** Both subscription checkout routes execute the same platform-only command. */
export async function createPlatformStarterCheckout(input: {
  plan?: PlatformPlan; tenantId: string; userId: string; email?: string; origin: string; successUrl?: string; cancelUrl?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: membership, error: membershipError } = await admin.from('tenant_users').select('role')
    .eq('tenant_id', input.tenantId).eq('user_id', input.userId).maybeSingle();
  if (membershipError || !membership || !['owner', 'admin', 'tenant_admin', 'super_admin'].includes(membership.role)) {
    throw new Error('Workspace owner or administrator required');
  }
  await verifyStripePlatformIdentity();
  const plan = input.plan || 'starter';
  if (!Object.hasOwn(PLATFORM_PRICE_ENV, plan)) throw new Error('Unsupported subscription plan');
  const priceId = process.env[PLATFORM_PRICE_ENV[plan]];
  if (!priceId) throw new Error('Subscription unavailable: price configuration required');
  assertPlatformPrice(plan, await stripe.prices.retrieve(priceId));
  // Enabling automatic_tax alone collects nothing without registrations.
  const registrations = await stripe.tax.registrations.list({ status: 'active', limit: 1 });
  const settings = await stripe.tax.settings.retrieve();
  if (!registrations.data.length || settings.status !== 'active') throw new Error('Stripe Tax configuration requires active registrations');
  const { data: tenant, error } = await admin.from('tenants').select('stripe_customer_id,stripe_subscription_id').eq('id', input.tenantId).single();
  if (error || !tenant) throw error || new Error('Workspace not found');
  let customerId = tenant.stripe_customer_id;
  if (customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || customer.metadata.tenantId !== input.tenantId) throw new Error('Legacy billing customer requires migration');
  } else {
    const customer = await stripe.customers.create({ email: input.email, metadata: { tenantId: input.tenantId, type: 'platform_subscription' } },
      { idempotencyKey: `platform-customer:${input.tenantId}` });
    customerId = customer.id;
    const { error: updateError } = await admin.from('tenants').update({ stripe_customer_id: customerId }).eq('id', input.tenantId);
    if (updateError) throw updateError;
  }
  const active = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
  if (active.data.some((s: { status: string }) => !['canceled', 'incomplete_expired'].includes(s.status))) throw new Error('Subscription already exists; use billing settings');
  const safeUrl = (candidate: string | undefined, fallback: string) => candidate && new URL(candidate).origin === input.origin
    ? candidate : `${input.origin}${fallback}`;
  const metadata = { tenantId: input.tenantId, userId: input.userId, plan, type: 'platform_subscription' };
  return stripe.checkout.sessions.create({ mode: 'subscription', customer: customerId, customer_update: { address: 'auto', name: 'auto' },
    line_items: [{ price: priceId, quantity: 1 }], automatic_tax: { enabled: true }, tax_id_collection: { enabled: true },
    success_url: safeUrl(input.successUrl, '/dashboard?checkout=success'), cancel_url: safeUrl(input.cancelUrl, '/dashboard?checkout=cancelled'),
    metadata, subscription_data: { metadata },
  }, { idempotencyKey: `platform-checkout:${input.tenantId}:${priceId}:${Math.floor(Date.now() / 1800000)}` });
}
