import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse, countActiveSuperAdmins } from '@/lib/apiAuth';
import { isPlatformAdminRole } from '@/lib/platformAdmin';
import { writeServerAuditLog } from '@/lib/security/serverAuditLog';
import { accountDeletionService } from '@/services/accountDeletionService';

export const dynamic = 'force-dynamic';

const deleteSchema = z.object({
  userId: z.string().uuid(),
  permanent: z.boolean().default(false),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user: actor } = await requirePlatformSuperAdmin();
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { userId, permanent, reason } = parsed.data;

    if (userId === actor.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Fetch target user profile
    const { data: targetProfile, error: fetchErr } = await admin
      .from('profiles')
      .select('id, email, role, tenant_id, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !targetProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Protection against deleting final active Super Admin
    if (isPlatformAdminRole(targetProfile.role)) {
      const activeSuperAdminCount = await countActiveSuperAdmins(admin);
      if (activeSuperAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the final active Super Admin. Promote another administrator first.' },
          { status: 400 }
        );
      }
    }

    if (!permanent) {
      // Soft Delete Workflow
      const { error: updateErr } = await admin
        .from('profiles')
        .update({
          account_status: 'deleted',
          scheduled_deletion_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateErr) throw updateErr;

      await writeServerAuditLog({
        tenantId: targetProfile.tenant_id,
        actorUserId: actor.id,
        actorType: 'user',
        action: 'USER_SOFT_DELETED',
        resourceType: 'user_profile',
        resourceId: userId,
        success: true,
        metadata: {
          target_email: targetProfile.email,
          reason: reason || null,
        },
      });

      return NextResponse.json({ success: true, status: 'deleted', softDeleted: true });
    }

    // Permanent Deletion Workflow — Requirement 43: Workspace Ownership Check
    // Check if target user owns any workspace as sole owner
    const { data: userTenants } = await admin
      .from('tenant_users')
      .select('tenant_id, role')
      .eq('user_id', userId)
      .in('role', ['owner', 'admin', 'tenant_admin']);

    if (userTenants && userTenants.length > 0) {
      for (const ut of userTenants) {
        // Check if there are other owners for this tenant
        const { data: coOwners } = await admin
          .from('tenant_users')
          .select('user_id')
          .eq('tenant_id', ut.tenant_id)
          .in('role', ['owner', 'admin', 'tenant_admin'])
          .neq('user_id', userId);

        if (!coOwners || coOwners.length === 0) {
          return NextResponse.json(
            {
              error: 'Cannot permanently delete user: workspace ownership must be transferred to another authorized user first or the workspace closed.',
              requiresOwnershipTransfer: true,
              tenantId: ut.tenant_id,
            },
            { status: 400 }
          );
        }
      }
    }

    // Execute purge via account deletion service
    const purgeResult = await accountDeletionService.purgeUserAccount(userId, 'admin_permanent_delete');
    if (!purgeResult.success) {
      return NextResponse.json({ error: purgeResult.error || 'Permanent user deletion failed' }, { status: 500 });
    }

    await writeServerAuditLog({
      tenantId: targetProfile.tenant_id,
      actorUserId: actor.id,
      actorType: 'user',
      action: 'USER_PERMANENTLY_DELETED',
      resourceType: 'user_profile',
      resourceId: userId,
      success: true,
      metadata: {
        target_email: targetProfile.email,
        reason: reason || null,
      },
    });

    return NextResponse.json({ success: true, permanentlyDeleted: true });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
