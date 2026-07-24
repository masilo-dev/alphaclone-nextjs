import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { accountDeletionService } from '@/services/accountDeletionService';
import { canRemoveWorkspaceMember, isPlatformAdminRole, WORKSPACE_OWNER_ROLES } from '@/lib/platformAdmin';
import { ENV } from '@/config/env';

type Context = { params: Promise<{ tenantId: string }> };
const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];

async function deleteMembershipRows(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  userId: string
) {
  const { error } = await admin.from('tenant_users').delete().eq('tenant_id', tenantId).eq('user_id', userId);
  if (error) throw error;
  // Some deployments also keep tenant_members — best-effort cleanup.
  await admin.from('tenant_members').delete().eq('tenant_id', tenantId).eq('user_id', userId);
}

export async function GET(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId);
    const { data, error } = await admin
      .from('tenant_users')
      .select('tenant_id, user_id, role, joined_at, profiles(id,email,name,avatar)')
      .eq('tenant_id', tenantId)
      .order('joined_at');
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
    const body = z
      .object({
        userId: z.string().uuid(),
        role: z.enum(['owner', 'admin', 'tenant_admin', 'member', 'guest', 'client']),
      })
      .parse(await req.json());
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from('tenant_users')
      .update({ role: body.role })
      .eq('tenant_id', tenantId)
      .eq('user_id', body.userId);
    if (error) throw error;
    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'tenant_member_role_updated',
      payload: { actorUserId: user.id, targetUserId: body.userId, role: body.role },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Team role could not be updated', req);
  }
}

/**
 * Remove a member from this workspace.
 * With ?purge=true, also permanently deletes the platform account when they
 * belong only to this tenant (business-owner account deletion).
 */
export async function DELETE(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles);
    const userId = z.string().uuid().parse(req.nextUrl.searchParams.get('userId'));
    const purge = ['1', 'true', 'yes'].includes(
      String(req.nextUrl.searchParams.get('purge') || '').toLowerCase()
    );
    const admin = createSupabaseAdminClient();

    const { data: target } = await admin
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const { count: ownerCount } = await admin
      .from('tenant_users')
      .select('user_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('role', [...WORKSPACE_OWNER_ROLES]);

    const gate = canRemoveWorkspaceMember({
      targetRole: target.role,
      ownerCount: ownerCount || 0,
      isSelf: userId === user.id,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.reason }, { status: 409 });
    }

    if (!purge) {
      await deleteMembershipRows(admin, tenantId, userId);
      await admin.from('business_automation_events').insert({
        tenant_id: tenantId,
        event_type: 'tenant_member_removed',
        payload: { actorUserId: user.id, targetUserId: userId },
      });
      return NextResponse.json({
        success: true,
        removed: true,
        purged: false,
        message: 'Removed from workspace. Their platform account still exists.',
      });
    }

    // Hard delete: only when the target has no other workspace memberships,
    // is not a platform admin, and service role is available for auth.users.
    const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (isPlatformAdminRole(profile?.role)) {
      return NextResponse.json(
        { error: 'Platform administrators cannot be deleted from a workspace. Use Platform Admin → Users.' },
        { status: 403 }
      );
    }

    const { count: membershipCount } = await admin
      .from('tenant_users')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((membershipCount || 0) > 1) {
      return NextResponse.json(
        {
          error:
            'This user belongs to other workspaces. Remove them from this workspace only, or ask a platform admin to delete the account.',
        },
        { status: 409 }
      );
    }

    if (!ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error:
            'Account deletion requires SUPABASE_SERVICE_ROLE_KEY on the server. Member was not removed.',
        },
        { status: 503 }
      );
    }

    const result = await accountDeletionService.purgeUserAccount(userId, 'tenant_owner_delete');
    if (!result.success) {
      // Fall back to membership remove so the owner is not stuck with a bad member.
      await deleteMembershipRows(admin, tenantId, userId);
      return NextResponse.json(
        {
          error: result.error || 'Failed to delete account',
          removed: true,
          purged: false,
        },
        { status: 500 }
      );
    }

    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'tenant_member_purged',
      payload: { actorUserId: user.id, targetUserId: userId },
    });

    return NextResponse.json({
      success: true,
      removed: true,
      purged: true,
      message: 'User removed from workspace and permanently deleted.',
    });
  } catch (error) {
    return routeErrorResponse(error, 'Team member could not be removed', req);
  }
}
