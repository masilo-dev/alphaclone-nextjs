import 'server-only';
import { stripe } from '@/lib/stripe';

let verifiedAccount: string | undefined;
export async function verifyStripePlatformIdentity() {
  const expected = process.env.STRIPE_PLATFORM_ACCOUNT_ID;
  if (!expected) throw new Error('Stripe platform account configuration required');
  if (verifiedAccount === expected) return;
  const account = await stripe.accounts.retrieve();
  if (account.id !== expected) throw new Error('Stripe credentials belong to a different platform account');
  verifiedAccount = expected;
}
