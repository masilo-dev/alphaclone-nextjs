import { NextRequest, NextResponse } from 'next/server';
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
}
