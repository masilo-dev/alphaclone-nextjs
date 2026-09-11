import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];

export async function POST(req: Request) {
  try {
    const { tenantId, returnUrl, refreshUrl } = z.object({
      tenantId: z.string().uuid(),
      returnUrl: z.string().url().optional(),
      refreshUrl: z.string().url().optional(),
    }).parse(await req.json());
    const { user } = await requireTenantRole(tenantId, adminRoles);
    const admin = createSupabaseAdminClient();
    const { data: tenant, error } = await admin.from('tenants')
      .select('stripe_connect_id, country_code, billing_email')
      .eq('id', tenantId).single();
    if (error || !tenant) throw error || new Error('Workspace not found');

    let accountId = tenant.stripe_connect_id ? String(tenant.stripe_connect_id) : '';
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: String(tenant.country_code || 'US').toUpperCase(),
        email: tenant.billing_email || user.email || undefined,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { tenantId, type: 'business_connect' },
      }, { idempotencyKey: `connect-account-${tenantId}` });
      accountId = account.id;
      const { error: updateError } = await admin.from('tenants')
        .update({ stripe_connect_id: accountId })
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
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: safeUrl(refreshUrl, `${fallback}&connect=refresh`),
      return_url: safeUrl(returnUrl, `${fallback}&connect=success`),
      type: 'account_onboarding',
    });
    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'stripe_connect_onboarding_started',
      payload: { actorUserId: user.id },
    });
    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    return routeErrorResponse(error, 'Stripe Connect onboarding could not be started', req);
  }
}
