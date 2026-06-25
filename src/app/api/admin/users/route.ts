import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';
import type { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['suspend', 'restore']),
});

export async function GET() {
  try {
    await requirePlatformSuperAdmin();
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from('profiles')
      .select('id, email, name, role, status, avatar, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const users = (data || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      email: p.email,
      name: p.name,
      role: p.role as UserRole,
      status: p.status || 'active',
      avatar: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(String(p.name || 'User'))}&background=random`,
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

    if (parsed.data.userId === actor.id) {
      return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const status = parsed.data.action === 'suspend' ? 'suspended' : 'active';

    const { error } = await admin
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.userId);

    if (error) throw error;
    return NextResponse.json({ success: true, status });
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

    const { error: tuError } = await admin.from('tenant_users').delete().eq('user_id', userId);
    if (tuError) throw tuError;

    const { error: pError } = await admin.from('profiles').delete().eq('id', userId);
    if (pError) throw pError;

    return NextResponse.json({ success: true });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
