import { verifyStripePlatformIdentity } from '@/lib/stripePlatformIdentity';
import { readConnectedAccount, isMissingStripeAccount } from '@/lib/stripeConnectAccount';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];

export async function POST(req: Request) {
  try {
    const { tenantId, returnUrl, refreshUrl, country, replaceAccount } = z.object({
      tenantId: z.string().uuid(),
      returnUrl: z.string().url().optional(),
      refreshUrl: z.string().url().optional(),
      country: z.string().regex(/^[A-Za-z]{2}$/, 'Business country must be a 2-letter ISO country code').transform((value) => value.toUpperCase()),
      replaceAccount: z.boolean().optional().default(false),
    }).parse(await req.json());
    const { user } = await requireTenantRole(tenantId, adminRoles);
    const admin = createSupabaseAdminClient();
    const { data: tenant, error } = await admin.from('tenants')
      .select('stripe_connect_id, name')
      .eq('id', tenantId).single();
    if (error || !tenant) throw error || new Error('Workspace not found');

    await verifyStripePlatformIdentity();
    let accountId = tenant.stripe_connect_id ? String(tenant.stripe_connect_id) : '';
    let legacyAccountId = '';
    if (accountId && replaceAccount) {
      legacyAccountId = accountId;
      accountId = '';
    }
    if (accountId) {
      try { const state = await readConnectedAccount(accountId); if (state.closed) { legacyAccountId = accountId; accountId = ''; } }
      catch (error) { if (!isMissingStripeAccount(error)) throw error; legacyAccountId = accountId; accountId = ''; }
    }
    if (!accountId) {
      if (!legacyAccountId) {
        const { data: lastDisconnect } = await admin.from('business_automation_events')
          .select('payload').eq('tenant_id', tenantId).eq('event_type', 'stripe_connect_disconnected')
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        legacyAccountId = String((lastDisconnect?.payload as any)?.accountId || '');
      }
      const account = await stripe.v2.core.accounts.create({
        dashboard: 'full', display_name: tenant.name, contact_email: user.email || undefined,
        identity: { country },
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
        defaults: { responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
        metadata: { tenantId, type: 'business_connect' },
      }, { idempotencyKey: `connect-account:${tenantId}:${legacyAccountId ? `after:${legacyAccountId}` : 'initial'}` });
      accountId = account.id;
      const { error: updateError } = await admin.from('tenants')
        .update({ stripe_connect_id: accountId, stripe_connect_onboarded: false })
        .eq('id', tenantId);
      if (updateError) throw updateError;
    }

    const requestOrigin = new URL(req.url).origin;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || requestOrigin).replace(/\/$/, '');
    const safeUrl = (candidate: string | undefined, fallback: string) => {
      if (!candidate) return fallback;
      try { return new URL(candidate).origin === requestOrigin ? candidate : fallback; } catch { return fallback; }
    };
    const fallback = `${appUrl}/dashboard/business/settings?tab=integrations`;
    const accountLink = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: { type: 'account_onboarding', account_onboarding: {
        refresh_url: safeUrl(refreshUrl, `${fallback}&connect=refresh`),
        return_url: safeUrl(returnUrl, `${fallback}&connect=success`),
      } },
    });
    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'stripe_connect_onboarding_started',
      payload: { actorUserId: user.id, accountId, legacyAccountId: legacyAccountId || null },
    });
    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    return routeErrorResponse(error, 'Stripe Connect onboarding could not be started', req);
  }
}
