import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse, countActiveSuperAdmins } from '@/lib/apiAuth';
import { isPlatformAdminRole, normalizePlatformRole } from '@/lib/platformAdmin';
import { writeServerAuditLog } from '@/lib/security/serverAuditLog';

export const dynamic = 'force-dynamic';

const roleSchema = z.object({
  userId: z.string().uuid(),
  newRole: z.enum(['user', 'admin', 'super_admin', 'tenant_admin', 'client']),
  confirmationGiven: z.boolean().optional(),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user: actor } = await requirePlatformSuperAdmin();
    const body = await req.json();
    const parsed = roleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { userId, newRole, confirmationGiven, reason } = parsed.data;
    const normalizedNewRole = normalizePlatformRole(newRole);

    const admin = createSupabaseAdminClient();

    // Fetch existing target profile
    const { data: targetProfile, error: fetchErr } = await admin
      .from('profiles')
      .select('id, email, role, tenant_id, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !targetProfile) {
      return NextResponse.json({ error: 'Target user profile not found' }, { status: 404 });
    }

    const previousRole = normalizePlatformRole(targetProfile.role);

    // Explicit confirmation check when promoting to super_admin
    if ((normalizedNewRole === 'super_admin' || normalizedNewRole === 'admin') && !confirmationGiven) {
      return NextResponse.json(
        {
          error: 'Explicit confirmation required before promoting user to platform Super Admin privileges.',
          requiresConfirmation: true,
        },
        { status: 400 }
      );
    }

    // Protection Against Final Super Admin Lockout
    if (isPlatformAdminRole(previousRole) && !isPlatformAdminRole(normalizedNewRole)) {
      const activeCount = await countActiveSuperAdmins(admin);
      if (activeCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the final active Super Admin. Promote another administrator first.' },
          { status: 400 }
        );
      }
    }

    // Update target profile role
    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        role: normalizedNewRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    // Write audit events
    if (normalizedNewRole === 'super_admin' && previousRole !== 'super_admin') {
      await writeServerAuditLog({
        tenantId: targetProfile.tenant_id,
        actorUserId: actor.id,
        actorType: 'user',
        action: 'SUPER_ADMIN_GRANTED',
        resourceType: 'user_profile',
        resourceId: userId,
        success: true,
        metadata: {
          target_email: targetProfile.email,
          previous_role: previousRole,
          new_role: normalizedNewRole,
          reason: reason || null,
        },
      });
    } else if (isPlatformAdminRole(previousRole) && !isPlatformAdminRole(normalizedNewRole)) {
      await writeServerAuditLog({
        tenantId: targetProfile.tenant_id,
        actorUserId: actor.id,
        actorType: 'user',
        action: 'SUPER_ADMIN_REVOKED',
        resourceType: 'user_profile',
        resourceId: userId,
        success: true,
        metadata: {
          target_email: targetProfile.email,
          previous_role: previousRole,
          new_role: normalizedNewRole,
          reason: reason || null,
        },
      });
    }

    await writeServerAuditLog({
      tenantId: targetProfile.tenant_id,
      actorUserId: actor.id,
      actorType: 'user',
      action: 'ROLE_CHANGED',
      resourceType: 'user_profile',
      resourceId: userId,
      success: true,
      metadata: {
        target_email: targetProfile.email,
        previous_role: previousRole,
        new_role: normalizedNewRole,
        reason: reason || null,
      },
    });

    return NextResponse.json({
      success: true,
      userId,
      previousRole,
      newRole: normalizedNewRole,
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
