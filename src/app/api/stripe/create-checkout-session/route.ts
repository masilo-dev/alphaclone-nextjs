import { NextResponse } from 'next/server';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createPlatformStarterCheckout } from '@/lib/stripePlatformCheckout';
import { z } from 'zod';
export async function POST(req: Request) {
  try {
    const { planId, tenantId, successUrl, cancelUrl } = z.object({
      planId: z.enum(['free', 'starter', 'pro', 'enterprise']), tenantId: z.string().uuid(),
      successUrl: z.string().url().optional(), cancelUrl: z.string().url().optional(),
    }).parse(await req.json());
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);
    if (planId === 'free') return NextResponse.json({ error: 'Subscription unavailable: choose a paid subscription plan' }, { status: 503 });
    const session = await createPlatformStarterCheckout({ plan: planId, tenantId, userId: user.id, email: user.email,
      origin: new URL(req.url).origin, successUrl, cancelUrl });
    return NextResponse.json({ url: session.url });
  } catch (error) { return routeErrorResponse(error, 'Subscription checkout is unavailable', req); }
}
