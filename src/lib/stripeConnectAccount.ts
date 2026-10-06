import { verifyStripePlatformIdentity } from '@/lib/stripePlatformIdentity';
import 'server-only';
import { stripe } from '@/lib/stripe';

export async function readConnectedAccount(accountId: string) {
  await verifyStripePlatformIdentity();
  const account = await stripe.v2.core.accounts.retrieve(accountId, { include: ['configuration.merchant', 'requirements'] });
  const capabilities = account.configuration?.merchant?.capabilities;
  return { account, id: account.id, closed: Boolean(account.closed),
    chargesEnabled: !account.closed && capabilities?.card_payments?.status === 'active',
    payoutsEnabled: !account.closed && capabilities?.stripe_balance?.payouts?.status === 'active',
    requirements: account.requirements?.entries || [], dashboard: account.dashboard };
}

export function isMissingStripeAccount(error: unknown) {
  const candidate = error as { code?: string; statusCode?: number };
  return candidate.code === 'resource_missing' || candidate.statusCode === 404;
}
