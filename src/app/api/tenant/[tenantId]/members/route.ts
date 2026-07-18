import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

type Context = { params: Promise<{ tenantId: string }> };
const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];

export async function GET(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('tenant_users').select('tenant_id, user_id, role, joined_at, profiles(id,email,name,avatar)').eq('tenant_id', tenantId).order('joined_at');
    if (error) throw error;
    const members = (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      user: row.profiles,
      profiles: undefined,
    }));
    return NextResponse.json({ members });
  } catch (error) {
    return routeErrorResponse(error, 'Team members could not be loaded', req);
  }
}

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles);
    const body = z.object({ userId: z.string().uuid(), role: z.enum(['owner', 'admin', 'tenant_admin', 'member', 'guest', 'client']) }).parse(await req.json());
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('tenant_users').update({ role: body.role }).eq('tenant_id', tenantId).eq('user_id', body.userId);
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'tenant_member_role_updated', payload: { actorUserId: user.id, targetUserId: body.userId, role: body.role } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Team role could not be updated', req);
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles);
    const userId = z.string().uuid().parse(req.nextUrl.searchParams.get('userId'));
    const admin = createSupabaseAdminClient();
    const { data: target } = await admin.from('tenant_users').select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (['owner', 'tenant_admin'].includes(target.role)) {
      const { count } = await admin.from('tenant_users').select('user_id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('role', ['owner', 'tenant_admin']);
      if ((count || 0) <= 1) return NextResponse.json({ error: 'The final workspace owner cannot be removed' }, { status: 409 });
    }
    const { error } = await admin.from('tenant_users').delete().eq('tenant_id', tenantId).eq('user_id', userId);
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'tenant_member_removed', payload: { actorUserId: user.id, targetUserId: userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Team member could not be removed', req);
  }
}
