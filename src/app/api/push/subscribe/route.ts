import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096).refine(value => value.startsWith('https://'), 'Push endpoint must use HTTPS'),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(20).max(512), auth: z.string().min(8).max(256) }),
});

export async function POST(req: NextRequest) {
  try {
    const input = z.object({ tenantId: z.string().uuid(), subscription: subscriptionSchema }).parse(await req.json());
    const { user, admin } = await requireTenantAccess(input.tenantId);
    const { data: existing, error: findError } = await admin.from('push_subscriptions').select('id')
      .eq('user_id', user.id).eq('endpoint', input.subscription.endpoint).maybeSingle();
    if (findError) throw findError;
    const values = { user_id: user.id, tenant_id: input.tenantId, subscription: input.subscription, endpoint: input.subscription.endpoint, keys: input.subscription.keys, updated_at: new Date().toISOString() };
    const result = existing
      ? await admin.from('push_subscriptions').update(values).eq('id', existing.id).eq('user_id', user.id)
      : await admin.from('push_subscriptions').insert(values);
    if (result.error) throw result.error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Push subscription could not be saved', req);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { tenantId, endpoint } = z.object({ tenantId: z.string().uuid(), endpoint: z.string().url().max(4096) }).parse(await req.json());
    const { user, admin } = await requireTenantAccess(tenantId);
    const { error } = await admin.from('push_subscriptions').delete()
      .eq('tenant_id', tenantId).eq('user_id', user.id).eq('endpoint', endpoint);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Push subscription could not be removed', req);
  }
=======
import { requireAuthenticatedUser } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
    try {
        const { supabase, user } = await requireAuthenticatedUser();

        // Get subscription object from body
        const subscription = await req.json();

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
        }

        // Resolve user's tenant_id from profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError || !profile?.tenant_id) {
            return NextResponse.json({ error: 'Tenant profile not found for user' }, { status: 400 });
        }

        const tenantId = profile.tenant_id;

        // Fetch user's existing push subscriptions to check if this endpoint already exists
        const { data: subs, error: fetchError } = await supabase
            .from('push_subscriptions')
            .select('id, subscription')
            .eq('user_id', user.id);

        if (fetchError) {
            throw fetchError;
        }

        const existingSub = subs?.find((s: any) => {
            // Compare endpoints to see if it is the same subscription
            const subData = typeof s.subscription === 'string' ? JSON.parse(s.subscription) : s.subscription;
            return subData?.endpoint === subscription.endpoint;
        });

        if (existingSub) {
            // Update the existing subscription
            const { error: updateError } = await supabase
                .from('push_subscriptions')
                .update({
                    subscription,
                    endpoint: subscription.endpoint,
                    keys: subscription.keys || subscription.toJSON?.().keys || null,
                    tenant_id: tenantId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingSub.id);

            if (updateError) throw updateError;
        } else {
            // Insert a new subscription
            const { error: insertError } = await supabase
                .from('push_subscriptions')
                .insert({
                    user_id: user.id,
                    tenant_id: tenantId,
                    subscription,
                    endpoint: subscription.endpoint,
                    keys: subscription.keys || subscription.toJSON?.().keys || null
                });

            if (insertError) throw insertError;
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[Push Subscribe API] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
>>>>>>> origin/main
}
