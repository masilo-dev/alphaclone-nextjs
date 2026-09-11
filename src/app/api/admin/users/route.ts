import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ENV } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse, countActiveSuperAdmins } from '@/lib/apiAuth';
import { isPlatformAdminRole } from '@/lib/platformAdmin';
import { writeServerAuditLog } from '@/lib/security/serverAuditLog';
import { accountDeletionService } from '@/services/accountDeletionService';
import type { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['suspend', 'restore', 'soft_delete']),
  reason: z.string().optional(),
});

export async function GET() {
  try {
    await requirePlatformSuperAdmin();
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from('profiles')
      .select('id, email, name, role, account_status, avatar, created_at, company_name, business_type, last_login_at, plan, walkthrough_completed, tenant_id, onboarding_status, email_verified, password_change_required')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const users = (data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      email: p.email,
      name: p.name || (typeof p.email === 'string' ? p.email.split('@')[0] : 'User'),
      role: (p.role || 'user') as UserRole,
      status: p.account_status || 'active',
      account_status: p.account_status || 'active',
      company_name: p.company_name || null,
      business_type: p.business_type || null,
      created_at: p.created_at || null,
      last_login_at: p.last_login_at || null,
      plan: p.plan || 'pro',
      walkthrough_completed: !!p.walkthrough_completed,
      onboarding_status: p.onboarding_status || (p.walkthrough_completed ? 'completed' : 'pending'),
      email_verified: p.email_verified ?? true,
      password_change_required: !!p.password_change_required,
      tenant_id: p.tenant_id || null,
      avatar: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(String(p.name || p.email || 'User'))}&background=random`,
    }));

    return NextResponse.json({ success: true, users });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user: actor } = await requirePlatformSuperAdmin();
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { userId, action, reason } = parsed.data;

    if (userId === actor.id) {
      return NextResponse.json({ error: 'Cannot modify your own account status' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Fetch target user profile
    const { data: targetProfile, error: fetchErr } = await admin
      .from('profiles')
      .select('id, role, account_status, email, tenant_id')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !targetProfile) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Lockout Protection Check: if suspending or soft deleting a super admin
    if ((action === 'suspend' || action === 'soft_delete') && isPlatformAdminRole(targetProfile.role)) {
      const activeSuperAdminCount = await countActiveSuperAdmins(admin);
      if (activeSuperAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the final active Super Admin. Promote another administrator first.' },
          { status: 400 }
        );
      }
    }

    let accountStatus = 'active';
    let auditAction = 'USER_REACTIVATED';

    if (action === 'suspend') {
      accountStatus = 'suspended';
      auditAction = 'USER_SUSPENDED';
    } else if (action === 'soft_delete') {
      accountStatus = 'deleted';
      auditAction = 'USER_SOFT_DELETED';
    }

    const updatePayload: Record<string, unknown> = {
      account_status: accountStatus,
      updated_at: new Date().toISOString(),
    };

    if (action === 'soft_delete') {
      updatePayload.scheduled_deletion_at = new Date().toISOString();
    }

    const { error: updateErr } = await admin
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId);

    if (updateErr) throw updateErr;

    // Log privileged audit action
    await writeServerAuditLog({
      tenantId: targetProfile.tenant_id,
      actorUserId: actor.id,
      actorType: 'user',
      action: auditAction,
      resourceType: 'user_profile',
      resourceId: userId,
      success: true,
      metadata: {
        target_email: targetProfile.email,
        previous_status: targetProfile.account_status || 'active',
        new_status: accountStatus,
        reason: reason || null,
      },
    });

    return NextResponse.json({ success: true, status: accountStatus });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user: actor } = await requirePlatformSuperAdmin();
    const userId = req.nextUrl.searchParams.get('userId')?.trim();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (userId === actor.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, role, account_status, email, tenant_id')
      .eq('id', userId)
      .maybeSingle();

    if (targetProfile && isPlatformAdminRole(targetProfile.role)) {
      const activeSuperAdminCount = await countActiveSuperAdmins(admin);
      if (activeSuperAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the final active Super Admin. Promote another administrator first.' },
          { status: 400 }
        );
      }
    }

    if (!ENV.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error:
            'SUPABASE_SERVICE_ROLE_KEY is required to permanently delete platform users (auth.users).',
        },
        { status: 503 }
      );
    }

    const result = await accountDeletionService.purgeUserAccount(userId, 'admin_delete');
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete user' }, { status: 500 });
    }

    await writeServerAuditLog({
      tenantId: targetProfile?.tenant_id || null,
      actorUserId: actor.id,
      actorType: 'user',
      action: 'USER_PERMANENTLY_DELETED',
      resourceType: 'user_profile',
      resourceId: userId,
      success: true,
      metadata: {
        target_email: targetProfile?.email || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
