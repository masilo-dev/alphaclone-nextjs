import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';
import { writeServerAuditLog } from '@/lib/security/serverAuditLog';

export const dynamic = 'force-dynamic';

const transferSchema = z.object({
  tenantId: z.string().uuid(),
  currentOwnerUserId: z.string().uuid(),
  newOwnerUserId: z.string().uuid(),
  reason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user: actor } = await requirePlatformSuperAdmin();
    const body = await req.json();
    const parsed = transferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { tenantId, currentOwnerUserId, newOwnerUserId, reason } = parsed.data;

    if (currentOwnerUserId === newOwnerUserId) {
      return NextResponse.json({ error: 'New owner must be a different user' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Verify new owner profile exists and is active
    const { data: newOwnerProfile, error: newOwnerErr } = await admin
      .from('profiles')
      .select('id, email, account_status')
      .eq('id', newOwnerUserId)
      .maybeSingle();

    if (newOwnerErr || !newOwnerProfile) {
      return NextResponse.json({ error: 'New owner profile not found' }, { status: 404 });
    }

    if (newOwnerProfile.account_status === 'suspended' || newOwnerProfile.account_status === 'deleted') {
      return NextResponse.json({ error: 'New owner account must be active' }, { status: 400 });
    }

    // Ensure new owner is in tenant_users with 'owner' or 'tenant_admin' role
    const { error: upsertErr } = await admin
      .from('tenant_users')
      .upsert({
        tenant_id: tenantId,
        user_id: newOwnerUserId,
        role: 'tenant_admin',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,user_id' });

    if (upsertErr) throw upsertErr;

    // Update current owner role in tenant_users to member/staff
    await admin
      .from('tenant_users')
      .update({
        role: 'member',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', currentOwnerUserId);

    // Audit event
    await writeServerAuditLog({
      tenantId,
      actorUserId: actor.id,
      actorType: 'user',
      action: 'WORKSPACE_OWNERSHIP_TRANSFERRED',
      resourceType: 'tenant',
      resourceId: tenantId,
      success: true,
      metadata: {
        previous_owner_id: currentOwnerUserId,
        new_owner_id: newOwnerUserId,
        new_owner_email: newOwnerProfile.email,
        reason: reason || null,
      },
    });

    return NextResponse.json({
      success: true,
      tenantId,
      newOwnerUserId,
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
