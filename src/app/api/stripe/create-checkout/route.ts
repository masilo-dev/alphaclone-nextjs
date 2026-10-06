import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { createPlatformStarterCheckout } from '@/lib/stripePlatformCheckout';
import { requireTenantRole } from '@/lib/apiAuth';
import { isTurnstileEnforced, readClientIp, readTurnstileToken, verifyTurnstileToken } from '@/lib/verifyTurnstile';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { plan, tenantId } = body;
        const turnstileToken = readTurnstileToken(body);

        if (!plan || !tenantId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);
        const userId = user.id;

        if (isTurnstileEnforced()) {
            if (!turnstileToken) {
                return NextResponse.json({ error: 'Security verification required' }, { status: 400 });
            }
            const verified = await verifyTurnstileToken(turnstileToken, readClientIp(req));
            if (!verified) {
                return NextResponse.json({ error: 'Security verification failed. Please try again.' }, { status: 403 });
            }
        }

        if (plan !== 'starter') return NextResponse.json({ error: 'Subscription unavailable: only Starter is configured' }, { status: 503 });
        const session = await createPlatformStarterCheckout({ tenantId, userId, email: user.email, origin: new URL(req.url).origin });

        return NextResponse.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
        console.error('Stripe checkout error:', error);
        return clientErrorResponse(error, { request: req, scope: 'stripe/create-checkout' });
    }
}
