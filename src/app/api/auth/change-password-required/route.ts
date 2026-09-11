import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { writeServerAuditLog } from '@/lib/security/serverAuditLog';

export const dynamic = 'force-dynamic';

const passwordChangeSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const body = await req.json();
    const parsed = passwordChangeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    // 1. Update password in Supabase Auth
    const { error: authErr } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    });

    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    // 2. Clear password_change_required flag in profiles using service role
    const admin = createSupabaseAdminClient();
    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .update({
        password_change_required: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('tenant_id, email')
      .single();

    if (profErr) throw profErr;

    // 3. Write audit log
    await writeServerAuditLog({
      tenantId: profile?.tenant_id || null,
      actorUserId: user.id,
      actorType: 'user',
      action: 'PASSWORD_CHANGED',
      resourceType: 'user_profile',
      resourceId: user.id,
      success: true,
      metadata: {
        forced_reset: true,
        email: profile?.email || user.email,
      },
    });

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
