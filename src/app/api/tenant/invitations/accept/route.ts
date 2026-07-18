import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(req);
    const { token } = z.object({ token: z.string().uuid() }).parse(await req.json());
    if (!user.email) return NextResponse.json({ error: 'Your account has no verified email address' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: tenantId, error } = await admin.rpc('accept_tenant_invitation', {
      p_token: token,
      p_user_id: user.id,
      p_user_email: user.email,
    });
    if (error || !tenantId) throw error || new Error('Invitation could not be accepted');
    const { data: tenant } = await admin.from('tenants').select('id,name,slug').eq('id', tenantId).single();
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'tenant_invitation_accepted', payload: { userId: user.id } });
    return NextResponse.json({ success: true, tenant });
  } catch (error) {
    return routeErrorResponse(error, 'Invitation could not be accepted', req);
  }
}

