import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

const ADDONS = {
  storage: { name: '10GB Extra Storage', quantity: 10240, priceCents: 500, billingCycle: 'one_time' },
  ai_requests: { name: '100 AI Requests', quantity: 100, priceCents: 1000, billingCycle: 'one_time' },
  video_minutes: { name: '500 Video Minutes', quantity: 500, priceCents: 1500, billingCycle: 'one_time' },
  team_members: { name: 'Additional Team Member', quantity: 1, priceCents: 500, billingCycle: 'monthly' },
  api_calls: { name: '10,000 API Calls', quantity: 10000, priceCents: 2000, billingCycle: 'one_time' },
} as const;

export async function POST(req: Request) {
  try {
    const { tenantId, addonType } = z.object({
      tenantId: z.string().uuid(), addonType: z.enum(['storage','ai_requests','video_minutes','team_members','api_calls']),
    }).parse(await req.json());
    const { user } = await requireTenantRole(tenantId, ['owner','admin','tenant_admin','super_admin']);
    const addon = ADDONS[addonType];
    const origin = new URL(req.url).origin;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, '');
    const recurring = addon.billingCycle === 'monthly';
    const session = await stripe.checkout.sessions.create({
      mode: recurring ? 'subscription' : 'payment',
      customer_email: user.email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: addon.priceCents,
          product_data: { name: addon.name },
          ...(recurring ? { recurring: { interval: 'month' as const } } : {}),
        },
      }],
      automatic_tax: { enabled: true },
      success_url: `${appUrl}/dashboard/business/settings?tab=billing&addon=success`,
      cancel_url: `${appUrl}/dashboard/business/settings?tab=billing&addon=cancelled`,
      metadata: { type: 'addon', tenantId, addonType, quantity: String(addon.quantity), priceCents: String(addon.priceCents), billingCycle: addon.billingCycle, addonName: addon.name },
      ...(recurring ? { subscription_data: { metadata: { type: 'addon', tenantId, addonType } } } : {}),
    }, { idempotencyKey: `addon-${tenantId}-${addonType}-${Math.floor(Date.now() / 3_600_000)}` });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return routeErrorResponse(error, 'Add-on checkout could not be started', req);
  }
}
