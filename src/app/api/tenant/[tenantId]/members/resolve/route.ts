import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const emailSchema = z.string().trim().email().max(320);

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const parsed = emailSchema.safeParse(new URL(req.url).searchParams.get('email'));
    if (!parsed.success) return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', parsed.data)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ userId: null });

    const { data: membership, error: membershipError } = await admin
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', profile.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    return NextResponse.json({ userId: membership?.user_id || null });
  } catch (error) {
    return routeErrorResponse(error, 'Workspace member could not be resolved', req);
  }
}
